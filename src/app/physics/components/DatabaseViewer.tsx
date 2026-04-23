'use client';

import { useState, useEffect, memo, useRef } from 'react';
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

const USD_TO_INR = 93;

const formatCurrency = (val: number) => {
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(val);
    const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val * USD_TO_INR);
    return `${usd} (${inr})`;
};

export default function DatabaseViewer() {
    const [books, setBooks] = useState<string[]>([]);
    const [selectedBook, setSelectedBook] = useState<string | null>(null);
    const [chapters, setChapters] = useState<string[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [pages, setPages] = useState<string[]>([]);
    const [selectedPage, setSelectedPage] = useState<string | null>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [globalStats, setGlobalStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    useEffect(() => {
        fetchGlobalStats();
        fetchBooks();
    }, []);

    const fetchGlobalStats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/db/stats`);
            const data = await res.json();
            setGlobalStats(data);
        } catch (e) {
            console.error("Failed to fetch global stats", e);
        }
    };

    const fetchBooks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/source-verified/books`);
            const data = await res.json();
            setBooks(data.books || []);
        } catch (e) {
            console.error("Failed to fetch books", e);
        }
    };

    const fetchChapters = async (bookName: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/source-verified/${encodeURIComponent(bookName)}/chapters`);
            const data = await res.json();
            setChapters(data.chapters || []);
        } catch (e) {
            console.error("Failed to fetch chapters", e);
        }
    };

    const fetchPages = async (bookName: string, chapterName: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/source-verified/${encodeURIComponent(bookName)}/${encodeURIComponent(chapterName)}/pages`);
            const data = await res.json();
            setPages(data.pages || []);
        } catch (e) {
            console.error("Failed to fetch pages", e);
        }
    };

    const fetchQuestions = async (bookName: string, chapterName: string, pageName: string) => {
        setLoadingQuestions(true);
        try {
            // Using Section 5: results browsing for Physics
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/results/${encodeURIComponent(bookName)}/${encodeURIComponent(chapterName)}/${encodeURIComponent(pageName)}`);
            const data = await res.json();
            setQuestions(data.questions || []);
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
            setSelectedChapter(null);
            setPages([]);
            setQuestions([]);
        }
    };

    const handleChapterSelect = (chapter: string) => {
        setSelectedChapter(curr => curr === chapter ? null : chapter);
        if (selectedChapter !== chapter && selectedBook) {
            fetchPages(selectedBook, chapter);
            setSelectedPage(null);
            setQuestions([]);
        }
    };

    const handlePageSelect = (pageName: string) => {
        setSelectedPage(curr => curr === pageName ? null : pageName);
        if (selectedPage !== pageName && selectedBook && selectedChapter) {
            fetchQuestions(selectedBook, selectedChapter, pageName);
        }
    };

    return (
        <div className="split-view">
            <div className="panel" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div className="control-panel">
                    <h2>Physics DB Explorer</h2>
                    <p style={{ color: 'var(--text-light)', marginTop: '8px', fontSize: '14px' }}>Browse processed physics questions.</p>
                    
                    <div style={{ marginTop: '20px' }}>
                        {globalStats && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                <div style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px' }}>Global Impact</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{globalStats.total_tokens?.toLocaleString() || 0}</div>
                                        <div style={{ fontSize: '10px', opacity: 0.5 }}>TOKENS</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(globalStats.total_cost_inr / USD_TO_INR)}</div>
                                        <div style={{ fontSize: '10px', opacity: 0.5 }}>INVESTMENT</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {books.map(book => (
                                <div key={book}>
                                    <button onClick={() => handleBookSelect(book)} className={`mini-btn ${selectedBook === book ? 'active' : ''}`} style={{ width: '100%', textAlign: 'left', background: selectedBook === book ? 'rgba(0,0,0,0.4)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '4px', cursor: 'pointer', color: '#fff' }}>
                                        {selectedBook === book ? '📖 ' : '📚 '} {book}
                                    </button>
                                    
                                    {selectedBook === book && (
                                        <div style={{ marginLeft: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {chapters.map(chapter => (
                                                <div key={chapter}>
                                                    <button onClick={() => handleChapterSelect(chapter)} style={{ width: '100%', textAlign: 'left', background: selectedChapter === chapter ? 'rgba(59,130,246,0.2)' : 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: selectedChapter === chapter ? '#3b82f6' : '#aaa' }}>
                                                        {selectedChapter === chapter ? '● ' : '○ '} {chapter}
                                                    </button>
                                                    
                                                    {selectedChapter === chapter && (
                                                        <div style={{ marginLeft: '15px', display: 'flex', flexDirection: 'column' }}>
                                                            {pages.map(p => (
                                                                <button key={p} onClick={() => handlePageSelect(p)} style={{ textAlign: 'left', background: 'transparent', border: 'none', padding: '4px', fontSize: '12px', cursor: 'pointer', color: selectedPage === p ? '#10b981' : '#888' }}>
                                                                    📄 {p}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="panel result-panel-container" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div className="book-header"><h2>Result Details</h2></div>
                
                {loadingQuestions ? <div className="loader"></div> : (
                    <div style={{ marginTop: '20px' }}>
                        {questions.length === 0 ? <p style={{ opacity: 0.5 }}>Select a page to view results.</p> : (
                            questions.map((q, i) => (
                                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <strong>Question {q.folder}</strong>
                                        <span style={{ fontSize: '12px', color: '#10b981' }}>{q.cost_summary?.grand_total_inr ? `₹${q.cost_summary.grand_total_inr.toFixed(2)}` : ''}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px', opacity: 0.7 }}>
                                        <span>LLM1: {q.has_llm1 ? '✅' : '❌'}</span>
                                        <span>LLM2: {q.has_llm2 ? '✅' : '❌'}</span>
                                        <span>LLM3: {q.has_llm3 ? '✅' : '❌'}</span>
                                        <span>Images: {q.images_generated}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
