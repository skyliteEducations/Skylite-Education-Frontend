'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

// Configuration
const API_BASE_URL = 'http://localhost:8000';

type JobStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

interface Option { label: string; text: string; }
interface Diagram { url: string; alt: string; }
interface QuestionEntry { question: string; options: Option[]; diagrams?: Diagram[] | null; }
interface StructuredResult { type: 'single' | 'multi'; question?: string; options?: Option[]; diagrams?: Diagram[] | null; questions?: QuestionEntry[]; }

/**
 * Robust LaTeX Component for complex mixed text.
 * Fixes the fragmented math wrapping issue ($...$ $...$) that caused KaTeX errors.
 */
function MathText({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
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

  // Use the backend-provided $...$ delimiters. 
  // If no delimiters but has backslashes, wrap individual tokens to avoid clumping.
  let processedText = text;
  if (!text.includes('$') && text.includes('\\')) {
    // Wrap tokens starting with \ (e.g. \lim or \text{...}) in $..$
    processedText = text.replace(/(\\[a-zA-Z]+(?:\{[^}]*\})?)/g, '$$1$');
  }

  return (
    <div ref={containerRef} style={{ display: 'inline-block' }}>
      {processedText}
    </div>
  );
}

export default function Home() {
  const [status, setStatus] = useState<JobStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    setPreviewUrl(URL.createObjectURL(file));
    await startConversion(file);
  };

  const startConversion = async (file: File) => {
    setStatus('uploading');
    setMessage('Sending file to Skylite AI...');
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/convert/upload`, {
        method: 'POST', body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail?.message || 'Upload failed');
      startPolling(data.job_id);
    } catch (err: any) {
      setError(err.message);
      setStatus('failed');
    }
  };

  const startPolling = (jobId: string) => {
    setStatus('processing');
    setMessage('AI is thinking...');
    
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/convert/status/${jobId}`);
        const data = await res.json();
        if (data.status === 'completed') {
          clearInterval(pollingIntervalRef.current);
          setStatus('completed');
          setResult(data.result);
        } else if (data.status === 'failed') {
          clearInterval(pollingIntervalRef.current);
          setStatus('failed');
          setError(data.error);
        }
      } catch (err) { console.error(err); }
    }, 3000);
  };

  return (
    <main className="main-container">
      <div className="card" style={{ marginBottom: '24px' }}>
        <h1>Skylite Educations Platform</h1>
        <p className="subtitle">Question Uploading Channel</p>
      </div>

      <div className="split-view">
        <div className="panel">
          <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>Capture Content</h2>
          <div className="actions-grid">
            <button className="action-btn" onClick={() => cameraInputRef.current?.click()} disabled={status === 'processing'}>
              <span className="icon">📸</span><span className="label">Open Camera</span>
            </button>
            <button className="action-btn" onClick={() => galleryInputRef.current?.click()} disabled={status === 'processing'}>
              <span className="icon">🖼️</span><span className="label">Gallery Pick</span>
            </button>
          </div>

          <input type="file" hidden ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleFileChange} />
          <input type="file" hidden ref={galleryInputRef} accept="image/*" onChange={handleFileChange} />

          {status !== 'idle' && (
            <div className="status-box">
              <div className="status-header">
                {(status === 'uploading' || status === 'processing') && <div className="loader"></div>}
                <span className="status-text">{status.toUpperCase()}</span>
              </div>
              <p className="status-message" style={{ color: status === 'failed' ? 'var(--error)' : 'inherit' }}>{error || message}</p>
            </div>
          )}

          {previewUrl && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px' }}>ORIGINAL PHOTO</h3>
              <img src={previewUrl} className="image-preview" alt="User Capture" />
            </div>
          )}
        </div>

        <div className="panel result-panel-container">
          <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600', color: 'var(--primary)' }}>Extracted Result</h2>
          {!result && status === 'idle' && <div className="empty-state"><span>🔍</span><p>Results will appear here.</p></div>}
          {result && (
            <div className="result-panel">
              {result.type === 'single' ? (
                <QuestionItem question={result.question || ''} options={result.options || []} diagrams={result.diagrams} />
              ) : (
                result.questions?.map((q, idx) => (
                  <QuestionItem key={idx} index={idx + 1} question={q.question || ''} options={q.options || []} diagrams={q.diagrams} />
                ))
              )}
              <button 
                onClick={() => { setStatus('idle'); setResult(null); setPreviewUrl(null); }}
                className="action-btn" style={{ marginTop: '20px', padding: '12px', width: '100%', borderStyle: 'solid' }}
              >
                Clear for New Scan
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function QuestionItem({ question, options, diagrams, index }: QuestionEntry & { index?: number }) {
  return (
    <div className="question-card">
      <div className="question-text">
        {index && <span style={{ color: 'var(--primary)', fontWeight: '700', marginRight: '10px' }}>{index}.</span>}
        <MathText text={question} />
      </div>
      {diagrams && diagrams.length > 0 && (
        <div className="diagrams-grid">
          {diagrams.map((diag, i) => (
            <div key={i} className="diagram-container">
              <img src={diag.url} alt={diag.alt} />
              {diag.alt !== 'diagram' && <p className="diagram-caption">{diag.alt}</p>}
            </div>
          ))}
        </div>
      )}
      {options?.length > 0 && (
        <div className="options-list">
          {options.map((opt, i) => (
            <div key={i} className="option-item">
              <div className="option-label">{opt.label}</div>
              <div className="option-content"><MathText text={opt.text} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
