'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import QuestionBuilder from './components/QuestionBuilder';
import PipelineStats from './components/PipelineStats';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'idle' | 'uploading';

interface BiologyBlock {
    type: string;
    content: string;
    index: number;
}

interface BiologyDiagram {
    url: string;
    alt: string;
    block_index: number;
}

interface BiologyResult {
    type: 'biology_content';
    full_text: string;
    blocks: BiologyBlock[];
    diagrams: BiologyDiagram[];
    topics?: string[];
    metadata: {
        chapter?: string;
        topic?: string;
        book_id: string;
        page_name: string;
    };
}

// --- Reusable MathText Component ---
const MathText = memo(function MathText({ text }: { text: string }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            try {
                renderMathInElement(containerRef.current, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true },
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.error("KaTeX render error:", e);
            }
        }
    }, [text]);

    if (!text) return null;

    let processedText = text;
    if (!text.includes('$') && text.includes('\\')) {
        processedText = text.replace(/(\\[a-zA-Z]+(?:\{[^}]*\})?)/g, '$$1$');
    }

    return (
        <div ref={containerRef} style={{ display: 'inline-block', width: '100%', wordBreak: 'break-word' }}>
            {processedText}
        </div>
    );
});

// --- Log Viewer Component ---
const LogViewer = memo(function LogViewer({ jobId }: { jobId: string }) {
    const [logs, setLogs] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!jobId) return;
        setLogs(''); // Clear logs on new job
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/log/${jobId}`);
                if (res.ok) {
                    const text = await res.text();
                    setLogs(text);
                }
            } catch (e) {
                console.error("Log fetch failed", e);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [jobId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="terminal-container">
            <div className="terminal-header">
                <div className="terminal-controls">
                    <span className="control c-close"></span>
                    <span className="control c-min"></span>
                    <span className="control c-max"></span>
                </div>
                <div className="terminal-title">runtime_extraction.log — datalab-engine-01</div>
            </div>
            <div className="terminal-body" ref={scrollRef}>
                <pre className="terminal-text">
                    {logs || '> Initializing biological context...\n> Connecting to extraction node...\n> Waiting for AI log stream...'}
                    <span className="terminal-cursor">_</span>
                </pre>
            </div>
        </div>
    );
});

// --- Content Block Renderer ---
const ContentBlock = memo(function ContentBlock({ 
    block, 
    diagrams, 
    isSelected, 
    onToggle 
}: { 
    block: BiologyBlock, 
    diagrams: BiologyDiagram[],
    isSelected: boolean,
    onToggle: (idx: number) => void
}) {
    const blockDiagrams = diagrams.filter(d => d.block_index === block.index);

    return (
        <div className={`bio-content-card ${isSelected ? 'selected' : ''}`} onClick={() => onToggle(block.index)}>
            <div className="card-selection-area">
                <input type="checkbox" checked={isSelected} readOnly />
            </div>
            
            <div className="card-flag-type">{block.type}</div>
            
            {['Heading', 'SectionHeader'].includes(block.type) ? (
                <div className="bio-h3">
                    <MathText text={block.content} />
                </div>
            ) : block.type === 'Header' ? (
                 <div className="bio-h2">
                    <MathText text={block.content} />
                </div>
            ) : (
                <div className="bio-para">
                    <MathText text={block.content} />
                </div>
            )}
            
            {blockDiagrams.length > 0 && (
                <div className="bio-diagram-stack">
                    {blockDiagrams.map((diag, i) => (
                        <div key={i} className="bio-img-frame">
                            <div className="img-container">
                                <img src={diag.url} alt={diag.alt} loading="lazy" />
                            </div>
                            {diag.alt && diag.alt !== 'diagram' && (
                                <div className="img-caption">
                                    <span className="caption-icon">📷</span>
                                    {diag.alt}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default function NEETBiologyPipeline() {
    const [activeTab, setActiveTab] = useState<'datalab' | 'builder' | 'stats'>('datalab');

    const [file, setFile] = useState<File | null>(null);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [bookId, setBookId] = useState<string | null>(null);
    const [chapterName, setChapterName] = useState('');
    const [topicName, setTopicName] = useState('');
    const [bookPages, setBookPages] = useState<any[]>([]);
    const [currentBookPageIndex, setCurrentBookPageIndex] = useState(0);
    const [status, setStatus] = useState<JobStatus>('idle');
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [result, setResult] = useState<BiologyResult | null>(null);
    const [viewMode, setViewMode] = useState<'content' | 'raw'>('content');
    const [taxonomyList, setTaxonomyList] = useState<string[]>([]);
    const [pyqChapter, setPyqChapter] = useState('');

    const currentPage = bookPages[currentBookPageIndex];
    const pollingIntervalRef = useRef<any>(null);

    // Fetch taxonomy list
    useEffect(() => {
        const fetchTaxonomy = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/taxonomy-list`);
                if (res.ok) {
                    const data = await res.json();
                    setTaxonomyList(Object.keys(data) || []);
                }
            } catch (e) {
                console.error("Failed to fetch taxonomy:", e);
            }
        };
        fetchTaxonomy();
    }, []);

    // Fetch pages when bookId is set
    const fetchBookPages = useCallback(async (bid: string) => {
        if (!bid) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${bid}/pages`);
            const data = await res.json();
            if (data && data.pages) {
                setBookPages(data.pages.map((p: any) => ({
                    name: p.page_name,
                    url: `${API_BASE_URL}${p.url}`,
                    actionStatus: p.status || null
                })));
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        if (bookId) {
            fetchBookPages(bookId);
            const interval = setInterval(() => fetchBookPages(bookId), 5000);
            return () => clearInterval(interval);
        }
    }, [bookId, fetchBookPages]);

    // Check for existing result when page changes
    useEffect(() => {
        if (!bookId || !currentPage?.name) return;

        setResult(null);
        setStatus('idle');
        setMessage('');
        setError(null);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        const checkResult = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${bookId}/${currentPage.name}/result`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.type === 'biology_content') {
                        setResult(data);
                        setStatus('completed');
                        setMessage('Data retrieved from server repository.');
                        setChapterName(data.metadata.chapter || '');
                        // setTopicName(data.metadata.topic || ''); // User wants to remove manual entry
                        // Auto select all blocks by default
                        setSelectedIndices(data.blocks.map((b: any) => b.index));
                    }
                }
            } catch (err) { }
        };
        checkResult();
    }, [bookId, currentPage?.name]);

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setMessage('Establishing data stream and extracting page segments...');
        setError(null);
        setResult(null);
        setCurrentBookPageIndex(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail?.message || 'Transmission failed');

            setBookId(data.book_id);
            setStatus('idle');
            fetchBookPages(data.book_id);
        } catch (e: any) {
            setError(e.message);
            setStatus('failed');
        }
    };

    const handleMarkPage = async (pageName: string, action: 'skip' | 'process') => {
        if (!bookId) return;
        try {
            await fetch(`${API_BASE_URL}/api/v1/biology/book/${bookId}/mark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_name: pageName, action })
            });
            setBookPages(prev => prev.map(p => p.name === pageName ? { ...p, actionStatus: action } : p));
        } catch (err) { console.error("Mark failed", err); }
    };

    const startPolling = (jobId: string) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/status/${jobId}`);
                if (!res.ok) throw new Error("Connection lost");
                const data = await res.json();

                if (data.status === 'completed') {
                    setResult(data.result);
                    setStatus('completed');
                    setMessage('Biological Intelligence extraction successful.');
                    setSelectedIndices(data.result.blocks.map((b: any) => b.index));
                    clearInterval(pollingIntervalRef.current);
                } else if (data.status === 'failed') {
                    setError(data.error || "Neural extraction failed");
                    setStatus('failed');
                    clearInterval(pollingIntervalRef.current);
                }
            } catch (e: any) {
                console.error(e);
            }
        };
        pollingIntervalRef.current = setInterval(poll, 3000);
        poll();
    };

    const handleProcessPage = async (pageName: string) => {
        if (!bookId || !chapterName) {
            alert("Please classify the Chapter in the right panel before processing.");
            return;
        }
        
        // 1. Mark the page as 'process' first (moves to process folder)
        await handleMarkPage(pageName, 'process');

        setStatus('processing');
        setMessage(`AI Agent is classifying and extracting biological clusters...`);
        setResult(null);
        setError(null);

        const formData = new URLSearchParams();
        formData.append('chapter_name', chapterName);
        formData.append('topic_name', topicName);

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/biology/book/${bookId}/${pageName}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Processing aborted');
            if (data.job_id) {
                setCurrentJobId(data.job_id);
                startPolling(data.job_id);
            }
        } catch (err: any) {
            setError(err.message);
            setStatus('failed');
        }
    };

    const handleSaveContent = async () => {
        if (!bookId || !currentPage || !result || selectedIndices.length === 0) return;

        setIsSaving(true);
        const selectedBlocks = result.blocks.filter(b => selectedIndices.includes(b.index));

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${bookId}/${currentPage.name}/save-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selected_blocks: selectedBlocks,
                    chapter_name: chapterName,
                    topic_name: topicName,
                    pyq_chapter: pyqChapter,
                    topics: result.topics
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Save operation failed');
            alert("Content successfully committed to database repository.");
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSelection = useCallback((idx: number) => {
        setSelectedIndices(prev => 
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    }, []);

    const downloadJson = () => {
        if (!result) return;
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `biology_result_${currentPage?.name || 'export'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyText = () => {
        if (!result) return;
        navigator.clipboard.writeText(result.full_text);
        alert("Text copied to clipboard!");
    };

    return (
        <main className="bio-pipeline-root">
            {/* BACKGROUND ANIMATION */}
            <div className="bio-orb orb-1"></div>
            <div className="bio-orb orb-2"></div>
            
            <header className="bio-masthead">
                <div className="masthead-content">
                    <div className="bio-logo-area">
                        <Link href="/" className="bio-home-btn">← DASHBOARD</Link>
                        <h1>NEET <span className="text-highlight">Biology</span> Datalab</h1>
                        <p>High-Precision AI Extraction Pipeline</p>
                    </div>

                    <div className="bio-main-tabs">
                        <button className={activeTab === 'datalab' ? 'active' : ''} onClick={() => setActiveTab('datalab')}>
                            <span className="tab-icon">🧪</span> DATALAB EXTRACTION
                        </button>
                        <button className={activeTab === 'builder' ? 'active' : ''} onClick={() => setActiveTab('builder')}>
                            <span className="tab-icon">🧬</span> QUESTION BUILDER
                        </button>
                        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
                            <span className="tab-icon">📊</span> PIPELINE ANALYTICS
                        </button>
                    </div>


                    {bookId && activeTab === 'datalab' && (
                        <div className="masthead-meta">
                            <div className="meta-pill">
                                <span className="glow-indic"></span>
                                {bookId}
                            </div>
                            <button className="bio-reset-btn" onClick={() => { setBookId(null); setBookPages([]); setResult(null); }}>
                                SWITCH BOOK
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <section className="bio-viewport">
                {activeTab === 'builder' ? (
                    <QuestionBuilder />
                ) : activeTab === 'stats' ? (
                    <PipelineStats />
                ) : !bookId ? (

                    <div className="bio-init-card">
                        <div className="init-icon-frame">
                            <div className="init-icon">🧬</div>
                            <div className="init-rings">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                        <h2>Biological Protocol Initiation</h2>
                        <p>Deploy the extraction engine by providing a source PDF document.</p>
                        
                        <div className="bio-dropzone">
                            <input
                                type="file"
                                id="pdf-stream"
                                accept="application/pdf"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                                className="bio-hidden"
                            />
                            <label htmlFor="pdf-stream" className="bio-upload-surface">
                                <div className="up-icon">📂</div>
                                <div className="up-text">
                                    {file ? file.name : "Select Document Stream"}
                                </div>
                                <div className="up-hint">NEET NCERT / Competitive Reference Files</div>
                            </label>
                        </div>

                        <button
                            className="bio-submit-btn"
                            onClick={handleUpload}
                            disabled={status === 'uploading' || !file}
                        >
                            {status === 'uploading' ? (
                                <span className="btn-load-state">
                                    <div className="pulse-loader"></div>
                                    UPLOADING...
                                </span>
                            ) : "DECODE SOURCE DOCUMENT"}
                        </button>

                        {error && <div className="bio-error">{error}</div>}
                    </div>
                ) : (
                    <div className="bio-workspace">
                        {/* LEFT: SOURCE VIEW */}
                        <div className="bio-side-panel source-side">
                            <div className="side-header">
                                <h3>SOURCE VISUALIZER</h3>
                                <div className="side-badge">{currentBookPageIndex + 1} / {bookPages.length}</div>
                            </div>

                            <div className="side-body visual-body">
                                {!currentPage ? (
                                    <div className="bio-shimmer-box">
                                        <div className="bio-spinner"></div>
                                        <p>SYNCHRONIZING PAGES...</p>
                                    </div>
                                ) : (
                                    <div className="source-image-stage">
                                        {currentPage.actionStatus && (
                                            <div className={`bio-status-badge badge-${currentPage.actionStatus}`}>
                                                {currentPage.actionStatus.toUpperCase()}
                                            </div>
                                        )}
                                        <img src={currentPage.url} alt="Source Segment" />
                                    </div>
                                )}
                            </div>

                            <div className="side-footer">
                                <div className="bio-step-nav">
                                    <button onClick={() => setCurrentBookPageIndex(p => p - 1)} disabled={currentBookPageIndex === 0}>PREVIOUS</button>
                                    <button onClick={() => setCurrentBookPageIndex(p => p + 1)} disabled={!bookPages.length || currentBookPageIndex >= bookPages.length - 1}>NEXT</button>
                                </div>
                                {currentPage && (
                                    <div className="bio-binary-actions">
                                        <button className="bio-skip-btn" onClick={() => handleMarkPage(currentPage.name, 'skip')}>SKIP PAGE</button>
                                        <button className="bio-proc-trigger" onClick={() => handleProcessPage(currentPage.name)} disabled={status === 'processing'}>
                                            {status === 'processing' && currentJobId ? 'ANALYZING...' : 'PROCESS PAGE AI'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: AI OUTPUT */}
                        <div className="bio-side-panel output-side">
                            <div className="side-header">
                                <h3>DATALAB INTELLIGENCE</h3>
                                <div className="bio-view-tabs">
                                    <button onClick={() => setViewMode('content')} className={viewMode === 'content' ? 'active' : ''}>STRUCTURED</button>
                                    <button onClick={() => setViewMode('raw')} className={viewMode === 'raw' ? 'active' : ''}>RAW</button>
                                </div>
                            </div>

                            <div className="bio-form-config">
                                <div className="bio-input-group" style={{ gridColumn: 'span 2' }}>
                                    <label>EMULATE PYQ DIFFICULTY (CHAPTER)</label>
                                    <select 
                                        value={pyqChapter} 
                                        onChange={e => setPyqChapter(e.target.value)}
                                        style={{ width: '100%', background: '#020617', border: '1px solid #1e293b', padding: '12px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px' }}
                                    >
                                        <option value="">-- Select PYQ Chapter --</option>
                                        {taxonomyList.map(chap => (
                                            <option key={chap} value={chap}>{chap}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bio-input-group">
                                    <label>GENUS / CHAPTER</label>
                                    <input placeholder="e.g. Biological Classification" value={chapterName} onChange={e => setChapterName(e.target.value)} />
                                </div>
                            </div>

                            <button 
                                className="bio-execute-btn"
                                onClick={() => currentPage && handleProcessPage(currentPage.name)}
                                disabled={status === 'processing' || !chapterName || !currentPage}
                            >
                                {status === 'processing' ? 'EXTRACTING BIOLOGY...' : (result ? 'RETRAIN AI ON PAGE' : 'EXECUTE AI CLASSIFICATION')}
                            </button>

                            <div className="bio-results-scroller">
                                {status === 'processing' && currentJobId && (
                                    <div className="bio-runtime-container">
                                        <div className="runtime-pulse">
                                            <div className="wave"></div>
                                            <span>AI AGENT ACTIVE...</span>
                                        </div>
                                        <LogViewer jobId={currentJobId} />
                                    </div>
                                )}

                                {result && (
                                    <div className="bio-result-actions">
                                        <button onClick={copyText}>📋 COPY TEXT</button>
                                        <button onClick={downloadJson}>📥 DOWNLOAD JSON</button>
                                        <button 
                                            className="bio-save-commit-btn" 
                                            onClick={handleSaveContent}
                                            disabled={isSaving || selectedIndices.length === 0}
                                        >
                                            {isSaving ? 'COMMITTING...' : '🧬 SAVE TO DATABASE'}
                                        </button>
                                    </div>
                                )}

                                {result && (
                                    <div className="bio-selection-header">
                                        <div className="selection-count">{selectedIndices.length} / {result.blocks.length} BLOCKS SELECTED</div>
                                        <button onClick={() => setSelectedIndices(selectedIndices.length === result.blocks.length ? [] : result.blocks.map(b => b.index))}>
                                            {selectedIndices.length === result.blocks.length ? 'DESELECT ALL' : 'SELECT ALL'}
                                        </button>
                                    </div>
                                )}

                                {result && viewMode === 'content' && (
                                    <div className="bio-content-view">
                                        {result.blocks.map((block, idx) => (
                                            <ContentBlock 
                                                key={idx} 
                                                block={block} 
                                                diagrams={result.diagrams} 
                                                isSelected={selectedIndices.includes(block.index)}
                                                onToggle={toggleSelection}
                                            />
                                        ))}
                                    </div>
                                )}

                                {result && viewMode === 'raw' && (
                                    <div className="bio-raw-box">
                                        {result.full_text}
                                    </div>
                                )}

                                {!result && status === 'idle' && (
                                    <div className="bio-empty-prompt">
                                        <div className="prompt-svg">⌬</div>
                                        <p>AWAITING EXECUTION COMMAND</p>
                                        <small>CLASSIFY THE CHAPTER TO BEGIN NEURAL EXTRACTION</small>
                                    </div>
                                )}

                                {status === 'failed' && (
                                    <div className="bio-failure-alert">
                                        <div className="alert-top">EXTRACTION ABORTED</div>
                                        <p>{error}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <style jsx global>{`
                :root {
                    --bio-green: #10b981;
                    --bio-green-soft: rgba(16, 185, 129, 0.1);
                    --bio-green-glow: rgba(16, 185, 129, 0.3);
                    --dark-slate: #0f172a;
                    --glass-1: rgba(255, 255, 255, 0.05);
                    --glass-2: rgba(255, 255, 255, 0.08);
                }

                .bio-pipeline-root {
                    background-color: #020617;
                    color: #f8fafc;
                    font-family: 'Inter', system-ui, sans-serif;
                    height: 100vh;
                    overflow: hidden;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }

                /* BACKGROUND ORBS */
                .bio-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                    z-index: 0;
                    opacity: 0.15;
                }
                .orb-1 { top: -100px; right: -100px; width: 400px; height: 400px; background: var(--bio-green); }
                .orb-2 { bottom: -100px; left: -100px; width: 300px; height: 300px; background: #6366f1; }

                /* MASTHEAD */
                .bio-masthead {
                    height: 100px;
                    border-bottom: 1px solid var(--glass-2);
                    background: rgba(15, 23, 42, 0.8);
                    backdrop-filter: blur(20px);
                    z-index: 10;
                    padding: 0 40px;
                    display: flex;
                    align-items: center;
                }
                .masthead-content {
                    width: 100%;
                    max-width: 1600px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .bio-logo-area h1 {
                    font-size: 24px;
                    margin: 2px 0;
                    font-weight: 900;
                    letter-spacing: -0.5px;
                }
                .text-highlight { color: var(--bio-green); }
                .bio-logo-area p { color: #94a3b8; font-size: 13px; font-weight: 500; }
                .bio-home-btn { font-size: 11px; font-weight: 800; color: #475569; text-decoration: none; display: block; margin-bottom: 4px; }
                .bio-home-btn:hover { color: #fff; }

                .bio-main-tabs { display: flex; gap: 8px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 12px; border: 1px solid var(--glass-2); }
                .bio-main-tabs button { background: transparent; border: none; padding: 10px 20px; border-radius: 8px; color: #64748b; font-size: 11px; font-weight: 800; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 8px; }
                .bio-main-tabs button.active { background: var(--bio-green); color: #fff; box-shadow: 0 4px 15px var(--bio-green-glow); }
                .tab-icon { font-size: 14px; }

                .meta-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    background: var(--glass-1);
                    padding: 8px 16px;
                    border-radius: 99px;
                    border: 1px solid var(--glass-2);
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--bio-green);
                }
                .glow-indic { width: 8px; height: 8px; border-radius: 50%; background: var(--bio-green); box-shadow: 0 0 10px var(--bio-green); }
                .bio-reset-btn { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; margin-left: 12px; }
                .bio-reset-btn:hover { color: #fff; border-color: #fff; }

                /* VIEWPORT */
                .bio-viewport { flex: 1; padding: 30px 40px; position: relative; z-index: 5; overflow: hidden; }

                /* INIT CARD */
                .bio-init-card {
                    max-width: 550px;
                    margin: 60px auto;
                    background: #0f172a;
                    border: 1px solid var(--glass-2);
                    border-radius: 40px;
                    padding: 60px;
                    text-align: center;
                    box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6);
                    animation: cardSlide 0.8s cubic-bezier(0.19, 1, 0.22, 1);
                }
                @keyframes cardSlide { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                .init-icon-frame { position: relative; margin-bottom: 30px; display: inline-block; }
                .init-icon { font-size: 72px; position: relative; z-index: 2; animation: float 3s ease-in-out infinite; }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .init-rings span { position: absolute; border: 1px solid var(--bio-green-glow); border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); animation: orbit 4s linear infinite; }
                .init-rings span:nth-child(1) { width: 120px; height: 120px; animation-duration: 6s; }
                .init-rings span:nth-child(2) { width: 90px; height: 90px; animation-duration: 4s; }
                .init-rings span:nth-child(3) { width: 150px; height: 150px; animation-duration: 8s; }
                @keyframes orbit { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }

                .bio-hidden { display: none; }
                .bio-upload-surface {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 40px;
                    border: 2px dashed #1e293b;
                    border-radius: 24px;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin: 30px 0;
                    background: rgba(0,0,0,0.2);
                }
                .bio-upload-surface:hover { border-color: var(--bio-green); background: var(--bio-green-soft); transform: scale(1.02); }
                .up-icon { font-size: 40px; margin-bottom: 12px; }
                .up-text { font-size: 18px; font-weight: 700; }
                .up-hint { font-size: 12px; color: #64748b; margin-top: 6px; }

                .bio-submit-btn { width: 100%; padding: 20px; background: var(--bio-green); color: #fff; border: none; border-radius: 20px; font-size: 16px; font-weight: 800; tracking-spacing: 1px; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 30px var(--bio-green-soft); }
                .bio-submit-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 40px var(--bio-green-glow); filter: brightness(1.1); }
                .bio-submit-btn:disabled { opacity: 0.5; }

                /* WORKSPACE */
                .bio-workspace { display: grid; grid-template-columns: 1fr 1.3fr; gap: 30px; height: 100%; }
                .bio-side-panel { background: #0f172a; border: 1px solid var(--glass-2); border-radius: 30px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 15px 40px -10px rgba(0,0,0,0.4); }

                .side-header { padding: 20px 24px; border-bottom: 1px solid var(--glass-2); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.01); }
                .side-header h3 { font-size: 12px; font-weight: 900; color: var(--bio-green); letter-spacing: 1.5px; }
                .side-badge { font-size: 11px; font-weight: 800; color: #94a3b8; background: var(--glass-1); padding: 4px 10px; border-radius: 6px; }

                .visual-body { flex: 1; background: #020617; display: flex; items-center: center; justify-content: center; overflow: hidden; }
                .source-image-stage { position: relative; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; }
                .source-image-stage img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }

                .bio-status-badge { position: absolute; top: 30px; right: 30px; padding: 6px 14px; border-radius: 8px; font-size: 10px; font-weight: 900; z-index: 5; }
                .badge-process { background: var(--bio-green); color: #fff; }
                .badge-skip { background: #475569; color: #fff; }

                .side-footer { padding: 20px 24px; background: #0f172a; border-top: 1px solid var(--glass-2); display: flex; justify-content: space-between; align-items: center; }
                .bio-step-nav button { background: var(--glass-1); border: 1px solid var(--glass-2); color: #fff; padding: 10px 18px; border-radius: 10px; font-size: 10px; font-weight: 800; cursor: pointer; margin-right: 8px; transition: all 0.2s; }
                .bio-step-nav button:hover:not(:disabled) { border-color: var(--bio-green); }
                .bio-step-nav button:disabled { opacity: 0.3; cursor: not-allowed; }

                .bio-binary-actions .bio-proc-trigger { background: var(--bio-green); color: #fff; border: none; padding: 10px 24px; border-radius: 10px; font-weight: 800; font-size: 11px; cursor: pointer; transition: all 0.2s; }
                .bio-binary-actions .bio-skip-btn { background: transparent; color: #475569; border: 1px solid #1e293b; padding: 10px 24px; border-radius: 10px; font-weight: 800; font-size: 11px; cursor: pointer; margin-right: 12px; }

                /* FORM & EXECUTE */
                .bio-form-config { padding: 24px; background: rgba(0,0,0,0.1); display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-bottom: 1px solid var(--glass-2); }
                .bio-input-group label { display: block; font-size: 9px; font-weight: 900; color: var(--bio-green); margin-bottom: 6px; letter-spacing: 0.5px; }
                .bio-input-group input { width: 100%; background: #020617; border: 1px solid #1e293b; padding: 12px 14px; border-radius: 10px; color: #fff; font-size: 13px; transition: all 0.2s; }
                .bio-input-group input:focus { border-color: var(--bio-green); box-shadow: 0 0 0 4px var(--bio-green-soft); outline: none; }

                .bio-execute-btn { margin: 24px; padding: 18px; background: linear-gradient(135deg, #10b981 0%, #064e3b 100%); border: none; border-radius: 16px; color: #fff; font-weight: 900; font-size: 13px; letter-spacing: 1px; cursor: pointer; transition: all 0.3s; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
                .bio-execute-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px var(--bio-green-glow); }
                .bio-execute-btn:disabled { opacity: 0.4; }

                /* RESULTS TABS */
                .bio-view-tabs { display: flex; gap: 4px; background: #020617; padding: 4px; border-radius: 8px; border: 1px solid #1e293b; }
                .bio-view-tabs button { padding: 6px 12px; border: none; border-radius: 6px; background: transparent; color: #64748b; font-size: 10px; font-weight: 800; cursor: pointer; transition: all 0.2s; }
                .bio-view-tabs button.active { background: #1e293b; color: #fff; }

                .bio-results-scroller { flex: 1; overflow-y: auto; padding: 0 24px 30px; scrollbar-width: thin; }

                /* TERMINAL */
                .terminal-container { background: #020617; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; margin-top: 10px; }
                .terminal-header { background: #1e293b; padding: 10px 14px; display: flex; align-items: center; gap: 14px; }
                .terminal-controls { display: flex; gap: 6px; }
                .control { width: 10px; height: 10px; border-radius: 50%; }
                .c-close { background: #ff5f56; }
                .c-min { background: #ffbd2e; }
                .c-max { background: #27c93f; }
                .terminal-title { font-size: 11px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
                .terminal-body { padding: 20px; height: 250px; overflow-y: auto; background: #000; }
                .terminal-text { font-family: 'Fira Code', 'Courier New', monospace; font-size: 12px; line-height: 1.6; color: #10b981; white-space: pre-wrap; margin: 0; }
                .terminal-cursor { display: inline-block; width: 8px; height: 15px; background: #10b981; animation: blink 1s infinite; vertical-align: middle; margin-left: 2px; }
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

                .bio-runtime-container { animation: fadeIn 0.4s ease-out; }
                .runtime-pulse { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 10px; background: var(--bio-green-soft); border-radius: 10px; border: 1px solid var(--bio-green-glow); }
                .runtime-pulse span { font-size: 10px; font-weight: 900; color: var(--bio-green); }
                .wave { width: 16px; height: 16px; border: 2px solid var(--bio-green); border-radius: 50%; animation: wavePulse 1.5s infinite; }
                @keyframes wavePulse { 0% { box-shadow: 0 0 0 0 var(--bio-green-glow); } 100% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); } }

                /* BIO CONTENT CARDS */
                .bio-content-card { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-2); border-radius: 20px; padding: 30px; margin-bottom: 30px; transition: all 0.3s; position: relative; overflow: hidden; }
                .bio-content-card:hover { transform: translateX(10px); background: rgba(255, 255, 255, 0.04); border-color: var(--bio-green); }
                .card-flag-type { position: absolute; top: 0; left: 0; padding: 4px 12px; background: var(--bio-green-soft); color: var(--bio-green); font-size: 9px; font-weight: 900; border-radius: 0 0 12px 0; border-right: 1px solid var(--bio-green-glow); border-bottom: 1px solid var(--bio-green-glow); text-transform: uppercase; }

                .bio-h2 { font-size: 28px; font-weight: 900; color: var(--bio-green); margin-bottom: 20px; line-height: 1.2; }
                .bio-h3 { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 15px; }
                .bio-para { font-size: 16px; line-height: 1.8; color: #cbd5e1; }

                .bio-diagram-stack { margin-top: 24px; display: grid; gap: 20px; }
                .bio-img-frame { background: #fff; padding: 16px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
                .img-container img { width: 100%; border-radius: 10px; display: block; }
                .img-caption { margin-top: 12px; display: flex; items-center: center; gap: 8px; color: #64748b; font-size: 13px; font-weight: 500; }
                .caption-icon { font-size: 16px; }

                .bio-result-actions { display: flex; gap: 12px; margin-bottom: 24px; padding: 12px; background: var(--glass-1); border-radius: 12px; border: 1px solid var(--glass-2); }
                .bio-result-actions button { flex: 1; padding: 10px; background: #1e293b; border: 1px solid #334155; color: #fff; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; }
                .bio-result-actions button:hover { background: #334155; }
                .bio-save-commit-btn { background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; border: none !important; color: #fff !important; }
                .bio-save-commit-btn:hover { filter: brightness(1.2); }
                .bio-save-commit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                .bio-selection-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 0 4px; }
                .selection-count { font-size: 10px; font-weight: 800; color: #64748b; tracking-spacing: 0.5px; }
                .bio-selection-header button { background: transparent; border: none; color: var(--bio-green); font-size: 10px; font-weight: 900; cursor: pointer; text-decoration: underline; }

                /* CONTENT CARD SELECTION */
                .card-selection-area { position: absolute; top: 15px; right: 20px; z-index: 10; }
                .card-selection-area input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--bio-green); }
                .bio-content-card.selected { border-color: var(--bio-green); background: rgba(16, 185, 129, 0.05); }

                .bio-raw-box { background: #000; padding: 30px; border-radius: 20px; font-family: 'Fira Code', monospace; font-size: 14px; line-height: 1.7; color: #94a3b8; border: 1px solid #1e293b; white-space: pre-wrap; }

                .bio-empty-prompt { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; opacity: 0.3; text-align: center; }
                .prompt-svg { font-size: 64px; margin-bottom: 20px; color: var(--bio-green); }
                .bio-empty-prompt p { font-size: 14px; font-weight: 900; letter-spacing: 2px; }
                .bio-empty-prompt small { font-size: 10px; margin-top: 8px; max-width: 250px; }

                .bio-failure-alert { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 24px; border-radius: 20px; }
                .alert-top { font-weight: 900; color: #ef4444; font-size: 12px; letter-spacing: 1px; margin-bottom: 6px; }
                .bio-failure-alert p { font-size: 14px; color: #f87171; }

                .pulse-loader { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: rotate 0.6s linear infinite; margin-right: 10px; display: inline-block; }
                @keyframes rotate { to { transform: rotate(360deg); } }

                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #334155; }
            `}</style>
        </main>
    );
}
