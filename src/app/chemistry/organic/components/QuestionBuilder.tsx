'use client';

import { useState, useRef, useEffect, memo } from 'react';
import MathText from './MathText';
import SmilesRenderer from './SmilesRenderer';
import ReactionSequence from './ReactionSequence';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v2/organic-chemistry';

const TerminalLog = memo(function TerminalLog({ logText }: { logText: string }) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logText]);

    return (
        <div className="terminal-container">
            <div className="terminal-header">
                <div className="terminal-dots">
                    <span className="dot red"></span>
                    <span className="dot yellow"></span>
                    <span className="dot green"></span>
                </div>
                <span className="terminal-title">pipeline.log</span>
            </div>
            <div ref={scrollRef} className="terminal-body">
                <pre>{logText || '> Establishing molecular socket...\n> Waiting for synthesis stream...'}</pre>
            </div>
            <style jsx>{`
                .terminal-container { background: #000; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; font-family: 'JetBrains Mono', monospace; margin-top: 15px; }
                .terminal-header { background: #1e293b; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; }
                .terminal-dots { display: flex; gap: 6px; }
                .dot { width: 8px; height: 8px; border-radius: 50%; }
                .red { background: #ff5f56; }
                .yellow { background: #ffbd2e; }
                .green { background: #27c93f; }
                .terminal-title { fontSize: 10px; color: #94a3b8; fontWeight: 800; text-transform: uppercase; letter-spacing: 1px; }
                .terminal-body { padding: 15px; height: 160px; overflow-y: auto; font-size: 11px; color: #10b981; line-height: 1.5; }
                pre { white-space: pre-wrap; margin: 0; }
            `}</style>
        </div>
    );
});

const QuestionCard = memo(function QuestionCard({ q, level }: { q: any, level: string }) {
    if (!q) return null;
    
    let optionsArray: any[] = [];
    if (q.options && Array.isArray(q.options)) {
        optionsArray = q.options.map((opt: any, i: number) => {
            const label = String.fromCharCode(65 + i);
            if (typeof opt === 'string') return { label, text: opt };
            return { label, text: opt.text || '', smiles: opt.smiles };
        });
    } else if (q.options && typeof q.options === 'object') {
        optionsArray = Object.entries(q.options).map(([key, val]: [string, any]) => {
            if (typeof val === 'string') return { label: key, text: val };
            return { label: key, text: val?.text || '', smiles: val?.smiles };
        });
    }

    const verdict = q.verdict || '';
    const isVerified = verdict === 'verified';
    const isTieBroken = verdict === 'tie_broken';
    const isReview = verdict === 'review_required';

    return (
        <div className={`q-card ${level}`}>
            <div className="q-header">
                <div className="q-badge-row">
                    <span className={`diff-badge ${level}`}>{level.toUpperCase()}</span>
                    
                    {isVerified && <span className="verdict-badge verified">✓ VERIFIED</span>}
                    {isTieBroken && <span className="verdict-badge tiebroken">⚖ TIE-BROKEN (L3)</span>}
                    {isReview && <span className="verdict-badge review">⚠ REVIEW REQUIRED</span>}
                    {(!isVerified && !isTieBroken && !isReview && verdict) && (
                        <span className="verdict-badge">{verdict.toUpperCase()}</span>
                    )}

                    {q.consensus && (
                        <span className="consensus-badge">
                            L1: <strong>{q.consensus.llm1}</strong> | L2: <strong>{q.consensus.llm2}</strong>
                        </span>
                    )}
                </div>
                {q.topic && (
                    <div className="q-topic-info-container">
                        <div className="q-topic-info">
                            {q.topic} {q.subtopic && `• ${q.subtopic}`}
                        </div>
                        {q.q_micro_concept && (
                            <div className="q-micro-concept">
                                MICRO-CONCEPT: <span>{q.q_micro_concept}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {q.q_prerequisite_concepts && q.q_prerequisite_concepts.length > 0 && (
                <div className="q-prerequisites">
                    {q.q_prerequisite_concepts.map((concept: string, idx: number) => (
                        <span key={idx} className="prereq-badge">{concept}</span>
                    ))}
                </div>
            )}

            {q.visual_confirmation && (
                <div className="visual-confirmation-box">
                    <strong>👁 Visual Extraction:</strong> <MathText text={q.visual_confirmation} />
                </div>
            )}

            <div className="q-content">
                <div className="q-text"><MathText text={q.question} /></div>
                
                {q.reaction_sequence ? (
                    <ReactionSequence data={q.reaction_sequence} />
                ) : (
                    q.question_smiles && <SmilesRenderer smiles={q.question_smiles} />
                )}

                <div className="options-grid">
                    {optionsArray.map((opt, i) => (
                        <div key={i} className={`opt-box ${opt.label === q.correct_option ? 'correct' : ''}`}>
                            <div className="opt-label">{opt.label}</div>
                            <div className="opt-body">
                                <MathText text={opt.text} />
                                {opt.smiles && <SmilesRenderer smiles={opt.smiles} width={120} height={120} transparent={true} />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="q-explanation">
                <h4>EXPLANATORY NOTES</h4>
                <MathText text={q.solution || 'No explanation provided.'} />
            </div>

            <style jsx>{`
                .q-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; margin-bottom: 24px; transition: 0.3s; }
                .q-card:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); }
                .q-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
                .q-badge-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .diff-badge { padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 900; color: #fff; text-transform: uppercase; }
                .diff-badge.easy { background: #10b981; }
                .diff-badge.medium { background: #f59e0b; }
                .diff-badge.hard { background: #ef4444; }
                
                .verdict-badge { font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 6px; }
                .verdict-badge.verified { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
                .verdict-badge.tiebroken { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
                .verdict-badge.review { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
                
                .consensus-badge { font-size: 10px; color: #94a3b8; background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 6px; }
                .consensus-badge strong { color: #fff; }
                
                .q-topic-info-container { text-align: right; display: flex; flex-direction: column; gap: 4px; }
                .q-topic-info { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
                .q-micro-concept { font-size: 9px; font-weight: 900; color: #6366f1; letter-spacing: 0.5px; }
                .q-micro-concept span { color: #cbd5e1; font-weight: 700; }
                
                .q-prerequisites { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
                .prereq-badge { font-size: 9px; font-weight: 800; background: rgba(255,255,255,0.03); color: #64748b; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06); text-transform: uppercase; }

                .visual-confirmation-box { background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #cbd5e1; border-left: 4px solid #6366f1; }
                .visual-confirmation-box strong { color: #818cf8; font-weight: 800; margin-right: 5px; }

                .q-text { font-size: 17px; font-weight: 700; color: #f8fafc; line-height: 1.6; margin-bottom: 20px; }
                
                .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
                .opt-box { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; display: flex; gap: 15px; transition: 0.2s; }
                .opt-box.correct { border-color: #10b981; background: rgba(16, 185, 129, 0.05); }
                .opt-label { width: 28px; height: 28px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; color: #94a3b8; flex-shrink: 0; }
                .opt-box.correct .opt-label { background: #10b981; color: #000; }
                .opt-body { flex: 1; display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: #cbd5e1; }
                
                .q-explanation { margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); }
                .q-explanation h4 { font-size: 10px; font-weight: 900; color: #6366f1; margin-bottom: 10px; letter-spacing: 1px; }
                .q-explanation :global(p) { font-size: 13.5px; line-height: 1.6; color: #94a3b8; }
            `}</style>
        </div>
    );
});

export default function QuestionBuilder({ initialBookId, initialPageName }: { initialBookId: string, initialPageName: string }) {
    const [status, setStatus] = useState<'idle' | 'building' | 'completed' | 'failed'>('idle');
    const [results, setResults] = useState<any>(null);
    const [viewTab, setViewTab] = useState<'final' | 'llm1' | 'llm2' | 'stats' | 'raw'>('final');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');

    const pollInterval = useRef<any>(null);

    // Initial check for results
    useEffect(() => {
        if (!initialBookId || !initialPageName) return;
        fetchResults();
    }, [initialBookId, initialPageName]);

    const fetchResults = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${encodeURIComponent(initialBookId)}/${encodeURIComponent(initialPageName)}/results`);
            if (res.ok) {
                const data = await res.json();
                setResults(data);
                if (data.questions) setStatus('completed');
            } else {
                setResults(null);
                setStatus('idle');
            }
        } catch (e) {
            setResults(null);
        }
    };

    const startBuild = async () => {
        if (!initialBookId || !initialPageName) return;
        setStatus('building');
        setResults(null);
        setSyncStatus('idle');
        try {
            await fetch(`${API_BASE_URL}${API_PREFIX}/book/${encodeURIComponent(initialBookId)}/${encodeURIComponent(initialPageName)}/generate`, { method: 'POST' });
            pollResults();
        } catch (e) {
            setStatus('failed');
        }
    };

    const pollResults = () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
        pollInterval.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${encodeURIComponent(initialBookId)}/${encodeURIComponent(initialPageName)}/results`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                    if (data.questions) {
                        clearInterval(pollInterval.current);
                        setStatus('completed');
                    }
                }
            } catch (e) {}
        }, 3000);
    };

    const syncToDB = async () => {
        setSyncStatus('syncing');
        try {
            const res = await fetch(`${API_BASE_URL}${API_PREFIX}/book/${encodeURIComponent(initialBookId)}/${encodeURIComponent(initialPageName)}/sync`, { method: 'POST' });
            if (res.ok) setSyncStatus('synced');
            else setSyncStatus('failed');
        } catch (e) { setSyncStatus('failed'); }
    };

    const stats = results?.stats || {};
    const cost = stats.total_cost_usd || 0;
    const llm1 = stats.llm1_usage || {};
    const llm2 = stats.llm2_usage || {};

    return (
        <div className="builder-root">
            <div className="builder-controls">
                <div className="control-card">
                    <div className="control-label">SYNTHESIS ENGINE</div>
                    <button className="build-btn" onClick={startBuild} disabled={status === 'building'}>
                        {status === 'building' ? '🧬 AGENT IN FLIGHT...' : '🚀 DEPLOY VISION PIPELINE'}
                    </button>
                    <p className="control-hint">This will trigger the 4-Stage AI Pipeline for the current page.</p>
                </div>

                <TerminalLog logText={results?.log || ''} />

                {status === 'completed' && (
                    <div className="control-card sync-card">
                        <div className="control-label">DATABASE SYNC</div>
                        <button className={`sync-btn ${syncStatus}`} onClick={syncToDB} disabled={syncStatus === 'syncing' || syncStatus === 'synced'}>
                            {syncStatus === 'syncing' ? 'SYNCING...' : syncStatus === 'synced' ? '✓ COMMITTED' : '📤 SYNC TO MONGODB'}
                        </button>
                    </div>
                )}
            </div>

            <div className="builder-main">
                <nav className="tabs-nav">
                    <button className={viewTab === 'final' ? 'active' : ''} onClick={() => setViewTab('final')}>Final Outcomes</button>
                    <button className={viewTab === 'llm1' ? 'active' : ''} onClick={() => setViewTab('llm1')}>L1 Generator</button>
                    <button className={viewTab === 'llm2' ? 'active' : ''} onClick={() => setViewTab('llm2')}>L2 Validator</button>
                    <button className={viewTab === 'stats' ? 'active' : ''} onClick={() => setViewTab('stats')}>Efficiency & Cost</button>
                    <button className={viewTab === 'raw' ? 'active' : ''} onClick={() => setViewTab('raw')}>Raw Data</button>
                </nav>

                <div className="tab-content">
                    {status === 'building' && !results?.questions && (
                        <div className="loading-state">
                            <div className="loader-ring"></div>
                            <h3>SYNTHESIZING ORGANIC DATA</h3>
                            <p>Orchestrating Vision Models & Chemical Logic...</p>
                        </div>
                    )}

                    {viewTab === 'final' && results?.questions && (
                        <div className="results-list">
                            {['easy', 'medium', 'hard'].map(lvl => (
                                <QuestionCard key={lvl} level={lvl} q={results.questions[lvl]} />
                            ))}
                        </div>
                    )}
                    
                    {viewTab === 'llm1' && results?.llm1_raw && (
                        <div className="results-list">
                            {['easy', 'medium', 'hard'].map(lvl => (
                                <QuestionCard key={lvl} level={lvl} q={results.llm1_raw[lvl]} />
                            ))}
                        </div>
                    )}

                    {viewTab === 'llm2' && results?.llm2_raw && (
                        <div className="results-list">
                            {['easy', 'medium', 'hard'].map(lvl => (
                                <QuestionCard key={lvl} level={lvl} q={results.llm2_raw[lvl]} />
                            ))}
                        </div>
                    )}

                    {viewTab === 'stats' && results?.stats && (
                        <div className="stats-view">
                            <div className="cost-summary">
                                <div className="total-cost">
                                    <span className="label">TOTAL PIPELINE COST</span>
                                    <span className="value">
                                        ${cost.toFixed(4)} 
                                        <span style={{fontSize: '20px', color: '#94a3b8', marginLeft: '10px'}}>
                                            (₹{(stats.total_cost_inr || 0).toFixed(2)})
                                        </span>
                                    </span>
                                </div>
                                <div className="per-question-cost" style={{marginTop: '15px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', display: 'inline-block', border: '1px solid rgba(16, 185, 129, 0.2)'}}>
                                    <span style={{fontSize: '11px', color: '#10b981', fontWeight: 900, letterSpacing: '1px', display: 'block', marginBottom: '4px'}}>PER QUESTION (3 GENERATED)</span>
                                    <span style={{fontSize: '16px', color: '#fff', fontWeight: 800}}>${(cost / 3).toFixed(4)}</span>
                                    <span style={{fontSize: '14px', color: '#94a3b8', marginLeft: '6px'}}>| ₹{((stats.total_cost_inr || 0) / 3).toFixed(2)}</span>
                                </div>
                                <div className="cost-disclaimer">Calculated based on real-time token usage across GPT-5.4 & Claude Sonnet.</div>
                            </div>

                            <div className="stats-grid">
                                <div className="stat-box">
                                    <div className="stat-title">L1 GENERATOR (GPT-5.4)</div>
                                    <div className="stat-row"><span>Input Tokens</span> <strong>{llm1.input_tokens}</strong></div>
                                    <div className="stat-row"><span>Output Tokens</span> <strong>{llm1.output_tokens}</strong></div>
                                    <div className="stat-divider"></div>
                                    <div className="stat-row highlight">
                                        <span>Estimated Cost</span> 
                                        <strong>
                                            ${llm1.cost_usd?.toFixed(4)} 
                                            <span style={{fontSize: '11px', color: '#94a3b8', marginLeft: '4px'}}>
                                                (₹{llm1.cost_inr?.toFixed(2)})
                                            </span>
                                        </strong>
                                    </div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-title">L2 VALIDATOR (Claude)</div>
                                    <div className="stat-row"><span>Input Tokens</span> <strong>{llm2.input_tokens}</strong></div>
                                    <div className="stat-row"><span>Output Tokens</span> <strong>{llm2.output_tokens}</strong></div>
                                    <div className="stat-divider"></div>
                                    <div className="stat-row highlight">
                                        <span>Estimated Cost</span> 
                                        <strong>
                                            ${llm2.cost_usd?.toFixed(4)} 
                                            <span style={{fontSize: '11px', color: '#94a3b8', marginLeft: '4px'}}>
                                                (₹{llm2.cost_inr?.toFixed(2)})
                                            </span>
                                        </strong>
                                    </div>
                                </div>
                                {stats.tiebreaker_cost_usd > 0 && (
                                    <div className="stat-box full-width">
                                        <div className="stat-title">L3 TIEBREAKER (GPT-4o)</div>
                                        <div className="stat-row highlight">
                                            <span>Additional Cost</span> 
                                            <strong>
                                                ${stats.tiebreaker_cost_usd?.toFixed(4)} 
                                                <span style={{fontSize: '11px', color: '#94a3b8', marginLeft: '4px'}}>
                                                    (₹{stats.tiebreaker_cost_inr?.toFixed(2)})
                                                </span>
                                            </strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {viewTab === 'raw' && results && (
                        <div className="raw-json">
                            <pre>{JSON.stringify(results, null, 2)}</pre>
                        </div>
                    )}

                    {!results?.questions && status !== 'building' && (
                        <div className="empty-placeholder">
                            <div className="icon">🚀</div>
                            <p>DEPLOY THE PIPELINE TO GENERATE MOLECULAR OUTCOMES</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .builder-root { display: grid; grid-template-columns: 340px 1fr; height: 100%; overflow: hidden; background: rgba(0,0,0,0.1); }
                .builder-controls { padding: 20px; border-right: 1px solid rgba(255,255,255,0.05); overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
                .control-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 20px; border-radius: 16px; }
                .control-label { font-size: 10px; font-weight: 900; color: #6366f1; margin-bottom: 12px; letter-spacing: 1px; }
                .build-btn { width: 100%; background: #6366f1; color: #fff; border: none; padding: 14px; border-radius: 10px; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); }
                .build-btn:hover:not(:disabled) { background: #4f46e5; transform: translateY(-1px); }
                .build-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .control-hint { font-size: 10px; color: #475569; margin-top: 10px; text-align: center; line-height: 1.4; }

                .sync-card { border-color: rgba(16, 185, 129, 0.2); }
                .sync-btn { width: 100%; background: #10b981; color: #000; border: none; padding: 12px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer; }
                .sync-btn.synced { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981; }
                
                .builder-main { display: flex; flex-direction: column; overflow: hidden; }
                .tabs-nav { display: flex; gap: 30px; padding: 0 40px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1); }
                .tabs-nav button { background: none; border: none; padding: 20px 0; font-size: 12px; font-weight: 800; color: #475569; cursor: pointer; position: relative; transition: 0.2s; }
                .tabs-nav button.active { color: #6366f1; }
                .tabs-nav button.active::after { content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: #6366f1; border-radius: 2px 2px 0 0; }
                
                .tab-content { flex: 1; overflow-y: auto; padding: 30px 40px; }
                .results-list { max-width: 850px; margin: 0 auto; }
                
                .loading-state { height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
                .loader-ring { width: 50px; height: 50px; border: 4px solid rgba(99, 102, 241, 0.1); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .loading-state h3 { font-size: 16px; font-weight: 800; letter-spacing: 2px; }
                .loading-state p { color: #64748b; font-size: 13px; }

                .stats-view { max-width: 800px; margin: 0 auto; }
                .cost-summary { background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 20px; padding: 30px; margin-bottom: 30px; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
                .total-cost { display: flex; flex-direction: column; gap: 5px; }
                .total-cost .label { font-size: 11px; font-weight: 900; color: #6366f1; letter-spacing: 2px; }
                .total-cost .value { font-size: 48px; font-weight: 900; color: #fff; letter-spacing: -1px; }
                .cost-disclaimer { font-size: 11px; color: #475569; margin-top: 15px; }
                
                .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .stat-box { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); padding: 20px; border-radius: 16px; }
                .stat-box.full-width { grid-column: span 2; display: flex; justify-content: space-between; align-items: center; }
                .stat-box.full-width .stat-title { margin-bottom: 0; }
                .stat-box.full-width .stat-row { margin-bottom: 0; }
                .stat-title { font-size: 11px; font-weight: 900; color: #94a3b8; margin-bottom: 20px; letter-spacing: 1px; }
                .stat-row { display: flex; justify-content: space-between; gap: 20px; font-size: 13px; color: #64748b; margin-bottom: 10px; }
                .stat-row strong { color: #f8fafc; }
                .stat-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 15px 0; }
                .stat-row.highlight { color: #10b981; }
                .stat-row.highlight strong { color: #10b981; font-size: 16px; }

                .raw-json { background: #000; padding: 20px; border-radius: 16px; font-family: monospace; font-size: 12px; color: #10b981; }
                .empty-placeholder { height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; opacity: 0.3; }
                .empty-placeholder .icon { font-size: 48px; }
                .empty-placeholder p { font-weight: 900; font-size: 12px; letter-spacing: 1px; }
            `}</style>
        </div>
    );
}
