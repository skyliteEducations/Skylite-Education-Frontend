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
    const [selectedTaxonomies, setSelectedTaxonomies] = useState<string[]>([]);
    const [isMultiTaxonomy, setIsMultiTaxonomy] = useState(false);
    
    const pollingInterval = useRef<any>(null);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/physics/source-verified/books`);
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
                const res = await fetch(`${API_BASE_URL}/api/v1/physics/source-verified/${bookName}/chapters`);
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
                const res = await fetch(`${API_BASE_URL}/api/v1/physics/source-verified/${bookName}/${chapterName}/pages`);
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
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/source-verified/${bookName}/${chapterName}/${pageName}`);
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
        const question = verifiedQuestions.find(q => (q.question_index !== undefined ? q.question_index : verifiedQuestions.indexOf(q)) === qIndex);
        if (!question) {
            alert("Question not found in local state.");
            return;
        }

        setActiveQIndex(qIndex);
        setJobStatus('starting');
        setJobMessage('Initiating 3-LLM physics pipeline...');
        setOutputData(null);
        setEditableFinalObj(null);
        setJobTokens(null);
        setViewMode('edit');
        
        try {
            // Prepare the generation payload
            const payload = {
                questions: [{
                    ...question,
                    book_name: bookName,
                    chapter_name: chapterName,
                    page_name: pageName,
                    taxonomy_names: isMultiTaxonomy ? selectedTaxonomies : [chapterName]
                }]
            };

            const res = await fetch(`${API_BASE_URL}/api/v1/physics/pipeline/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.job_id) {
                setActiveJobId(data.job_id);
                pollJob(data.job_id, qIndex);
            } else {
                setJobStatus('error');
                setJobMessage(data.detail || 'Failed to start pipeline');
            }
        } catch (e) {
            setJobStatus('error');
            console.error(e);
        }
    };

    const fetchOutput = async (qIdx: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/output/${bookName}/${chapterName}/${pageName}/${qIdx}/all`);
            const data = await res.json();
            if (data) {
                setOutputData(data);
                
                const aggregatedTokens: any = {};
                if (data.tokens) {
                    Object.assign(aggregatedTokens, data.tokens);
                } else {
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
                    
                    if (Object.keys(aggregatedTokens).length === 0 && (data.total_tokens || data.prompt_tokens)) {
                        aggregatedTokens.totalBuild = data;
                    }
                }
                
                if (Object.keys(aggregatedTokens).length > 0) setJobTokens(aggregatedTokens);
                
                setEditableFinalObj((prev: any) => {
                    const parsed = parseOutputToEditable(data);
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
                const res = await fetch(`${API_BASE_URL}/api/v1/physics/pipeline/status/${jId}`);
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
        poll();
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
            
            const res = await fetch(`${API_BASE_URL}/api/v1/physics/sync-to-mongo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Physics pipeline data successfully synced to MongoDB!");
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
                    </div>
                </div>
            </div>
        );
    };

    const hasLLM1 = !!(outputData?.llm1_output && (outputData.llm1_output.easy || outputData.llm1_output.medium || outputData.llm1_output.hard));
    const hasLLM2 = !!(outputData?.llm2_output && (outputData.llm2_output.easy || outputData.llm2_output.medium || outputData.llm2_output.hard));
    const hasLLM3 = !!(outputData?.llm3_output && (outputData.llm3_output.easy || outputData.llm3_output.medium || outputData.llm3_output.hard));
    
    const taxonomyRaw = outputData?.taxonomy_assignment || outputData?.taxonomy;
    const hasTaxonomy = !!(taxonomyRaw && (taxonomyRaw.topic || taxonomyRaw.subtopic || taxonomyRaw.easy || taxonomyRaw.medium || taxonomyRaw.hard || taxonomyRaw.total_tokens));

    return (
        <div className="split-view">
            <div className="panel" style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div className="control-panel">
                    <h2>Source Locator (Physics)</h2>
                    <p style={{ color: 'var(--text-light)', marginTop: '8px', fontSize: '14px' }}>Path to verified physics questions.</p>
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

                        {/* Multi-Taxonomy Selection */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label className="editor-label" style={{ margin: 0 }}>Generation Taxonomy</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: isMultiTaxonomy ? 'var(--primary)' : 'var(--text-light)' }}>Multi</span>
                                    <input 
                                        type="checkbox" 
                                        checked={isMultiTaxonomy} 
                                        onChange={e => setIsMultiTaxonomy(e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                            
                            {isMultiTaxonomy ? (
                                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                                    {chapterList.map(c => (
                                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '2px 4px', borderRadius: '2px', background: selectedTaxonomies.includes(c) ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedTaxonomies.includes(c)} 
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedTaxonomies([...selectedTaxonomies, c]);
                                                    else setSelectedTaxonomies(selectedTaxonomies.filter(x => x !== c));
                                                }}
                                            />
                                            {c}
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: '12px', color: 'var(--text-light)', opacity: 0.6 }}>Using default chapter: <span style={{ color: 'var(--primary)' }}>{chapterName || 'None'}</span></p>
                            )}
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
                    <h2>3-LLM Physics Output</h2>
                    {activeJobId && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ background: hasLLM1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: `1px solid ${hasLLM1 ? '#10b981' : '#333'}` }}>
                                {hasLLM1 ? '✅ LLM 1 Generated' : '⏳ LLM 1'}
                            </div>
                            <div style={{ background: hasLLM2 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: `1px solid ${hasLLM2 ? '#10b981' : '#333'}` }}>
                                {hasLLM2 ? '✅ LLM 2 Verified' : '⏳ LLM 2'}
                            </div>
                            <div style={{ background: hasLLM3 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', border: `1px solid ${hasLLM3 ? '#10b981' : '#333'}` }}>
                                {hasLLM3 ? '✅ LLM 3 Verified' : '⏳ LLM 3'}
                            </div>
                        </div>
                    )}
                </div>

                {(jobStatus === 'processing' || jobStatus === 'starting' || jobStatus === 'saving') && !outputData && (
                    <div className="status-box" style={{ marginBottom: '20px' }}>
                        <div className="status-header">
                            <div className="loader"></div>
                            <span className="status-text">{jobStatus.toUpperCase()}</span>
                        </div>
                        <p className="status-message">{jobMessage}</p>
                    </div>
                )}

                {outputData && (
                    <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                            <button onClick={() => setViewMode('edit')} className="tab-btn" style={{ background: viewMode === 'edit' ? 'var(--primary)' : 'transparent', color: viewMode === 'edit' ? '#000' : 'var(--text-light)', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>Final View</button>
                            <button onClick={() => setViewMode('llm1')} className="tab-btn" style={{ background: viewMode === 'llm1' ? '#3b82f6' : 'transparent', color: viewMode === 'llm1' ? '#fff' : 'var(--text-light)', border: '1px solid #3b82f6', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>LLM 1</button>
                            <button onClick={() => setViewMode('llm2')} className="tab-btn" style={{ background: viewMode === 'llm2' ? '#a855f7' : 'transparent', color: viewMode === 'llm2' ? '#fff' : 'var(--text-light)', border: '1px solid #a855f7', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>LLM 2</button>
                            <button onClick={() => setViewMode('taxonomy')} className="tab-btn" style={{ background: viewMode === 'taxonomy' ? '#f59e0b' : 'transparent', color: viewMode === 'taxonomy' ? '#fff' : 'var(--text-light)', border: '1px solid #f59e0b', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' }}>Taxonomy</button>
                        </div>

                        {viewMode === 'edit' && editableFinalObj && (
                            <div className="result-panel">
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                    <h3 style={{ fontSize: '14px', color: '#f59e0b', marginBottom: '12px' }}>Taxonomy</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="editor-group" style={{ margin: 0 }}>
                                            <label className="editor-label">Topic</label>
                                            <input className="edit-input" value={editableFinalObj.taxonomy?.topic || ''} onChange={e => updateLevelField('taxonomy', 'topic', e.target.value)} />
                                        </div>
                                        <div className="editor-group" style={{ margin: 0 }}>
                                            <label className="editor-label">Subtopic</label>
                                            <input className="edit-input" value={editableFinalObj.taxonomy?.subtopic || ''} onChange={e => updateLevelField('taxonomy', 'subtopic', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Original Reference</h3>
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
                                    {jobStatus === 'saving' ? 'Saving...' : 'Sync to Database'}
                                </button>
                            </div>
                        )}

                        {viewMode === 'llm1' && (
                             <div className="result-panel">
                                <h3>LLM 1 Raw Generations</h3>
                                {['easy', 'medium', 'hard'].map((l: any) => {
                                    const levelData = outputData.llm1_output[l];
                                    if (!levelData) return null;
                                    return (
                                        <div key={l} style={{ marginBottom: '20px', padding: '12px', borderLeft: '3px solid #3b82f6', background: 'rgba(0,0,0,0.2)' }}>
                                            <div style={{ textTransform: 'uppercase', fontSize: '10px', color: '#3b82f6', marginBottom: '8px', fontWeight: 'bold' }}>{l} Variation</div>
                                            <MathText text={levelData.question || ''} />
                                        </div>
                                    );
                                })}
                             </div>
                        )}
                        
                        {viewMode === 'taxonomy' && (
                             <div className="result-panel">
                                <h3>Taxonomy Result</h3>
                                <pre style={{ background: '#111', padding: '20px', borderRadius: '8px' }}>
                                    {JSON.stringify(taxonomyRaw, null, 2)}
                                </pre>
                             </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
