'use client';

import { useState, useRef, ChangeEvent, useEffect, useCallback, memo } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

// Configuration — set NEXT_PUBLIC_API_BASE_URL in your .env file
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type JobStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
type AppMode = 'standard' | 'datalab';

interface Option { label: string; text: string; }
interface Diagram { url: string; alt: string; }
interface QuestionEntry { question: string; options: Option[]; diagrams?: Diagram[] | null; comprehension_context?: string | null; context?: string | null; comprehension?: string | null; passage?: string | null; passage_text?: string | null; context_text?: string | null; }
interface StructuredResult { type: 'single' | 'multi'; question?: string; options?: Option[]; diagrams?: Diagram[] | null; comprehension_context?: string | null; context?: string | null; comprehension?: string | null; questions?: QuestionEntry[]; }

/**
 * Robust LaTeX Component for complex mixed text.
 * Memoized to prevent heavy math re-renders during heartbeats.
 */
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
        <div ref={containerRef} style={{ display: 'inline-block' }}>
            {processedText}
        </div>
    );
});

/**
 * Specialized component for Matrix Match questions with 2-column rendering.
 * Now handles both paired lines (a. -> p.) and separate lists.
 */
const MatrixMatch = memo(function MatrixMatch({ text }: { text: string }) {
    const lines = text.split('\n').filter(l => l.trim() !== "");
    const items: { left: string; right: string }[] = [];
    let headerI = "List I";
    let headerII = "List II";
    let introLines: string[] = [];

    // Identify headers
    const headerRegex = /(?:List|Column)\s+I:?\s*(.*?)\s*(?:\||VS|\n|$)\s*(?:List|Column)\s+II:?\s*(.*)/i;
    const hMatch = text.match(headerRegex);
    if (hMatch) {
        headerI = (hMatch[1] || "List I").trim() || "List I";
        headerII = (hMatch[2] || "List II").trim() || "List II";
    }

    // Pass 1: Try to find paired items (a. ... -> p. ...)
    // Support ASCII and Unicode arrows
    const rowRegex = /^\s*(?:\(?)([a-hA-H0-9])(?:\.|\))\s*(.*?)\s*(?:->|—|:|==|→|⟶|⇒|>)\s*(?:\(?)([p-zP-Z0-9])(?:\.|\))\s*(.*)$/i;

    // Pass 2: Fallback for separate lists
    const leftItems: { label: string, content: string }[] = [];
    const rightItems: { label: string, content: string }[] = [];

    lines.forEach(line => {
        const rMatch = line.match(rowRegex);
        if (rMatch) {
            items.push({
                left: `${rMatch[1]}. ${rMatch[2]}`,
                right: `${rMatch[3]}. ${rMatch[4]}`
            });
            return;
        }

        const itemMatch = line.match(/^\s*(?:\(?)([a-z0-9])(?:\.|\))\s*(.*)$/i);
        if (itemMatch) {
            const label = itemMatch[1].toLowerCase();
            const content = itemMatch[2];
            // Deduplicate (skip if we already have this content)
            const isDup = [...leftItems, ...rightItems].some(x => x.content.toLowerCase() === content.toLowerCase());
            if (isDup) return;

            if (['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].includes(label)) {
                leftItems.push({ label, content: `${label}. ${content}` });
            } else if (['p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'].includes(label)) {
                rightItems.push({ label, content: `${label}. ${content}` });
            } else {
                if (leftItems.length <= rightItems.length) leftItems.push({ label, content: line });
                else rightItems.push({ label, content: line });
            }
        } else if (!line.match(/(?:List|Column)\s+I/i)) {
            introLines.push(line);
        }
    });

    // If we have separate lists but no paired items, pair them by index
    if (items.length === 0 && leftItems.length > 0 && rightItems.length > 0) {
        const max = Math.max(leftItems.length, rightItems.length);
        for (let i = 0; i < max; i++) {
            items.push({
                left: leftItems[i]?.content || "",
                right: rightItems[i]?.content || ""
            });
        }
    }

    // SAFETY CHECK: If we only have items in one column, don't use grid mode
    // (This prevents the bug in the screenshot where everything was on the left)
    const hasDataInBoth = items.some(it => it.left && it.right) || (leftItems.length > 0 && rightItems.length > 0);

    if (items.length === 0 || !hasDataInBoth) {
        return <MathText text={text} />;
    }

    return (
        <div className="matrix-match-wrapper">
            {introLines.length > 0 && (
                <div className="matrix-intro">
                    {introLines.map((l, i) => <div key={i}><MathText text={l} /></div>)}
                </div>
            )}
            <div className="matrix-columns-grid">
                <div className="matrix-col">
                    <div className="matrix-col-header">{headerI}</div>
                    {items.map((it, idx) => (
                        <div key={idx} className="matrix-row">
                            {it.left && <MathText text={it.left} />}
                        </div>
                    ))}
                </div>
                <div className="matrix-col">
                    <div className="matrix-col-header">{headerII}</div>
                    {items.map((it, idx) => (
                        <div key={idx} className="matrix-row">
                            {it.right && <MathText text={it.right} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default function Home() {
    const [mode, setMode] = useState<AppMode>('standard');
    const [status, setStatus] = useState<JobStatus>('idle');
    const [message, setMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<StructuredResult | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);

    const [activeBookId, setActiveBookId] = useState<string | null>(null);
    const [bookPages, setBookPages] = useState<any[]>([]);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [isBookMode, setIsBookMode] = useState(false);
    const [currentBookPageIndex, setCurrentBookPageIndex] = useState(0);

    const currentPage = bookPages[currentBookPageIndex];

    const [univBookName, setUnivBookName] = useState('');
    const [univChapterName, setUnivChapterName] = useState('');
    const [editableQuestions, setEditableQuestions] = useState<any[]>([]);

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const pollingIntervalRef = useRef<any>(null);

    useEffect(() => {
        if (result) {
            console.log("[DEBUG] Mapping Result Questions:", result.questions);
            const qs = result.type === 'single'
                ? [{
                    question: result.question || '',
                    options: result.options || [],
                    diagrams: result.diagrams || [],
                    question_type: 'single_correct',
                    correct_option: '',
                    subtopic: '',
                    solution: '',
                    flag: false,
                    question_number: "1",
                    comprehension_context: result.comprehension_context || result.context || result.comprehension || null
                }]
                : result.questions?.map((q: any, i: number) => ({
                    question: q.question || '',
                    options: q.options || [],
                    diagrams: q.diagrams || [],
                    question_type: 'single_correct',
                    correct_option: '',
                    subtopic: '',
                    solution: '',
                    flag: false,
                    question_number: (q.question_number || q.question_index || (i + 1)).toString(),
                    comprehension_context: q.comprehension_context || q.context || q.comprehension || q.passage || q.passage_text || q.context_text || result.comprehension_context || result.context || null
                })) || [];
            console.log("[DEBUG] Final Editable Questions:", qs);
            setEditableQuestions(qs);
        } else {
            setEditableQuestions([]);
        }
    }, [result]);

    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        setPreviewUrl(URL.createObjectURL(file));

        if (file.type === 'application/pdf' && mode === 'datalab') {
            await startBookUpload(file);
        } else {
            setIsBookMode(false);
            await startConversion(file);
        }
    };

    const startBookUpload = async (file: File) => {
        setStatus('uploading');
        setMessage('Uploading Book PDF to Lab...');
        setResult(null);
        setError(null);
        setIsBookMode(true);
        setCurrentBookPageIndex(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/datalab/book/upload`, {
                method: 'POST', body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail?.message || 'Book upload failed');

            setActiveBookId(data.book_id);
            setTotalPages(data.total_pages);
            fetchBookPages(data.book_id);
            setStatus('idle');
        } catch (err: any) {
            setError(err.message);
            setStatus('failed');
        }
    };

    const fetchBookPages = useCallback(async (bookId: string) => {
        if (!bookId) return;
        const url = `${API_BASE_URL}/api/v1/datalab/book/${bookId}/pages`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.pages) {
                setBookPages(prev => {
                    if (prev.length === data.pages.length) return prev;
                    return data.pages.map((p: any) => ({
                        name: p.page_name,
                        url: `${API_BASE_URL}${p.url}`,
                        actionStatus: p.status || null
                    }));
                });
            }
        } catch (err) { console.error(`Error fetching pages:`, err); }
    }, []);

    // Background Extraction/Deduplication Polling
    useEffect(() => {
        let interval: any;
        if (isBookMode && activeBookId && bookPages.length < totalPages) {
            interval = setInterval(() => {
                fetchBookPages(activeBookId);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isBookMode, activeBookId, bookPages.length, totalPages, fetchBookPages]);

    const handleMarkPage = async (pageName: string, action: 'skip' | 'process') => {
        try {
            await fetch(`${API_BASE_URL}/api/v1/datalab/book/${activeBookId}/mark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_name: pageName, action })
            });
            setBookPages(prev => prev.map(p => p.name === pageName ? { ...p, actionStatus: action } : p));
        } catch (err) { console.error("Mark failed", err); }
    };

    const handleProcessPage = async (pageName: string) => {
        setBookPages(prev => prev.map(p => p.name === pageName ? { ...p, actionStatus: 'process' } : p));
        setStatus('uploading');
        setMessage(`Processing: ${pageName}...`);
        setResult(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/datalab/book/${activeBookId}/${pageName}/process`, {
                method: 'POST'
            });
            const data = await response.json();
            if (!response.ok) throw new Error('Process failed');
            setCurrentJobId(data.job_id);
            startPolling(data.job_id);
        } catch (err: any) {
            setError(err.message);
            setStatus('failed');
        }
    };

    const startConversion = async (file: File) => {
        setStatus('uploading');
        setMessage(mode === 'standard' ? 'Sending to AI...' : 'Processing asset...');
        setResult(null);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        const endpoint = mode === 'standard'
            ? `${API_BASE_URL}/api/v1/convert/upload`
            : `${API_BASE_URL}/api/v1/datalab/upload`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST', body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail?.message || 'Upload failed');
            setCurrentJobId(data.job_id);
            startPolling(data.job_id);
        } catch (err: any) {
            setError(err.message);
            setStatus('failed');
        }
    };

    const startPolling = (jobId: string) => {
        setStatus('processing');
        const statusEndpoint = mode === 'standard'
            ? `${API_BASE_URL}/api/v1/convert/status/${jobId}`
            : `${API_BASE_URL}/api/v1/datalab/status/${jobId}`;

        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(statusEndpoint);
                const data = await res.json();
                if (data.status === 'completed') {
                    clearInterval(pollingIntervalRef.current);
                    setStatus('completed');
                    setResult(data.result);
                } else if (data.status === 'failed') {
                    clearInterval(pollingIntervalRef.current);
                    setStatus('failed');
                    setError(data.error);
                }
            } catch (err) { console.error(err); }
        }, 2000);
    };

    const handleQuestionUpdate = useCallback((idx: number, updatedFields: any) => {
        setEditableQuestions(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updatedFields };
            return next;
        });
    }, []);

    const handleSaveAll = useCallback(async () => {
        if (!currentJobId || !activeBookId) {
            alert("Missing job or book context. Please process a page first.");
            return;
        }
        setStatus('uploading');
        setMessage("Saving all questions to your Repository...");

        const payload = {
            job_id: currentJobId,
            book_id: activeBookId,
            book_name: univBookName || activeBookId,
            chapter_name: univChapterName || "Uncategorized",
            page_name: currentPage?.name || "unnamed_page",
            questions: editableQuestions.map((q, i) => ({
                question_index: q.question_number || (i + 1).toString(),
                question_number: q.question_number || (i + 1).toString(),
                question: q.question,
                options: q.options,
                correct_option: q.correct_option || "",
                solution_text: q.solution || "",
                subtopic: q.subtopic || "",
                question_type: q.question_type || "single_correct",
                flag: q.flag || false,
                diagrams: q.diagrams || [],
                comprehension_context: q.comprehension_context || null
            }))
        };

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/datalab/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                alert(`SUCCESS: ${data.message}`);
                setStatus('completed');
            } else { throw new Error(data.detail || "Save failed"); }
        } catch (err: any) {
            setError(err.message);
            setStatus('failed');
            alert(`Error: ${err.message}`);
        }
    }, [currentJobId, activeBookId, univBookName, univChapterName, currentPage?.name, editableQuestions]);

    const resetState = () => {
        setStatus('idle');
        setResult(null);
        setPreviewUrl(null);
        setError(null);
        setActiveBookId(null);
        setBookPages([]);
        setIsBookMode(false);
        setCurrentJobId(null);
        setCurrentBookPageIndex(0);
        setEditableQuestions([]);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };

    return (
        <main className={`main-container ${mode === 'datalab' ? 'datalab-mode' : ''}`}>
            <div className="card" style={{ marginBottom: '16px' }}>
                <h1>AI Agent Platform</h1>
                <p className="subtitle">{mode === 'standard' ? 'Question Uploading Channel' : 'Intelligent DataLab Workbench'}</p>
            </div>

            <div className="tabs-container">
                <button
                    className={`tab-btn ${mode === 'standard' ? 'active' : ''}`}
                    onClick={() => { setMode('standard'); resetState(); }}
                >
                    🚀 Standard Converter
                </button>
                <button
                    className={`tab-btn ${mode === 'datalab' ? 'active' : ''}`}
                    onClick={() => { setMode('datalab'); resetState(); }}
                >
                    🧬 DataLab AI
                </button>
            </div>

            <div className="split-view">
                <div className="panel">
                    <div className="book-header">
                        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
                            {mode === 'standard' ? 'Capture Content' : isBookMode ? 'Selected Resource' : 'Upload Lab Assets'}
                        </h2>
                        {isBookMode && activeBookId && (
                            <span className="book-meta">Book ID: {activeBookId.slice(0, 8)}</span>
                        )}
                    </div>

                    {!isBookMode ? (
                        <>
                            <div className="actions-grid">
                                <button className="action-btn" onClick={() => cameraInputRef.current?.click()} disabled={status === 'processing'}>
                                    <span className="icon">{mode === 'standard' ? '📸' : '🔭'}</span>
                                    <span className="label">Open Camera</span>
                                </button>
                                <button className="action-btn" onClick={() => galleryInputRef.current?.click()} disabled={status === 'processing'}>
                                    <span className="icon">{mode === 'standard' ? '🖼️' : '🛸'}</span>
                                    <span className="label">Gallery / PDF Book</span>
                                </button>
                            </div>

                            <input type="file" hidden ref={cameraInputRef} accept="image/*,application/pdf" capture="environment" onChange={handleFileChange} />
                            <input type="file" hidden ref={galleryInputRef} accept="image/*,application/pdf" onChange={handleFileChange} />

                            {status !== 'idle' && (
                                <div className="status-box">
                                    <div className="status-header">
                                        {(status === 'uploading' || status === 'processing') && <div className="loader"></div>}
                                        <span className="status-text">{status.toUpperCase()}</span>
                                    </div>
                                    <p className="status-message" style={{ color: status === 'failed' ? 'var(--error)' : 'inherit' }}>{error || message}</p>
                                </div>
                            )}

                            {previewUrl && (
                                <div style={{ marginTop: '24px' }}>
                                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px' }}>SOURCE PREVIEW</h3>
                                    <img src={previewUrl} className="image-preview" alt="User Capture" />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="page-viewer-container">
                            {!currentPage ? (
                                <div className="empty-state" style={{ height: '300px' }}>
                                    <div className="loader"></div>
                                    <p style={{ marginTop: '20px' }}>Analyzing PDF (Fast Mode)...</p>
                                    <span className="book-meta">Extraction starting in background...</span>
                                </div>
                            ) : (
                                <>
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        {currentPage.actionStatus && (
                                            <div className={`page-badge badge-${currentPage.actionStatus}`} style={{ top: '10px', right: '10px' }}>{currentPage.actionStatus}</div>
                                        )}
                                        <img src={currentPage.url} className="viewer-image" alt="Page View" />
                                    </div>

                                    <div className="page-nav-controls">
                                        <button className="step-btn" disabled={currentBookPageIndex === 0} onClick={() => setCurrentBookPageIndex(p => p - 1)}>← Back</button>
                                        <span className="page-indicator">Page {currentBookPageIndex + 1} of {totalPages}</span>
                                        <button className="step-btn" disabled={currentBookPageIndex >= bookPages.length - 1 && bookPages.length < totalPages} onClick={() => setCurrentBookPageIndex(p => p + 1)}>Next →</button>
                                    </div>

                                    {bookPages.length < totalPages && (
                                        <div className="field-badge" style={{ marginTop: '-10px', marginBottom: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)' }}>
                                            ⚡ Extraction in progress ({bookPages.length}/{totalPages})
                                        </div>
                                    )}

                                    <div className="page-actions-overlay" style={{ marginTop: '0', width: '100%', gridTemplateColumns: '1fr 1fr' }}>
                                        <button
                                            className="mini-btn skip-btn"
                                            style={{ padding: '15px' }}
                                            onClick={() => handleMarkPage(currentPage.name, 'skip')}
                                        >
                                            Skip This Page
                                        </button>
                                        <button
                                            className="mini-btn proc-btn"
                                            style={{ padding: '15px' }}
                                            disabled={status === 'processing'}
                                            onClick={() => handleProcessPage(currentPage.name)}
                                        >
                                            Process Page AI
                                        </button>
                                    </div>
                                </>
                            )}

                            <button className="cancel-btn" onClick={resetState} style={{ marginTop: '20px', width: '100%' }}>
                                Exit Book Collector
                            </button>
                        </div>
                    )}
                </div>

                <div className="panel result-panel-container">
                    <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600', color: 'var(--primary)' }}>
                        {mode === 'standard' ? 'Extracted Result' : 'AI Laboratory Output'}
                    </h2>

                    {mode === 'datalab' && result && (
                        <div className="universal-fields">
                            <div className="editor-group">
                                <label className="editor-label">Book Name</label>
                                <input className="edit-input" placeholder="e.g. Physics Vol 1" value={univBookName} onChange={e => setUnivBookName(e.target.value)} />
                            </div>
                            <div className="editor-group">
                                <label className="editor-label">Chapter</label>
                                <input className="edit-input" placeholder="e.g. Light" value={univChapterName} onChange={e => setUnivChapterName(e.target.value)} />
                            </div>
                        </div>
                    )}

                    {!result && status === 'idle' && (
                        <div className="empty-state">
                            <span>{mode === 'standard' ? '🔍' : '🧪'}</span>
                            <p>{mode === 'standard' ? 'Results will appear here.' : 'Awaiting data extraction...'}</p>
                        </div>
                    )}
                    {status !== 'idle' && isBookMode && !result && (
                        <div className="status-box" style={{ marginBottom: '20px' }}>
                            <div className="status-header">
                                {(status === 'uploading' || status === 'processing') && <div className="loader"></div>}
                                <span className="status-text">{status.toUpperCase()}</span>
                            </div>
                            <p className="status-message">{message}</p>
                        </div>
                    )}
                    {result && (
                        <div className="result-panel">
                            {editableQuestions.map((q, idx) => (
                                <QuestionItem
                                    key={idx}
                                    index={idx}
                                    data={q}
                                    mode={mode}
                                    onChange={(updated) => handleQuestionUpdate(idx, updated)}
                                />
                            ))}

                            {mode === 'datalab' && editableQuestions.length > 0 && (
                                <button
                                    onClick={handleSaveAll}
                                    className="save-btn"
                                    style={{
                                        marginTop: '24px',
                                        padding: '18px',
                                        width: '100%',
                                        background: 'var(--primary)',
                                        fontSize: '18px',
                                        fontWeight: '800',
                                        boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.4)'
                                    }}
                                >
                                    🚀 Save All Results to Lab
                                </button>
                            )}

                            <button
                                onClick={() => { setStatus('idle'); setResult(null); }}
                                className="action-btn" style={{ marginTop: '20px', padding: '12px', width: '100%', borderStyle: 'solid' }}
                            >
                                Clear Results
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

const QuestionItem = memo(function QuestionItem({
    data,
    index,
    mode,
    onChange
}: {
    data: any,
    index: number,
    mode: AppMode,
    onChange: (updatedFields: any) => void
}) {
    const [isEditing, setIsEditing] = useState(false);

    const toggleEdit = () => setIsEditing(!isEditing);

    const handleOptionChange = (optIdx: number, newText: string) => {
        const newOptions = [...data.options];
        newOptions[optIdx].text = newText;
        onChange({ options: newOptions });
    };

    const handleDiagramChange = (diagIdx: number, field: 'url' | 'alt', value: string) => {
        const newDiagrams = [...(data.diagrams || [])];
        newDiagrams[diagIdx] = { ...newDiagrams[diagIdx], [field]: value };
        onChange({ diagrams: newDiagrams });
    };

    const handleDeleteDiagram = (diagIdx: number) => {
        const newDiagrams = (data.diagrams || []).filter((_: any, i: number) => i !== diagIdx);
        onChange({ diagrams: newDiagrams.length > 0 ? newDiagrams : null });
    };

    const handleAddDiagram = () => {
        const newDiagrams = [...(data.diagrams || []), { url: '', alt: 'diagram' }];
        onChange({ diagrams: newDiagrams });
    };

    return (
        <div className="question-card" style={{ position: 'relative' }}>
            {mode === 'datalab' && (
                <div style={{
                    position: 'absolute', top: '16px', right: '16px',
                    display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!isEditing && (
                            <select
                                className="compact-select"
                                value={data.question_type}
                                onChange={(e) => onChange({ question_type: e.target.value })}
                            >
                                <option value="single_correct">Single Correct</option>
                                <option value="multiple_correct">Multiple Correct</option>
                                <option value="linked_comprehension">Linked Comprehension</option>
                                <option value="matrix_match">Matrix Match</option>
                                <option value="numerical_value">Numerical Value</option>
                            </select>
                        )}
                        <button className="edit-toggle-btn" style={{ margin: 0 }} onClick={toggleEdit}>
                            {isEditing ? '👀 View' : '✏️ Edit'}
                        </button>
                    </div>

                    <div className="checkbox-wrapper" style={{ margin: 0 }}>
                        <input
                            type="checkbox"
                            className="custom-checkbox"
                            checked={data.flag || false}
                            onChange={(e) => onChange({ flag: e.target.checked })}
                        />
                        <span className="flag-label">{data.flag ? 'Verified (True)' : 'Flag: False'}</span>
                    </div>
                </div>
            )}

            {!isEditing ? (
                <>
                    {(data.comprehension_context || data.context || data.comprehension || data.passage) && (
                        <div className="comprehension-context">
                            <MathText text={data.comprehension_context || data.context || data.comprehension || data.passage} />
                        </div>
                    )}
                    <div className="question-text" style={{ paddingRight: '160px' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: '700', marginRight: '10px' }}>
                            Q {data.question_number || (index + 1)}.
                        </span>
                        {(data.question_type === 'matrix_match' || /List\s+I|Column\s+I/i.test(data.question)) ? (
                            <MatrixMatch text={data.question} />
                        ) : (
                            <MathText text={data.question} />
                        )}
                    </div>
                    {data.diagrams && data.diagrams.length > 0 && (
                        <div className="diagrams-grid">
                            {data.diagrams.map((diag: any, i: number) => (
                                <div key={i} className="diagram-container">
                                    <img src={diag.url} alt={diag.alt} />
                                    {diag.alt !== 'diagram' && <p className="diagram-caption">{diag.alt}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                    {data.options?.length > 0 && (
                        <div className="options-list">
                            {data.options.map((opt: any, i: number) => (
                                <div key={i} className="option-item">
                                    <div className="option-label">{opt.label}</div>
                                    <div className="option-content"><MathText text={opt.text} /></div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="edit-form">
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px' }}>
                        <div className="editor-group">
                            <label className="editor-label">No.</label>
                            <input className="edit-input" value={data.question_number} onChange={e => onChange({ question_number: e.target.value })} />
                        </div>
                        <div className="editor-group">
                            <label className="editor-label">Question Text</label>
                            <textarea className="edit-textarea" value={data.question} onChange={e => onChange({ question: e.target.value })} />
                        </div>
                    </div>

                    <div className="editor-group">
                        <label className="editor-label">Comprehension Context (Shared Passage)</label>
                        <textarea
                            className="edit-textarea"
                            style={{ minHeight: '80px' }}
                            placeholder="Add shared passage or identity here..."
                            value={data.comprehension_context || data.context || data.comprehension || data.passage || ''}
                            onChange={e => onChange({ comprehension_context: e.target.value })}
                        />
                    </div>

                    <div className="options-list">
                        <label className="editor-label">Options</label>
                        {data.options.map((opt: any, i: number) => (
                            <div key={i} className="option-item" style={{ background: 'transparent', padding: '0', display: 'flex', gap: '10px' }}>
                                <div className="option-label" style={{ marginTop: '8px' }}>{opt.label}</div>
                                <input className="edit-input" value={opt.text} onChange={e => handleOptionChange(i, e.target.value)} />
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="editor-group">
                            <label className="editor-label">Correct Option</label>
                            <input className="edit-input" placeholder="e.g. A" value={data.correct_option} onChange={e => onChange({ correct_option: e.target.value })} />
                        </div>
                        <div className="editor-group">
                            <label className="editor-label">Topic / Subtopic</label>
                            <input className="edit-input" placeholder="e.g. Newton's 2nd Law" value={data.subtopic} onChange={e => onChange({ subtopic: e.target.value })} />
                        </div>
                    </div>

                    <div className="editor-group" style={{ marginTop: '16px' }}>
                        <label className="editor-label">Associated Diagrams</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(data.diagrams || []).map((diag: any, i: number) => (
                                <div key={i} className="diagram-edit-row" style={{
                                    display: 'grid',
                                    gridTemplateColumns: '80px 1fr 1fr 40px',
                                    gap: '12px',
                                    alignItems: 'center',
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '12px',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', background: '#333' }}>
                                        {diag.url ? <img src={diag.url} alt="prev" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>No img</div>}
                                    </div>
                                    <input className="edit-input" placeholder="Label/Alt" value={diag.alt} onChange={e => handleDiagramChange(i, 'alt', e.target.value)} />
                                    <input className="edit-input" placeholder="Image URL" value={diag.url} onChange={e => handleDiagramChange(i, 'url', e.target.value)} />
                                    <button onClick={() => handleDeleteDiagram(i)} className="action-btn" style={{ background: '#ff4444', color: '#fff', border: 'none', height: '36px', borderRadius: '6px' }}>✕</button>
                                </div>
                            ))}
                            <button onClick={handleAddDiagram} className="action-btn" style={{ padding: '8px', borderStyle: 'dashed', opacity: 0.7 }}>
                                + Add Diagram
                            </button>
                        </div>
                    </div>

                    <div className="editor-group">
                        <label className="editor-label">Solution Text</label>
                        <textarea className="edit-textarea" style={{ minHeight: '80px' }} value={data.solution} onChange={e => onChange({ solution: e.target.value })} />
                    </div>

                    <div className="editor-actions">
                        <button className="save-btn" style={{ background: 'var(--primary)', width: '100%' }} onClick={toggleEdit}>✔ Done Editing (Close Editor)</button>
                    </div>
                </div>
            )}
        </div>
    );
});