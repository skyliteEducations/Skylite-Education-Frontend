'use client';

import { useState, useRef, useEffect, memo } from 'react';
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

const COST_CONFIG: any = {
    'gpt-5.4': { input: 2.50, output: 15.00 },
    'gpt-4o': { input: 2.50, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 }
};

const USD_TO_INR = 93;

const formatCurrency = (val: number) => {
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(val);
    const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(val * USD_TO_INR);
    return `${usd} (${inr})`;
};

export default function QuestionBuilder() {
    const [bookName, setBookName] = useState('');
    const [chapterName, setChapterName] = useState('');
    const [pageName, setPageName] = useState('');
    
    // Discovery Lists
    const [bookList, setBookList] = useState<string[]>([]);
    const [chapterList, setChapterList] = useState<string[]>([]);
    const [pageList, setPageList] = useState<string[]>([]);

    const [verifiedQuestions, setVerifiedQuestions] = useState<any[]>([]);
    const [loadingQs, setLoadingQs] = useState(false);
    
    // Active job polling
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<string>('idle');
    const [jobMessage, setJobMessage] = useState('');
    const [activeQIndex, setActiveQIndex] = useState<number | null>(null);
    
    // Builder Output
    const [outputData, setOutputData] = useState<any>(null);
    const [editableFinalObj, setEditableFinalObj] = useState<any>(null);

    // Active View Mode (Tabs)
    const [viewMode, setViewMode] = useState<'edit' | 'llm1' | 'llm2' | 'llm3' | 'taxonomy' | 'performance'>('edit');
    const [jobTokens, setJobTokens] = useState<any>(null);
    
    const pollingInterval = useRef<any>(null);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/source-verified/books`);
                const data = await res.json();
                setBookList(data.books || []);
            } catch (e) {
                console.error("Failed to fetch books", e);
            }
        };
        fetchBooks();
    }, []);

    useEffect(() => {
        if (!bookName) { setChapterList([]); setChapterName(''); return; }
        const fetchChapters = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/source-verified/${bookName}/chapters`);
                const data = await res.json();
                setChapterList(data.chapters || []);
            } catch (e) {
                console.error("Failed to fetch chapters", e);
            }
        };
        fetchChapters();
    }, [bookName]);

    useEffect(() => {
        if (!bookName || !chapterName) { setPageList([]); setPageName(''); return; }
        const fetchPages = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/source-verified/${bookName}/${chapterName}/pages`);
                const data = await res.json();
                setPageList(data.pages || []);
            } catch (e) {
                console.error("Failed to fetch pages", e);
            }
        };
        fetchPages();
    }, [bookName, chapterName]);

    const parseOutputToEditable = (out: any) => {
        let rawTax = out.taxonomy_assignment || out.taxonomy || { topic: "", subtopic: "", total_tokens: 0 };
        
        // Handle flattened or nested structure
        let topic = rawTax.topic || "";
        let subtopic = rawTax.subtopic || "";
        if (!topic && !subtopic) {
            const firstFound = rawTax.easy || rawTax.medium || rawTax.hard;
            if (firstFound) {
                topic = firstFound.topic || "";
                subtopic = firstFound.subtopic || "";
            }
        }

        return {
            reference_question: out.extraction,
            taxonomy: { topic, subtopic, total_tokens: rawTax.total_tokens || 0 },
            easy: out.final_output?.easy || out.llm1_output?.easy || { question: '', options: { A: "", B: "", C: "", D: "" }, correct_option: "", solution: "" },
            medium: out.final_output?.medium || out.llm1_output?.medium || { question: '', options: { A: "", B: "", C: "", D: "" }, correct_option: "", solution: "" },
            hard: out.final_output?.hard || out.llm1_output?.hard || { question: '', options: { A: "", B: "", C: "", D: "" }, correct_option: "", solution: "" }
        };
    };

    const fetchVerified = async () => {
        if (!bookName || !chapterName || !pageName) {
            alert('Please fill out all path fields'); return;
        }
        setLoadingQs(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/source-verified/${bookName}/${chapterName}/${pageName}`);
            const data = await res.json();
            setVerifiedQuestions(data.verified_questions || []);
        } catch (e) {
            console.error(e);
            alert("Could not fetch verified questions");
        } finally {
            setLoadingQs(false);
        }
    };

    const startBuild = async (qIndex: number) => {
        setActiveQIndex(qIndex);
        setJobStatus('starting');
        setJobMessage('Initiating 3-LLM pipeline...');
        setOutputData(null);
        setEditableFinalObj(null);
        setJobTokens(null);
        setViewMode('edit');
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/build/${bookName}/${chapterName}/${pageName}/${qIndex}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.job_id) {
                setActiveJobId(data.job_id);
                pollJob(data.job_id, qIndex);
            }
        } catch (e) {
            setJobStatus('error');
            console.error(e);
        }
    };

    const fetchOutput = async (qIdx: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/output/${bookName}/${chapterName}/${pageName}/${qIdx}/all`);
            const data = await res.json();
            if (data) {
                setOutputData(data);
                
                // Aggregate tokens from all steps if they exist in the response
                const aggregatedTokens: any = {};
                if (data.tokens) {
                    Object.assign(aggregatedTokens, data.tokens);
                } else {
                    // Look into individual output blocks
                    const steps = { 
                        llm1: data.llm1_output, 
                        llm2: data.llm2_output, 
                        llm3: data.llm3_output, 
                        taxonomy: data.taxonomy_assignment || data.taxonomy 
                    };
                    Object.entries(steps).forEach(([key, val]: [string, any]) => {
                        if (val && (val.total_tokens || val.prompt_tokens)) {
                            aggregatedTokens[key] = {
                                total: val.total_tokens,
                                prompt: val.prompt_tokens,
                                completion: val.completion_tokens,
                                model: val.model
                            };
                        }
                    });
                    
                    // Fallback for root tokens
                    if (Object.keys(aggregatedTokens).length === 0 && (data.total_tokens || data.prompt_tokens)) {
                        aggregatedTokens.totalBuild = data;
                    }
                }
                
                console.log("Builder Token Debug (Aggregated):", aggregatedTokens);
                if (Object.keys(aggregatedTokens).length > 0) setJobTokens(aggregatedTokens);
                
                setEditableFinalObj((prev: any) => {
                    const parsed = parseOutputToEditable(data);
                    // If we don't have a previous object, or the previous object is essentially "empty" 
                    // (no question text in easy/medium/hard), we should use the new parsed data.
                    const isNewPopulated = !!(parsed.easy?.question || parsed.medium?.question || parsed.hard?.question);
                    const isOldEmpty = !prev || !(prev.easy?.question || prev.medium?.question || prev.hard?.question);
                    
                    if (isOldEmpty && isNewPopulated) return parsed;
                    return prev || parsed;
                });
            }
        } catch (e) {}
    };

    const pollJob = (jId: string, qIdx: number) => {
        setJobStatus('processing');
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        
        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/status/${jId}`);
                if (!res.ok) throw new Error("Poll failed");
                const data = await res.json();
                
                setJobMessage(`Status: ${data.status}`);
                if (data.tokens) {
                    setJobTokens(data.tokens);
                } else if (data.total_tokens || data.prompt_tokens) {
                    setJobTokens(data);
                }
                if (data.taxonomy) {
                     setOutputData((prev: any) => ({ ...prev, taxonomy_assignment: data.taxonomy }));
                }

                if (data.status === 'completed') {
                    setJobStatus('completed');
                    clearInterval(pollingInterval.current);
                    fetchOutput(qIdx);
                } else if (data.status === 'failed') {
                    setJobStatus('error');
                    clearInterval(pollingInterval.current);
                } else {
                    fetchOutput(qIdx);
                }
            } catch (e) { }
        };
        pollingInterval.current = setInterval(poll, 4000);
    };

    const saveFinal = async () => {
        if (activeQIndex === null) return;
        setJobStatus('saving');
        try {
            const body = {
                book_name: bookName,
                chapter_name: chapterName,
                page_name: pageName,
                question_index: activeQIndex,
                job_id: activeJobId
            };
            
            const res = await fetch(`${API_BASE_URL}/api/v1/question-builder/sync-to-mongo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Question pipeline data successfully synced to MongoDB!");
                setJobStatus('idle');
                setActiveJobId(null);
            } else {
                alert(`Failed to sync: ${data.message || 'Unknown error'}`);
                setJobStatus('completed');
            }
        } catch (e) {
            console.error(e);
            setJobStatus('error');
        }
    };

    const updateLevelField = (level: 'easy'|'medium'|'hard'|'taxonomy', field: string, value: any) => {
        setEditableFinalObj((prev: any) => ({
            ...prev,
            [level]: level === 'taxonomy' ? { ...prev.taxonomy, [field]: value } : { ...prev[level], [field]: value }
        }));
    };

    const updateOption = (level: 'easy'|'medium'|'hard', optKey: string, value: string) => {
        setEditableFinalObj((prev: any) => ({
            ...prev,
            [level]: { 
                ...prev[level], 
                options: { ...prev[level].options, [optKey]: value }
            }
        }));
    };

    const LevelEditor = ({ level, diffData, tokens, llm2, llm3 }: any) => {
        if (!diffData) return null;
        return (
            <div className="diff-editor-section" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
                <h3 style={{ textTransform: 'capitalize', color: 'var(--primary)', marginBottom: '16px' }}>{level} Variation</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="edit-form">
                        <label className="editor-label">Generated Question</label>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', marginBottom: '8px', borderLeft: '3px solid var(--primary)', maxHeight: '150px', overflowY: 'auto' }}>
                            <MathText text={diffData.question || ''} />
                        </div>
                        <textarea className="edit-textarea" style={{ minHeight: '80px', fontSize: '13px' }} value={diffData.question || ''} onChange={e => updateLevelField(level, 'question', e.target.value)} />
                        
                        <label className="editor-label" style={{ marginTop: '12px' }}>Options Preview</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '4px' }}>
                            {['A','B','C','D'].map(k => (
                                <div key={k} style={{ fontSize: '13px' }}>
                                    <strong style={{ color: 'var(--primary)', marginRight: '6px' }}>({k})</strong>
                                    <MathText text={(diffData.options && diffData.options[k]) || ''} />
                                </div>
                            ))}
                        </div>

                        <label className="editor-label">Edit Raw Options</label>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {['A','B','C','D'].map(k => (
                                <div key={k} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', minWidth: '15px' }}>{k}</span>
                                    <input className="edit-input" style={{ fontSize: '13px' }} value={(diffData.options && diffData.options[k]) || ''} onChange={e => updateOption(level, k, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="edit-form">
                        <label className="editor-label">Correct Option</label>
                        <input className="edit-input" value={diffData.correct_option || ''} onChange={e => updateLevelField(level, 'correct_option', e.target.value)} />
                        
                        <label className="editor-label" style={{ marginTop: '12px' }}>Solution Preview</label>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', marginBottom: '8px', borderLeft: '3px solid #10b981', maxHeight: '150px', overflowY: 'auto' }}>
                            <MathText text={diffData.solution || ''} />
                        </div>
                        <textarea className="edit-textarea" style={{ minHeight: '120px' }} value={diffData.solution || ''} onChange={e => updateLevelField(level, 'solution', e.target.value)} />
                        
                        {(llm2 || llm3) && (
                            <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-light)', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>Validator Feedback</strong>
                                {llm2 && (
                                    <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 'bold', color: '#a855f7' }}>Validator 1:</span>
                                            <span style={{ color: llm2.verdict === 'correct' ? '#10b981' : '#f43f5e', fontWeight: 'bold' }}>{llm2.verdict?.toUpperCase()}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8, maxHeight: '60px', overflowY: 'auto' }}>
                                            <MathText text={llm2.explanation || 'No explanation.'} />
                                        </div>
                                    </div>
                                )}
                                {llm3 && (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>Validator 2:</span>
                                            <span style={{ color: llm3.verdict === 'correct' ? '#10b981' : '#f43f5e', fontWeight: 'bold' }}>{llm3.verdict?.toUpperCase()}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8, maxHeight: '60px', overflowY: 'auto' }}>
                                            <MathText text={llm3.explanation || 'No explanation.'} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Step Tokens: {tokens || 'N/A'}</p>
                           <p style={{ fontSize: '12px', opacity: 0.7, margin: 0, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>Verdict: <span style={{ color: diffData.verdict === 'correct' ? '#10b981' : '#f43f5e', fontWeight: 'bold' }}>{diffData.verdict || 'PENDING'}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const hasLLM1 = !!(outputData?.llm1_output && (outputData.llm1_output.easy || outputData.llm1_output.medium || outputData.llm1_output.hard));
    const hasLLM2 = !!(outputData?.llm2_output && (outputData.llm2_output.easy || outputData.llm2_output.medium || outputData.llm2_output.hard));
    const hasLLM3 = !!(outputData?.llm3_output && (outputData.llm3_output.easy || outputData.llm3_output.medium || outputData.llm3_output.hard));
    
    // Check taxonomy in multiple potential fields
    const taxonomyRaw = outputData?.taxonomy_assignment || outputData?.taxonomy;
    const hasTaxonomy = !!(taxonomyRaw && (taxonomyRaw.topic || taxonomyRaw.subtopic || taxonomyRaw.easy || taxonomyRaw.medium || taxonomyRaw.hard || taxonomyRaw.total_tokens));

    return (
        <div className="split-view">
            <div className="panel" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div className="control-panel">
                    <h2>Source Locator</h2>
                    <p style={{ color: 'var(--text-light)', marginTop: '8px', fontSize: '14px' }}>Path to verified questions.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                        <div className="editor-group" style={{ margin: 0 }}>
                            <label className="editor-label">Book Selection</label>
                            <select className="edit-input" value={bookName} onChange={e => setBookName(e.target.value)} style={{ padding: '8px', borderRadius: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>-- Select Book --</option>
                                {bookList.map(b => <option key={b} value={b} style={{ background: '#1a1a1a', color: '#fff' }}>{b}</option>)}
                            </select>
                        </div>
                        <div className="editor-group" style={{ margin: 0 }}>
                            <label className="editor-label">Chapter Selection</label>
                            <select className="edit-input" value={chapterName} onChange={e => setChapterName(e.target.value)} disabled={!bookName} style={{ padding: '8px', borderRadius: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>-- Select Chapter --</option>
                                {chapterList.map(c => <option key={c} value={c} style={{ background: '#1a1a1a', color: '#fff' }}>{c}</option>)}
                            </select>
                        </div>
                        <div className="editor-group" style={{ margin: 0 }}>
                            <label className="editor-label">Page Selection</label>
                            <select className="edit-input" value={pageName} onChange={e => setPageName(e.target.value)} disabled={!chapterName} style={{ padding: '8px', borderRadius: '4px', background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>-- Select Page --</option>
                                {pageList.map(p => <option key={p} value={p} style={{ background: '#1a1a1a', color: '#fff' }}>{p}</option>)}
                            </select>
                        </div>
                        <button className="action-btn" onClick={fetchVerified} style={{ background: 'var(--primary)', color: '#000', fontWeight: 'bold' }} disabled={!pageName}>
                            {loadingQs ? 'Fetching...' : 'Fetch Verified Questions'}
                        </button>
                    </div>
                </div>

                <div className="control-panel" style={{ marginTop: '20px' }}>
                    <h2>Verified Questions List</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                        {verifiedQuestions.length === 0 && !loadingQs && <p style={{ color: 'var(--text-light)' }}>No questions loaded.</p>}
                        {verifiedQuestions.map((q, rawIdx) => {
                            const qIdx = q.question_index !== undefined ? q.question_index : rawIdx;
                            return (
                                <div key={qIdx} style={{ padding: '12px', background: activeQIndex === qIdx ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '8px', border: activeQIndex === qIdx ? '1px solid var(--primary)' : '1px solid transparent' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '4px' }}>Index: {qIdx} {q.question_number ? `| Q No: ${q.question_number}` : ''}</div>
                                    <div style={{ maxHeight: '40px', overflow: 'hidden', fontSize: '14px', marginBottom: '8px' }}>
                                        <MathText text={q.question} />
                                    </div>
                                    <button 
                                        className="action-btn" 
                                        onClick={() => startBuild(qIdx)}
                                        disabled={jobStatus === 'processing' || jobStatus === 'starting'}
                                        style={{ width: '100%', padding: '6px', fontSize: '13px', background: activeQIndex === qIdx ? 'var(--primary)' : '#444', color: activeQIndex === qIdx ? '#000' : '#fff' }}
                                    >
                                        Start 3-LLM Build
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="panel result-panel-container" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div className="book-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>3-LLM Builder Output</h2>
                    {activeJobId && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ background: hasLLM1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: `1px solid ${hasLLM1 ? '#10b981' : '#333'}` }}>
                                {hasLLM1 ? '✅ LLM 1 Generated' : '⏳ LLM 1 Generating'}
                            </div>
                            <div style={{ background: hasLLM2 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: `1px solid ${hasLLM2 ? '#10b981' : '#333'}` }}>
                                {hasLLM2 ? '✅ LLM 2 Verified' : '⏳ LLM 2 Analyzing'}
                            </div>
                            <div style={{ background: hasLLM3 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: `1px solid ${hasLLM3 ? '#10b981' : '#333'}` }}>
                                {hasLLM3 ? '✅ LLM 3 Verified' : '⏳ LLM 3 Analyzing'}
                            </div>
                            <div style={{ background: hasTaxonomy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: `1px solid ${hasTaxonomy ? '#10b981' : '#333'}` }}>
                                {hasTaxonomy ? '✅ Taxonomy Assigned' : '⏳ Taxonomy Pipeline'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Persistent Mini Tokens (Optional, but keeping for quick reference if you want) */}
                {jobTokens && jobStatus === 'processing' && (
                    <div style={{ marginBottom: '10px', fontSize: '11px', color: 'var(--primary)', opacity: 0.8, textAlign: 'right' }}>
                        Live Monitoring: {((Object.values(jobTokens) as any[]).reduce((a: number, b: any) => a + (b?.total || (typeof b === 'number' ? b : 0)), 0))} tokens...
                    </div>
                )}

                {(jobStatus === 'processing' || jobStatus === 'starting' || jobStatus === 'saving') && !outputData && (
                    <div className="status-box" style={{ marginBottom: '20px' }}>
                        <div className="status-header">
                            <div className="loader"></div>
                            <span className="status-text">{jobStatus.toUpperCase()}</span>
                        </div>
                        <p className="status-message">{jobMessage}</p>
                    </div>
                )}

                {!outputData && jobStatus === 'idle' && (
                    <div className="empty-state"><span>🤖</span><p>Select a verified question and start the build pipeline.</p></div>
                )}

                {outputData && (
                    <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <button onClick={() => setViewMode('edit')} className="tab-btn" style={{ background: viewMode === 'edit' ? 'var(--primary)' : 'transparent', color: viewMode === 'edit' ? '#000' : 'var(--text-light)', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>Final Consolidated View</button>
                            <button onClick={() => setViewMode('llm1')} className="tab-btn" style={{ background: viewMode === 'llm1' ? '#3b82f6' : 'transparent', color: viewMode === 'llm1' ? '#fff' : 'var(--text-light)', border: '1px solid #3b82f6', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>{hasLLM1 ? '✅ LLM 1 Data' : '⏳ LLM 1 Data'}</button>
                            <button onClick={() => setViewMode('llm2')} className="tab-btn" style={{ background: viewMode === 'llm2' ? '#a855f7' : 'transparent', color: viewMode === 'llm2' ? '#fff' : 'var(--text-light)', border: '1px solid #a855f7', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>{hasLLM2 ? '✅ LLM 2' : '⏳ LLM 2'}</button>
                            <button onClick={() => setViewMode('llm3')} className="tab-btn" style={{ background: viewMode === 'llm3' ? '#ef4444' : 'transparent', color: viewMode === 'llm3' ? '#fff' : 'var(--text-light)', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>{hasLLM3 ? '✅ LLM 3' : '⏳ LLM 3'}</button>
                            <button onClick={() => setViewMode('taxonomy')} className="tab-btn" style={{ background: viewMode === 'taxonomy' ? '#f59e0b' : 'transparent', color: viewMode === 'taxonomy' ? '#fff' : 'var(--text-light)', border: '1px solid #f59e0b', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>{hasTaxonomy ? '✅ Taxonomy' : '⏳ Taxonomy'}</button>
                            <button onClick={() => setViewMode('performance')} className="tab-btn" style={{ background: viewMode === 'performance' ? '#3b82f6' : 'transparent', color: viewMode === 'performance' ? '#fff' : 'var(--text-light)', border: '1px solid #3b82f6', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>📊 Pipeline Performance</button>
                        </div>

                        {viewMode === 'edit' && editableFinalObj && (
                            <div className="result-panel">
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(245, 158, 11, 0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h3 style={{ fontSize: '16px', color: '#f59e0b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '20px' }}>🏷️</span> Subject Taxonomy
                                        </h3>
                                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', color: '#f59e0b', fontWeight: 'bold', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                            PIPELINE ASSIGNED
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="editor-group" style={{ margin: 0 }}>
                                            <label className="editor-label" style={{ color: 'rgba(245,158,11,0.7)', fontSize: '11px' }}>TOPIC</label>
                                            <input 
                                                className="edit-input" 
                                                style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(0,0,0,0.2)', color: '#f59e0b', fontWeight: '600' }}
                                                value={editableFinalObj.taxonomy?.topic || ''} 
                                                onChange={e => updateLevelField('taxonomy', 'topic', e.target.value)} 
                                            />
                                        </div>
                                        <div className="editor-group" style={{ margin: 0 }}>
                                            <label className="editor-label" style={{ color: 'rgba(245,158,11,0.7)', fontSize: '11px' }}>SUBTOPIC</label>
                                            <input 
                                                className="edit-input" 
                                                style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(0,0,0,0.2)', color: '#f59e0b', fontWeight: '600' }}
                                                value={editableFinalObj.taxonomy?.subtopic || ''} 
                                                onChange={e => updateLevelField('taxonomy', 'subtopic', e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                    {outputData?.taxonomy_assignment?.reasoning && (
                                        <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.6, background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px', borderLeft: '2px solid #f59e0b' }}>
                                            <strong>Reasoning:</strong> {outputData.taxonomy_assignment.reasoning}
                                        </div>
                                    )}
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Original Reference Question</h3>
                                    <div style={{ fontSize: '15px' }}><MathText text={editableFinalObj.reference_question?.question || ''} /></div>
                                </div>
                                {['easy', 'medium', 'hard'].map((lvl: any) => (
                                    <LevelEditor 
                                        key={lvl} 
                                        level={lvl} 
                                        diffData={editableFinalObj[lvl]} 
                                        tokens={outputData?.llm1_output?.total_tokens}
                                        llm2={outputData?.llm2_output && outputData.llm2_output[lvl]}
                                        llm3={outputData?.llm3_output && outputData.llm3_output[lvl]}
                                    />
                                ))}
                                <button onClick={saveFinal} className="action-btn" style={{ background: 'var(--primary)', color: '#000', width: '100%', padding: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                                    {jobStatus === 'saving' ? 'Saving...' : 'Finalize & Save Variations'}
                                </button>
                            </div>
                        )}

                        {viewMode === 'llm1' && (
                            <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ color: '#3b82f6', margin: 0 }}>LLM 1 Raw Generations (Rendered)</h3>
                                    {outputData.llm1_output?.total_tokens && (
                                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                            Tokens: <strong>{outputData.llm1_output.total_tokens}</strong>
                                        </div>
                                    )}
                                </div>
                                {!hasLLM1 ? <p>Processing...</p> : (
                                    <>
                                        {['easy', 'medium', 'hard'].map((l: any) => {
                                            const levelData = outputData.llm1_output[l] || outputData.llm1_output[l.charAt(0).toUpperCase() + l.slice(1)];
                                            if (!levelData) return null;
                                            return (
                                                <div key={l} style={{ marginBottom: '20px', padding: '12px', borderLeft: '3px solid #3b82f6', background: 'rgba(0,0,0,0.2)' }}>
                                                    <div style={{ textTransform: 'uppercase', fontSize: '10px', color: '#3b82f6', marginBottom: '8px', fontWeight: 'bold' }}>{l} Variation</div>
                                                    <MathText text={levelData.question || ''} />
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px', fontSize: '13px' }}>
                                                        {['A','B','C','D'].map(k => (
                                                            <div key={k}><strong style={{ color: '#3b82f6' }}>({k})</strong> <MathText text={levelData.options?.[k] || ''} /></div>
                                                        ))}
                                                    </div>
                                                    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                                        <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '4px', fontWeight: 'bold' }}>SOLUTION</div>
                                                        <MathText text={levelData.solution || ''} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <details style={{ marginTop: '20px' }}>
                                            <summary style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}>View Raw JSON</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '6px' }}>{JSON.stringify(outputData.llm1_output, null, 2)}</pre>
                                        </details>
                                    </>
                                )}
                            </div>
                        )}
                        {viewMode === 'llm2' && (
                            <div style={{ background: 'rgba(168, 85, 247, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ color: '#a855f7', margin: 0 }}>LLM 2 Validator Verdicts (Rendered)</h3>
                                    {outputData.llm2_output?.total_tokens && (
                                        <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                            Tokens: <strong>{outputData.llm2_output.total_tokens}</strong>
                                        </div>
                                    )}
                                </div>
                                {!hasLLM2 ? <p>Awaiting LLM 1...</p> : (
                                    <>
                                        {['easy', 'medium', 'hard'].map((l: any) => {
                                            const levelData = outputData.llm2_output[l] || outputData.llm2_output[l.charAt(0).toUpperCase() + l.slice(1)];
                                            if (!levelData) return null;
                                            return (
                                                <div key={l} style={{ marginBottom: '20px', padding: '12px', borderLeft: '3px solid #a855f7', background: 'rgba(0,0,0,0.2)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <span style={{ textTransform: 'uppercase', fontSize: '10px', color: '#a855f7', fontWeight: 'bold' }}>{l} Validation</span>
                                                        {levelData.verdict && (
                                                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: levelData.verdict === 'correct' ? '#10b981' : '#f43f5e' }}>{levelData.verdict?.toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    
                                                    {levelData.question ? (
                                                        <MathText text={levelData.question} />
                                                    ) : (
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--primary)', marginBottom: '4px' }}>Correct Option: <strong>{levelData.correct_option}</strong></div>
                                                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '150px', overflowY: 'auto' }}>
                                                                <MathText text={levelData.solution || 'No solution provided.'} />
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {levelData.explanation && (
                                                        <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.3)', padding: '8px', fontSize: '12px', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                                                            <strong>Explanation:</strong> <MathText text={levelData.explanation} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <details style={{ marginTop: '20px' }}>
                                            <summary style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}>View Raw JSON</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '6px' }}>{JSON.stringify(outputData.llm2_output, null, 2)}</pre>
                                        </details>
                                    </>
                                )}
                            </div>
                        )}
                        {viewMode === 'llm3' && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ color: '#ef4444', margin: 0 }}>LLM 3 Validator Verdicts (Rendered)</h3>
                                    {outputData.llm3_output?.total_tokens && (
                                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                            Tokens: <strong>{outputData.llm3_output.total_tokens}</strong>
                                        </div>
                                    )}
                                </div>
                                {!hasLLM3 ? <p>Awaiting LLM 1...</p> : (
                                    <>
                                        {['easy', 'medium', 'hard'].map((l: any) => {
                                            const levelData = outputData.llm3_output[l] || outputData.llm3_output[l.charAt(0).toUpperCase() + l.slice(1)];
                                            if (!levelData) return null;
                                            return (
                                                <div key={l} style={{ marginBottom: '20px', padding: '12px', borderLeft: '3px solid #ef4444', background: 'rgba(0,0,0,0.2)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <span style={{ textTransform: 'uppercase', fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>{l} Validation</span>
                                                        {levelData.verdict && (
                                                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: levelData.verdict === 'correct' ? '#10b981' : '#f43f5e' }}>{levelData.verdict?.toUpperCase()}</span>
                                                        )}
                                                    </div>

                                                    {levelData.question ? (
                                                        <MathText text={levelData.question} />
                                                    ) : (
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--primary)', marginBottom: '4px' }}>Correct Option: <strong>{levelData.correct_option}</strong></div>
                                                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '150px', overflowY: 'auto' }}>
                                                                <MathText text={levelData.solution || 'No solution provided.'} />
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {levelData.explanation && (
                                                        <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.3)', padding: '8px', fontSize: '12px', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                                                            <strong>Explanation:</strong> <MathText text={levelData.explanation} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <details style={{ marginTop: '20px' }}>
                                            <summary style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}>View Raw JSON</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '6px' }}>{JSON.stringify(outputData.llm3_output, null, 2)}</pre>
                                        </details>
                                    </>
                                )}
                            </div>
                        )}
                        {viewMode === 'taxonomy' && (
                            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ color: '#f59e0b', margin: 0 }}>Taxonomy Assessment (Categorization)</h3>
                                    {taxonomyRaw?.total_tokens && (
                                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                            Tokens: <strong>{taxonomyRaw.total_tokens}</strong>
                                        </div>
                                    )}
                                </div>
                                {!hasTaxonomy ? <p>Processing Taxonomy...</p> : (
                                    <div className="taxonomy-view">
                                        {/* Display nested taxonomy if available */}
                                        {taxonomyRaw && (taxonomyRaw.easy || taxonomyRaw.medium || taxonomyRaw.hard) ? (
                                            <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                                                {['easy', 'medium', 'hard'].map(lvl => {
                                                    const d = taxonomyRaw[lvl];
                                                    if (!d) return null;
                                                    return (
                                                        <div key={lvl} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                                                            <div style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '4px' }}>{lvl} Category</div>
                                                            <div style={{ display: 'flex', gap: '20px' }}>
                                                                <div><span style={{ fontSize: '12px', opacity: 0.6 }}>Topic:</span> <strong style={{ color: '#f59e0b' }}>{d.topic}</strong></div>
                                                                <div><span style={{ fontSize: '12px', opacity: 0.6 }}>Subtopic:</span> <strong style={{ color: '#f59e0b' }}>{d.subtopic}</strong></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                                <div className="taxonomy-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.1)' }}>
                                                    <label style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Detected Topic</label>
                                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>{taxonomyRaw?.topic ||'N/A'}</div>
                                                </div>
                                                <div className="taxonomy-card" style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.1)' }}>
                                                    <label style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Detected Subtopic</label>
                                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>{taxonomyRaw?.subtopic || 'N/A'}</div>
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                                            <label style={{ fontSize: '11px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Reasoning/Confidence</label>
                                            <p style={{ fontSize: '14px', lineHeight: '1.6' }}>{taxonomyRaw?.reasoning || "Taxonomy assigned based on content analysis."}</p>
                                        </div>
                                        
                                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <label className="editor-label">Edit Topic</label>
                                            <input className="edit-input" value={editableFinalObj.taxonomy?.topic || ''} onChange={e => updateLevelField('taxonomy', 'topic', e.target.value)} />
                                            <label className="editor-label" style={{ marginTop: '12px' }}>Edit Subtopic</label>
                                            <input className="edit-input" value={editableFinalObj.taxonomy?.subtopic || ''} onChange={e => updateLevelField('taxonomy', 'subtopic', e.target.value)} />
                                        </div>

                                        <details style={{ marginTop: '20px' }}>
                                            <summary style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}>View Raw Taxonomy Data</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '6px' }}>{JSON.stringify(taxonomyRaw, null, 2)}</pre>
                                        </details>
                                    </div>
                                )}
                            </div>
                        )}

                        {viewMode === 'performance' && (
                            <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <h3 style={{ color: '#3b82f6', marginBottom: '20px' }}>Pipeline Performance & Cost Metrics</h3>
                                
                                {jobTokens ? (
                                    <>
                                        {/* Helper to normalize token data from different API formats */}
                                        {(() => {
                                            const normalize = (t: any) => ({
                                                total: t?.total || t?.total_tokens || (typeof t === 'number' ? t : 0),
                                                prompt: t?.prompt || t?.prompt_tokens || 0,
                                                completion: t?.completion || t?.completion_tokens || 0,
                                                model: t?.model || 'unknown'
                                            });

                                            const isFlat = jobTokens.total_tokens || jobTokens.total;
                                            
                                            return (
                                                <div style={{ display: 'grid', gridTemplateColumns: isFlat ? '1fr' : 'repeat(4, 1fr)', gap: '15px' }}>
                                                    {isFlat ? (() => {
                                                        const data = normalize(jobTokens);
                                                        const config = COST_CONFIG[data.model] || (data.model.includes('claude') ? COST_CONFIG['claude-sonnet-4-6'] : null);
                                                        const cost = config ? (data.prompt * config.input / 1000000) + (data.completion * config.output / 1000000) : 0;
                                                        return (
                                                            <div style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)', padding: '25px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                                                <div style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>Total Build Tokens</div>
                                                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>{data.total}</div>
                                                                <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>Model: {data.model}</div>
                                                                {cost > 0 && <div style={{ fontSize: '16px', color: '#10b981', marginTop: '10px', fontWeight: 'bold' }}>Estimated Build Cost: {formatCurrency(cost)}</div>}
                                                            </div>
                                                        );
                                                    })() : (
                                                        ['llm1', 'llm2', 'llm3', 'taxonomy'].map(step => {
                                                            const data = normalize(jobTokens[step]);
                                                            if (data.total === 0) return (
                                                                <div key={step} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px', opacity: 0.4 }}>
                                                                    <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>{step}</div>
                                                                    <div style={{ fontSize: '12px' }}>Waiting...</div>
                                                                </div>
                                                            );
                                                            const config = COST_CONFIG[data.model] || (data.model.includes('claude') ? COST_CONFIG['claude-sonnet-4-6'] : null);
                                                            const cost = (data.prompt && data.completion && config) ? (data.prompt * config.input / 1000000) + (data.completion * config.output / 1000000) : 0;
                                                            
                                                            return (
                                                                <div key={step} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                    <div style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '6px', fontWeight: 'bold' }}>{step}</div>
                                                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: step === 'llm1' ? '#3b82f6' : step === 'taxonomy' ? '#f59e0b' : '#a855f7' }}>{data.total}</div>
                                                                    <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>{data.model}</div>
                                                                    {cost > 0 && <div style={{ fontSize: '13px', color: '#10b981', marginTop: '6px', fontWeight: 'bold' }}>{formatCurrency(cost)}</div>}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {(() => {
                                            let totalT = 0;
                                            let totalC = 0;
                                            
                                            // Handle both flat and nested structures for the summary
                                            if (jobTokens.total_tokens || jobTokens.total) {
                                                const t = jobTokens;
                                                totalT = t.total || t.total_tokens || 0;
                                                const model = t.model || '';
                                                const config = COST_CONFIG[model] || (model.includes('claude') ? COST_CONFIG['claude-sonnet-4-6'] : null);
                                                if (config) {
                                                    const p = t.prompt || t.prompt_tokens || 0;
                                                    const c = t.completion || t.completion_tokens || 0;
                                                    totalC = (p * config.input / 1000000) + (c * config.output / 1000000);
                                                }
                                            } else {
                                                Object.values(jobTokens).forEach((t: any) => {
                                                    totalT += (t.total || t.total_tokens || (typeof t === 'number' ? t : 0));
                                                    const model = t.model || '';
                                                    const config = COST_CONFIG[model] || (model.includes('claude') ? COST_CONFIG['claude-sonnet-4-6'] : null);
                                                    if (config) {
                                                        const p = t.prompt || t.prompt_tokens || 0;
                                                        const c = t.completion || t.completion_tokens || 0;
                                                        totalC += (p * config.input / 1000000) + (c * config.output / 1000000);
                                                    }
                                                });
                                            }
                                            
                                            return (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
                                                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', marginBottom: '8px' }}>Average Tokens / Question</div>
                                                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{Math.round(totalT / 3)}</div>
                                                        <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>Based on 3 Variations (E/M/H)</div>
                                                    </div>
                                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase', marginBottom: '8px' }}>Estimated Cost / Question</div>
                                                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{totalC > 0 ? formatCurrency(totalC / 3) : '$0.00'}</div>
                                                        <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>Total Pipeline Cost: {formatCurrency(totalC)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <details style={{ marginTop: '30px' }}>
                                            <summary style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}>View Advanced Token JSON</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '6px', marginTop: '10px' }}>{JSON.stringify(jobTokens, null, 2)}</pre>
                                        </details>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏳</div>
                                        <p>No token data available for this question yet. Start a build to see metrics.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

