'use client';

import { useEffect, useState, useRef, memo } from 'react';

interface SmilesRendererProps {
    smiles: string;
    width?: number;
    height?: number;
    transparent?: boolean;
}

// Utility to format chemical formulas with sub/superscripts
const formatChemicalFormula = (text: string) => {
    return text
        .replace(/\+/g, '⁺')
        .replace(/-/g, '⁻')
        .replace(/(\d+)/g, (match) => {
            const subscripts = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
            return match.split('').map(char => subscripts[parseInt(char)] || char).join('');
        });
};

const ION_MAP: { [key: string]: string } = {
    '[Na+]': 'Na⁺',
    '[Cl-]': 'Cl⁻',
    '[K+]': 'K⁺',
    '[Li+]': 'Li⁺',
    '[Mg+2]': 'Mg²⁺',
    '[Ca+2]': 'Ca²⁺',
    '[Br-]': 'Br⁻',
    '[I-]': 'I⁻',
    '[F-]': 'F⁻',
    '[OH-]': 'OH⁻',
    '[NH4+]': 'NH₄⁺',
    '[H+]': 'H⁺',
    '[O-]': 'O⁻',
    '[O-2]': 'O²⁻',
    '[SO4-2]': 'SO₄²⁻',
    '[NO3-]': 'NO₃⁻',
    '[PO4-3]': 'PO₄³⁻',
    '[CN-]': 'CN⁻',
    '[CO3-2]': 'CO₃²⁻',
    '[HCO3-]': 'HCO₃⁻',
    '[CH3COO-]': 'CH₃COO⁻',
    '[Fe+2]': 'Fe²⁺',
    '[Fe+3]': 'Fe³⁺',
    '[Cu+2]': 'Cu²⁺',
    '[Zn+2]': 'Zn²⁺',
    '[Ag+]': 'Ag⁺',
    '[Al+3]': 'Al³⁺',
};

const SmilesFragment = memo(function SmilesFragment({ fragment, width, height }: { fragment: string; width: number; height: number }) {
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (ION_MAP[fragment]) return;

        let isMounted = true;
        const render = async () => {
            try {
                if (!(window as any).RDKit) {
                    // Wait for RDKit to be initialized if script is loading
                    let attempts = 0;
                    while (!(window as any).RDKit && attempts < 20) {
                        await new Promise(r => setTimeout(r, 200));
                        attempts++;
                    }
                }

                const RDKit = (window as any).RDKit;
                if (!RDKit || !isMounted) return;

                const mol = RDKit.get_mol(fragment);
                if (mol) {
                    const details = JSON.stringify({
                        width,
                        height,
                        bondLineWidth: 1.8,
                        addAtomIndices: false,
                        explicitMethyl: true,
                        addStereoAnnotation: true,
                        padding: 0.15,
                    });
                    const svgContent = mol.get_svg_with_highlights(details);
                    mol.delete();
                    if (isMounted) setSvg(svgContent);
                } else {
                    if (isMounted) setError(true);
                }
            } catch (e) {
                console.error('RDKit rendering error:', e);
                if (isMounted) setError(true);
            }
        };

        render();
        return () => { isMounted = false; };
    }, [fragment, width, height]);

    if (ION_MAP[fragment]) {
        return (
            <div className="ion-pill">
                {ION_MAP[fragment]}
            </div>
        );
    }

    if (error) {
        // Fallback to text if rendering fails
        return <div className="smiles-fallback">{fragment}</div>;
    }

    if (!svg) {
        return <div className="loading-shimmer" style={{ width, height }} />;
    }

    return (
        <div 
            className="svg-wrapper" 
            dangerouslySetInnerHTML={{ __html: svg }} 
            style={{ width, height }}
        />
    );
});

const SmilesRenderer = memo(function SmilesRenderer({ smiles, width = 400, height = 400, transparent = false }: SmilesRendererProps) {
    useEffect(() => {
        // Load RDKit script if not present
        if (!(window as any).RDKitScriptLoaded) {
            (window as any).RDKitScriptLoaded = true;
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js';
            script.onload = async () => {
                try {
                    (window as any).RDKit = await (window as any).initRDKitModule();
                    console.log('RDKit initialized');
                } catch (e) {
                    console.error('RDKit init failed:', e);
                }
            };
            document.head.appendChild(script);
        }
    }, []);

    if (!smiles) return null;

    const pipeGroups = smiles.split('|');
    const totalFragments = pipeGroups.reduce((acc, group) => acc + group.split('.').length, 0);
    
    // Adjust size if there are multiple fragments overall
    const fragWidth = totalFragments > 1 ? Math.max(150, Math.min(width, 400 / totalFragments)) : width;
    const fragHeight = totalFragments > 1 ? Math.max(150, Math.min(height, 400 / (totalFragments > 2 ? 2 : 1))) : height;

    return (
        <div className={`smiles-container ${transparent ? 'transparent' : ''}`}>
            {pipeGroups.map((group, gIdx) => {
                const fragments = group.split('.');
                return (
                    <div key={`group-${gIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {fragments.map((frag, idx) => (
                            <div key={`${frag}-${idx}`} className="smiles-fragment-wrapper">
                                <SmilesFragment fragment={frag} width={fragWidth} height={fragHeight} />
                                {idx < fragments.length - 1 && <span className="ion-plus">+</span>}
                            </div>
                        ))}
                        {gIdx < pipeGroups.length - 1 && <span className="pipe-separator">|</span>}
                    </div>
                );
            })}
            <style jsx>{`
                .smiles-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;

                    align-items: center;
                    justify-content: center;
                    background: white;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 15px 0;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                    border: 1px solid #e2e8f0;
                    width: fit-content;
                    max-width: 100%;
                }
                .smiles-container.transparent {
                    background: transparent;
                    box-shadow: none;
                    border: none;
                    padding: 0;
                    margin: 0;
                }
                .smiles-fragment-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }
                .ion-pill {
                    background: #EEEDFE;
                    color: #534AB7;
                    padding: 8px 16px;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 1.2rem;
                    border: 1px solid #D8D6F9;
                    font-family: 'Outfit', sans-serif;
                    box-shadow: 0 2px 4px rgba(83, 74, 183, 0.1);
                    white-space: nowrap;
                }
                .ion-plus {
                    font-size: 1.5rem;
                    color: #94a3b8;
                    font-weight: 300;
                }
                .pipe-separator {
                    font-size: 1.5rem;
                    color: #cbd5e1;
                    font-weight: 300;
                    margin: 0 4px;
                }
                .svg-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                .svg-wrapper :global(svg) {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .smiles-fallback {
                    font-family: monospace;
                    font-size: 12px;
                    color: #64748b;
                    padding: 8px;
                    background: #f8fafc;
                    border-radius: 6px;
                }
                .loading-shimmer {
                    background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 8px;
                }
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
});

export default SmilesRenderer;
