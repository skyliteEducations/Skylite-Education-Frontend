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
        backgroundColor: '#090d16',
        borderRight: '1px solid #1e293b',
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '36px',
        overflowY: 'auto' as const,
        boxShadow: '4px 0 24px rgba(0,0,0,0.2)'
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
        color: '#ffffff',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        marginBottom: '12px'
    };

    const subHeadingStyle = {
        fontSize: '15px',
        color: '#94a3b8',
        lineHeight: 1.5,
        fontWeight: 400
    };

    const sectionTitleStyle = {
        fontSize: '13px',
        fontWeight: 700,
        color: '#cbd5e1',
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
        border: `1px solid ${active ? '#10b981' : '#1e293b'}`,
        backgroundColor: active ? 'rgba(16, 185, 129, 0.12)' : '#111827',
        color: active ? '#34d399' : '#cbd5e1',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'left' as const,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between' as const,
        boxShadow: active ? '0 0 12px rgba(16,185,129,0.15)' : 'none',
        width: '100%',
        animation: active ? 'activePulse 2s infinite' : 'none'
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
                        <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '6px', color: '#34d399' }}>1</span>
                        Select Subject
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {subjects.length === 0 && !error && <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading subjects...</p>}
                        {subjects.map(subj => (
                            <button
                                key={subj}
                                onClick={() => fetchChapters(subj)}
                                style={btnStyle(selectedSubject === subj)}
                                className="selection-btn"
                                onMouseEnter={(e) => {
                                    if (selectedSubject !== subj) {
                                        e.currentTarget.style.backgroundColor = '#1f2937';
                                        e.currentTarget.style.color = '#ffffff';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedSubject !== subj) {
                                        e.currentTarget.style.backgroundColor = '#111827';
                                        e.currentTarget.style.color = '#cbd5e1';
                                    }
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
                            <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '6px', color: '#34d399' }}>2</span>
                            Select Chapter
                        </h2>
                        {chapters.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', background: '#111827', borderRadius: '12px', border: '1px dashed #1e293b' }}>
                                <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>No chapters available for {selectedSubject}.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {chapters.map(chap => (
                                    <button
                                        key={chap}
                                        onClick={() => handleChapterSelect(chap)}
                                        style={btnStyle(selectedChapter === chap)}
                                        className="selection-btn"
                                        onMouseEnter={(e) => {
                                            if (selectedChapter !== chap) {
                                                e.currentTarget.style.backgroundColor = '#1f2937';
                                                e.currentTarget.style.color = '#ffffff';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedChapter !== chap) {
                                                e.currentTarget.style.backgroundColor = '#111827';
                                                e.currentTarget.style.color = '#cbd5e1';
                                            }
                                        }}
                                    >
                                        <span>{chap}</span>
                                        <span style={{ color: selectedChapter === chap ? '#34d399' : '#cbd5e1', fontSize: '18px' }}>→</span>
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
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        
                        {/* Interactive scrolling perspective grid floor */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-15%',
                            left: '-20%',
                            width: '140%',
                            height: '45%',
                            backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.08) 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                            transform: 'rotateX(70deg) rotateZ(0deg)',
                            transformOrigin: 'bottom center',
                            animation: 'gridScroll 22s linear infinite',
                            opacity: 0.7,
                            zIndex: 0,
                            pointerEvents: 'none'
                        }} />

                        {/* Rotating 3D Wireframe Cube */}
                        <div className="cube-3d" style={{
                            position: 'absolute',
                            left: '12%',
                            bottom: '10%',
                            width: '80px',
                            height: '80px',
                            transformStyle: 'preserve-3d',
                            animation: 'cubeRotate 12s linear infinite',
                            opacity: 0.3,
                            zIndex: 1,
                            pointerEvents: 'none'
                        }}>
                            <div style={{ position: 'absolute', width: '80px', height: '80px', border: '1px solid rgba(16, 185, 129, 0.3)', transform: 'rotateY(0deg) translateZ(40px)' }} />
                            <div style={{ position: 'absolute', width: '80px', height: '80px', border: '1px solid rgba(16, 185, 129, 0.3)', transform: 'rotateY(180deg) translateZ(40px)' }} />
                            <div style={{ position: 'absolute', width: '80px', height: '80px', border: '1px solid rgba(16, 185, 129, 0.3)', transform: 'rotateY(-90deg) translateZ(40px)' }} />
                            <div style={{ position: 'absolute', width: '80px', height: '80px', border: '1px solid rgba(16, 185, 129, 0.3)', transform: 'rotateY(90deg) translateZ(40px)' }} />
                            <div style={{ position: 'absolute', width: '80px', height: '80px', border: '1px solid rgba(16, 185, 129, 0.3)', transform: 'rotateX(90deg) translateZ(40px)' }} />
                            <div style={{ position: 'absolute', width: '80px', height: '80px', border: '1px solid rgba(16, 185, 129, 0.3)', transform: 'rotateX(-90deg) translateZ(40px)' }} />
                        </div>

                        {/* Rotating 3D Wireframe Octahedron (Double Pyramid) */}
                        <div className="poly-3d" style={{
                            position: 'absolute',
                            right: '15%',
                            top: '28%',
                            width: '60px',
                            height: '60px',
                            transformStyle: 'preserve-3d',
                            animation: 'cubeRotate 8s linear infinite reverse',
                            opacity: 0.25,
                            zIndex: 1,
                            pointerEvents: 'none'
                        }}>
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(0deg) translateZ(18px) rotateX(30deg)' }} />
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(90deg) translateZ(18px) rotateX(30deg)' }} />
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(180deg) translateZ(18px) rotateX(30deg)' }} />
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(-90deg) translateZ(18px) rotateX(30deg)' }} />
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderTop: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(0deg) translateZ(18px) rotateX(-30deg) translateY(30px)' }} />
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderTop: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(90deg) translateZ(18px) rotateX(-30deg) translateY(30px)' }} />
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderTop: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(180deg) translateZ(18px) rotateX(-30deg) translateY(30px)' }} />
                            <div style={{ position: 'absolute', width: '0', height: '0', borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderTop: '52px solid rgba(16, 185, 129, 0.25)', transform: 'rotateY(-90deg) translateZ(18px) rotateX(-30deg) translateY(30px)' }} />
                        </div>

                        {/* Full Area 3D Scanning Scene */}
                        <div className="scene-3d" style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            overflow: 'hidden',
                            pointerEvents: 'none',
                            perspective: '1200px',
                            zIndex: 1
                        }}>
                            {/* Floating Sheet 1 (Left Area) */}
                            <div style={{
                                position: 'absolute',
                                width: '260px',
                                height: '340px',
                                left: '8%',
                                top: '15%',
                                background: 'rgba(255, 255, 255, 0.75)',
                                backdropFilter: 'blur(6px)',
                                border: '1px solid rgba(16, 185, 129, 0.15)',
                                borderRadius: '16px',
                                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.05)',
                                transformStyle: 'preserve-3d',
                                transform: 'rotateX(38deg) rotateY(12deg) rotateZ(-12deg)',
                                animation: 'floatLeft 8s ease-in-out infinite',
                                overflow: 'hidden'
                            }}>
                                {/* Grid Pattern */}
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.04) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                                
                                {/* Laser Scanner Line and projection beam cone */}
                                <div className="scanner-beam" style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    height: '80px',
                                    background: 'linear-gradient(to bottom, rgba(16, 185, 129, 0.12), transparent)',
                                    borderTop: '2px solid #10b981',
                                    boxShadow: '0 -2px 10px rgba(16, 185, 129, 0.4)',
                                    animation: 'scan 4.5s linear infinite',
                                    zIndex: 10
                                }} />

                                {/* Skeleton content */}
                                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.6 }}>
                                    <div style={{ height: '14px', width: '50%', background: '#10b981', borderRadius: '3px' }} />
                                    <div style={{ height: '8px', width: '90%', background: '#94a3b8', borderRadius: '2px', animation: 'drawLine 6s ease-in-out infinite' }} />
                                    <div style={{ height: '8px', width: '80%', background: '#94a3b8', borderRadius: '2px', animation: 'drawLine 6s ease-in-out infinite 1.5s' }} />
                                    <div style={{ height: '8px', width: '85%', background: '#94a3b8', borderRadius: '2px', animation: 'drawLine 6s ease-in-out infinite 3s' }} />
                                    <div style={{ height: '50px', background: 'rgba(16,185,129,0.05)', border: '1px dashed rgba(16,185,129,0.1)', borderRadius: '6px', marginTop: '12px' }} />
                                </div>
                            </div>

                            {/* Floating Sheet 2 (Right-Bottom Area) */}
                            <div style={{
                                position: 'absolute',
                                width: '280px',
                                height: '360px',
                                right: '6%',
                                bottom: '10%',
                                background: 'rgba(255, 255, 255, 0.75)',
                                backdropFilter: 'blur(6px)',
                                border: '1px solid rgba(0, 0, 0, 0.05)',
                                borderRadius: '16px',
                                boxShadow: '0 25px 45px rgba(0, 0, 0, 0.05)',
                                transformStyle: 'preserve-3d',
                                transform: 'rotateX(30deg) rotateY(-15deg) rotateZ(8deg)',
                                animation: 'floatRight 10s ease-in-out infinite',
                                overflow: 'hidden'
                            }}>
                                {/* Laser Scanner Line and projection beam cone */}
                                <div className="scanner-beam" style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    height: '80px',
                                    background: 'linear-gradient(to bottom, rgba(16, 185, 129, 0.12), transparent)',
                                    borderTop: '2px solid #10b981',
                                    boxShadow: '0 -2px 10px rgba(16, 185, 129, 0.4)',
                                    animation: 'scan 5.5s linear infinite',
                                    zIndex: 10
                                }} />

                                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.6 }}>
                                    <div style={{ height: '14px', width: '40%', background: '#4b5563', borderRadius: '3px' }} />
                                    <div style={{ height: '8px', width: '85%', background: '#94a3b8', borderRadius: '2px', animation: 'drawLine 5s ease-in-out infinite 0.5s' }} />
                                    <div style={{ height: '8px', width: '70%', background: '#94a3b8', borderRadius: '2px', animation: 'drawLine 5s ease-in-out infinite 2s' }} />
                                    {/* Schematic representation */}
                                    <div style={{ height: '80px', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="40" height="40" viewBox="0 0 100 100" fill="none" stroke="#10b981" strokeWidth="2">
                                            <polygon points="50,15 90,85 10,85" strokeDasharray="3" />
                                            <circle cx="50" cy="55" r="20" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Sheet 3 (Top-Right Area) */}
                            <div style={{
                                position: 'absolute',
                                width: '220px',
                                height: '200px',
                                right: '12%',
                                top: '8%',
                                background: 'rgba(255, 255, 255, 0.7)',
                                backdropFilter: 'blur(5px)',
                                border: '1px solid rgba(16, 185, 129, 0.1)',
                                borderRadius: '16px',
                                boxShadow: '0 15px 30px rgba(0, 0, 0, 0.04)',
                                transformStyle: 'preserve-3d',
                                transform: 'rotateX(45deg) rotateY(8deg) rotateZ(-6deg)',
                                animation: 'floatTopRight 7s ease-in-out infinite',
                                overflow: 'hidden'
                            }}>
                                {/* Laser Scanner Line and projection beam cone */}
                                <div className="scanner-beam" style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    height: '80px',
                                    background: 'linear-gradient(to bottom, rgba(16, 185, 129, 0.12), transparent)',
                                    borderTop: '2px solid #10b981',
                                    boxShadow: '0 -2px 10px rgba(16, 185, 129, 0.4)',
                                    animation: 'scan 3.8s linear infinite',
                                    zIndex: 10
                                }} />

                                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.7 }}>
                                    <div style={{ height: '12px', width: '60%', background: '#10b981', borderRadius: '3px' }} />
                                    <div style={{ height: '30px', background: 'rgba(16,185,129,0.03)', border: '1px dashed rgba(16,185,129,0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: '10px', color: '#10b981', fontFamily: 'monospace' }}>∑ (x_i - μ)² / N</span>
                                    </div>
                                    <div style={{ height: '8px', width: '85%', background: '#94a3b8', borderRadius: '2px', marginTop: '6px' }} />
                                    <div style={{ height: '8px', width: '50%', background: '#94a3b8', borderRadius: '2px' }} />
                                </div>
                            </div>
                        </div>

                        {/* Foreground Glass Card (Light-themed glassmorphism) */}
                        <div style={{ 
                            position: 'relative', 
                            zIndex: 2, 
                            width: '100%', 
                            maxWidth: '520px', 
                            padding: '48px', 
                            backgroundColor: 'rgba(255, 255, 255, 0.7)', 
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(0, 0, 0, 0.08)',
                            borderRadius: '24px', 
                            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.06)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            textAlign: 'center', 
                            animation: 'scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
                        }}>
                            <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '32px' }}>
                                <svg className="animate-spin" viewBox="0 0 100 100" style={{ width: '100%', height: '100%', animation: 'spin 1.5s linear infinite' }}>
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="45" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="283" strokeDashoffset="75" strokeLinecap="round" />
                                </svg>
                            </div>
                            <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
                                Synthesizing Test
                            </h3>
                            <p style={{ fontSize: '15px', color: '#4b5563', marginBottom: '32px', minHeight: '22px', fontWeight: 500 }}>
                                {generatingText}
                            </p>
                            
                            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                <div style={{ 
                                    height: '100%', 
                                    width: `${progress}%`, 
                                    background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)',
                                    backgroundSize: '200% 100%',
                                    animation: 'progressShine 2s linear infinite',
                                    transition: 'width 0.1s linear',
                                    borderRadius: '4px'
                                }}></div>
                            </div>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>PROGRESS</span>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
                            </div>
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
                @keyframes floatLeft {
                    0% { transform: rotateX(38deg) rotateY(12deg) rotateZ(-12deg) translateY(0px) translateZ(0px); }
                    50% { transform: rotateX(40deg) rotateY(10deg) rotateZ(-10deg) translateY(-15px) translateZ(25px); }
                    100% { transform: rotateX(38deg) rotateY(12deg) rotateZ(-12deg) translateY(0px) translateZ(0px); }
                }
                @keyframes floatRight {
                    0% { transform: rotateX(30deg) rotateY(-15deg) rotateZ(8deg) translateY(0px) translateZ(0px); }
                    50% { transform: rotateX(32deg) rotateY(-13deg) rotateZ(10deg) translateY(15px) translateZ(35px); }
                    100% { transform: rotateX(30deg) rotateY(-15deg) rotateZ(8deg) translateY(0px) translateZ(0px); }
                }
                @keyframes floatTopRight {
                    0% { transform: rotateX(45deg) rotateY(8deg) rotateZ(-6deg) translateY(0px) translateZ(0px); }
                    50% { transform: rotateX(43deg) rotateY(6deg) rotateZ(-8deg) translateY(-12px) translateZ(-15px); }
                    100% { transform: rotateX(45deg) rotateY(8deg) rotateZ(-6deg) translateY(0px) translateZ(0px); }
                }
                @keyframes scan {
                    0% { top: 0%; }
                    50% { top: 100%; }
                    100% { top: 0%; }
                }
                @keyframes drawLine {
                    0% { width: 0%; opacity: 0.3; }
                    50% { width: 100%; opacity: 0.8; }
                    100% { width: 0%; opacity: 0.3; }
                }
                @keyframes gridScroll {
                    from { background-position: 0 0; }
                    to { background-position: 0 400px; }
                }
                @keyframes cubeRotate {
                    0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
                    100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(180deg); }
                }
                @keyframes activePulse {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                @keyframes progressShine {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .selection-btn {
                    transform: translateY(0px) scale(1);
                }
                .selection-btn:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
                }
                .selection-btn:active {
                    transform: translateY(0px) scale(0.98);
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
