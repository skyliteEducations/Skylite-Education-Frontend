'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import QuestionBuilder from './components/QuestionBuilder';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1/inorganic-chemistry';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'idle' | 'uploading';

interface ChemistryBlock {
    type: string;
    content: string;
    index: number;
}

interface ChemistryResult {
    blocks: ChemistryBlock[];
    topics?: any[];
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

// --- Content Block Renderer ---
const ContentBlock = memo(function ContentBlock({
    block,
    isSelected,
    onToggle
}: {
    block: ChemistryBlock,
    isSelected: boolean,
    onToggle: (idx: number) => void
}) {
    return (
        <div className={`chem-content-card ${isSelected ? 'selected' : ''}`} onClick={() => onToggle(block.index)}>
            <div className="card-selection-area">
                <input type="checkbox" checked={isSelected} readOnly />
            </div>

            <div className="card-flag-type">{block.type}</div>

            <div className="chem-para">
                <MathText text={block.content} />
            </div>
        </div>
    );
});

export default function InorganicChemistryPipeline() {
    const [activeTab, setActiveTab] = useState<'datalab' | 'builder'>('datalab');

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
    const [result, setResult] = useState<ChemistryResult | null>(null);
    const [taxonomyList, setTaxonomyList] = useState<string[]>([]);
    const [pyqChapter, setPyqChapter] = useState('');

    const currentPage = bookPages[currentBookPageIndex];
    const pollingIntervalRef = useRef<any>(null);

    // Fetch taxonomy list
    useEffect(() => {
        const fetchTaxonomy = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/taxonomy-list`);
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

    const fetchBookPages = useCallback(async (bid: string) => {
        if (!bid) return;
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${bid}/pages`);
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

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setMessage('Initializing Inorganic Chemistry engine...');
        setError(null);
        setResult(null);
        setCurrentBookPageIndex(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/upload`, {
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

    const startPolling = (jobId: string) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/status/${jobId}`);
                if (!res.ok) throw new Error("Connection lost");
                const data = await res.json();

                if (data.status === 'completed') {
                    setResult(data.result);
                    setStatus('completed');
                    setMessage('Chemical structure extraction successful.');
                    setSelectedIndices(data.result.blocks.map((b: any) => b.index));
                    clearInterval(pollingIntervalRef.current);
                } else if (data.status === 'failed') {
                    setError(data.error || "Analysis failed");
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
            alert("Please provide the Chapter Name before processing.");
            return;
        }

        setStatus('processing');
        setMessage(`AI Agent is analyzing Inorganic Chemistry symbols and text...`);
        setResult(null);
        setError(null);

        const formData = new FormData();
        formData.append('chapter_name', chapterName);
        if (topicName) formData.append('topic_name', topicName);

        try {
            const response = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${bookId}/${pageName}/process`, {
                method: 'POST',
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
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${bookId}/${currentPage.name}/save-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selected_blocks: selectedBlocks,
                    chapter_name: chapterName,
                    pyq_chapter: pyqChapter
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Save failed');
            alert("Reference content successfully committed for question builder.");
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

    return (
        <main className="chem-pipeline-root">
            <div className="chem-orb orb-1"></div>
            <div className="chem-orb orb-2"></div>

            <header className="chem-masthead">
                <div className="masthead-content">
                    <div className="chem-logo-area">
                        <Link href="/chemistry" className="chem-home-btn">← CHAPTERS</Link>
                        <h1>Inorganic <span className="text-highlight">Chemistry</span> Lab</h1>
                        <p>High-Precision Inorganic Extraction Pipeline</p>
                    </div>

                    <div className="chem-main-tabs">
                        <button className={activeTab === 'datalab' ? 'active' : ''} onClick={() => setActiveTab('datalab')}>
                            <span className="tab-icon">🧪</span> DATALAB EXTRACTION
                        </button>
                        <button className={activeTab === 'builder' ? 'active' : ''} onClick={() => setActiveTab('builder')}>
                            <span className="tab-icon">🧬</span> QUESTION BUILDER
                        </button>
                    </div>

                    {bookId && activeTab === 'datalab' && (
                        <div className="masthead-meta">
                            <div className="meta-pill">
                                <span className="glow-indic"></span>
                                {bookId}
                            </div>
                            <button className="chem-reset-btn" onClick={() => { setBookId(null); setBookPages([]); setResult(null); }}>
                                SWITCH BOOK
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <section className="chem-viewport">
                {activeTab === 'builder' ? (
                    <QuestionBuilder />
                ) : !bookId ? (
                    <div className="chem-init-card">
                        <div className="init-icon-frame">
                            <div className="init-icon">🧪</div>
                        </div>
                        <h2>Inorganic Protocol Initiation</h2>
                        <p>Deploy the extraction engine by providing a source PDF document.</p>

                        <div className="chem-dropzone">
                            <input
                                type="file"
                                id="pdf-stream"
                                accept="application/pdf"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                                className="chem-hidden"
                            />
                            <label htmlFor="pdf-stream" className="chem-upload-surface">
                                <div className="up-icon">📂</div>
                                <div className="up-text">
                                    {file ? file.name : "Select Inorganic PDF"}
                                </div>
                            </label>
                        </div>

                        <button
                            className="chem-submit-btn"
                            onClick={handleUpload}
                            disabled={status === 'uploading' || !file}
                        >
                            {status === 'uploading' ? "UPLOADING..." : "DECODE SOURCE DOCUMENT"}
                        </button>
                        {error && <div className="chem-error">{error}</div>}
                    </div>
                ) : (
                    <div className="chem-workspace">
                        {/* LEFT: SOURCE VIEW */}
                        <div className="chem-side-panel source-side">
                            <div className="side-header">
                                <h3>SOURCE VISUALIZER</h3>
                                <div className="side-badge">{currentBookPageIndex + 1} / {bookPages.length}</div>
                            </div>

                            <div className="side-body visual-body">
                                {!currentPage ? (
                                    <div className="chem-shimmer-box">
                                        <p>SYNCHRONIZING...</p>
                                    </div>
                                ) : (
                                    <div className="source-image-stage">
                                        <img src={currentPage.url} alt="Source Segment" />
                                    </div>
                                )}
                            </div>

                            <div className="side-footer">
                                <div className="chem-step-nav">
                                    <button onClick={() => setCurrentBookPageIndex(p => p - 1)} disabled={currentBookPageIndex === 0}>PREVIOUS</button>
                                    <button onClick={() => setCurrentBookPageIndex(p => p + 1)} disabled={!bookPages.length || currentBookPageIndex >= bookPages.length - 1}>NEXT</button>
                                </div>
                                {currentPage && (
                                    <div className="chem-binary-actions">
                                        <button className="chem-proc-trigger" onClick={() => handleProcessPage(currentPage.name)} disabled={status === 'processing'}>
                                            {status === 'processing' ? 'EXTRACTING...' : 'PROCESS PAGE AI'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: AI OUTPUT */}
                        <div className="chem-side-panel output-side">
                            <div className="side-header">
                                <h3>DATALAB INTELLIGENCE</h3>
                            </div>

                            <div className="chem-form-config">
                                <div className="chem-input-group" style={{ gridColumn: 'span 2' }}>
                                    <label>PYQ DIFFICULTY REFERENCE (CHAPTER)</label>
                                    <select
                                        value={pyqChapter}
                                        onChange={e => setPyqChapter(e.target.value)}
                                    >
                                        <option value="">-- Select PYQ Chapter --</option>
                                        {taxonomyList.map(chap => <option key={chap} value={chap}>{chap}</option>)}
                                    </select>
                                </div>
                                <div className="chem-input-group">
                                    <label>CHAPTER NAME</label>
                                    <input placeholder="e.g. Coordination Compounds" value={chapterName} onChange={e => setChapterName(e.target.value)} />
                                </div>
                                <div className="chem-input-group">
                                    <label>TOPIC (OPTIONAL)</label>
                                    <input placeholder="e.g. Crystal Field Theory" value={topicName} onChange={e => setTopicName(e.target.value)} />
                                </div>
                            </div>

                            <button
                                className="chem-execute-btn"
                                onClick={() => currentPage && handleProcessPage(currentPage.name)}
                                disabled={status === 'processing' || !chapterName || !currentPage}
                            >
                                {status === 'processing' ? 'EXTRACTING CHEMICAL DATA...' : 'EXECUTE AI EXTRACTION'}
                            </button>

                            <div className="chem-results-scroller">
                                {result && (
                                    <div className="chem-selection-header">
                                        <div className="selection-count">{selectedIndices.length} / {result.blocks.length} BLOCKS SELECTED</div>
                                        <button className="chem-save-commit-btn" onClick={handleSaveContent} disabled={isSaving || selectedIndices.length === 0}>
                                            {isSaving ? 'COMMITTING...' : '💾 SAVE REFERENCE'}
                                        </button>
                                    </div>
                                )}

                                {result ? (
                                    <div className="chem-content-view">
                                        {result.blocks.map((block, idx) => (
                                            <ContentBlock
                                                key={idx}
                                                block={block}
                                                isSelected={selectedIndices.includes(block.index)}
                                                onToggle={toggleSelection}
                                            />
                                        ))}
                                    </div>
                                ) : status === 'idle' ? (
                                    <div className="chem-empty-prompt">
                                        <p>AWAITING ANALYSIS COMMAND</p>
                                    </div>
                                ) : status === 'processing' ? (
                                    <div className="chem-shimmer-box">
                                        <p>AI AGENT IS EXTRACTING DATA...</p>
                                    </div>
                                ) : null}

                                {status === 'failed' && (
                                    <div className="chem-failure-alert">
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
                    --chem-primary: #6366f1;
                    --chem-green: #10b981;
                    --dark-slate: #020617;
                    --glass: rgba(255, 255, 255, 0.05);
                }

                .chem-pipeline-root {
                    background-color: var(--dark-slate);
                    color: #f8fafc;
                    font-family: 'Inter', system-ui, sans-serif;
                    height: 100vh;
                    overflow: hidden;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }

                .chem-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                    z-index: 0;
                    opacity: 0.15;
                }
                .orb-1 { top: -100px; right: -100px; width: 400px; height: 400px; background: var(--chem-primary); }
                .orb-2 { bottom: -100px; left: -100px; width: 300px; height: 300px; background: var(--chem-green); }

                .chem-masthead {
                    height: 100px;
                    border-bottom: 1px solid var(--glass);
                    background: rgba(15, 23, 42, 0.8);
                    backdrop-filter: blur(20px);
                    z-index: 10;
                    padding: 0 40px;
                    display: flex;
                    align-items: center;
                }
                .masthead-content { width: 100%; display: flex; justify-content: space-between; align-items: center; }
                .chem-logo-area h1 { font-size: 24px; font-weight: 900; }
                .text-highlight { color: var(--chem-primary); }
                .chem-logo-area p { color: #94a3b8; font-size: 13px; }
                .chem-home-btn { font-size: 11px; font-weight: 800; color: #475569; text-decoration: none; display: block; margin-bottom: 4px; }
                .chem-home-btn:hover { color: #fff; }

                .chem-main-tabs { display: flex; gap: 8px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 12px; }
                .chem-main-tabs button { background: transparent; border: none; padding: 10px 20px; border-radius: 8px; color: #64748b; font-size: 11px; font-weight: 800; cursor: pointer; transition: 0.3s; }
                .chem-main-tabs button.active { background: var(--chem-primary); color: #fff; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); }

                .meta-pill { display: inline-flex; align-items: center; gap: 10px; background: var(--glass); padding: 8px 16px; border-radius: 99px; font-size: 12px; font-weight: 700; color: var(--chem-green); }
                .glow-indic { width: 8px; height: 8px; border-radius: 50%; background: var(--chem-green); box-shadow: 0 0 10px var(--chem-green); }
                .chem-reset-btn { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 11px; margin-left: 12px; }

                .chem-viewport { flex: 1; padding: 20px 40px; position: relative; z-index: 5; overflow: hidden; }

                .chem-init-card { max-width: 500px; margin: 60px auto; background: #0f172a; border: 1px solid var(--glass); border-radius: 40px; padding: 60px; text-align: center; }
                .init-icon { font-size: 64px; margin-bottom: 20px; }
                .chem-dropzone { margin: 30px 0; }
                .chem-hidden { display: none; }
                .chem-upload-surface { display: flex; flex-direction: column; align-items: center; padding: 40px; border: 2px dashed #1e293b; border-radius: 24px; cursor: pointer; }
                .chem-submit-btn { background: var(--chem-primary); color: #fff; border: none; padding: 16px 32px; border-radius: 12px; font-weight: 800; cursor: pointer; width: 100%; }

                .chem-workspace { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; height: 100%; }
                .chem-side-panel { background: #0f172a; border: 1px solid var(--glass); border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; }
                .side-header { padding: 20px; border-bottom: 1px solid var(--glass); display: flex; justify-content: space-between; align-items: center; }
                .side-header h3 { font-size: 12px; font-weight: 900; color: #64748b; letter-spacing: 1px; }
                .side-badge { background: var(--glass); padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; }

                .side-body { flex: 1; overflow-y: auto; padding: 20px; }
                .source-image-stage img { width: 100%; border-radius: 12px; }

                .side-footer { padding: 20px; border-top: 1px solid var(--glass); display: flex; justify-content: space-between; }
                .chem-step-nav button { background: var(--glass); border: none; padding: 10px 20px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; margin-right: 8px; }
                .chem-proc-trigger { background: var(--chem-primary); border: none; padding: 10px 24px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer; }

                .chem-form-config { padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; border-bottom: 1px solid var(--glass); }
                .chem-input-group label { display: block; font-size: 10px; font-weight: 800; color: var(--chem-primary); margin-bottom: 8px; }
                .chem-input-group input, .chem-input-group select { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid #1e293b; padding: 12px; border-radius: 10px; color: #fff; font-size: 13px; }

                .chem-execute-btn { margin: 0 24px 20px; background: #fff; color: #000; border: none; padding: 14px; border-radius: 12px; font-weight: 800; font-size: 12px; cursor: pointer; }
                .chem-results-scroller { flex: 1; overflow-y: auto; padding: 0 24px 24px; }

                .chem-content-card { background: rgba(255,255,255,0.02); border: 1px solid var(--glass); border-radius: 16px; padding: 20px; margin-bottom: 12px; display: flex; gap: 16px; cursor: pointer; }
                .chem-content-card.selected { border-color: var(--chem-primary); background: rgba(99, 102, 241, 0.05); }
                .card-flag-type { font-size: 9px; font-weight: 900; color: var(--chem-green); background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 4px; height: fit-content; }
                .chem-para { font-size: 14px; line-height: 1.6; color: #cbd5e1; }

                .chem-selection-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 10px 0; border-bottom: 1px solid var(--glass); }
                .selection-count { font-size: 11px; font-weight: 800; color: #64748b; }
                .chem-save-commit-btn { background: var(--chem-green); color: #000; border: none; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; }
                
                .chem-empty-prompt { text-align: center; padding: 60px; opacity: 0.3; font-weight: 800; font-size: 14px; }
                .chem-shimmer-box { text-align: center; padding: 40px; opacity: 0.5; font-size: 12px; }
            `}</style>
        </main>
    );
}
