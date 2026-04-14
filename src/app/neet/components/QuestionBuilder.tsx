'use client';

import { useState, useRef, useEffect, memo, useCallback } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

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
const TerminalLog = memo(function TerminalLog({ bookId, pageName }: { bookId: string, pageName: string }) {
    const [logs, setLogs] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bookId || !pageName) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${bookId}/${pageName}/pipeline/log`);
                if (res.ok) {
                    const text = await res.text();
                    setLogs(text);
                }
            } catch (e) {}
        }, 3000);
        return () => clearInterval(interval);
    }, [bookId, pageName]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs]);

    return (
        <div className="bio-terminal">
            <div className="terminal-top">
                <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
                <span className="t-label">pipeline.log — build-engine-04</span>
            </div>
            <div className="terminal-cnt" ref={scrollRef}>
                <pre>{logs || '> Establishing AI socket...\n> Waiting for build logs...'}</pre>
            </div>
        </div>
    );
});
const COST_CONFIG: any = {
    'gpt-5.4': { input: 2.50, output: 15.00 },
    'gpt-4o': { input: 2.50, output: 15.00 },
    'claude-sonnet-4-6': { input: 3.00, output: 15.00 }
};

const USD_TO_INR = 93;

const calculateCostRaw = (usage: any, model: string) => {
    if (!usage) return 0;
    const config = COST_CONFIG[model] || COST_CONFIG['gpt-5.4'];
    const pTokens = (usage.prompt_tokens || usage.input_tokens || 0);
    const cTokens = (usage.completion_tokens || usage.output_tokens || 0);
    
    const costUsd = ((pTokens / 1000000) * config.input) + ((cTokens / 1000000) * config.output);
    return (costUsd * USD_TO_INR);
};

const formatINR = (usage: any, model: string) => {
    return `₹${calculateCostRaw(usage, model).toFixed(2)}`;
};

const getTotalTokens = (usage: any) => {
    if (!usage) return 0;
    return (usage.prompt_tokens || usage.input_tokens || 0) + (usage.completion_tokens || usage.output_tokens || 0);
};

export default function QuestionBuilder() {
    const [books, setBooks] = useState<string[]>([]);
    const [selectedBook, setSelectedBook] = useState('');
    const [pages, setPages] = useState<string[]>([]);
    const [selectedPage, setSelectedPage] = useState('');
    
    const [status, setStatus] = useState<'idle' | 'building' | 'completed' | 'failed'>('idle');
    const [message, setMessage] = useState('');
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [results, setResults] = useState<any>(null);
    const [referenceData, setReferenceData] = useState<any>(null);
    const [viewTab, setViewTab] = useState<'final' | 'llm1' | 'llm2' | 'stats'>('final');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
    const [taxonomyList, setTaxonomyList] = useState<string[]>([]);
    const [pyqChapter, setPyqChapter] = useState('');

    const pollInterval = useRef<any>(null);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/pipeline/books`);
                const data = await res.json();
                setBooks(data.books || []);
            } catch (e) {
                console.error(e);
            }
        };
        const fetchTaxonomy = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/taxonomy-list`);
                if (res.ok) {
                    const data = await res.json();
                    setTaxonomyList(Object.keys(data) || []);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchBooks();
        fetchTaxonomy();
    }, []);

    useEffect(() => {
        if (!selectedBook) { setPages([]); setSelectedPage(''); return; }
        const fetchPages = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/pipeline/${selectedBook}/pages`);
                const data = await res.json();
                setPages(data.pages || []);
            } catch (e) {
                console.error(e);
            }
        };
        fetchPages();
    }, [selectedBook]);

    // Check for existing results when page changes
    useEffect(() => {
        if (!selectedBook || !selectedPage) { 
            setResults(null); 
            setReferenceData(null);
            setSyncStatus('idle');
            return; 
        }
        
        const fetchInitialState = async () => {
            try {
                // 1. Fetch reference content independently
                const refRes = await fetch(`${API_BASE_URL}/api/v1/biology/book/${selectedBook}/${selectedPage}/pipeline/reference`);
                if (refRes.ok) {
                    const refJson = await refRes.json();
                    setReferenceData(refJson);
                }

                // 2. Separately check for pipeline outputs
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${selectedBook}/${selectedPage}/pipeline-results`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.final_response || data.llm1) {
                        setResults(data);
                        setStatus('completed');
                    } else {
                        setResults(null);
                        setStatus('idle');
                    }
                } else {
                    setResults(null);
                    setStatus('idle');
                }
            } catch (e) {
                setStatus('idle');
            }
        };
        fetchInitialState();
    }, [selectedBook, selectedPage]);

    const startBuild = async () => {
        if (!selectedBook || !selectedPage) return;

        setStatus('building');
        setMessage('Synthesizing biological context. Starting AI background pipeline...');
        setResults((prev: any) => ({ reference_content: prev?.reference_content }));

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${selectedBook}/${selectedPage}/build-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pyq_chapter: pyqChapter })
            });
            const data = await res.json();
            
            // Start polling as the backend processes in the background
            pollResourcePaths();
            setMessage(data.message || 'Pipeline started. Monitoring generation progress...');
        } catch (e: any) {
            setStatus('failed');
            setMessage(e.message);
        }
    };

    const pollResourcePaths = () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
        
        let attempts = 0;
        pollInterval.current = setInterval(async () => {
            attempts++;
            if (attempts > 150) { 
                clearInterval(pollInterval.current);
                setStatus('failed');
                setMessage('Pipeline timeout.');
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${selectedBook}/${selectedPage}/pipeline-results`);
                if (res.ok) {
                    const data = await res.json();
                    
                    const finalData = data.final || data.final_response;
                    const reference = data.reference || data.reference_content;

                    if (reference && !referenceData) setReferenceData(reference);

                    setResults((prev: any) => ({
                        ...prev,
                        llm1: data.llm1 || prev?.llm1,
                        llm2: data.llm2 || prev?.llm2,
                        final_response: finalData || prev?.final_response
                    }));

                    if (finalData) {
                        clearInterval(pollInterval.current);
                        pollInterval.current = null;
                        setStatus('completed');
                        setMessage('NEET Question Pipeline completed successfully.');
                    } else if (data.llm2) {
                        setMessage('Validator (LLM2) completed. Synthesizing final response...');
                    } else if (data.llm1) {
                        setMessage('Generator (LLM1) completed. Validator (LLM2) is now processing...');
                    }
                }
            } catch (e) {}
        }, 4000);
    };

    const saveToMongo = async () => {
        if (!selectedBook || !selectedPage) return;
        setSyncStatus('syncing');
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/biology/book/${selectedBook}/${selectedPage}/save-to-mongodb`, {
                method: 'POST'
            });
            if (res.ok) {
                setSyncStatus('synced');
                setMessage('Successfully synchronized all pipeline artifacts to MongoDB.');
            } else {
                setSyncStatus('failed');
                setMessage('Database synchronization failed.');
            }
        } catch (e) {
            setSyncStatus('failed');
            setMessage('Network error during database synchronization.');
        }
    };

    const calculateCost = (usage: any, modelType: 'gpt' | 'claude') => {
        if (!usage) return 0;
        
        let inputRate = 0;
        let outputRate = 15.00 / 1000000; // Both models use $15.00 for output
        
        if (modelType === 'gpt') {
            inputRate = 2.50 / 1000000;
        } else {
            inputRate = 3.00 / 1000000;
        }

        const usdCost = (usage.prompt_tokens * inputRate) + (usage.completion_tokens * outputRate);
        return usdCost * 93; // 1 USD = 93 INR
    };



    const QuestionCard = ({ q, level, validator, phase }: { q: any, level: string, validator?: any, phase?: string }) => {
        const baseContent = (phase === 'Validator' && results?.llm1?.[level]) ? results.llm1[level] : q;
        if (!baseContent) return null;
        
        // Final view checks the explicit string. Active phases default cleanly without forcing a false-negative status.
        const isVerified = phase ? true : (q.verdict === 'verified' || q.verdict === 'correct');

        return (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${isVerified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {level} VARIATION <span style={{ opacity: 0.6 }}>{phase ? `[${phase}]` : ''}</span>
                    </div>
                    
                    {!phase && ( // Only show Verdict Badge on Final Block
                        <div style={{ padding: '6px 12px', borderRadius: '99px', fontSize: '10px', fontWeight: 'bold', background: isVerified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: isVerified ? '#10b981' : '#ef4444', border: `1px solid ${isVerified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                            {isVerified ? '✓ VERIFIED' : '⚠ ATTENTION'}
                        </div>
                    )}
                </div>
                
                <div style={{ fontSize: '16px', lineHeight: '1.6', color: '#f1f5f9', marginBottom: '24px', fontWeight: '500' }}>
                    <MathText text={baseContent.question || q.question} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    {Object.entries(baseContent.options || q.options || {}).map(([key, val]: any) => (
                        <div key={key} style={{ display: 'flex', gap: '12px', background: q.correct_option === key ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: `1px solid ${q.correct_option === key ? '#10b981' : 'rgba(255,255,255,0.05)'}` }}>
                            <div style={{ background: q.correct_option === key ? '#10b981' : 'rgba(255,255,255,0.1)', color: q.correct_option === key ? '#000' : '#fff', width: '28px', height: '28px', minWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>{key}</div>
                            <div style={{ fontSize: '14px', color: '#cbd5e1', paddingTop: '4px' }}><MathText text={val} /></div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: '24px', fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', alignItems: 'center' }}>
                    CORRECT OPTION: <span style={{ marginLeft: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{q.correct_option}</span>
                </div>

                <div style={{ background: '#000', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: validator?.explanation ? '16px' : '0' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', letterSpacing: '1px', marginBottom: '10px', textTransform: 'uppercase' }}>EXPLANATION & SOLUTION ({phase || 'FINAL'})</div>
                    <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#94a3b8' }}><MathText text={q.solution} /></div>
                </div>

                {validator?.explanation && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#ef4444', letterSpacing: '1px', marginBottom: '10px', textTransform: 'uppercase' }}>VALIDATOR ANALYSIS</div>
                        <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#fca5a5' }}><MathText text={validator.explanation} /></div>
                    </div>
                )}
            </div>
        );
    };

    const hasResults = !!results;
    
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', height: 'calc(100vh - 120px)', background: '#020617', color: '#fff', overflow: 'hidden' }}>
            
            {/* LEFT PANEL */}
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15, 23, 42, 0.4)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>Select Book</label>
                    <select value={selectedBook} onChange={e => setSelectedBook(e.target.value)} style={{ padding: '12px 14px', background: '#000', border: '1px solid #1e293b', color: '#fff', borderRadius: '10px', fontSize: '13px', outline: 'none', fontWeight: 'bold' }}>
                        <option value="">-- Verified Books --</option>
                        {books.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>Select Resource Page</label>
                    <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} disabled={!selectedBook} style={{ padding: '12px 14px', background: '#000', border: '1px solid #1e293b', color: '#fff', borderRadius: '10px', fontSize: '13px', outline: 'none', fontWeight: 'bold', opacity: !selectedBook ? 0.4 : 1 }}>
                        <option value="">-- Saved Pages --</option>
                        {pages.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>Emulate Difficulty (PYQ Chapter)</label>
                    <select value={pyqChapter} onChange={e => setPyqChapter(e.target.value)} style={{ padding: '12px 14px', background: '#000', border: '1px solid #1e293b', color: '#fff', borderRadius: '10px', fontSize: '13px', outline: 'none', fontWeight: 'bold' }}>
                        <option value="">-- Select Chapter --</option>
                        {taxonomyList.map(chap => <option key={chap} value={chap}>{chap}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', background: '#000', flex: 1, borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden' }}>
                    <div style={{ background: '#1e293b', padding: '12px 16px', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Reference Content View</div>
                    <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                        {referenceData?.selected_blocks ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {referenceData.selected_blocks.map((block: any, idx: number) => (
                                    <div key={idx} style={{ paddingBottom: '20px', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
                                        <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'inline-block', padding: '4px 8px', borderRadius: '6px', marginBottom: '10px', letterSpacing: '1px' }}>{block.type?.toUpperCase()}</div>
                                        <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#cbd5e1' }}><MathText text={block.content} /></div>
                                    </div>
                                ))}
                            </div>
                        ) : referenceData?.full_text ? (
                            <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#cbd5e1' }}><MathText text={referenceData.full_text} /></div>
                        ) : (
                            <div style={{ textAlign: 'center', opacity: 0.4, marginTop: '40px', fontSize: '13px' }}>Awaiting valid content origin.</div>
                        )}
                    </div>
                </div>

                {(status === 'building' || status === 'completed') && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Pipeline Status</div>
                        <div style={{ fontSize: '13px', color: status === 'building' ? '#10b981' : '#fff' }}>{message}</div>
                    </div>
                )}

                <button 
                    onClick={startBuild} 
                    disabled={!selectedPage || status === 'building'} 
                    style={{ background: '#10b981', color: '#000', border: 'none', padding: '18px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: (!selectedPage || status === 'building') ? 'not-allowed' : 'pointer', opacity: (!selectedPage || status === 'building') ? 0.5 : 1, transition: 'all 0.2s', marginTop: 'auto', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)' }}
                >
                    {status === 'building' ? 'ASSEMBLING PIPELINE...' : '🚀 START QUESTION BUILD'}
                </button>
            </div>

            {/* RIGHT PANEL */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>
                <div style={{ padding: '0 30px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', gap: '30px' }}>
                    <button onClick={() => setViewTab('final')} style={{ background: 'none', border: 'none', padding: '24px 0', borderBottom: `2px solid ${viewTab === 'final' ? '#10b981' : 'transparent'}`, color: viewTab === 'final' ? '#10b981' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>Final Validated Outcomes</button>
                    <button onClick={() => setViewTab('llm1')} style={{ background: 'none', border: 'none', padding: '24px 0', borderBottom: `2px solid ${viewTab === 'llm1' ? '#3b82f6' : 'transparent'}`, color: viewTab === 'llm1' ? '#3b82f6' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>L1 Generative Array</button>
                    <button onClick={() => setViewTab('llm2')} style={{ background: 'none', border: 'none', padding: '24px 0', borderBottom: `2px solid ${viewTab === 'llm2' ? '#a855f7' : 'transparent'}`, color: viewTab === 'llm2' ? '#a855f7' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>L2 Validation Array</button>
                    <button onClick={() => setViewTab('stats')} style={{ background: 'none', border: 'none', padding: '24px 0', borderBottom: `2px solid ${viewTab === 'stats' ? '#f59e0b' : 'transparent'}`, color: viewTab === 'stats' ? '#f59e0b' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>Cost Metrics & Analytics</button>
                    
                    {status === 'completed' && (
                        <button 
                            onClick={saveToMongo}
                            disabled={syncStatus === 'syncing' || syncStatus === 'synced'}
                            style={{ 
                                marginLeft: 'auto', alignSelf: 'center', padding: '10px 20px', borderRadius: '8px', 
                                background: syncStatus === 'synced' ? 'rgba(16, 185, 129, 0.1)' : '#10b981',
                                color: syncStatus === 'synced' ? '#10b981' : '#000',
                                fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px',
                                cursor: (syncStatus === 'syncing' || syncStatus === 'synced') ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s', border: syncStatus === 'synced' ? '1px solid #10b981' : 'none'
                            }}
                        >
                            {syncStatus === 'syncing' ? '⌛ SYNCING...' : syncStatus === 'synced' ? '✓ COMMITTED TO MONGO' : '📤 SYNC TO DATABASE'}
                        </button>
                    )}
                </div>

                <div style={{ padding: '40px', overflowY: 'auto', flex: 1, position: 'relative' }}>
                    {status === 'building' && !hasResults && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px' }}>
                            <div style={{ width: '60px', height: '60px', border: '4px solid rgba(16, 185, 129, 0.2)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>Synthesizing NEET Content Pipeline...</p>
                            <span style={{ fontSize: '13px', color: '#10b981' }}>{message}</span>
                        </div>
                    )}

                    {status === 'idle' && !hasResults && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3 }}>
                            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🧪</div>
                            <p style={{ fontSize: '16px' }}>Select an Origin Page & Start the Build Pipeline.</p>
                        </div>
                    )}

                    {hasResults && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '850px', margin: '0 auto' }}>
                            {viewTab === 'final' && results.final_response && (
                                <>
                                    {['easy', 'medium', 'hard'].map((lvl) => (
                                        <QuestionCard key={lvl} level={lvl} q={results.final_response[lvl]} />
                                    ))}
                                </>
                            )}

                            {viewTab === 'llm1' && results.llm1 && (
                                <>
                                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', color: '#10b981', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>GENERATOR PIPELINE (LLM 1)</h4>
                                    {['easy', 'medium', 'hard'].map((lvl) => (
                                        <QuestionCard key={lvl} level={lvl} q={results.llm1[lvl]} phase="Generator" />
                                    ))}
                                </>
                            )}

                            {viewTab === 'llm2' && results.llm2 && (
                                <>
                                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', color: '#10b981', textAlign: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>VALIDATION PIPELINE (LLM 2)</h4>
                                    {['easy', 'medium', 'hard'].map((lvl) => (
                                        <QuestionCard key={lvl} level={lvl} q={results.llm2[lvl]} validator={results.llm2[lvl]} phase="Validator" />
                                    ))}
                                </>
                            )}

                            {viewTab === 'stats' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                                        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '20px', border: '1px solid #1e293b', textAlign: 'center' }}>
                                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', marginBottom: '12px', fontWeight: 'bold' }}>LLM 1 Context Tokens</div>
                                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace', marginBottom: '8px' }}>{getTotalTokens(results.llm1?.usage)}</div>
                                            <div style={{ fontSize: '11px', color: '#475569' }}>Generator Core (GPT-5.4)</div>
                                        </div>
                                        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '20px', border: '1px solid #1e293b', textAlign: 'center' }}>
                                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', marginBottom: '12px', fontWeight: 'bold' }}>LLM 2 Logic Tokens</div>
                                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace', marginBottom: '8px' }}>{getTotalTokens(results.llm2?.usage)}</div>
                                            <div style={{ fontSize: '11px', color: '#475569' }}>Validator Logic (Claude Sonnet 4.6)</div>
                                        </div>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '24px', borderRadius: '20px', border: '1px solid #10b981', textAlign: 'center' }}>
                                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#10b981', marginBottom: '12px', fontWeight: 'bold' }}>Total Pipeline Output</div>
                                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace', marginBottom: '8px' }}>{getTotalTokens(results.llm1?.usage) + getTotalTokens(results.llm2?.usage)}</div>
                                            <div style={{ fontSize: '11px', color: '#10b981' }}>Combined Net Utilization</div>
                                        </div>
                                    </div>

                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #1e293b', borderRadius: '24px', padding: '40px' }}>
                                        <h3 style={{ fontSize: '14px', color: '#10b981', margin: '0 0 30px 0', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Pipeline Cost Transparency (INR)</h3>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '30px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Compute Phase</th>
                                                    <th style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Model Interface</th>
                                                    <th style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Tokens (P+C)</th>
                                                    <th style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Financial Impact</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1' }}>Context Generation</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1' }}>GPT-5.4 Base</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1', fontFamily: 'monospace' }}>{getTotalTokens(results.llm1?.usage)}</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1' }}>{formatINR(results.llm1?.usage, 'gpt-5.4')}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1' }}>Academic Verification</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1' }}>Claude Sonnet 4.6</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1', fontFamily: 'monospace' }}>{getTotalTokens(results.llm2?.usage)}</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px', color: '#cbd5e1' }}>{formatINR(results.llm2?.usage, 'claude-sonnet-4-6')}</td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={3} style={{ paddingTop: '24px', borderTop: '2px solid #1e293b', fontSize: '16px', color: '#10b981', fontWeight: 'bold' }}>Total Estimated Resource Cost</td>
                                                    <td style={{ paddingTop: '24px', borderTop: '2px solid #1e293b', fontSize: '16px', color: '#10b981', fontWeight: 'bold' }}>₹{(calculateCostRaw(results.llm1?.usage, 'gpt-5.4') + calculateCostRaw(results.llm2?.usage, 'claude-sonnet-4-6')).toFixed(2)}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <div style={{ textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
                                            Unit Cost per Verified NCERT Question: <span style={{ fontSize: '20px', color: '#fff', fontWeight: 'bold', marginLeft: '10px' }}>₹{((calculateCostRaw(results.llm1?.usage, 'gpt-5.4') + calculateCostRaw(results.llm2?.usage, 'claude-sonnet-4-6')) / 3).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
