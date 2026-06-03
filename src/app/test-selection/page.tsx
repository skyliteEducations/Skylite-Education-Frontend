'use client';

import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function TestGenerationPage() {
    const [subjects, setSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    
    const [chapters, setChapters] = useState<string[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [generatingText, setGeneratingText] = useState('Initializing AI Core...');
    
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch subjects on mount
    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/test-selection/subjects`);
                if (!res.ok) throw new Error('Failed to fetch subjects');
                const data = await res.json();
                setSubjects(data.subjects || []);
            } catch (err: any) {
                setError(err.message);
            }
        };
        fetchSubjects();
    }, []);

    const fetchChapters = async (subject: string) => {
        setSelectedSubject(subject);
        setSelectedChapter(null);
        setPdfUrl(null);
        setIsGenerating(false);
        setError(null);
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/test-selection/chapters/${encodeURIComponent(subject)}`);
            if (!res.ok) throw new Error('Failed to fetch chapters');
            const data = await res.json();
            setChapters(data.chapters || []);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleChapterSelect = (chapter: string) => {
        setSelectedChapter(chapter);
        setPdfUrl(null);
        setIsGenerating(true);
        setProgress(0);
        setError(null);
    };

    // 30 Seconds Simulation Effect
    useEffect(() => {
        if (!isGenerating) return;

        const totalTime = 30000; // 30 seconds
        const intervalTime = 100; // smooth 100ms updates
        const steps = totalTime / intervalTime;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const currentProgress = Math.min(100, Math.floor((currentStep / steps) * 100));
            setProgress(currentProgress);
            
            if (currentProgress < 15) setGeneratingText('Initializing AI Core & Context...');
            else if (currentProgress < 35) setGeneratingText('Analyzing chapter syllabus & concepts...');
            else if (currentProgress < 60) setGeneratingText('Formulating high-quality cognitive questions...');
            else if (currentProgress < 85) setGeneratingText('Structuring matrix matches & linked passages...');
            else if (currentProgress < 95) setGeneratingText('Compiling PDF layout & typesetting equations...');
            else setGeneratingText('Finalizing Document...');

            if (currentStep >= steps) {
                clearInterval(timer);
                finishGeneration(selectedSubject!, selectedChapter!);
            }
        }, intervalTime);

        return () => clearInterval(timer);
    }, [isGenerating, selectedChapter, selectedSubject]);

    const finishGeneration = async (subject: string, chapter: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/test-selection/test-url/${encodeURIComponent(subject)}/${encodeURIComponent(chapter)}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Test not found');
            }
            const data = await res.json();
            setPdfUrl(data.s3_url);
            setIsGenerating(false);
        } catch (err: any) {
            setError(err.message);
            setIsGenerating(false);
        }
    };

    // --- Modern Split-Layout UI Styles ---
    const containerStyle = {
        height: '100vh',
        width: '100vw',
        backgroundColor: '#ffffff',
        color: '#111827',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        position: 'absolute' as const,
        top: 0, left: 0,
        zIndex: 1000,
        overflow: 'hidden' as const
    };

    const leftPanelStyle = {
        width: '420px',
        minWidth: '420px',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '36px',
        overflowY: 'auto' as const,
        boxShadow: '4px 0 24px rgba(0,0,0,0.02)'
    };

    const rightPanelStyle = {
        flex: 1,
        backgroundColor: '#f9fafb', // Very subtle off-white to contrast the left panel
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        position: 'relative' as const
    };

    const headingStyle = {
        fontSize: '40px',
        fontWeight: 900, // Extra bold as requested
        color: '#111827',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        marginBottom: '12px'
    };

    const subHeadingStyle = {
        fontSize: '15px',
        color: '#6b7280',
        lineHeight: 1.5,
        fontWeight: 400
    };

    const sectionTitleStyle = {
        fontSize: '13px',
        fontWeight: 700,
        color: '#4b5563',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const btnStyle = (active: boolean) => ({
        padding: '14px 18px',
        borderRadius: '12px',
        border: `1px solid ${active ? '#10b981' : '#e5e7eb'}`,
        backgroundColor: active ? '#ecfdf5' : '#ffffff',
        color: active ? '#047857' : '#374151',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'left' as const,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between' as const,
        boxShadow: active ? '0 0 0 1px #10b981, 0 4px 6px -1px rgba(16,185,129,0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
        width: '100%'
    });

    return (
        <div style={containerStyle}>
            
            {/* LEFT PANEL: Selection Controls */}
            <div style={leftPanelStyle}>
                <div>
                    <h1 style={headingStyle}>Test<br/>Generation<span style={{ color: '#10b981' }}>.</span></h1>
                    <p style={subHeadingStyle}>
                        Configure your exam parameters. Our AI will automatically synthesize a complete test document.
                    </p>
                </div>

                {error && (
                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}>
                        {error}
                    </div>
                )}

                {/* Step 1: Subject */}
                <div>
                    <h2 style={sectionTitleStyle}>
                        <span style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '6px', color: '#374151' }}>1</span>
                        Select Subject
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {subjects.length === 0 && !error && <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading subjects...</p>}
                        {subjects.map(subj => (
                            <button
                                key={subj}
                                onClick={() => fetchChapters(subj)}
                                style={btnStyle(selectedSubject === subj)}
                                onMouseEnter={(e) => {
                                    if (selectedSubject !== subj) e.currentTarget.style.backgroundColor = '#f9fafb';
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedSubject !== subj) e.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                            >
                                {subj}
                                {selectedSubject === subj && <span style={{ color: '#10b981' }}>✓</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Step 2: Chapter */}
                {selectedSubject && (
                    <div style={{ animation: 'slideIn 0.3s ease-out' }}>
                        <h2 style={sectionTitleStyle}>
                            <span style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: '6px', color: '#374151' }}>2</span>
                            Select Chapter
                        </h2>
                        {chapters.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
                                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: 500 }}>No chapters available for {selectedSubject}.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {chapters.map(chap => (
                                    <button
                                        key={chap}
                                        onClick={() => handleChapterSelect(chap)}
                                        style={btnStyle(selectedChapter === chap && !isGenerating && !pdfUrl)}
                                        onMouseEnter={(e) => {
                                            if (selectedChapter !== chap) e.currentTarget.style.backgroundColor = '#f9fafb';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedChapter !== chap) e.currentTarget.style.backgroundColor = '#ffffff';
                                        }}
                                    >
                                        <span>{chap}</span>
                                        <span style={{ color: '#9ca3af', fontSize: '18px' }}>→</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* RIGHT PANEL: Output / Loader / Empty State */}
            <div style={rightPanelStyle}>
                
                {!isGenerating && !pdfUrl && (
                    <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '80px', height: '80px', backgroundColor: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#374151' }}>No Document Selected</h3>
                        <p style={{ fontSize: '15px', color: '#6b7280', marginTop: '8px', maxWidth: '300px' }}>
                            Choose a subject and chapter from the sidebar to begin generating a new test.
                        </p>
                    </div>
                )}

                {isGenerating && (
                    <div style={{ margin: 'auto', width: '100%', maxWidth: '560px', padding: '48px', backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', animation: 'scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '32px' }}>
                            <svg className="animate-spin" viewBox="0 0 100 100" style={{ width: '100%', height: '100%', animation: 'spin 1.5s linear infinite' }}>
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="283" strokeDashoffset="75" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
                            Synthesizing Test
                        </h3>
                        <p style={{ fontSize: '15px', color: '#6b7280', marginBottom: '32px', minHeight: '22px', fontWeight: 500 }}>
                            {generatingText}
                        </p>
                        
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ 
                                height: '100%', 
                                width: `${progress}%`, 
                                backgroundColor: '#10b981', 
                                transition: 'width 0.1s linear',
                                borderRadius: '4px'
                            }}></div>
                        </div>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af' }}>PROGRESS</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
                        </div>
                    </div>
                )}

                {pdfUrl && !isGenerating && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.5s ease-in-out' }}>
                        <div style={{ padding: '24px 40px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>{selectedChapter}</h3>
                                <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>{selectedSubject} &bull; Generated Successfully</p>
                            </div>
                            <a 
                                href={pdfUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{
                                    backgroundColor: '#111827',
                                    color: '#ffffff',
                                    padding: '12px 20px',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Download PDF
                            </a>
                        </div>
                        
                        <iframe 
                            src={pdfUrl} 
                            style={{ width: '100%', flex: 1, border: 'none', backgroundColor: '#e5e7eb' }}
                            title="Generated Test PDF"
                        />
                    </div>
                )}
            </div>

            {/* Global Styles for Animations */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                body {
                    background-color: #ffffff !important;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
            `}} />
        </div>
    );
}
