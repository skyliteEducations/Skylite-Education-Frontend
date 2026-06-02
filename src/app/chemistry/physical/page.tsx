'use client';

import { useState, useRef, useEffect, memo, useCallback } from 'react';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1/physical-chemistry';

// --- Reusable KaTeX Math Component ---
const MathText = memo(function MathText({ text }: { text: string }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && text) {
            try {
                // Pre-process common double backslashes in serialized JSON to prevent KaTeX rendering issues
                let processed = text.replace(/\\\\/g, '\\');
                containerRef.current.innerHTML = processed;

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

    return (
        <div ref={containerRef} style={{ display: 'inline-block', whiteSpace: 'pre-wrap', width: '100%', wordBreak: 'break-word' }} />
    );
});

// --- Live Terminal Console ---
const TerminalLog = memo(function TerminalLog({ 
    chapterNumber, 
    seedId, 
    isActive 
}: { 
    chapterNumber: number | string, 
    seedId: string, 
    isActive: boolean 
}) {
    const [logs, setLogs] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive || !chapterNumber || !seedId) {
            if (!isActive) setLogs('');
            return;
        }

        const fetchLogs = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${chapterNumber}/${seedId}/pipeline/log`);
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data.log || '');
                }
            } catch (e) {
                console.error("Failed to fetch logs:", e);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, [chapterNumber, seedId, isActive]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="terminal-wrapper">
            <div className="terminal-bar">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
                <span className="terminal-title">pipeline.log — physical-chemistry-engine</span>
            </div>
            <div ref={scrollRef} className="terminal-body">
                <pre>{logs || '> Establishing secure socket to generation core...\n> Waiting for build pipeline execution signal...'}</pre>
            </div>

            <style jsx>{`
                .terminal-wrapper {
                    background: #090d16;
                    border: 1px solid rgba(244, 63, 94, 0.2);
                    border-radius: 16px;
                    overflow: hidden;
                    font-family: 'Fira Code', 'Courier New', monospace;
                    margin-top: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .terminal-bar {
                    background: #0f172a;
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .dot.red { background: #ef4444; }
                .dot.yellow { background: #f59e0b; }
                .dot.green { background: #10b981; }
                .terminal-title {
                    font-size: 10px;
                    color: #64748b;
                    margin-left: 12px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }
                .terminal-body {
                    padding: 16px;
                    height: 180px;
                    overflow-y: auto;
                    font-size: 11px;
                    color: #fb7185;
                    line-height: 1.5;
                }
                .terminal-body pre {
                    white-space: pre-wrap;
                    margin: 0;
                }
            `}</style>
        </div>
    );
});

export default function PhysicalChemistryPipeline() {
    const [chapters, setChapters] = useState<number[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<number | string>('');
    const [seedsSummary, setSeedsSummary] = useState<any[]>([]);
    const [selectedSeedId, setSelectedSeedId] = useState<string>('');
    const [seedDetail, setSeedDetail] = useState<any>(null);
    const [chapterTitle, setChapterTitle] = useState<string>('');

    const [status, setStatus] = useState<'idle' | 'building' | 'completed' | 'failed'>('idle');
    const [message, setMessage] = useState<string>('');
    const [results, setResults] = useState<any>(null);
    const [viewTab, setViewTab] = useState<'final' | 'llm1' | 'llm2' | 'consensus' | 'stats'>('final');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');

    const pollIntervalRef = useRef<any>(null);

    // 1. Initial Load: Fetch Chapters available in backend
    useEffect(() => {
        const fetchChapters = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/books/chapters`);
                if (res.ok) {
                    const data = await res.json();
                    setChapters(data.chapters || []);
                }
            } catch (e) {
                console.error("Failed to load chapters:", e);
            }
        };
        fetchChapters();
    }, []);

    // 2. Fetch Seeds list when Chapter changes
    useEffect(() => {
        if (!selectedChapter) {
            setSeedsSummary([]);
            setChapterTitle('');
            setSelectedSeedId('');
            setSeedDetail(null);
            setResults(null);
            setStatus('idle');
            return;
        }

        const fetchSeeds = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/books/chapter/${selectedChapter}/seeds`);
                if (res.ok) {
                    const data = await res.json();
                    setSeedsSummary(data.seeds || []);
                    setChapterTitle(data.chapter_title || '');
                }
            } catch (e) {
                console.error("Failed to load seeds:", e);
            }
        };
        fetchSeeds();
    }, [selectedChapter]);

    // 3. Fetch Seed Detail when Seed selection changes, and auto-fetch existing pipeline results if completed previously
    useEffect(() => {
        if (!selectedChapter || !selectedSeedId) {
            setSeedDetail(null);
            setResults(null);
            setStatus('idle');
            return;
        }

        const fetchSeedDetailAndOutputs = async () => {
            try {
                // Fetch details of seed
                const detailRes = await fetch(`${API_BASE_URL}${API_PREFIX}/books/chapter/${selectedChapter}/seed/${selectedSeedId}`);
                if (detailRes.ok) {
                    const detailData = await detailRes.json();
                    setSeedDetail(detailData);
                }

                // Check if pipeline has a completed or run history in pipeline base folder
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${selectedChapter}/${selectedSeedId}/pipeline-results`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.final || data.llm1) {
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
                console.error("Failed to fetch initial state:", e);
            }
        };

        setSyncStatus('idle');
        fetchSeedDetailAndOutputs();
    }, [selectedChapter, selectedSeedId]);

    // 4. Trigger background pipeline build
    const startBuild = async () => {
        if (!selectedChapter || !selectedSeedId) return;

        setStatus('building');
        setSyncStatus('idle');
        setMessage('Initializing Physical Chemistry generator engine...');
        setResults(null);

        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${selectedChapter}/${selectedSeedId}/build-questions`, {
                method: 'POST'
            });
            const data = await res.json();

            // Begin polling results
            pollPipeline();
            setMessage(data.message || 'Consensus generation started in the background. Monitoring...');
        } catch (e: any) {
            setStatus('failed');
            setMessage(e.message || 'Failed to dispatch pipeline script.');
        }
    };

    // 5. Polling for pipeline results
    const pollPipeline = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        let attempts = 0;
        pollIntervalRef.current = setInterval(async () => {
            attempts++;
            if (attempts > 120) { // Limit to 6 minutes
                clearInterval(pollIntervalRef.current);
                setStatus('failed');
                setMessage('Generation pipeline reached maximum timeout threshold.');
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${selectedChapter}/${selectedSeedId}/pipeline-results`);
                if (res.ok) {
                    const data = await res.json();
                    
                    setResults((prev: any) => ({
                        ...prev,
                        seed: data.seed || prev?.seed,
                        llm1: data.llm1 || prev?.llm1,
                        llm2: data.llm2 || prev?.llm2,
                        final: data.final || prev?.final,
                        stats: data.stats || prev?.stats,
                        log: data.log || prev?.log
                    }));

                    if (data.final) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                        setStatus('completed');
                        setMessage('Physical Chemistry Consensus Pipeline successfully generated verified questions!');
                    } else if (data.llm2) {
                        setMessage('Consensus model validation in progress. Comparing LLM-1 vs LLM-2 solutions...');
                    } else if (data.llm1) {
                        setMessage('LLM-1 (Generator) completed. Transferring payload to LLM-2 (Validator)...');
                    }
                }
            } catch (e) {
                console.error("Polling connection glitch:", e);
            }
        }, 3000);
    };

    // 6. Save results to MongoDB
    const saveToMongo = async () => {
        if (!selectedChapter || !selectedSeedId) return;
        setSyncStatus('syncing');
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${selectedChapter}/${selectedSeedId}/save-to-mongodb`, {
                method: 'POST'
            });
            if (res.ok) {
                setSyncStatus('synced');
                setMessage('Pipeline data committed successfully to cloud MongoDB.');
            } else {
                setSyncStatus('failed');
                setMessage('Error occurred while pushing records to MongoDB.');
            }
        } catch (e) {
            setSyncStatus('failed');
            setMessage('Network exception during MongoDB synchronization.');
        }
    };

    // 7. Cleanup
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    // --- Question Card Render Helper ---
    const QuestionCard = ({ q, level, phase }: { q: any, level: string, phase?: string }) => {
        if (!q) return null;

        const isVerified = q.verdict === 'verified' || q.verdict === 'correct' || !phase;

        return (
            <div className={`q-card ${isVerified ? 'verified' : 'flagged'}`}>
                <div className="q-card-header">
                    <span className="q-badge">{level} LEVEL {phase ? `(${phase})` : ''}</span>
                    <span className={`verdict-pill ${isVerified ? 'success' : 'attention'}`}>
                        {isVerified ? '✓ VERIFIED' : '⚠ VERDICT: ' + (q.verdict || 'ATTENTION')}
                    </span>
                </div>

                <div className="q-body-container">
                    <MathText text={q.question} />
                </div>

                <div className="options-grid">
                    {Object.entries(q.options || {}).map(([key, val]: any) => {
                        const isCorrect = String(q.correct_option) === String(key);
                        return (
                            <div key={key} className={`option-item ${isCorrect ? 'correct' : ''}`}>
                                <span className="option-label">{key}</span>
                                <span className="option-text"><MathText text={val} /></span>
                            </div>
                        );
                    })}
                </div>

                <div className="q-meta-footer">
                    <div className="meta-row">
                        <strong>CORRECT OPTION:</strong>
                        <span className="correct-option-bubble">{q.correct_option}</span>
                    </div>
                    {q.type && (
                        <div className="meta-row">
                            <strong>TYPE:</strong>
                            <span className="type-badge">{q.type}</span>
                        </div>
                    )}
                    {q.q_micro_concept && (
                        <div className="meta-row font-sm">
                            <strong>MICRO-CONCEPT:</strong>
                            <span className="concept-text">{q.q_micro_concept}</span>
                        </div>
                    )}
                </div>

                {q.q_prerequisite_concepts && q.q_prerequisite_concepts.length > 0 && (
                    <div className="prereq-container">
                        <strong>PREREQUISITE CONCEPTS:</strong>
                        <ul className="prereq-list">
                            {q.q_prerequisite_concepts.map((concept: string, i: number) => (
                                <li key={i}><MathText text={concept} /></li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="solution-section">
                    <div className="solution-header">DETAILED STEP-BY-STEP SOLUTION</div>
                    <div className="solution-text">
                        <MathText text={q.solution || q.llm1_solution || q.llm2_solution} />
                    </div>
                </div>

                <style jsx>{`
                    .q-card {
                        background: rgba(15, 23, 42, 0.4);
                        border: 1px solid rgba(255,255,255,0.05);
                        border-radius: 20px;
                        padding: 30px;
                        margin-bottom: 24px;
                        backdrop-filter: blur(20px);
                        transition: all 0.3s ease;
                    }
                    .q-card.verified {
                        border-color: rgba(16, 185, 129, 0.2);
                        box-shadow: 0 10px 40px rgba(16, 185, 129, 0.05);
                    }
                    .q-card.flagged {
                        border-color: rgba(244, 63, 94, 0.2);
                        box-shadow: 0 10px 40px rgba(244, 63, 94, 0.05);
                    }
                    .q-card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid rgba(255,255,255,0.05);
                        padding-bottom: 16px;
                        margin-bottom: 20px;
                    }
                    .q-badge {
                        font-size: 11px;
                        font-weight: 900;
                        letter-spacing: 1.5px;
                        text-transform: uppercase;
                        color: #fb923c;
                    }
                    .verdict-pill {
                        font-size: 10px;
                        font-weight: 800;
                        padding: 6px 14px;
                        border-radius: 99px;
                    }
                    .verdict-pill.success {
                        background: rgba(16, 185, 129, 0.1);
                        color: #10b981;
                        border: 1px solid rgba(16, 185, 129, 0.2);
                    }
                    .verdict-pill.attention {
                        background: rgba(244, 63, 94, 0.1);
                        color: #f43f5e;
                        border: 1px solid rgba(244, 63, 94, 0.2);
                    }
                    .q-body-container {
                        font-size: 16px;
                        line-height: 1.7;
                        color: #f8fafc;
                        margin-bottom: 24px;
                        font-weight: 500;
                    }
                    .options-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 16px;
                        margin-bottom: 24px;
                    }
                    .option-item {
                        display: flex;
                        align-items: flex-start;
                        gap: 14px;
                        background: rgba(0,0,0,0.25);
                        padding: 16px;
                        border-radius: 12px;
                        border: 1px solid rgba(255,255,255,0.03);
                        transition: all 0.2s;
                    }
                    .option-item.correct {
                        background: rgba(16, 185, 129, 0.05);
                        border-color: rgba(16, 185, 129, 0.3);
                    }
                    .option-label {
                        background: rgba(255,255,255,0.1);
                        color: #fff;
                        width: 28px;
                        height: 28px;
                        min-width: 28px;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 13px;
                        font-weight: 800;
                    }
                    .option-item.correct .option-label {
                        background: #10b981;
                        color: #000;
                    }
                    .option-text {
                        font-size: 14px;
                        color: #cbd5e1;
                        padding-top: 4px;
                    }
                    .q-meta-footer {
                        border-top: 1px solid rgba(255,255,255,0.05);
                        padding-top: 16px;
                        margin-bottom: 20px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 24px;
                    }
                    .meta-row {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 12px;
                        color: #94a3b8;
                    }
                    .correct-option-bubble {
                        color: #10b981;
                        background: rgba(16, 185, 129, 0.1);
                        padding: 4px 10px;
                        border-radius: 6px;
                        border: 1px solid rgba(16, 185, 129, 0.2);
                        font-weight: 800;
                    }
                    .type-badge {
                        background: rgba(255, 255, 255, 0.05);
                        padding: 4px 8px;
                        border-radius: 6px;
                        color: #cbd5e1;
                        font-weight: 700;
                    }
                    .concept-text {
                        color: #fb923c;
                        font-weight: 600;
                    }
                    .prereq-container {
                        background: rgba(251, 146, 60, 0.02);
                        border: 1px dashed rgba(251, 146, 60, 0.15);
                        border-radius: 12px;
                        padding: 16px 20px;
                        margin-bottom: 24px;
                    }
                    .prereq-container strong {
                        display: block;
                        font-size: 10px;
                        color: #fb923c;
                        letter-spacing: 1px;
                        margin-bottom: 10px;
                    }
                    .prereq-list {
                        margin: 0;
                        padding-left: 20px;
                        font-size: 13px;
                        color: #cbd5e1;
                        line-height: 1.6;
                    }
                    .prereq-list li {
                        margin-bottom: 6px;
                    }
                    .solution-section {
                        background: #020617;
                        border: 1px solid rgba(255,255,255,0.05);
                        border-radius: 12px;
                        padding: 24px;
                    }
                    .solution-header {
                        font-size: 10px;
                        font-weight: 900;
                        color: #10b981;
                        letter-spacing: 1px;
                        margin-bottom: 12px;
                    }
                    .solution-text {
                        font-size: 14px;
                        line-height: 1.8;
                        color: #94a3b8;
                    }
                `}</style>
            </div>
        );
    };

    return (
        <main className="pipeline-root">
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>
            <div className="orb orb-3"></div>

            <header className="chem-masthead">
                <div className="masthead-content">
                    <div className="chem-logo-area">
                        <Link href="/chemistry" className="chem-home-btn">← CHAPTERS</Link>
                        <h1>Physical <span className="text-highlight">Chemistry</span> Lab</h1>
                        <p>NCERT Seed Question Synthesis & Consensus Pipeline</p>
                    </div>

                    {selectedChapter && (
                        <div className="masthead-meta">
                            <div className="meta-pill">
                                <span className="glow-indic animate-pulse"></span>
                                Chapter {selectedChapter}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <section className="chem-viewport">
                <div className="workspace-container">
                    
                    {/* LEFT PANEL: SEED CONFIG & SELECTOR */}
                    <div className="left-panel">
                        <div className="panel-section">
                            <label className="section-label">1. Select Subject Chapter</label>
                            <select 
                                value={selectedChapter} 
                                onChange={e => setSelectedChapter(e.target.value)} 
                                className="premium-select"
                            >
                                <option value="">-- Select Chemistry Chapter --</option>
                                {chapters.map(chap => (
                                    <option key={chap} value={chap}>Chapter {chap}</option>
                                ))}
                            </select>
                            {chapterTitle && <div className="chapter-title-hint">{chapterTitle}</div>}
                        </div>

                        {selectedChapter && (
                            <div className="panel-section">
                                <label className="section-label">2. Select Seed Reference</label>
                                <div className="seeds-explorer">
                                    {seedsSummary.length === 0 ? (
                                        <div className="no-seeds-alert">No seed files located for Chapter {selectedChapter}.</div>
                                    ) : (
                                        <div className="seeds-list">
                                            {seedsSummary.map((seed) => (
                                                <button
                                                    key={seed.seed_id}
                                                    onClick={() => setSelectedSeedId(seed.seed_id)}
                                                    className={`seed-item-btn ${selectedSeedId === seed.seed_id ? 'active' : ''}`}
                                                >
                                                    <span className="seed-id-tag">{seed.seed_id}</span>
                                                    <div className="seed-summary-details">
                                                        <span className="seed-topic-label">{seed.topic || 'General concept'}</span>
                                                        <span className="seed-sub-label">{seed.type} • {seed.subtopic || 'Direct drill'}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {seedDetail && (
                            <div className="panel-section">
                                <label className="section-label">3. Seed Inspection Visualizer</label>
                                <div className="seed-detail-card">
                                    <div className="detail-row">
                                        <span className="detail-badge-id">{seedDetail.seed_id}</span>
                                        <span className="detail-badge-type">{seedDetail.type}</span>
                                    </div>
                                    <div className="seed-question-body">
                                        <MathText text={seedDetail.question} />
                                    </div>
                                    {seedDetail.why_selected && (
                                        <div className="why-selected-box">
                                            <strong>Why Selected:</strong>
                                            <p>{seedDetail.why_selected}</p>
                                        </div>
                                    )}

                                    {/* Collapsible Ideas */}
                                    <div className="ideas-container">
                                        <details className="idea-disclosure">
                                            <summary>Easy Variant Concept</summary>
                                            <div className="idea-body">{seedDetail.easy_variant_idea}</div>
                                        </details>
                                        <details className="idea-disclosure">
                                            <summary>Medium Variant Concept</summary>
                                            <div className="idea-body">{seedDetail.medium_variant_idea}</div>
                                        </details>
                                        <details className="idea-disclosure">
                                            <summary>Hard Variant Concept</summary>
                                            <div className="idea-body">{seedDetail.hard_variant_idea}</div>
                                        </details>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedSeedId && (
                            <div className="panel-section">
                                <button
                                    onClick={startBuild}
                                    disabled={status === 'building'}
                                    className="premium-action-btn"
                                >
                                    {status === 'building' ? 'GENERATION PROTOCOL ACTIVE...' : '⚡ LAUNCH AI PIPELINE'}
                                </button>
                                <TerminalLog chapterNumber={selectedChapter} seedId={selectedSeedId} isActive={status === 'building'} />
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANEL: GENERATION WORKSPACE & RESULTS */}
                    <div className="right-panel">
                        {status === 'idle' && !results && (
                            <div className="idle-welcome-stage">
                                <div className="welcome-icon">⚡</div>
                                <h2>Awaiting Pipeline Dispatch</h2>
                                <p>Provide a Chapter and a Seed reference in the left selector panel to check generated question history or deploy the 3-stage consensus pipeline.</p>
                            </div>
                        )}

                        {status === 'building' && !results && (
                            <div className="building-loader-stage">
                                <div className="spinner-glow"></div>
                                <h2>Synthesizing Consensus</h2>
                                <p>LLM agents are resolving chemical equations and generating multi-tier IIT-JEE problems...</p>
                                <span className="building-sub-msg">{message}</span>
                            </div>
                        )}

                        {results && (
                            <div className="results-workspace">
                                <div className="workspace-tabs-bar">
                                    <button 
                                        onClick={() => setViewTab('final')} 
                                        className={`tab-btn ${viewTab === 'final' ? 'active' : ''}`}
                                    >
                                        Final Outcomes
                                    </button>
                                    <button 
                                        onClick={() => setViewTab('llm1')} 
                                        className={`tab-btn ${viewTab === 'llm1' ? 'active' : ''}`}
                                    >
                                        L1 Generator
                                    </button>
                                    <button 
                                        onClick={() => setViewTab('llm2')} 
                                        className={`tab-btn ${viewTab === 'llm2' ? 'active' : ''}`}
                                    >
                                        L2 Validator
                                    </button>
                                    <button 
                                        onClick={() => setViewTab('consensus')} 
                                        className={`tab-btn ${viewTab === 'consensus' ? 'active' : ''}`}
                                    >
                                        Consensus Audit
                                    </button>
                                    <button 
                                        onClick={() => setViewTab('stats')} 
                                        className={`tab-btn ${viewTab === 'stats' ? 'active' : ''}`}
                                    >
                                        Cost & Efficiency
                                    </button>

                                    {status === 'completed' && (
                                        <button
                                            onClick={saveToMongo}
                                            disabled={syncStatus === 'syncing' || syncStatus === 'synced'}
                                            className={`tab-btn-sync ${syncStatus === 'synced' ? 'synced' : ''}`}
                                        >
                                            {syncStatus === 'syncing' ? '⌛ SYNCING...' : syncStatus === 'synced' ? '✓ COMMITTED' : '📤 SAVE TO DB'}
                                        </button>
                                    )}
                                </div>

                                <div className="workspace-body">
                                    {message && <div className="status-notification-bar">{message}</div>}

                                    {viewTab === 'final' && results.final && (
                                        <div className="questions-array">
                                            {['easy', 'medium', 'hard'].map((lvl) => (
                                                <QuestionCard key={lvl} level={lvl} q={results.final[lvl]} />
                                            ))}
                                        </div>
                                    )}

                                    {viewTab === 'llm1' && results.llm1 && (
                                        <div className="questions-array">
                                            <div className="tab-context-header text-orange">LLM-1 GENERATOR INTERFACE RESPONSE</div>
                                            {['easy', 'medium', 'hard'].map((lvl) => (
                                                <QuestionCard key={lvl} level={lvl} q={results.llm1[lvl]} phase="Generator L1" />
                                            ))}
                                        </div>
                                    )}

                                    {viewTab === 'llm2' && results.llm2 && (
                                        <div className="questions-array">
                                            <div className="tab-context-header text-rose">LLM-2 VALIDATION CRITIQUE</div>
                                            {['easy', 'medium', 'hard'].map((lvl) => (
                                                <QuestionCard key={lvl} level={lvl} q={results.llm2[lvl]} phase="Validator L2" />
                                            ))}
                                        </div>
                                    )}

                                    {viewTab === 'consensus' && (
                                        <div className="audit-scroller">
                                            <h3 className="audit-title text-highlight">Consensus Validation & Resolution</h3>
                                            <p className="audit-subtitle">Cross-referencing answer outcomes and logical steps between LLM models.</p>
                                            
                                            {['easy', 'medium', 'hard'].map((lvl) => {
                                                const finalQ = results.final?.[lvl];
                                                if (!finalQ) return null;
                                                const consensus = finalQ.consensus || {};
                                                const l1_ans = finalQ.llm1_answer || consensus.llm1 || 'N/A';
                                                const l2_ans = finalQ.llm2_answer || consensus.llm2 || 'N/A';
                                                const verdict = finalQ.verdict || 'tie_broken';
                                                const isMatch = l1_ans === l2_ans;

                                                return (
                                                    <div key={lvl} className={`audit-item-box ${isMatch ? 'match' : 'mismatch'}`}>
                                                        <div className="audit-item-header">
                                                            <span className="audit-level-badge">{lvl} difficulty</span>
                                                            <span className={`audit-verdict-label ${verdict}`}>
                                                                {verdict.toUpperCase().replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                        <div className="audit-vitals-grid">
                                                            <div className="vital-card">
                                                                <span className="vital-label">LLM-1 generator choice</span>
                                                                <span className="vital-val orange">{l1_ans}</span>
                                                            </div>
                                                            <div className="vital-card">
                                                                <span className="vital-label">LLM-2 validator choice</span>
                                                                <span className="vital-val rose">{l2_ans}</span>
                                                            </div>
                                                            <div className="vital-card full-colspan">
                                                                <span className="vital-label">Consensus Verdict Resolution</span>
                                                                <p className="verdict-explanation">
                                                                    {isMatch 
                                                                        ? "LLM-1 and LLM-2 agree perfectly on the correct choice. Complete mathematical alignment. Verdict: VERIFIED."
                                                                        : `Logical mismatch discovered between models (L1: ${l1_ans} vs L2: ${l2_ans}). Tiebreaker mechanism was activated to resolve the discrepancy and commit the correct path.`
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {viewTab === 'stats' && results.stats && (
                                        <div className="analytics-dashboard">
                                            <div className="metrics-summary-cards">
                                                <div className="metric-score-card">
                                                    <span className="score-lbl">Total Run Duration</span>
                                                    <div className="score-val">{(results.stats.total_time_seconds || 0).toFixed(1)}s</div>
                                                    <span className="score-desc">Telemetry compilation</span>
                                                </div>
                                                <div className="metric-score-card">
                                                    <span className="score-lbl">Combined Cost (USD)</span>
                                                    <div className="score-val">${(results.stats.total_cost_usd || 0).toFixed(4)}</div>
                                                    <span className="score-desc">API Resource pricing</span>
                                                </div>
                                                <div className="metric-score-card highlight">
                                                    <span className="score-lbl text-highlight">Financial Impact (INR)</span>
                                                    <div className="score-val">₹{(results.stats.total_cost_inr || 0).toFixed(2)}</div>
                                                    <span className="score-desc">Domestic currency projection</span>
                                                </div>
                                            </div>

                                            <div className="analytics-details-grid">
                                                <div className="details-card">
                                                    <h3>Pipeline Phase Duration</h3>
                                                    <div className="chart-bars">
                                                        {results.stats.step_durations && Object.entries(results.stats.step_durations).map(([step, sec]: any) => (
                                                            <div key={step} className="bar-row">
                                                                <span className="bar-label">{step.replace(/_/g, ' ')}</span>
                                                                <div className="bar-outer">
                                                                    <div 
                                                                        className="bar-inner orange" 
                                                                        style={{ width: `${Math.min(100, (sec / results.stats.total_time_seconds) * 100)}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="bar-value">{sec.toFixed(1)}s</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="details-card">
                                                    <h3>Model Token Utilization</h3>
                                                    <div className="table-responsive">
                                                        <table className="analytics-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Agent Phase</th>
                                                                    <th>Input Tokens</th>
                                                                    <th>Output Tokens</th>
                                                                    <th>Cost (INR)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {results.stats.llm1_usage && (
                                                                    <tr>
                                                                        <td>LLM-1 Generator</td>
                                                                        <td>{results.stats.llm1_usage.input_tokens}</td>
                                                                        <td>{results.stats.llm1_usage.output_tokens}</td>
                                                                        <td>₹{(results.stats.llm1_usage.cost_inr || 0).toFixed(2)}</td>
                                                                    </tr>
                                                                )}
                                                                {results.stats.llm2_usage && (
                                                                    <tr>
                                                                        <td>LLM-2 Validator</td>
                                                                        <td>{results.stats.llm2_usage.input_tokens}</td>
                                                                        <td>{results.stats.llm2_usage.output_tokens}</td>
                                                                        <td>₹{(results.stats.llm2_usage.cost_inr || 0).toFixed(2)}</td>
                                                                    </tr>
                                                                )}
                                                                {results.stats.tiebreaker_cost_inr > 0 && (
                                                                    <tr>
                                                                        <td>Tiebreaker Logic</td>
                                                                        <td>—</td>
                                                                        <td>—</td>
                                                                        <td>₹{(results.stats.tiebreaker_cost_inr).toFixed(2)}</td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="cost-unit-economics">
                                                <span>Unit Cost Per Verified IIT JEE Question:</span>
                                                <strong>₹{((results.stats.total_cost_inr || 0) / 3).toFixed(2)}</strong>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </section>

            <style jsx global>{`
                :root {
                    --chem-primary: #fb7185;
                    --chem-orange: #fb923c;
                    --chem-gold: #f59e0b;
                    --dark-slate: #020617;
                    --glass: rgba(255, 255, 255, 0.03);
                    --glass-border: rgba(255, 255, 255, 0.08);
                    --glass-active-border: rgba(244, 63, 94, 0.4);
                }

                .pipeline-root {
                    background-color: var(--dark-slate);
                    color: #f8fafc;
                    font-family: 'Inter', system-ui, sans-serif;
                    height: 100vh;
                    overflow: hidden;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }

                .orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(140px);
                    z-index: 0;
                    opacity: 0.12;
                }
                .orb-1 { top: -150px; right: -100px; width: 500px; height: 500px; background: var(--chem-primary); }
                .orb-2 { bottom: -150px; left: -100px; width: 450px; height: 450px; background: var(--chem-orange); }
                .orb-3 { top: 50%; left: 50%; width: 350px; height: 350px; background: var(--chem-gold); transform: translate(-50%, -50%); }

                .chem-masthead {
                    height: 80px;
                    border-bottom: 1px solid var(--glass-border);
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(30px);
                    z-index: 10;
                    padding: 0 40px;
                    display: flex;
                    align-items: center;
                }
                .masthead-content {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .chem-logo-area h1 {
                    font-size: 20px;
                    font-weight: 900;
                    margin: 0;
                    letter-spacing: -0.5px;
                }
                .text-highlight {
                    background: linear-gradient(135deg, var(--chem-primary) 0%, var(--chem-orange) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .chem-logo-area p {
                    color: #64748b;
                    font-size: 10px;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    font-weight: 700;
                }
                .chem-home-btn {
                    font-size: 10px;
                    font-weight: 900;
                    color: #475569;
                    text-decoration: none;
                    display: block;
                    margin-bottom: 2px;
                    letter-spacing: 1px;
                }
                .chem-home-btn:hover { color: #fff; }

                .meta-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(244, 63, 94, 0.1);
                    padding: 6px 16px;
                    border-radius: 99px;
                    font-size: 12px;
                    font-weight: 800;
                    color: var(--chem-primary);
                    border: 1px solid rgba(244, 63, 94, 0.2);
                }
                .glow-indic {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--chem-primary);
                    box-shadow: 0 0 10px var(--chem-primary);
                }

                .chem-viewport {
                    flex: 1;
                    position: relative;
                    z-index: 5;
                    overflow: hidden;
                    padding: 20px 40px;
                }
                .workspace-container {
                    display: grid;
                    grid-template-columns: 420px 1fr;
                    gap: 24px;
                    height: 100%;
                }

                /* LEFT PANEL styling */
                .left-panel {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid var(--glass-border);
                    border-radius: 24px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    overflow-y: auto;
                    backdrop-filter: blur(20px);
                }
                .panel-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .section-label {
                    font-size: 10px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .premium-select {
                    width: 100%;
                    background: #090d16;
                    border: 1px solid var(--glass-border);
                    padding: 14px;
                    border-radius: 12px;
                    color: #fff;
                    font-size: 13px;
                    font-weight: 700;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .premium-select:focus {
                    border-color: var(--glass-active-border);
                }
                .chapter-title-hint {
                    font-size: 12px;
                    color: var(--chem-orange);
                    font-weight: 700;
                    padding-left: 4px;
                }

                .seeds-explorer {
                    background: #090d16;
                    border: 1px solid var(--glass-border);
                    border-radius: 14px;
                    height: 220px;
                    overflow-y: auto;
                    padding: 8px;
                }
                .no-seeds-alert {
                    padding: 20px;
                    text-align: center;
                    font-size: 13px;
                    color: #64748b;
                }
                .seeds-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .seed-item-btn {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: transparent;
                    border: none;
                    text-align: left;
                    padding: 10px 12px;
                    border-radius: 10px;
                    cursor: pointer;
                    color: #cbd5e1;
                    transition: all 0.2s;
                }
                .seed-item-btn:hover {
                    background: rgba(255,255,255,0.02);
                }
                .seed-item-btn.active {
                    background: rgba(244, 63, 94, 0.08);
                    color: #fff;
                }
                .seed-id-tag {
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    font-size: 11px;
                    font-weight: 800;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .seed-item-btn.active .seed-id-tag {
                    background: var(--chem-primary);
                    color: #000;
                    border-color: var(--chem-primary);
                }
                .seed-summary-details {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    overflow: hidden;
                }
                .seed-topic-label {
                    font-size: 12px;
                    font-weight: 700;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .seed-sub-label {
                    font-size: 10px;
                    color: #64748b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .seed-detail-card {
                    background: #090d16;
                    border: 1px solid var(--glass-border);
                    border-radius: 16px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .detail-badge-id {
                    background: rgba(244, 63, 94, 0.1);
                    color: var(--chem-primary);
                    font-size: 11px;
                    font-weight: 900;
                    padding: 4px 10px;
                    border-radius: 6px;
                    border: 1px solid rgba(244, 63, 94, 0.2);
                }
                .detail-badge-type {
                    font-size: 10px;
                    color: #cbd5e1;
                    font-weight: 800;
                    background: rgba(255,255,255,0.05);
                    padding: 4px 8px;
                    border-radius: 6px;
                }
                .seed-question-body {
                    font-size: 13px;
                    line-height: 1.6;
                    color: #cbd5e1;
                }
                .why-selected-box {
                    font-size: 11px;
                    background: rgba(251, 146, 60, 0.03);
                    border-left: 3px solid var(--chem-orange);
                    padding: 8px 12px;
                    border-radius: 0 8px 8px 0;
                }
                .why-selected-box strong {
                    color: var(--chem-orange);
                    display: block;
                    margin-bottom: 4px;
                }
                .why-selected-box p {
                    margin: 0;
                    color: #94a3b8;
                }
                .ideas-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 6px;
                }
                .idea-disclosure {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.03);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .idea-disclosure summary {
                    font-size: 11px;
                    font-weight: 800;
                    padding: 8px 12px;
                    cursor: pointer;
                    color: #cbd5e1;
                    user-select: none;
                }
                .idea-body {
                    padding: 10px 12px;
                    font-size: 11px;
                    color: #94a3b8;
                    border-top: 1px solid rgba(255,255,255,0.02);
                    background: rgba(0,0,0,0.1);
                    line-height: 1.5;
                }

                .premium-action-btn {
                    background: linear-gradient(135deg, var(--chem-primary) 0%, var(--chem-orange) 100%);
                    color: #000;
                    border: none;
                    padding: 16px;
                    border-radius: 12px;
                    font-weight: 900;
                    font-size: 13px;
                    letter-spacing: 1px;
                    cursor: pointer;
                    box-shadow: 0 6px 20px rgba(244, 63, 94, 0.2);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .premium-action-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(244, 63, 94, 0.3);
                }
                .premium-action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* RIGHT PANEL styling */
                .right-panel {
                    background: #040815;
                    border: 1px solid var(--glass-border);
                    border-radius: 24px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .idle-welcome-stage {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    text-align: center;
                    padding: 40px;
                    max-width: 500px;
                    margin: 0 auto;
                    opacity: 0.4;
                }
                .welcome-icon {
                    font-size: 64px;
                    margin-bottom: 24px;
                    background: linear-gradient(135deg, var(--chem-primary) 0%, var(--chem-gold) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .idle-welcome-stage h2 {
                    font-size: 20px;
                    font-weight: 800;
                    margin-bottom: 12px;
                }
                .idle-welcome-stage p {
                    font-size: 14px;
                    line-height: 1.6;
                    color: #94a3b8;
                }

                .building-loader-stage {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    gap: 16px;
                    text-align: center;
                    padding: 40px;
                }
                .spinner-glow {
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(244, 63, 94, 0.1);
                    border-top-color: var(--chem-primary);
                    border-right-color: var(--chem-orange);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    box-shadow: 0 0 20px rgba(244, 63, 94, 0.15);
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .building-loader-stage h2 {
                    font-size: 22px;
                    font-weight: 900;
                    letter-spacing: -0.5px;
                }
                .building-loader-stage p {
                    font-size: 14px;
                    color: #cbd5e1;
                    max-width: 400px;
                    line-height: 1.6;
                    margin: 0;
                }
                .building-sub-msg {
                    font-size: 12px;
                    color: var(--chem-orange);
                    font-weight: 700;
                }

                .results-workspace {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                }
                .workspace-tabs-bar {
                    display: flex;
                    gap: 12px;
                    padding: 0 24px;
                    background: rgba(15, 23, 42, 0.4);
                    border-bottom: 1px solid var(--glass-border);
                    overflow-x: auto;
                }
                .tab-btn {
                    background: transparent;
                    border: none;
                    color: #64748b;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    padding: 24px 8px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .tab-btn:hover {
                    color: #cbd5e1;
                }
                .tab-btn.active {
                    color: var(--chem-primary);
                    border-bottom-color: var(--chem-primary);
                }
                .tab-btn-sync {
                    margin-left: auto;
                    align-self: center;
                    background: #10b981;
                    color: #000;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 10px;
                    font-weight: 900;
                    cursor: pointer;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    transition: all 0.3s;
                }
                .tab-btn-sync.synced {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    cursor: not-allowed;
                }
                .tab-btn-sync:disabled:not(.synced) {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .workspace-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 30px;
                }
                .status-notification-bar {
                    background: rgba(244, 63, 94, 0.05);
                    border: 1px solid rgba(244, 63, 94, 0.15);
                    border-radius: 10px;
                    padding: 10px 16px;
                    font-size: 12px;
                    color: var(--chem-primary);
                    font-weight: 700;
                    margin-bottom: 24px;
                }

                .questions-array {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .tab-context-header {
                    font-size: 12px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    text-align: center;
                    border-bottom: 1px solid var(--glass-border);
                    padding-bottom: 14px;
                    margin-bottom: 24px;
                }
                .text-orange { color: var(--chem-orange); }
                .text-rose { color: var(--chem-primary); }

                /* Audit Screen */
                .audit-scroller {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .audit-title {
                    font-size: 18px;
                    font-weight: 900;
                    margin-bottom: 4px;
                }
                .audit-subtitle {
                    font-size: 13px;
                    color: #64748b;
                    margin-bottom: 30px;
                }
                .audit-item-box {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid var(--glass-border);
                    border-radius: 20px;
                    padding: 24px;
                    margin-bottom: 20px;
                }
                .audit-item-box.match {
                    border-color: rgba(16, 185, 129, 0.15);
                }
                .audit-item-box.mismatch {
                    border-color: rgba(245, 158, 11, 0.15);
                }
                .audit-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    padding-bottom: 12px;
                }
                .audit-level-badge {
                    font-size: 10px;
                    font-weight: 900;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    color: #cbd5e1;
                }
                .audit-verdict-label {
                    font-size: 9px;
                    font-weight: 800;
                    padding: 4px 10px;
                    border-radius: 6px;
                }
                .audit-verdict-label.verified {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                }
                .audit-verdict-label.tie_broken {
                    background: rgba(245, 158, 11, 0.1);
                    color: #f59e0b;
                }
                .audit-vitals-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .vital-card {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.02);
                    border-radius: 12px;
                    padding: 16px;
                }
                .vital-card.full-colspan {
                    grid-column: span 2;
                    background: rgba(244, 63, 94, 0.02);
                    border-color: rgba(244, 63, 94, 0.05);
                }
                .vital-label {
                    display: block;
                    font-size: 9px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 6px;
                }
                .vital-val {
                    font-size: 20px;
                    font-weight: 900;
                    font-family: monospace;
                }
                .vital-val.orange { color: var(--chem-orange); }
                .vital-val.rose { color: var(--chem-primary); }
                .verdict-explanation {
                    margin: 0;
                    font-size: 12.5px;
                    line-height: 1.5;
                    color: #cbd5e1;
                }

                /* Analytics Screen */
                .analytics-dashboard {
                    max-width: 850px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                }
                .metrics-summary-cards {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 20px;
                }
                .metric-score-card {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid var(--glass-border);
                    padding: 24px;
                    border-radius: 20px;
                    text-align: center;
                }
                .metric-score-card.highlight {
                    background: rgba(244, 63, 94, 0.03);
                    border-color: rgba(244, 63, 94, 0.3);
                }
                .score-lbl {
                    font-size: 9px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    display: block;
                    margin-bottom: 10px;
                }
                .score-lbl.text-highlight {
                    background: linear-gradient(135deg, var(--chem-primary) 0%, var(--chem-orange) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .score-val {
                    font-size: 32px;
                    font-weight: 900;
                    font-family: 'Fira Code', monospace;
                    color: #fff;
                    margin-bottom: 6px;
                }
                .score-desc {
                    font-size: 11px;
                    color: #475569;
                }

                .analytics-details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.2fr;
                    gap: 20px;
                }
                .details-card {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid var(--glass-border);
                    border-radius: 20px;
                    padding: 24px;
                }
                .details-card h3 {
                    font-size: 13px;
                    font-weight: 900;
                    color: #94a3b8;
                    margin-top: 0;
                    margin-bottom: 20px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .chart-bars {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .bar-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .bar-label {
                    font-size: 11px;
                    color: #cbd5e1;
                    width: 140px;
                    text-transform: capitalize;
                }
                .bar-outer {
                    flex: 1;
                    height: 8px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 99px;
                    overflow: hidden;
                }
                .bar-inner {
                    height: 100%;
                    border-radius: 99px;
                }
                .bar-inner.orange {
                    background: linear-gradient(90deg, var(--chem-primary) 0%, var(--chem-orange) 100%);
                }
                .bar-value {
                    font-size: 11px;
                    font-weight: 700;
                    font-family: monospace;
                    width: 44px;
                    text-align: right;
                }

                .table-responsive {
                    overflow-x: auto;
                }
                .analytics-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 12.5px;
                }
                .analytics-table th {
                    border-bottom: 1px solid var(--glass-border);
                    padding-bottom: 10px;
                    font-size: 9px;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .analytics-table td {
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.02);
                    color: #cbd5e1;
                }
                .analytics-table tr:last-child td {
                    border-bottom: none;
                }

                .cost-unit-economics {
                    background: rgba(16, 185, 129, 0.03);
                    border: 1px solid rgba(16, 185, 129, 0.15);
                    border-radius: 16px;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 16px;
                    font-size: 14px;
                }
                .cost-unit-economics span {
                    color: #cbd5e1;
                }
                .cost-unit-economics strong {
                    font-size: 22px;
                    color: #10b981;
                    font-family: 'Fira Code', monospace;
                }
            `}</style>
        </main>
    );
}
