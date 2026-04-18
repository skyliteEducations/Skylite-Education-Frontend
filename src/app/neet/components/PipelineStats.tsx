'use client';

import { useState, useEffect, memo, useRef } from 'react';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';

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


interface TokenUsageDetail {
    input: number;
    output: number;
}

interface ModelUsageDetail {
    gpt_5_4: TokenUsageDetail;
    claude_sonnet: TokenUsageDetail;
}

interface PageQuestionStats {
    page_name: string;
    book_id: string;
    questions_count: number;
    verified_count: number;
    unverified_count: number;
    tokens: ModelUsageDetail;
    total_cost_inr: number;
    per_question_cost_inr: number;
}


interface ChapterPipelineStats {
    chapter_name: string;
    pages_processed: number;
    total_questions: number;
    total_verified: number;
    total_unverified: number;
    total_tokens: ModelUsageDetail;
    total_cost_inr: number;
    questions_breakdown: PageQuestionStats[];
}


interface PipelineStatsResponse {
    total_chapters: number;
    data: ChapterPipelineStats[];
}

const StatCard = memo(({ title, value, subValue, icon, color }: { title: string, value: string | number, subValue?: string, icon: string, color: string }) => (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="stat-icon" style={{ background: `${color}20`, color }}>{icon}</div>
        <div className="stat-content">
            <div className="stat-title">{title}</div>
            <div className="stat-value">{value}</div>
            {subValue && <div className="stat-sub">{subValue}</div>}
        </div>
        <style jsx>{`
            .stat-card {
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                padding: 24px;
                display: flex;
                align-items: center;
                gap: 20px;
                transition: transform 0.3s;
            }
            .stat-card:hover {
                transform: translateY(-5px);
                background: rgba(15, 23, 42, 0.8);
            }
            .stat-icon {
                width: 50px;
                height: 50px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }
            .stat-title {
                font-size: 11px;
                font-weight: 800;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 4px;
            }
            .stat-value {
                font-size: 28px;
                font-weight: 900;
                color: #f8fafc;
                font-family: 'Inter', sans-serif;
            }
            .stat-sub {
                font-size: 11px;
                color: #94a3b8;
                margin-top: 4px;
            }
        `}</style>
    </div>
));

export default function PipelineStats() {
    const [stats, setStats] = useState<PipelineStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedChapter, setSelectedChapter] = useState<ChapterPipelineStats | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/biology/stats/summary`);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (e) {
                console.error("Failed to fetch stats:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="stats-loader">
                <div className="spinner"></div>
                <p>AGGREGATING ANALYTICS...</p>
                <style jsx>{`
                    .stats-loader {
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: #10b981;
                        gap: 20px;
                    }
                    .spinner {
                        width: 50px;
                        height: 50px;
                        border: 3px solid rgba(16, 185, 129, 0.1);
                        border-top-color: #10b981;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    if (!stats || stats.data.length === 0) {
        return (
            <div className="stats-empty">
                <div className="empty-icon">📊</div>
                <h3>No Analytics Data Found</h3>
                <p>Complete the question extraction pipeline to see financial and operational metrics.</p>
                <style jsx>{`
                    .stats-empty {
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        padding: 40px;
                    }
                    .empty-icon { font-size: 64px; margin-bottom: 20px; opacity: 0.5; }
                    h3 { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 10px; }
                    p { color: #64748b; max-width: 400px; }
                `}</style>
            </div>
        );
    }

    const totals = stats.data.reduce((acc, chap) => ({
        questions: acc.questions + chap.total_questions,
        verified: acc.verified + (chap.total_verified || 0),
        unverified: acc.unverified + (chap.total_unverified || 0),
        cost: acc.cost + chap.total_cost_inr,
        tokens: acc.tokens + (chap.total_tokens.gpt_5_4.input + chap.total_tokens.gpt_5_4.output + chap.total_tokens.claude_sonnet.input + chap.total_tokens.claude_sonnet.output)
    }), { questions: 0, verified: 0, unverified: 0, cost: 0, tokens: 0 });


    return (
        <div className="pipeline-stats-container">
            <div className="stats-header">
                <div className="header-text">
                    <h2>PIPELINE <span className="text-highlight">ANALYTICS</span></h2>
                    <p>Operational Transparency & Financial Impact across {stats.total_chapters} Chapters</p>
                </div>
                {selectedChapter && (
                    <button className="back-btn" onClick={() => setSelectedChapter(null)}>
                        ← BACK TO OVERVIEW
                    </button>
                )}
            </div>

            {!selectedChapter ? (
                <div className="stats-dashboard">
                    <div className="dashboard-grid">
                        <StatCard 
                            title="Total Chapters" 
                            value={stats.total_chapters} 
                            icon="📚" 
                            color="#10b981" 
                        />
                        <StatCard 
                            title="Intelligence Quality" 
                            value={totals.verified} 
                            subValue={`${totals.unverified} requiring attention`}
                            icon="🧬" 
                            color="#6366f1" 
                        />

                        <StatCard 
                            title="Total Financial Impact" 
                            value={`₹${Math.round(totals.cost).toLocaleString()}`} 
                            subValue={`Avg ₹${(totals.cost / (totals.questions || 1)).toFixed(2)} / Question`}
                            icon="🪙" 
                            color="#f59e0b" 
                        />
                        <StatCard 
                            title="Token Utilization" 
                            value={`${(totals.tokens / 1000000).toFixed(2)}M`} 
                            subValue="Total IO Compute"
                            icon="⚡" 
                            color="#ec4899" 
                        />
                    </div>

                    <div className="chapter-list-section">
                        <div className="section-title">CHAPTER BREAKDOWN</div>
                        <div className="chapter-grid">
                            {stats.data.map((chap, i) => (
                                <div key={i} className="chapter-row" onClick={() => setSelectedChapter(chap)}>
                                    <div className="chap-info">
                                        <div className="chap-name"><MathText text={chap.chapter_name} /></div>
                                        <div className="chap-meta">{chap.pages_processed} Pages Processed</div>
                                    </div>

                                    <div className="chap-stats">
                                        <div className="chap-stat">
                                            <span className="label">VERIFIED / TOTAL</span>
                                            <span className="val">{chap.total_verified} / {chap.total_questions}</span>
                                        </div>

                                        <div className="chap-stat">
                                            <span className="label">COST</span>
                                            <span className="val">₹{chap.total_cost_inr.toFixed(0)}</span>
                                        </div>
                                        <div className="chap-stat arrow">→</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="chapter-detail-view">
                    <div className="detail-meta-row">
                        <div className="meta-item">
                            <label>CHAPTER</label>
                            <div><MathText text={selectedChapter.chapter_name} /></div>
                        </div>

                        <div className="meta-item">
                            <label>TOTAL QUESTIONS</label>
                            <div>{selectedChapter.total_verified} <span style={{ color: '#64748b', fontSize: '14px' }}>/ {selectedChapter.total_questions} Verified</span></div>
                        </div>
                        <div className="meta-item">
                            <label>UNVERIFIED</label>
                            <div style={{ color: selectedChapter.total_unverified > 0 ? '#ef4444' : '#64748b' }}>{selectedChapter.total_unverified}</div>
                        </div>
                        <div className="meta-item">
                            <label>TOTAL COST</label>
                            <div className="text-highlight">₹{selectedChapter.total_cost_inr.toFixed(2)}</div>
                        </div>
                    </div>


                    <div className="page-table-wrapper">
                        <table className="stats-table">
                            <thead>
                                <tr>
                                    <th>RESOURCE PAGE</th>
                                    <th>VERDICT STATUS</th>
                                    <th>MODEL I/O (TOKENS)</th>
                                    <th>FINANCIAL IMPACT</th>
                                    <th>UNIT COST</th>

                                </tr>
                            </thead>
                            <tbody>
                                {selectedChapter.questions_breakdown.map((page, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div className="page-name"><MathText text={page.page_name} /></div>
                                            <div className="book-id">{page.book_id}</div>
                                        </td>
                                        <td>
                                            <div className="verdict-row">
                                                <div className="v-pill verified">
                                                    <span className="v-icon">✓</span> {page.verified_count}
                                                </div>
                                                <div className="v-pill unverified">
                                                    <span className="v-icon">⚠</span> {page.unverified_count}
                                                </div>
                                            </div>
                                        </td>


                                        <td>
                                            <div className="token-split">
                                                <div className="t-row">
                                                    <span className="t-lbl">GPT-5.4</span>
                                                    <span className="t-val">{(page.tokens.gpt_5_4.input + page.tokens.gpt_5_4.output).toLocaleString()}</span>
                                                </div>
                                                <div className="t-row">
                                                    <span className="t-lbl">Claude</span>
                                                    <span className="t-val">{(page.tokens.claude_sonnet.input + page.tokens.claude_sonnet.output).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="cost-val">₹{page.total_cost_inr.toFixed(2)}</div>
                                            <div className="q-count">{page.questions_count} Questions</div>
                                        </td>
                                        <td>
                                            <div className="per-q-cost">₹{page.per_question_cost_inr.toFixed(2)}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <style jsx>{`
                .verdict-row { display: flex; gap: 8px; }
                .v-pill { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 6px; }
                .v-pill.verified { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
                .v-pill.unverified { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
                .v-icon { font-size: 10px; }

                .pipeline-stats-container {

                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: fadeIn 0.5s ease-out;
                    max-width: 1400px;
                    margin: 0 auto;
                    width: 100%;
                }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .stats-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 40px;
                    padding-top: 10px;
                }
                .header-text h2 { font-size: 32px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 8px; }
                .text-highlight { color: #10b981; }
                .header-text p { color: #64748b; font-size: 14px; font-weight: 500; }
                
                .back-btn {
                    background: #1e293b;
                    color: #fff;
                    border: 1px solid #334155;
                    padding: 10px 20px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .back-btn:hover { background: #334155; border-color: #475569; }

                .stats-dashboard {
                    flex: 1;
                    overflow-y: auto;
                    padding-right: 10px;
                }

                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 24px;
                    margin-bottom: 50px;
                }

                .chapter-list-section { margin-bottom: 40px; }
                .section-title {
                    font-size: 12px;
                    font-weight: 900;
                    color: #10b981;
                    letter-spacing: 2px;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .section-title::after { content: ''; flex: 1; height: 1px; background: rgba(16, 185, 129, 0.2); }

                .chapter-grid { display: flex; flex-direction: column; gap: 12px; }
                .chapter-row {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    padding: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .chapter-row:hover {
                    background: rgba(16, 185, 129, 0.05);
                    border-color: rgba(16, 185, 129, 0.3);
                    transform: translateX(10px);
                }
                .chap-name { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
                .chap-meta { font-size: 12px; color: #64748b; font-weight: 600; }
                
                .chap-stats { display: flex; gap: 40px; align-items: center; }
                .chap-stat { display: flex; flex-direction: column; align-items: flex-end; }
                .chap-stat .label { font-size: 9px; font-weight: 900; color: #475569; letter-spacing: 1px; }
                .chap-stat .val { font-size: 18px; font-weight: 900; color: #cbd5e1; }
                .chapter-row:hover .chap-stat .val { color: #10b981; }
                .arrow { font-size: 20px; color: #1e293b; transition: all 0.3s; }
                .chapter-row:hover .arrow { color: #10b981; transform: translateX(5px); }

                /* DETAIL VIEW */
                .chapter-detail-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                .detail-meta-row {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 30px;
                    background: rgba(0,0,0,0.2);
                    padding: 30px;
                    border-radius: 20px;
                    margin-bottom: 30px;
                }
                .meta-item label { display: block; font-size: 10px; font-weight: 900; color: #64748b; letter-spacing: 1px; margin-bottom: 8px; }
                .meta-item div { font-size: 24px; font-weight: 900; }

                .page-table-wrapper {
                    flex: 1;
                    overflow-y: auto;
                    background: rgba(255,255,255,0.01);
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .stats-table { width: 100%; border-collapse: collapse; }
                .stats-table th {
                    text-align: left;
                    padding: 20px 24px;
                    font-size: 10px;
                    font-weight: 900;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    position: sticky;
                    top: 0;
                    background: #0f172a;
                    z-index: 2;
                }
                .stats-table td {
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .page-name { font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 4px; }
                .book-id { font-size: 11px; color: #475569; font-family: monospace; }
                
                .token-split { display: flex; flex-direction: column; gap: 6px; }
                .t-row { display: flex; justify-content: space-between; gap: 20px; font-size: 12px; }
                .t-lbl { color: #64748b; font-weight: 600; }
                .t-val { color: #cbd5e1; font-family: monospace; font-weight: 700; }
                
                .cost-val { font-size: 16px; font-weight: 900; color: #f59e0b; margin-bottom: 4px; }
                .q-count { font-size: 11px; color: #475569; font-weight: 700; }
                
                .per-q-cost { font-size: 18px; font-weight: 900; color: #10b981; }

                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #334155; }
            `}</style>
        </div>
    );
}
