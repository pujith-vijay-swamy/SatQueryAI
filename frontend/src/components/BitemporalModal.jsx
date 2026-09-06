import React, { useState, useRef, useEffect } from 'react';
import { X, Columns2, Sparkles, Layers, Maximize2, SplitSquareVertical, ShieldCheck } from 'lucide-react';

export default function BitemporalModal({ isOpen, onClose, activeScene, visualArtifactUrl, analysisResult }) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [viewMode, setViewMode] = useState('swipe'); // 'swipe', 'side_by_side', 'mask'
  const [scaleMode, setScaleMode] = useState('fit'); // 'fit', 'original'
  const containerRef = useRef(null);

  const files = activeScene?.files || {};
  const cross = activeScene?.mode === 'cross_modal';
  const single = activeScene?.mode === 'single_image';

  const leftImg = cross ? (files.optical_preview || '/static/previews/assam_optical.png')
    : (files.t1_preview || '/static/previews/ahmedabad_t1.png');
  const rightImg = cross ? (files.sar_preview || '/static/previews/assam_sar.png')
    : (files.t2_preview || '/static/previews/ahmedabad_t2.png');

  const t1Date = activeScene?.timestamps?.t1 || (activeScene?.temporal_dates?.[0]) || 'T1 (Baseline)';
  const t2Date = activeScene?.timestamps?.t2 || (activeScene?.temporal_dates?.[1]) || 'T2 (Recent)';
  const gsd = activeScene?.gsd || activeScene?.resolution_gsd || '0.65m GSD';
  const crs = activeScene?.crs || 'EPSG:32643';
  const locName = activeScene?.location || activeScene?.title || activeScene?.id || 'Target AOI';

  const leftLbl = cross ? `Optical Sensor (${gsd})` : single ? `Baseline Raster (${gsd})` : `T1: ${t1Date} (${gsd})`;
  const rightLbl = cross ? 'RISAT-1 SAR C-Band (3.0m)' : single ? 'Observation Raster' : `T2: ${t2Date} (${gsd})`;

  const onMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(1, Math.min(99, pct)));
  };

  useEffect(() => {
    const handleMouseUp = () => setDragging(false);
    const handleMouseMove = (e) => {
      if (dragging) onMove(e.clientX);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragging, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(4, 4, 8, 0.92)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 24px',
      boxSizing: 'border-box',
    }}>
      {/* Modal Container */}
      <div style={{
        width: '100%', maxWidth: 1280, height: '92vh',
        background: '#0d0d12',
        border: '1px solid rgba(0, 240, 255, 0.4)',
        borderRadius: 10,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,240,255,0.15)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(18, 18, 24, 0.98)',
          borderBottom: '1px solid #27272a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 16,
        }}>
          {/* Left: Title & Sensor Specs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: 'rgba(0, 240, 255, 0.1)', border: '1px solid rgba(0, 240, 255, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layers size={17} color="#00F0FF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', letterSpacing: '0.02em' }}>
                  High-Resolution Bitemporal Swath Inspection
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)',
                  color: '#22c55e', fontFamily: "'JetBrains Mono', monospace",
                }}>
                  1:1 NATIVE RESOLUTION
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', fontFamily: "'JetBrains Mono', monospace", marginTop: 2, display: 'flex', gap: 8 }}>
                <span>AOI: <strong style={{ color: '#a1a1aa' }}>{locName}</strong></span>
                <span>·</span>
                <span>GSD: <strong style={{ color: '#00F0FF' }}>{gsd}</strong></span>
                <span>·</span>
                <span>CRS: <strong style={{ color: '#38bdf8' }}>{crs}</strong></span>
              </div>
            </div>
          </div>

          {/* Center: View Switcher Tabs */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.03)',
            border: '1px solid #27272a', borderRadius: 6, padding: 3, gap: 4,
          }}>
            <button
              onClick={() => setViewMode('swipe')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                color: viewMode === 'swipe' ? '#22c55e' : '#a1a1aa',
                background: viewMode === 'swipe' ? 'rgba(34,197,94,0.15)' : 'transparent',
                border: `1px solid ${viewMode === 'swipe' ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <Columns2 size={13} />
              <span>Interactive Swipe</span>
            </button>

            <button
              onClick={() => setViewMode('side_by_side')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                color: viewMode === 'side_by_side' ? '#38bdf8' : '#a1a1aa',
                background: viewMode === 'side_by_side' ? 'rgba(56,189,248,0.15)' : 'transparent',
                border: `1px solid ${viewMode === 'side_by_side' ? 'rgba(56,189,248,0.4)' : 'transparent'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <SplitSquareVertical size={13} />
              <span>Side-by-Side Dual View</span>
            </button>

            {visualArtifactUrl && (
              <button
                onClick={() => setViewMode('mask')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                  color: viewMode === 'mask' ? '#f59e0b' : '#a1a1aa',
                  background: viewMode === 'mask' ? 'rgba(245,158,11,0.15)' : 'transparent',
                  border: `1px solid ${viewMode === 'mask' ? 'rgba(245,158,11,0.4)' : 'transparent'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles size={13} />
                <span>Neural Evidence Mask</span>
              </button>
            )}
          </div>

          {/* Right: Scale Mode & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setScaleMode(m => m === 'fit' ? 'original' : 'fit')}
              title={scaleMode === 'fit' ? "Switch to 100% Native Unscaled Pixels" : "Fit to Container"}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 5, fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: scaleMode === 'original' ? '#00F0FF' : '#a1a1aa',
                background: scaleMode === 'original' ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${scaleMode === 'original' ? 'rgba(0,240,255,0.4)' : '#27272a'}`,
                cursor: 'pointer',
              }}
            >
              <Maximize2 size={13} />
              <span>{scaleMode === 'original' ? '1:1 PIXEL SCALE' : 'FIT VIEW'}</span>
            </button>

            <button
              onClick={onClose}
              title="Close Inspection Modal (Esc)"
              style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'rgba(255,255,255,0.03)', border: '1px solid #27272a',
                color: '#fafafa', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = '#27272a'; }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div style={{
          flex: 1, position: 'relative', overflow: scaleMode === 'original' ? 'auto' : 'hidden',
          background: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {viewMode === 'swipe' && (
            <div
              ref={containerRef}
              onMouseDown={(e) => { setDragging(true); onMove(e.clientX); }}
              style={{
                position: 'relative',
                width: scaleMode === 'original' ? 'auto' : '100%',
                height: scaleMode === 'original' ? 'auto' : '100%',
                minWidth: '100%', minHeight: '100%',
                cursor: 'ew-resize', userSelect: 'none',
              }}
            >
              {/* Right Image (Background) */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={rightImg}
                  alt={rightLbl}
                  draggable={false}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: scaleMode === 'original' ? 'none' : 'contain',
                  }}
                />
                <div style={{
                  position: 'absolute', bottom: 18, right: 20,
                  padding: '6px 14px', borderRadius: 6, background: 'rgba(9,9,14,0.92)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(56,189,248,0.4)', fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, fontWeight: 700, color: '#38bdf8',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                }}>
                  {rightLbl}
                </div>
              </div>

              {/* Left Image (Clipped by Pos) */}
              <div style={{
                position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden',
                borderRight: '2px solid #22c55e',
                boxShadow: '4px 0 20px rgba(34,197,94,0.3)',
              }}>
                <img
                  src={leftImg}
                  alt={leftLbl}
                  draggable={false}
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: containerRef.current?.clientWidth || '100%',
                    height: '100%',
                    objectFit: scaleMode === 'original' ? 'none' : 'contain',
                    maxWidth: 'none',
                  }}
                />
                <div style={{
                  position: 'absolute', bottom: 18, left: 20,
                  padding: '6px 14px', borderRadius: 6, background: 'rgba(9,9,14,0.92)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(34,197,94,0.4)', fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, fontWeight: 700, color: '#22c55e',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                }}>
                  {leftLbl}
                </div>
              </div>

              {/* Slider Handle Grip */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: `${pos}%`,
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(15, 15, 20, 0.98)',
                  border: '2px solid #22c55e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 24px rgba(34,197,94,0.7)',
                }}>
                  <Columns2 size={16} color="#22c55e" />
                </div>
                <span style={{
                  marginTop: 8, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(0,0,0,0.85)', color: '#22c55e',
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                  border: '1px solid rgba(34,197,94,0.3)',
                }}>
                  {Math.round(pos)}%
                </span>
              </div>
            </div>
          )}

          {viewMode === 'side_by_side' && (
            <div style={{
              width: '100%', height: '100%',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 14,
              boxSizing: 'border-box',
            }}>
              {/* T1 Baseline */}
              <div style={{
                position: 'relative', border: '1px solid #27272a', borderRadius: 8,
                background: '#09090b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src={leftImg} alt={leftLbl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  padding: '5px 12px', borderRadius: 4, background: 'rgba(15,15,20,0.9)',
                  border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e',
                  fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {leftLbl}
                </div>
              </div>

              {/* T2 Observation */}
              <div style={{
                position: 'relative', border: '1px solid #27272a', borderRadius: 8,
                background: '#09090b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src={rightImg} alt={rightLbl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  padding: '5px 12px', borderRadius: 4, background: 'rgba(15,15,20,0.9)',
                  border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8',
                  fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {rightLbl}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'mask' && visualArtifactUrl && (
            <div style={{
              width: '100%', height: '100%',
              position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={visualArtifactUrl}
                alt="Neural Evidence Mask"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {/* Overlay Legend */}
              <div style={{
                position: 'absolute', top: 16, left: 16,
                padding: '10px 16px', borderRadius: 6, background: 'rgba(15, 15, 20, 0.94)',
                backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', flexDirection: 'column', gap: 6,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              }}>
                <span style={{ color: '#fafafa', fontWeight: 700, borderBottom: '1px solid #27272a', paddingBottom: 4 }}>
                  NEURAL PREDICTION MASK KEY
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#FF4D4D' }} />
                  <span style={{ color: '#a1a1aa' }}>Built-Up Expansion / New Structures</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#00F0FF' }} />
                  <span style={{ color: '#a1a1aa' }}>Vegetative / Canopy Dynamic Shift</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#FFB000' }} />
                  <span style={{ color: '#a1a1aa' }}>Riparian Water / Riverbed Sandbar Shift</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer HUD */}
        <div style={{
          padding: '10px 20px',
          background: 'rgba(15, 15, 20, 0.98)',
          borderTop: '1px solid #27272a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e' }}>
              <ShieldCheck size={14} />
              <span>SUB-PIXEL CO-REGISTERED (RASTERIO)</span>
            </div>
            <span style={{ color: '#3f3f46' }}>|</span>
            <span style={{ color: '#71717a' }}>
              FOOTPRINT: <strong style={{ color: '#fafafa' }}>{activeScene?.ground_area_km2 || '14.2'} km²</strong>
            </span>
            <span style={{ color: '#3f3f46' }}>|</span>
            <span style={{ color: '#71717a' }}>
              MODEL: <strong style={{ color: '#38bdf8' }}>{analysisResult?.model_name?.split('[')[0]?.trim() || 'BIT-CD Transformer'}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#71717a' }}>DRAG SLIDER TO SWIPE · PRESS <kbd style={{ background: '#27272a', padding: '1px 5px', borderRadius: 3, color: '#fafafa' }}>ESC</kbd> TO EXIT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
