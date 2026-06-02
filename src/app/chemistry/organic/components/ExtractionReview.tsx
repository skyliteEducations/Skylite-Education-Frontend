'use client';

import React from 'react';
import MathText from './MathText';
import SmilesRenderer from './SmilesRenderer';

interface ChemistryBlock {
    type: string;
    content: string;
    index: number;
    smiles?: string;
}

interface ExtractionReviewProps {
    extractionStatus: string;
    error: string | null;
    extractedBlocks: ChemistryBlock[];
    selectedBlockIndices: number[];
    setSelectedBlockIndices: React.Dispatch<React.SetStateAction<number[]>>;
    handleSaveContent: () => void;
    isSaving: boolean;
}

export default function ExtractionReview({
    extractionStatus,
    error,
    extractedBlocks,
    selectedBlockIndices,
    setSelectedBlockIndices,
    handleSaveContent,
    isSaving
}: ExtractionReviewProps) {
    if (extractionStatus === 'idle') {
        return <div className="chem-empty-prompt"><p>AWAITING ANALYSIS COMMAND</p></div>;
    }

    return (
        <div className="extraction-container">
            {extractionStatus === 'processing' || extractionStatus === 'pending' ? (
                <div className="chem-shimmer-box">
                    <p>AI AGENT IS EXTRACTING DATA...</p>
                </div>
            ) : error ? (
                <div className="chem-failure-alert">
                    <p>{error}</p>
                </div>
            ) : (
                <>
                    <div className="chem-selection-header">
                        <div className="selection-count">{selectedBlockIndices.length} / {extractedBlocks.length} BLOCKS SELECTED</div>
                        <button className="chem-save-commit-btn" onClick={handleSaveContent} disabled={isSaving || selectedBlockIndices.length === 0}>
                            {isSaving ? 'SAVING...' : '💾 SAVE REFERENCE'}
                        </button>
                    </div>

                    <div className="chem-content-view">
                        {extractedBlocks.map((block, idx) => (
                            <div 
                                key={idx} 
                                className={`chem-content-card ${selectedBlockIndices.includes(idx) ? 'selected' : ''}`}
                                onClick={() => setSelectedBlockIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                            >
                                <div className="card-flag-type">{block.type}</div>
                                <div className="chem-para">
                                    <MathText text={block.content} />
                                    {block.smiles && (
                                        <div className="smiles-preview">
                                            <div className="smiles-label">SMILES VISUALIZATION:</div>
                                            <SmilesRenderer smiles={block.smiles} width={300} height={300} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            <style jsx>{`
                .extraction-container { width: 100%; }
                .chem-selection-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .selection-count { font-size: 11px; font-weight: 800; color: #64748b; }
                .chem-save-commit-btn { background: var(--chem-green); color: #000; border: none; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; transition: 0.3s; }
                .chem-save-commit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }
                
                .chem-content-view { display: flex; flex-direction: column; gap: 12px; }
                .chem-content-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: 0.2s; }
                .chem-content-card:hover { background: rgba(255,255,255,0.05); }
                .chem-content-card.selected { border-color: var(--chem-primary); background: rgba(99, 102, 241, 0.05); }
                
                .card-flag-type { font-size: 9px; font-weight: 900; color: var(--chem-green); background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 4px; width: fit-content; text-transform: uppercase; }
                .chem-para { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
                .smiles-preview { margin-top: 15px; }
                .smiles-label { font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 8px; letter-spacing: 0.5px; }
                
                .chem-empty-prompt { text-align: center; padding: 60px; opacity: 0.3; font-weight: 800; font-size: 14px; }
                .chem-shimmer-box { text-align: center; padding: 40px; opacity: 0.5; font-size: 12px; font-weight: 800; }
                .chem-failure-alert { padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; border-radius: 12px; text-align: center; }
            `}</style>
        </div>
    );
}
