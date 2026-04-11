'use client';

import { useState, useEffect, memo, useRef } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const DB_API_PREFIX = '/api/v1/question-builder/db';

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

const USD_TO_INR = 93;

const COST_CONFIG: any = {
    'gpt-5.4': { input: 2.50, output: 15.00 },
    'gpt-4o': { input: 2.50, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 }
};

const formatCurrency = (val: number) => {
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(val);
    const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val * USD_TO_INR);
    return `${usd} (${inr})`;
};

const calculateCost = (data: any, step: string) => {
    if (!data) return 0;
    
    // EXACT UNIT COSTS (Per 1M Tokens)
    const UNIT_COSTS: any = {
        'llm1': { input: 2.50, output: 15.00 },        // GPT 5.4
        'llm2': { input: 3.00, output: 15.00 },        // Claude Sonnet 4.6
        'llm3': { input: 3.00, output: 15.00 },        // Claude Sonnet 4.6
        'taxonomy': { input: 0.40, output: 1.60 }    // GPT 4.1 Mini
    };

    const config = UNIT_COSTS[step] || UNIT_COSTS['llm1'];
    
    // NEW NESTED STRUCTURE (prompt/completion)
    if (typeof data === 'object' && data.prompt !== undefined) {
        return (data.prompt * config.input / 1000000) + (data.completion * config.output / 1000000);
    }
    
    // OLD STRUCTURE FALLBACK (blended weighted rates)
    let tokens = typeof data === 'number' ? data : (data.total || data.total_tokens || 0);
    if (step === 'llm1') return tokens * 11.55 / 1000000;
    if (step === 'llm2' || step === 'llm3') return tokens * 9.22 / 1000000;
    if (step === 'taxonomy') return tokens * 0.51 / 1000000;

    return tokens * 10 / 1000000;
};

export default function DatabaseViewer() {
    const [books, setBooks] = useState<string[]>([]);
    const [selectedBook, setSelectedBook] = useState<string | null>(null);
    const [chapters, setChapters] = useState<string[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [globalStats, setGlobalStats] = useState<any>(null);
    const [bookStats, setBookStats] = useState<any>(null);
    const [chapterStats, setChapterStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    useEffect(() => {
        fetchGlobalStats();
        fetchBooks();
    }, []);

    const fetchGlobalStats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}${DB_API_PREFIX}/stats`);
            const data = await res.json();
            setGlobalStats(data);
        } catch (e) {
            console.error("Failed to fetch global stats", e);
        }
    };

    const fetchBooks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}${DB_API_PREFIX}/books`);
            const data = await res.json();
            setBooks(Array.isArray(data.books) ? data.books : Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch books", e);
        }
    };

    const fetchBookStats = async (bookName: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}${DB_API_PREFIX}/stats/${encodeURIComponent(bookName)}`);
            const data = await res.json();
            setBookStats(data);
        } catch (e) {
            console.error("Failed to fetch book stats", e);
        }
    };

    const fetchChapters = async (bookName: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}${DB_API_PREFIX}/${encodeURIComponent(bookName)}/chapters`);
            const data = await res.json();
            setChapters(Array.isArray(data.chapters) ? data.chapters : Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch chapters", e);
        }
    };

    const fetchChapterStats = async (bookName: string, chapterName: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}${DB_API_PREFIX}/stats/${encodeURIComponent(bookName)}/${encodeURIComponent(chapterName)}`);
            const data = await res.json();
            setChapterStats(data);
        } catch (e) {
            console.error("Failed to fetch chapter stats", e);
        }
    };

    const fetchQuestions = async (bookName: string, chapterName: string) => {
        setLoadingQuestions(true);
        try {
            const res = await fetch(`${API_BASE_URL}${DB_API_PREFIX}/${encodeURIComponent(bookName)}/${encodeURIComponent(chapterName)}/questions`);
            const data = await res.json();
            setQuestions(Array.isArray(data.questions) ? data.questions : Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch questions", e);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handleBookSelect = (book: string) => {
        setSelectedBook(curr => curr === book ? null : book);
        if (selectedBook !== book) {
            fetchChapters(book);
            fetchBookStats(book);
            setSelectedChapter(null);
            setQuestions([]);
            setChapterStats(null);
        }
    };

    const handleChapterSelect = (chapter: string) => {
        setSelectedChapter(curr => curr === chapter ? null : chapter);
        if (selectedChapter !== chapter) {
            if (selectedBook) {
                fetchQuestions(selectedBook, chapter);
                fetchChapterStats(selectedBook, chapter);
            }
        }
    };

    const StatsCard = ({ title, stats, color }: { title: string, stats: any, color: string }) => {
        if (!stats) return null;
        
        // Calculate estimated cost for the whole stat block
        const totalCost = stats.token_breakdown ? 
            Object.entries(stats.token_breakdown).reduce((acc, [step, val]) => acc + calculateCost(val, step), 0) :
            calculateCost(stats.total_tokens, 'llm1');

        const avgTripletCost = stats.reference_questions ? totalCost / stats.reference_questions : 0;
        const avgIndividualCost = stats.total_generated_questions ? totalCost / stats.total_generated_questions : 0;

        return (
            <div className="stats-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', border: `1px solid ${color}33`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', color: color, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📈 {title}
                    </h3>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>Total Pipeline Investment</div>
                        <div style={{ fontSize: '18px', color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(totalCost)}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
                    <div className="stat-item">
                        <label style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>Ref Questions</label>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats.reference_questions || 0}</div>
                    </div>
                    <div className="stat-item">
                        <label style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>Gen Questions</label>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats.total_generated_questions || 0}</div>
                    </div>
                    <div className="stat-item">
                        <label style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>Avg Cost / Ref Q</label>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(avgTripletCost)}</div>
                    </div>
                    <div className="stat-item">
                        <label style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>Avg Cost / Var</label>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(avgIndividualCost)}</div>
                    </div>
                </div>
                
                {stats.token_breakdown && (
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {Object.entries(stats.token_breakdown).map(([key, val]: [string, any]) => {
                            const stepCost = calculateCost(val, key);
                            const totalVal = typeof val === 'number' ? val : (val.total || 0);
                            return (
                                <div key={key} style={{ fontSize: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                    <div style={{ opacity: 0.5, textTransform: 'uppercase', marginBottom: '4px' }}>{key}</div>
                                    <div style={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>{totalVal?.toLocaleString() || 0}</div>
                                    {typeof val === 'object' && val.prompt !== undefined && (
                                        <div style={{ fontSize: '8px', opacity: 0.3, marginTop: '2px' }}>
                                            P:{val.prompt} C:{val.completion}
                                        </div>
                                    )}
                                    <div style={{ color: '#10b981', marginTop: '4px', fontSize: '9px', fontWeight: '500' }}>{formatCurrency(stepCost)}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="split-view" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="panel" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div className="control-panel">
                    <h2>Database Explorer</h2>
                    <p style={{ color: 'var(--text-light)', marginTop: '8px', fontSize: '14px' }}>Browse synced books and chapters.</p>
                    
                    <div style={{ marginTop: '20px' }}>
                        {globalStats && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '3px solid var(--primary)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                <div style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px' }}>Global Pipeline Impact</div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{globalStats.total_tokens?.toLocaleString() || 0}</div>
                                        <div style={{ fontSize: '10px', opacity: 0.5 }}>TOTAL TOKENS</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(globalStats.token_breakdown ? Object.entries(globalStats.token_breakdown).reduce((acc, [step, val]) => acc + calculateCost(val, step), 0) : calculateCost(globalStats.total_tokens, 'llm1'))}</div>
                                        <div style={{ fontSize: '10px', opacity: 0.5 }}>TOTAL EXPENDITURE</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 style={{ fontSize: '13px', opacity: 0.6, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Books Inventory</h3>
                            {(!Array.isArray(books) || books.length === 0) ? (
                                <p style={{ fontSize: '13px', opacity: 0.5 }}>No books found in database.</p>
                            ) : (
                                books.map(book => (
                                    <div key={book} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <button 
                                            onClick={() => handleBookSelect(book)}
                                            style={{ 
                                                width: '100%', 
                                                textAlign: 'left', 
                                                padding: '12px 16px', 
                                                background: selectedBook === book ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), transparent)' : 'rgba(255,255,255,0.03)', 
                                                border: selectedBook === book ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '8px',
                                                color: selectedBook === book ? 'var(--primary)' : '#fff',
                                                cursor: 'pointer',
                                                fontWeight: selectedBook === book ? 'bold' : 'normal',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <span>{selectedBook === book ? '📖 ' : '📚 '} {book}</span>
                                            <span style={{ fontSize: '10px', opacity: 0.5 }}>{selectedBook === book ? '▼' : '▶'}</span>
                                        </button>
                                        
                                        {selectedBook === book && (
                                            <div style={{ marginLeft: '12px', marginTop: '4px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid rgba(16, 185, 129, 0.2)', paddingLeft: '8px' }}>
                                                {(!Array.isArray(chapters) || chapters.length === 0) ? (
                                                    <p style={{ fontSize: '12px', opacity: 0.5, padding: '8px' }}>Loading chapters...</p>
                                                ) : (
                                                    chapters.map(chapter => (
                                                        <button 
                                                            key={chapter}
                                                            onClick={() => handleChapterSelect(chapter)}
                                                            style={{ 
                                                                width: '100%', 
                                                                textAlign: 'left', 
                                                                padding: '8px 12px', 
                                                                background: selectedChapter === chapter ? 'rgba(59, 130, 246, 0.1)' : 'transparent', 
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                color: selectedChapter === chapter ? '#3b82f6' : 'rgba(255,255,255,0.6)',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {selectedChapter === chapter ? '🔹 ' : '🔸 '} {chapter}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="panel result-panel-container" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div className="book-header" style={{ marginBottom: '20px' }}>
                    <h2>Performance Dashboard</h2>
                </div>

                {!selectedBook && globalStats && (
                    <StatsCard title="Global Aggregate Statistics" stats={globalStats} color="var(--primary)" />
                )}

                {selectedBook && (
                    <>
                        <StatsCard title={`Book Metrics: ${selectedBook}`} stats={bookStats} color="#a855f7" />
                        
                        {selectedChapter && (
                            <>
                                <StatsCard title={`Chapter Insight: ${selectedChapter}`} stats={chapterStats} color="#3b82f6" />
                                
                                <div className="questions-container" style={{ marginTop: '30px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <h3 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            📑 Synced Question Details
                                        </h3>
                                        <span style={{ fontSize: '12px', opacity: 0.6 }}>Total Sets: {questions.length}</span>
                                    </div>
                                    
                                    {loadingQuestions ? (
                                        <div className="loader"></div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {(!Array.isArray(questions) || questions.length === 0) ? (
                                                <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                                    <p style={{ opacity: 0.5 }}>No question triplets synced for this chapter yet.</p>
                                                </div>
                                            ) : (
                                                questions.map((q, idx) => {
                                                    const tripletCost = q.breakdown ? Object.entries(q.breakdown).reduce((acc, [step, val]) => acc + calculateCost(val, step), 0) : calculateCost(q.total_tokens, 'llm1');
                                                    const individualCost = tripletCost / 3;

                                                    return (
                                                        <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary)', opacity: 0.5 }}></div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'flex-start' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '2px' }}>REFERENCE INDEX</div>
                                                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>#{q.question_index ?? idx + 1}</div>
                                                                </div>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <div style={{ fontSize: '11px', opacity: 0.5, marginBottom: '2px' }}>PAGE NAME</div>
                                                                    <div style={{ fontSize: '12px', fontWeight: '500' }}>{q.page_name}</div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                                                                <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '15px' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                        <div>
                                                                            <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>Triplet Build Cost</div>
                                                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(tripletCost)}</div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>Per Variation Cost</div>
                                                                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(individualCost)}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                                    {q.breakdown ? Object.entries(q.breakdown).map(([llm, data]: [string, any]) => {
                                                                        const cost = calculateCost(data, llm);
                                                                        const tokens = typeof data === 'number' ? data : (data.total || data.total_tokens || 0);
                                                                        const inrVal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cost * USD_TO_INR);
                                                                        
                                                                        return (
                                                                            <div key={llm}>
                                                                                <div style={{ fontSize: '9px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '4px' }}>{llm}</div>
                                                                                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{tokens?.toLocaleString() || 0}</div>
                                                                                {typeof data === 'object' && data.prompt !== undefined && (
                                                                                    <div style={{ fontSize: '8px', opacity: 0.3, marginTop: '2px' }}>
                                                                                        P:{data.prompt} C:{data.completion}
                                                                                    </div>
                                                                                )}
                                                                                <div style={{ fontSize: '9px', color: '#10b981', marginTop: '2px' }}>{cost > 0 ? inrVal : ''}</div>
                                                                            </div>
                                                                        );
                                                                    }) : (
                                                                        <div style={{ gridColumn: 'span 4', fontSize: '11px', opacity: 0.4 }}>Breakdown unavailable</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '10px', opacity: 0.4 }}>Synced on: {q.synced_at ? new Date(q.synced_at).toLocaleString() : 'N/A'}</span>
                                                                <button 
                                                                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                                                    onClick={() => alert("Detailed view coming soon - check Builder tab for full content.")}
                                                                >
                                                                    View Pipeline Details
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
            
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .stat-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .stat-item label {
                    letter-spacing: 0.5px;
                }
            `}</style>
        </div>
    );
}
