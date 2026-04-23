'use client';

import { useState, useRef, useEffect, memo, useCallback } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1/inorganic-chemistry';

const MathText = memo(function MathText({ text }: { text: string }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && text) {
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
        <div ref={containerRef} style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}>
            {processedText}
        </div>
    );
});

// --- Terminal Log Viewer ---
const TerminalLog = memo(function TerminalLog({ log }: { log: string }) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [log]);

    return (
        <div className="chem-terminal">
            <div className="terminal-top">
                <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
                <span className="t-label">pipeline.log — inorganic-engine-02</span>
            </div>
            <div className="terminal-cnt" ref={scrollRef}>
                <pre>{log || '> Initializing chemical pipeline...\n> Awaiting log stream...'}</pre>
            </div>
        </div>
    );
});

export default function QuestionBuilder() {
    const [selectedBook, setSelectedBook] = useState('');
    const [selectedPage, setSelectedPage] = useState('');
    
    const [status, setStatus] = useState<'idle' | 'building' | 'completed' | 'failed'>('idle');
    const [message, setMessage] = useState('');
    const [results, setResults] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
    const [taxonomyList, setTaxonomyList] = useState<string[]>([]);
    const [pyqChapter, setPyqChapter] = useState('');

    const pollInterval = useRef<any>(null);

    useEffect(() => {
        const fetchTaxonomy = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/taxonomy-list`);
                if (res.ok) {
                    const data = await res.json();
                    setTaxonomyList(Object.keys(data) || []);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchTaxonomy();
    }, []);

    const startBuild = async () => {
        if (!selectedBook || !selectedPage) {
            alert("Please specify Book ID and Page Name (e.g. from extraction tab)");
            return;
        }

        setStatus('building');
        setSyncStatus('idle');
        setMessage('Synthesizing inorganic chemistry variations. Starting 2-LLM pipeline...');
        setResults(null);

        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${selectedBook}/${selectedPage}/build-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pyq_chapter: pyqChapter })
            });
            
            if (!res.ok) throw new Error("Failed to start pipeline");
            
            pollResults();
        } catch (e: any) {
            setStatus('failed');
            setMessage(e.message);
        }
    };

    const pollResults = () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
        
        pollInterval.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${selectedBook}/${selectedPage}/pipeline-results`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);

                    if (data.final) {
                        clearInterval(pollInterval.current);
                        pollInterval.current = null;
                        setStatus('completed');
                        setMessage('Inorganic Question Pipeline completed successfully.');
                    }
                }
            } catch (e) {}
        }, 4000);
    };

    const saveToMongo = async () => {
        if (!selectedBook || !selectedPage) return;
        setSyncStatus('syncing');
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${selectedBook}/${selectedPage}/save-to-mongodb`, {
                method: 'POST'
            });
            if (res.ok) {
                setSyncStatus('synced');
                setMessage('Artifacts synchronized to iitjee_chemistry collection.');
            } else {
                setSyncStatus('failed');
            }
        } catch (e) {
            setSyncStatus('failed');
        }
    };

    const QuestionCard = ({ q, level }: { q: any, level: string }) => {
        if (!q) return null;
        const isVerified = q.verdict === 'verified';

        return (
            <div className="chem-q-card">
                <div className="q-card-header">
                    <span className="lvl-label">{level.toUpperCase()} VARIATION</span>
                    <span className={`verdict-badge ${isVerified ? 'verified' : 'flagged'}`}>
                        {isVerified ? '✓ VERIFIED' : '⚠ REVIEW'}
                    </span>
                </div>
                
                <div className="q-text">
                    <MathText text={q.question} />
                </div>
                
                <div className="options-grid">
                    {Object.entries(q.options || {}).map(([key, val]: any) => (
                        <div key={key} className={`opt-item ${q.correct_option === key ? 'correct' : ''}`}>
                            <div className="opt-key">{key}</div>
                            <div className="opt-val"><MathText text={val} /></div>
                        </div>
                    ))}
                </div>

                <div className="q-meta">
                    CORRECT OPTION: <span className="correct-val">{q.correct_option}</span>
                </div>

                <div className="q-solution">
                    <label>EXPLANATION & SOLUTION</label>
                    <div className="sol-text"><MathText text={q.solution || "No explanation provided."} /></div>
                </div>
            </div>
        );
    };

    return (
        <div className="chem-builder-workspace">
            <div className="builder-sidebar">
                <div className="sidebar-group">
                    <label>BOOK IDENTIFIER</label>
                    <input 
                        placeholder="e.g. Chemistry_NCERT_P1" 
                        value={selectedBook} 
                        onChange={e => setSelectedBook(e.target.value)} 
                    />
                </div>

                <div className="sidebar-group">
                    <label>PAGE NAME</label>
                    <input 
                        placeholder="e.g. page_001.jpg" 
                        value={selectedPage} 
                        onChange={e => setSelectedPage(e.target.value)} 
                    />
                </div>

                <div className="sidebar-group">
                    <label>EMULATE PYQ DIFFICULTY</label>
                    <select value={pyqChapter} onChange={e => setPyqChapter(e.target.value)}>
                        <option value="">-- Select Chapter --</option>
                        {taxonomyList.map(chap => <option key={chap} value={chap}>{chap}</option>)}
                    </select>
                </div>

                <TerminalLog log={results?.log || ''} />

                <button 
                    className="build-trigger-btn"
                    onClick={startBuild} 
                    disabled={status === 'building'}
                >
                    {status === 'building' ? 'PIPELINE ACTIVE...' : '🚀 DEPLOY 2-LLM BUILDER'}
                </button>
            </div>

            <div className="builder-main">
                <div className="main-header">
                    <h2>Validated Pipeline Outcomes</h2>
                    {status === 'completed' && (
                        <button 
                            className={`sync-btn ${syncStatus}`}
                            onClick={saveToMongo}
                            disabled={syncStatus === 'syncing' || syncStatus === 'synced'}
                        >
                            {syncStatus === 'syncing' ? 'SYNCING...' : syncStatus === 'synced' ? '✓ COMMITTED' : '📤 SYNC TO DB'}
                        </button>
                    )}
                </div>

                <div className="main-content">
                    {status === 'building' && !results?.final && (
                        <div className="build-loading">
                            <div className="chem-spinner"></div>
                            <p>Synthesizing Inorganic variations...</p>
                            <span>Generator is creating questions. Validator will follow.</span>
                        </div>
                    )}

                    {results?.final ? (
                        <div className="questions-stack">
                            {['easy', 'medium', 'hard'].map(lvl => (
                                <QuestionCard key={lvl} level={lvl} q={results.final[lvl]} />
                            ))}
                        </div>
                    ) : status === 'idle' && (
                        <div className="idle-state">
                            <p>Specify context origins and start the build pipeline.</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .chem-builder-workspace {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    height: 100%;
                    background: #020617;
                    border-radius: 24px;
                    overflow: hidden;
                }

                .builder-sidebar {
                    background: rgba(15, 23, 42, 0.4);
                    border-right: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .sidebar-group label {
                    display: block;
                    font-size: 10px;
                    font-weight: 800;
                    color: #6366f1;
                    margin-bottom: 8px;
                    letter-spacing: 1px;
                }

                .sidebar-group input, .sidebar-group select {
                    width: 100%;
                    background: #000;
                    border: 1px solid #1e293b;
                    padding: 12px;
                    border-radius: 10px;
                    color: #fff;
                    font-size: 13px;
                }

                .build-trigger-btn {
                    margin-top: auto;
                    background: #6366f1;
                    color: #fff;
                    border: none;
                    padding: 18px;
                    border-radius: 12px;
                    font-weight: 800;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
                }

                .builder-main {
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .main-header {
                    padding: 20px 40px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .main-header h2 { font-size: 18px; font-weight: 800; }

                .sync-btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 800;
                    cursor: pointer;
                    border: none;
                }
                .sync-btn.idle { background: #10b981; color: #000; }
                .sync-btn.synced { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981; }

                .main-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 40px;
                }

                .questions-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .chem-q-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    padding: 30px;
                }

                .q-card-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }

                .lvl-label { font-size: 10px; font-weight: 800; color: #94a3b8; }
                .verdict-badge { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 99px; }
                .verdict-badge.verified { background: rgba(16, 185, 129, 0.1); color: #10b981; }

                .q-text { font-size: 16px; font-weight: 500; line-height: 1.6; margin-bottom: 24px; }

                .options-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .opt-item {
                    display: flex;
                    gap: 12px;
                    background: rgba(0,0,0,0.3);
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .opt-item.correct { border-color: #10b981; background: rgba(16, 185, 129, 0.05); }

                .opt-key {
                    background: rgba(255, 255, 255, 0.1);
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 800;
                }
                .correct .opt-key { background: #10b981; color: #000; }

                .q-meta { font-size: 12px; font-weight: 800; color: #94a3b8; margin-bottom: 20px; }
                .correct-val { color: #10b981; margin-left: 10px; }

                .q-solution label { display: block; font-size: 10px; font-weight: 800; color: #10b981; margin-bottom: 10px; }
                .sol-text { font-size: 14px; color: #64748b; line-height: 1.6; }

                .chem-terminal {
                    background: #000;
                    border-radius: 12px;
                    border: 1px solid #1e293b;
                    overflow: hidden;
                    font-family: monospace;
                    margin-top: 10px;
                }
                .terminal-top { background: #1e293b; padding: 8px 12px; display: flex; align-items: center; gap: 6px; }
                .dot { width: 8px; height: 8px; border-radius: 50%; }
                .dot.r { background: #ff5f56; }
                .dot.y { background: #ffbd2e; }
                .dot.g { background: #27c93f; }
                .t-label { font-size: 9px; color: #94a3b8; margin-left: 10px; font-weight: 700; }
                .terminal-cnt { padding: 15px; height: 150px; overflow-y: auto; font-size: 11px; color: #10b981; }
                .terminal-cnt pre { white-space: pre-wrap; }

                .chem-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(99, 102, 241, 0.2);
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .build-loading { text-align: center; margin-top: 100px; }
                .build-loading p { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
                .build-loading span { font-size: 13px; color: #64748b; }
                
                .idle-state { text-align: center; margin-top: 100px; opacity: 0.3; }
            `}</style>
        </div>
    );
}
