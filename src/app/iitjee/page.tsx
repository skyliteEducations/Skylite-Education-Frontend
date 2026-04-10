'use client';

import { useState, useRef, ChangeEvent, useEffect, useCallback, memo } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import QuestionBuilder from './components/QuestionBuilder';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'idle' | 'uploading';

interface Option { label: string; text: string; }
interface Diagram { url: string; alt: string; }
interface QuestionEntry { question: string; options: Option[]; diagrams?: Diagram[] | null; comprehension_context?: string | null; context?: string | null; comprehension?: string | null; passage?: string | null; passage_text?: string | null; context_text?: string | null; question_number?: string; question_index?: string | number; question_type?: string; subtopic?: string; solution?: string; }

// --- Reusable MathText and MatrixMatch Components ---

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

const MatrixMatch = memo(function MatrixMatch({ text }: { text: string }) {
    const lines = text.split('\n').filter(l => l.trim() !== "");
    const items: { left: string; right: string }[] = [];
    let headerI = "List I";
    let headerII = "List II";
    let introLines: string[] = [];

    const headerRegex = /(?:List|Column)\s+I:?\s*(.*?)\s*(?:\||VS|\n|$)\s*(?:List|Column)\s+II:?\s*(.*)/i;
    const hMatch = text.match(headerRegex);
    if (hMatch) {
        headerI = (hMatch[1] || "List I").trim() || "List I";
        headerII = (hMatch[2] || "List II").trim() || "List II";
    }

    const rowRegex = /^\s*(?:\(?)([a-hA-H0-9])(?:\.|\))\s*(.*?)\s*(?:->|—|:|==|→|⟶|⇒|>)\s*(?:\(?)([p-zP-Z0-9])(?:\.|\))\s*(.*)$/i;
    const leftItems: { label: string, content: string }[] = [];
    const rightItems: { label: string, content: string }[] = [];

    lines.forEach(line => {
        const rMatch = line.match(rowRegex);
        if (rMatch) {
            items.push({ left: `${rMatch[1]}. ${rMatch[2]}`, right: `${rMatch[3]}. ${rMatch[4]}` });
            return;
        }

        const itemMatch = line.match(/^\s*(?:\(?)([a-z0-9])(?:\.|\))\s*(.*)$/i);
        if (itemMatch) {
            const label = itemMatch[1].toLowerCase();
            const content = itemMatch[2];
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

    if (items.length === 0 && leftItems.length > 0 && rightItems.length > 0) {
        const max = Math.max(leftItems.length, rightItems.length);
        for (let i = 0; i < max; i++) {
            items.push({ left: leftItems[i]?.content || "", right: rightItems[i]?.content || "" });
        }
    }

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

// --- Question Editor Component ---
const QuestionItemEditor = memo(function QuestionItemEditor({
    data, index, jobId, bookName, chapterName, pageName, onVerify
}: {
    data: any, index: number, jobId?: string, bookName: string, chapterName: string, pageName: string, onVerify: () => void
}) {
    const [editableData, setEditableData] = useState(data);
    const [isEditing, setIsEditing] = useState(false);

    const toggleEdit = () => setIsEditing(!isEditing);

    const onChange = (updated: any) => {
        setEditableData({ ...editableData, ...updated });
    };

    const handleOptionChange = (optIdx: number, newText: string) => {
        const newOptions = [...editableData.options];
        newOptions[optIdx].text = newText;
        onChange({ options: newOptions });
    };

    const handleDiagramChange = (diagIdx: number, field: 'url' | 'alt', value: string) => {
        const newDiagrams = [...(editableData.diagrams || [])];
        newDiagrams[diagIdx] = { ...newDiagrams[diagIdx], [field]: value };
        onChange({ diagrams: newDiagrams });
    };

    const handleDeleteDiagram = (diagIdx: number) => {
        const newDiagrams = (editableData.diagrams || []).filter((_: any, i: number) => i !== diagIdx);
        onChange({ diagrams: newDiagrams.length > 0 ? newDiagrams : null });
    };

    const handleAddDiagram = () => {
        const newDiagrams = [...(editableData.diagrams || []), { url: '', alt: 'diagram' }];
        onChange({ diagrams: newDiagrams });
    };

    const handleSaveEdits = async () => {
        const safeJobId = jobId || bookName || 'historical';
        try {
            await fetch(`${API_BASE_URL}/api/v1/iitjee/edit/${safeJobId}/${index}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: editableData.question,
                    options: editableData.options,
                    diagrams: editableData.diagrams,
                    comprehension_context: editableData.comprehension_context
                })
            });
            setIsEditing(false);
        } catch (e) {
            console.error(e);
        }
    };

    const verifyQuestion = async () => {
        try {
            // Determine which API to use based on jobId presence
            let url = `${API_BASE_URL}/api/v1/iitjee/verify/${jobId}/${index}`;
            if (!jobId) {
                // Use the new historical verification route
                url = `${API_BASE_URL}/api/v1/iitjee/book/${bookName}/${pageName}/verify-item/${index}`;
            }

            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    book_name: bookName,
                    chapter_name: chapterName,
                    page_name: pageName,
                    question_index: index,
                    question_number: editableData.question_number?.toString() || (index + 1).toString(),
                    question: editableData.question,
                    options: editableData.options,
                    diagrams: editableData.diagrams,
                    comprehension_context: editableData.comprehension_context
                })
            });
            onVerify();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="question-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '10px' }}>
                {!isEditing && (
                    <button onClick={verifyQuestion} className="action-btn" style={{ background: 'var(--primary)', color: '#000', padding: '6px 12px', fontSize: '13px' }}>
                        Verify &amp; Save
                    </button>
                )}
                <button onClick={toggleEdit} className="action-btn" style={{ padding: '6px 12px', fontSize: '13px' }}>
                    {isEditing ? 'Cancel Edit' : '✏️ Edit'}
                </button>
            </div>

            {!isEditing ? (
                <>
                    {(editableData.comprehension_context || editableData.context || editableData.comprehension || editableData.passage) && (
                        <div className="comprehension-context">
                            <MathText text={editableData.comprehension_context || editableData.context || editableData.comprehension || editableData.passage} />
                        </div>
                    )}
                    <div className="question-text" style={{ paddingRight: '160px' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: '700', marginRight: '10px' }}>
                            Q {editableData.question_number || (index + 1)}.
                        </span>
                        {(editableData.question_type === 'matrix_match' || /List\s+I|Column\s+I/i.test(editableData.question)) ? (
                            <MatrixMatch text={editableData.question} />
                        ) : (
                            <MathText text={editableData.question} />
                        )}
                    </div>
                    {editableData.diagrams && editableData.diagrams.length > 0 && (
                        <div className="diagrams-grid">
                            {editableData.diagrams.map((diag: any, i: number) => (
                                <div key={i} className="diagram-container">
                                    <img src={diag.url} alt={diag.alt} />
                                    {diag.alt !== 'diagram' && <p className="diagram-caption">{diag.alt}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                    {editableData.options?.length > 0 && (
                        <div className="options-list">
                            {editableData.options.map((opt: any, i: number) => (
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
                            <input className="edit-input" value={editableData.question_number || (index + 1)} onChange={e => onChange({ question_number: e.target.value })} />
                        </div>
                        <div className="editor-group">
                            <label className="editor-label">Question Text</label>
                            <textarea className="edit-textarea" value={editableData.question} onChange={e => onChange({ question: e.target.value })} />
                        </div>
                    </div>
                    <div className="editor-group">
                        <label className="editor-label">Comprehension Context</label>
                        <textarea className="edit-textarea" style={{ minHeight: '80px' }} value={editableData.comprehension_context || editableData.context || ''} onChange={e => onChange({ comprehension_context: e.target.value })} />
                    </div>
                    <div className="options-list">
                        <label className="editor-label">Options</label>
                        {editableData.options.map((opt: any, i: number) => (
                            <div key={i} className="option-item" style={{ background: 'transparent', padding: '0', display: 'flex', gap: '10px' }}>
                                <div className="option-label" style={{ marginTop: '8px' }}>{opt.label}</div>
                                <input className="edit-input" value={opt.text} onChange={e => handleOptionChange(i, e.target.value)} />
                            </div>
                        ))}
                    </div>
                    <div className="editor-group" style={{ marginTop: '16px' }}>
                        <label className="editor-label">Associated Diagrams</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(editableData.diagrams || []).map((diag: any, i: number) => (
                                <div key={i} className="diagram-edit-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 40px', gap: '12px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                                    <div style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', background: '#333' }}>
                                        {diag.url ? <img src={diag.url} alt="prev" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>No img</div>}
                                    </div>
                                    <input className="edit-input" placeholder="Label/Alt" value={diag.alt} onChange={e => handleDiagramChange(i, 'alt', e.target.value)} />
                                    <input className="edit-input" placeholder="Image URL" value={diag.url} onChange={e => handleDiagramChange(i, 'url', e.target.value)} />
                                    <button onClick={() => handleDeleteDiagram(i)} className="action-btn" style={{ background: '#ff4444', color: '#fff', border: 'none', height: '36px', borderRadius: '6px' }}>✕</button>
                                </div>
                            ))}
                            <button onClick={handleAddDiagram} className="action-btn" style={{ padding: '8px', borderStyle: 'dashed', opacity: 0.7 }}>+ Add Diagram</button>
                        </div>
                    </div>
                    <button onClick={handleSaveEdits} className="action-btn" style={{ marginTop: '16px', background: 'var(--primary)', color: '#000', width: '100%' }}>
                        Save Edits
                    </button>
                </div>
            )}
        </div>
    );
});


export default function IITJEEPipeline() {
    const [activeModule, setActiveModule] = useState<'extraction' | 'builder'>('extraction');

    return (
        <main className="dashboard-container">
            <header className="fixed-header" style={{ zIndex: 10 }}>
                <div className="header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>AI Voice Builder Pipeline </h1>
                        <p style={{ color: 'var(--text-light)', opacity: 0.8, marginTop: '4px' }}>
                            Extraction logic and 3-LLM Variations Workflow
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            style={{ background: activeModule === 'extraction' ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: activeModule === 'extraction' ? '#000' : '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
                            onClick={() => setActiveModule('extraction')}
                        >
                            🏗 Extraction Pipeline
                        </button>
                        <button
                            style={{ background: activeModule === 'builder' ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: activeModule === 'builder' ? '#000' : '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
                            onClick={() => setActiveModule('builder')}
                        >
                            🤖 3-LLM Builder
                        </button>
                    </div>
                </div>
            </header>

            <div className="content-scroll" style={{ paddingTop: '10px' }}>
                {activeModule === 'extraction' ? <ExtractionPipeline /> : <QuestionBuilder />}
            </div>
        </main>
    );
}

function ExtractionPipeline() {
    const [file, setFile] = useState<File | null>(null);
    const [bookId, setBookId] = useState<string | null>(null);
    const [chapterName, setChapterName] = useState('Uncategorized');
    const [bookPages, setBookPages] = useState<any[]>([]);
    const [currentBookPageIndex, setCurrentBookPageIndex] = useState(0);

    const [status, setStatus] = useState<JobStatus>('idle');
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [verifiedIndexes, setVerifiedIndexes] = useState<number[]>([]);

    const currentPage = bookPages[currentBookPageIndex];

    const pollingIntervalRef = useRef<any>(null);

    useEffect(() => {
        if (!bookId || !currentPage?.name) return;

        setResult(null);
        setStatus('idle');
        setMessage('');
        setError(null);
        setVerifiedIndexes([]);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        const checkResult = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/iitjee/book/${bookId}/${currentPage.name}/result`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.type === 'multi' || data.questions) {
                        setResult(data);
                        setStatus('completed');
                        setMessage('Loaded historical extraction data.');
                    }
                }
            } catch (err) {
                // Not found. Await user manual processing.
            }
        };
        checkResult();
    }, [bookId, currentPage?.name]);

    const fetchBookPages = useCallback(async (bid: string) => {
        if (!bid) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/iitjee/book/${bid}/pages`);
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
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        let interval: any;
        if (bookId) {
            interval = setInterval(() => fetchBookPages(bookId), 4000);
        }
        return () => clearInterval(interval);
    }, [bookId, fetchBookPages]);

    const handleUpload = async () => {
        if (!file) {
            alert("Please select a PDF file.");
            return;
        }

        setStatus('uploading');
        setMessage('Uploading Book PDF...');
        setError(null);
        setResult(null);
        setVerifiedIndexes([]);
        setCurrentBookPageIndex(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/iitjee/book/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail?.message || 'Upload failed');

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
            await fetch(`${API_BASE_URL}/api/v1/iitjee/book/${bookId}/mark`, {
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
                const res = await fetch(`${API_BASE_URL}/api/v1/iitjee/status/${jobId}`);
                if (!res.ok) throw new Error("Status check failed");
                const data = await res.json();

                if (data.status === 'completed') {
                    setResult(data.result);
                    setStatus('completed');
                    setMessage('Extraction Complete!');
                    clearInterval(pollingIntervalRef.current);
                } else if (data.status === 'failed') {
                    setError(data.error || "Job failed");
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
        if (!bookId) return;
        setBookPages(prev => prev.map(p => p.name === pageName ? { ...p, actionStatus: 'process' } : p));
        setStatus('uploading');
        setMessage(`Processing: ${pageName}...`);
        setResult(null);
        setVerifiedIndexes([]);

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/iitjee/book/${bookId}/${pageName}/process`, {
                method: 'POST'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Process failed');
            if (data.job_id) {
                setCurrentJobId(data.job_id);
                startPolling(data.job_id);
            }
        } catch (err: any) {
            setError(err.message);
            setStatus('failed');
        }
    };

    const handleVerifySuccess = (idx: number) => {
        setVerifiedIndexes([...verifiedIndexes, idx]);
    };

    const questions = result?.type === 'single' ? [result] : result?.questions || [];

    return (
        <div style={{ height: '100%' }}>
            {bookId ? (
                <div className="split-view">
                    <div className="panel" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                        <div className="book-header">
                            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Active Book Viewer</h2>
                            <span className="book-meta">Book ID: {bookId}</span>
                        </div>

                        <div className="page-viewer-container" style={{ marginTop: '20px' }}>
                            {!currentPage ? (
                                <div className="empty-state" style={{ height: '300px' }}>
                                    <div className="loader"></div>
                                    <p style={{ marginTop: '20px' }}>Loading pages...</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        {currentPage.actionStatus && (
                                            <div className={`page-badge badge-${currentPage.actionStatus}`} style={{ top: '10px', right: '10px' }}>
                                                {currentPage.actionStatus}
                                            </div>
                                        )}
                                        <img src={currentPage.url} className="viewer-image" alt="Page View" />
                                    </div>

                                    <div className="page-nav-controls">
                                        <button className="step-btn" disabled={currentBookPageIndex === 0} onClick={() => setCurrentBookPageIndex(p => p - 1)}>← Back</button>
                                        <span className="page-indicator">Page {currentBookPageIndex + 1} of {bookPages.length || '?'}</span>
                                        <button className="step-btn" disabled={currentBookPageIndex >= bookPages.length - 1} onClick={() => setCurrentBookPageIndex(p => p + 1)}>Next →</button>
                                    </div>

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
                                            disabled={status === 'processing' || status === 'uploading'}
                                            onClick={() => handleProcessPage(currentPage.name)}
                                        >
                                            {result ? 'Reprocess Page AI' : 'Process Page AI'}
                                        </button>
                                    </div>
                                </>
                            )}
                            <button className="cancel-btn" onClick={() => { setBookId(null); setBookPages([]); setResult(null); }} style={{ marginTop: '20px', width: '100%' }}>
                                Close Viewer
                            </button>
                        </div>
                    </div>

                    <div className="panel result-panel-container" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                        <div className="book-header" style={{ marginBottom: '20px' }}>
                            <h2>Lab Output & Extraction</h2>
                        </div>

                        {status !== 'idle' && !result && (
                            <div className="status-box" style={{ marginBottom: '20px' }}>
                                <div className="status-header">
                                    {(status === 'uploading' || status === 'processing' || status === 'pending') && <div className="loader"></div>}
                                    <span className="status-text">{status.toUpperCase()}</span>
                                </div>
                                <p className="status-message">{message}</p>
                                {error && <p style={{ color: '#ff4444', marginTop: '8px' }}>{error}</p>}
                            </div>
                        )}

                        {result && (
                            <div className="result-panel">
                                <div className="universal-fields">
                                    <div className="editor-group" style={{ margin: 0 }}>
                                        <label className="editor-label">Book (For Verification Save)</label>
                                        <input className="edit-input" placeholder="e.g. Physics Vol 1" value={bookId} readOnly />
                                    </div>
                                    <div className="editor-group" style={{ margin: 0 }}>
                                        <label className="editor-label">Chapter</label>
                                        <input className="edit-input" placeholder="e.g. Light" value={chapterName} onChange={e => setChapterName(e.target.value)} />
                                    </div>
                                </div>
                                <p style={{ color: 'var(--text-light)', marginBottom: '20px', marginTop: '20px' }}>
                                    Review, edit, and individually verify questions before saving them to the repository for "{currentPage?.name}".
                                </p>
                                {questions.map((q: any, idx: number) => {
                                    const isVerified = verifiedIndexes.includes(idx);
                                    return (
                                        <div key={idx} style={{ opacity: isVerified ? 0.7 : 1, transition: 'all 0.3s', position: 'relative' }}>
                                            {isVerified && (
                                                <div style={{ position: 'absolute', top: '-10px', left: '-10px', background: '#10b981', color: '#000', padding: '4px 8px', borderRadius: '4px', zIndex: 10, fontWeight: 'bold', fontSize: '12px' }}>
                                                    ✓ Verified &amp; Saved
                                                </div>
                                            )}
                                            <QuestionItemEditor
                                                data={q}
                                                index={idx}
                                                jobId={currentJobId!}
                                                bookName={bookId}
                                                chapterName={chapterName}
                                                pageName={currentPage?.name || ''}
                                                onVerify={() => handleVerifySuccess(idx)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!result && status === 'idle' && (
                            <div className="empty-state">
                                <span>🧪</span>
                                <p>Select a page from the left and click Process Page AI.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }} className="control-panel">
                    <h2>Upload IIT JEE Book</h2>
                    <p style={{ color: 'var(--text-light)', marginTop: '8px' }}>
                        Upload a PDF book. It will be split into individual pages in the background, allowing you to selectively process pages using the AI.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={e => setFile(e.target.files?.[0] || null)}
                            style={{ color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '6px' }}
                        />

                        <button
                            className="action-btn"
                            onClick={handleUpload}
                            disabled={status === 'uploading' || status === 'processing'}
                            style={{ background: 'var(--primary)', color: '#000', fontWeight: 'bold', padding: '16px' }}
                        >
                            {status === 'uploading' ? 'Uploading...' : 'Upload Book PDF'}
                        </button>

                        {status !== 'idle' && (
                            <div className="status-box" style={{ marginTop: '20px' }}>
                                <div className="status-header">
                                    {(status === 'uploading' || status === 'processing') && <div className="loader"></div>}
                                    <span className="status-text">{status.toUpperCase()}</span>
                                </div>
                                <p className="status-message">{message}</p>
                                {error && <p style={{ color: '#ff4444', marginTop: '8px' }}>{error}</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
