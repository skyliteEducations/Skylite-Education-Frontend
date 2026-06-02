'use client';

import Link from 'next/link';

export default function ChemistrySelection() {
    return (
        <main className="chem-selection-root">
            <div className="chem-orb orb-1"></div>
            <div className="chem-orb orb-2"></div>

            <div className="selection-container">
                <header className="selection-header">
                    <Link href="/" className="back-link">← DASHBOARD</Link>
                    <h1>IIT JEE / NEET <span className="text-highlight">Chemistry</span></h1>
                    <p>Select a specialized chemical domain to begin extraction</p>
                </header>

                <div className="selection-grid">
                    {/* INORGANIC CHEMISTRY */}
                    <Link href="/chemistry/inorganic" className="selection-card inorganic">
                        <div className="card-icon">🧪</div>
                        <div className="card-content">
                            <h3>Inorganic Chemistry</h3>
                            <p>Coordination compounds, p-block, metallurgy, and periodic trends.</p>
                            <span className="status-label live">LIVE PIPELINE</span>
                        </div>
                    </Link>

                    {/* ORGANIC CHEMISTRY */}
                    <Link href="/chemistry/organic" className="selection-card organic">
                        <div className="card-icon">🧬</div>
                        <div className="card-content">
                            <h3>Organic Chemistry</h3>
                            <p>Reaction mechanisms, hydrocarbons, and functional groups.</p>
                            <span className="status-label live">LIVE PIPELINE</span>
                        </div>
                    </Link>

                    {/* PHYSICAL CHEMISTRY */}
                    <Link href="/chemistry/physical" className="selection-card physical">
                        <div className="card-icon">⚡</div>
                        <div className="card-content">
                            <h3>Physical Chemistry</h3>
                            <p>Thermodynamics, kinetics, and equilibrium states.</p>
                            <span className="status-label live">LIVE PIPELINE</span>
                        </div>
                    </Link>
                </div>
            </div>

            <style jsx>{`
                .chem-selection-root {
                    background-color: #020617;
                    color: #f8fafc;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .chem-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                    z-index: 0;
                    opacity: 0.15;
                }
                .orb-1 { top: -100px; right: -100px; width: 500px; height: 500px; background: #6366f1; }
                .orb-2 { bottom: -100px; left: -100px; width: 400px; height: 400px; background: #10b981; }

                .selection-container {
                    position: relative;
                    z-index: 10;
                    max-width: 1000px;
                    width: 100%;
                }

                .selection-header {
                    text-align: center;
                    margin-bottom: 60px;
                }

                .back-link {
                    display: inline-block;
                    margin-bottom: 20px;
                    font-size: 12px;
                    font-weight: 800;
                    color: #475569;
                    text-decoration: none;
                    transition: color 0.3s;
                }
                .back-link:hover { color: #fff; }

                .selection-header h1 {
                    font-size: 48px;
                    font-weight: 900;
                    margin-bottom: 12px;
                    letter-spacing: -1px;
                }
                .text-highlight { color: #6366f1; }
                .selection-header p { color: #94a3b8; font-size: 18px; }

                .selection-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 30px;
                }

                .selection-card {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 32px;
                    padding: 40px;
                    text-decoration: none;
                    color: inherit;
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    backdrop-filter: blur(20px);
                }

                .selection-card:not(.disabled):hover {
                    transform: translateY(-10px);
                    border-color: #6366f1;
                    background: rgba(15, 23, 42, 0.8);
                    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.5);
                }

                .selection-card.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .card-icon {
                    font-size: 48px;
                    margin-bottom: 24px;
                }

                .card-content h3 {
                    font-size: 22px;
                    font-weight: 800;
                    margin-bottom: 12px;
                }

                .card-content p {
                    font-size: 14px;
                    color: #94a3b8;
                    line-height: 1.6;
                    margin-bottom: 24px;
                }

                .status-label {
                    font-size: 10px;
                    font-weight: 900;
                    padding: 6px 12px;
                    border-radius: 99px;
                    letter-spacing: 1px;
                }

                .status-label.live {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }

                .status-label.pending {
                    background: rgba(255, 255, 255, 0.05);
                    color: #64748b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
            `}</style>
        </main>
    );
}
