'use client';

import React, { memo } from 'react';
import SmilesRenderer from './SmilesRenderer';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

interface ReactionStep {
    reactant_smiles: string;
    reagent: string;
    product_smiles: string;
    product_label?: string;
}

interface ReactionSequenceProps {
    data: {
        type: 'sequence';
        steps: ReactionStep[];
    };
}

const ReactionSequence = memo(function ReactionSequence({ data }: { data: any }) {
    if (!data || !data.is_sequence) return null;

    const steps = data.steps || [
        { reactant: data.reactant, reagent: data.reagent, product: data.product, label: data.product_label }
    ];

    return (
        <div className="reaction-sequence-container">
            {steps.map((step: any, idx: number) => (
                <div key={idx} className="reaction-step-wrapper">
                    {/* Reactant */}
                    <div className="molecule-block">
                        {step.reactant && <SmilesRenderer smiles={step.reactant} width={180} height={180} transparent={true} />}
                    </div>

                    {/* Arrow with Reagent */}
                    <div className="arrow-block">
                        <div className="reagent-text">
                            {step.reagent && <InlineMath math={step.reagent} />}
                        </div>
                        <div className="reaction-arrow">
                            <svg width="80" height="20" viewBox="0 0 80 20">
                                <path 
                                    d="M0 10 L75 10 M70 5 L75 10 L70 15" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Product */}
                    {(idx === steps.length - 1 || step.label) && (
                        <div className="molecule-block">
                            {step.product === '?' ? (
                                <div className="question-mark">?</div>
                            ) : (
                                step.product && <SmilesRenderer smiles={step.product} width={180} height={180} transparent={true} />
                            )}
                            {step.label && (
                                <div className="product-label">{step.label}</div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            <style jsx>{`
                .reaction-sequence-container {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 20px;
                    background: white;
                    border-radius: 16px;
                    margin: 15px 0;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                    border: 1px solid #e2e8f0;
                }
                .reaction-step-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .molecule-block {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .product-label {
                    margin-top: 5px;
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 1.1rem;
                    background: #f1f5f9;
                    padding: 2px 8px;
                    border-radius: 6px;
                }
                .arrow-block {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-width: 80px;
                    color: #475569;
                }
                .reagent-text {
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-bottom: 4px;
                    text-align: center;
                }
                .reaction-arrow {
                    color: #6366f1;
                }
                .question-mark {
                    width: 100px;
                    height: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    font-weight: 900;
                    color: #6366f1;
                    border: 3px dashed #e2e8f0;
                    border-radius: 12px;
                    background: #f8fafc;
                }
            `}</style>
        </div>
    );
});

export default ReactionSequence;
