'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import QuestionBuilder from './components/QuestionBuilder';

// --- Constants ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v2/organic-chemistry';

export default function OrganicChemistryV2() {
    // --- State ---
    const [books, setBooks] = useState<string[]>([]);
    const [selectedBook, setSelectedBook] = useState<string>('');
    const [pages, setPages] = useState<any[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentPage = pages[currentPageIndex];

    useEffect(() => {
        fetchBooks();
    }, []);

    const fetchBooks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/books`);
            const data = await res.json();
            setBooks(data || []);
        } catch (err) { console.error('Fetch books failed', err); }
    };

    const fetchPages = useCallback(async (bookId: string) => {
        if (!bookId) return;
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${encodeURIComponent(bookId)}/pages`);
            const data = await res.json();
            const formattedPages = (data.pages || []).map((p: any) => ({
                name: p.page_name,
                url: `${API_BASE_URL}${p.url}`
            }));
            setPages(formattedPages);
            setCurrentPageIndex(0);
        } catch (err) { console.error('Fetch pages failed', err); }
    }, []);

    useEffect(() => {
        if (selectedBook) fetchPages(selectedBook);
        else setPages([]);
    }, [selectedBook, fetchPages]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            setSelectedBook(data.book_id);
            fetchBooks();
        } catch (err: any) { setError(err.message); } finally { setIsUploading(false); }
    };

    return (
        <main className="chem-pipeline-root">
            <div className="chem-orb orb-1"></div>
            <div className="chem-orb orb-2"></div>

            <header className="chem-masthead">
                <div className="masthead-content">
                    <div className="chem-logo-area">
                        <Link href="/chemistry" className="chem-home-btn">← MODULES</Link>
                        <h1>Organic <span className="text-highlight">Chemistry</span> V2</h1>
                        <p>Vision-Priority Question Synthesis Engine</p>
                    </div>

                    {selectedBook && (
                        <div className="masthead-meta">
                            <div className="meta-pill">
                                <span className="glow-indic"></span>
                                {selectedBook}
                            </div>
                            <button className="chem-reset-btn" onClick={() => { setSelectedBook(''); setPages([]); }}>
                                SWITCH BOOK
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <section className="chem-viewport">
                {!selectedBook ? (
                    <div className="chem-init-card">
                        <div className="init-icon-frame"><div className="init-icon">🧪</div></div>
                        <h2>Vision Protocol Initiation</h2>
                        <p>Upload a PDF or select a book to begin high-precision question generation.</p>
                        <div className="library-wrapper">
                            <select className="premium-select" value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}>
                                <option value="">-- Choose Existing Book --</option>
                                {books.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <div className="or-divider"><span>OR</span></div>
                            <div className="chem-dropzone">
                                <input type="file" id="pdf-stream" accept="application/pdf" onChange={handleUpload} className="chem-hidden" />
                                <label htmlFor="pdf-stream" className="chem-upload-surface">
                                    <div className="up-icon">📂</div>
                                    <div className="up-text">{isUploading ? "PROCESSOR INITIALIZING..." : "Select Organic PDF"}</div>
                                </label>
                            </div>
                        </div>
                        {error && <p className="error-text">{error}</p>}
                    </div>
                ) : (
                    <div className="chem-workspace">
                        <div className="chem-side-panel source-side">
                            <div className="side-header">
                                <h3>SOURCE VISUALIZER</h3>
                                <div className="side-badge">{currentPageIndex + 1} / {pages.length}</div>
                            </div>
                            <div className="side-body visual-body">
                                {!currentPage ? (
                                    <div className="chem-shimmer-box"><p>SYNCHRONIZING...</p></div>
                                ) : (
                                    <div className="source-image-stage">
                                        <img src={currentPage.url} alt="Source Segment" />
                                    </div>
                                )}
                            </div>
                            <div className="side-footer">
                                <div className="chem-step-nav">
                                    <button onClick={() => setCurrentPageIndex(p => p - 1)} disabled={currentPageIndex === 0}>PREVIOUS</button>
                                    <button onClick={() => setCurrentPageIndex(p => p + 1)} disabled={!pages.length || currentPageIndex >= pages.length - 1}>NEXT</button>
                                </div>
                                <div className="page-indicator">PAGE {currentPageIndex + 1}</div>
                            </div>
                        </div>

                        <div className="chem-side-panel output-side">
                            <QuestionBuilder 
                                initialBookId={selectedBook} 
                                initialPageName={currentPage?.name} 
                            />
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
                    --glass-border: rgba(255, 255, 255, 0.1);
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
                .chem-orb { position: absolute; border-radius: 50%; filter: blur(120px); z-index: 0; opacity: 0.15; }
                .orb-1 { top: -100px; right: -100px; width: 400px; height: 400px; background: var(--chem-primary); }
                .orb-2 { bottom: -100px; left: -100px; width: 300px; height: 300px; background: var(--chem-green); }
                
                .chem-masthead { 
                    height: 80px; 
                    border-bottom: 1px solid var(--glass-border); 
                    background: rgba(15, 23, 42, 0.8); 
                    backdrop-filter: blur(20px); 
                    z-index: 10; 
                    padding: 0 40px; 
                    display: flex; 
                    align-items: center; 
                }
                .masthead-content { width: 100%; display: flex; justify-content: space-between; align-items: center; }
                .chem-logo-area h1 { font-size: 20px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
                .text-highlight { color: var(--chem-primary); }
                .chem-logo-area p { color: #94a3b8; font-size: 11px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
                .chem-home-btn { font-size: 10px; font-weight: 800; color: #475569; text-decoration: none; display: block; margin-bottom: 2px; }
                .chem-home-btn:hover { color: #fff; }
                
                .meta-pill { display: inline-flex; align-items: center; gap: 10px; background: rgba(16, 185, 129, 0.1); padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700; color: var(--chem-green); border: 1px solid rgba(16, 185, 129, 0.2); }
                .glow-indic { width: 6px; height: 6px; border-radius: 50%; background: var(--chem-green); box-shadow: 0 0 10px var(--chem-green); }
                .chem-reset-btn { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 10px; font-weight: 700; margin-left: 12px; transition: 0.2s; }
                .chem-reset-btn:hover { background: #1e293b; color: #fff; }

                .chem-viewport { flex: 1; padding: 20px; position: relative; z-index: 5; overflow: hidden; }
                .chem-init-card { max-width: 500px; margin: 40px auto; background: #0f172a; border: 1px solid var(--glass-border); border-radius: 32px; padding: 50px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                .init-icon-frame { width: 80px; height: 80px; background: rgba(99, 102, 241, 0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; border: 1px solid rgba(99, 102, 241, 0.2); }
                .init-icon { font-size: 40px; }
                .chem-init-card h2 { font-size: 24px; font-weight: 800; margin-bottom: 12px; }
                .chem-init-card p { color: #94a3b8; font-size: 14px; margin-bottom: 32px; line-height: 1.6; }
                
                .library-wrapper { display: flex; flex-direction: column; gap: 20px; }
                .premium-select { background: #000; border: 1px solid #1e293b; color: #fff; padding: 15px; border-radius: 12px; width: 100%; outline: none; font-size: 14px; transition: 0.2s; }
                .premium-select:focus { border-color: var(--chem-primary); box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); }
                
                .or-divider { text-align: center; position: relative; }
                .or-divider::before { content: ""; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #1e293b; }
                .or-divider span { background: #0f172a; padding: 0 12px; font-size: 10px; font-weight: 900; color: #475569; position: relative; }
                
                .chem-hidden { display: none; }
                .chem-upload-surface { display: flex; flex-direction: column; align-items: center; padding: 30px; border: 2px dashed #1e293b; border-radius: 20px; cursor: pointer; transition: 0.3s; background: rgba(0,0,0,0.2); }
                .chem-upload-surface:hover { border-color: var(--chem-primary); background: rgba(99, 102, 241, 0.05); }
                .up-icon { font-size: 32px; margin-bottom: 12px; }
                .up-text { font-size: 13px; font-weight: 800; color: #64748b; }
                .error-text { color: #ef4444; font-size: 12px; margin-top: 15px; }

                .chem-workspace { display: grid; grid-template-columns: 450px 1fr; gap: 20px; height: 100%; }
                .chem-side-panel { background: #0f172a; border: 1px solid var(--glass-border); border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3); }
                .side-header { padding: 16px 20px; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); }
                .side-header h3 { font-size: 11px; font-weight: 900; color: #64748b; letter-spacing: 1.5px; margin: 0; }
                .side-badge { background: var(--chem-primary); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; }
                
                .side-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
                .source-image-stage { background: #fff; border-radius: 12px; padding: 10px; }
                .source-image-stage img { width: 100%; height: auto; border-radius: 4px; }
                
                .side-footer { padding: 16px 20px; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); }
                .chem-step-nav { display: flex; gap: 8px; }
                .chem-step-nav button { background: #1e293b; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; color: #fff; font-size: 10px; font-weight: 800; cursor: pointer; transition: 0.2s; }
                .chem-step-nav button:hover:not(:disabled) { background: #334155; }
                .chem-step-nav button:disabled { opacity: 0.3; cursor: not-allowed; }
                .page-indicator { font-size: 11px; font-weight: 800; color: #475569; }

                .chem-shimmer-box { height: 200px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.02); border-radius: 12px; font-size: 12px; font-weight: 700; color: #475569; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
            `}</style>
        </main>
    );
}
