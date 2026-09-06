import React, { useState, useRef, useEffect } from 'react';
import { Columns2, Sparkles, Layers } from 'lucide-react';

export default function RasterSwipe({ activeScene, visualArtifactUrl }) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState('swipe');
  const ref = useRef(null);

  const files = activeScene?.files || {};
  const cross = activeScene?.mode === 'cross_modal';
  const single = activeScene?.mode === 'single_image';

  const leftImg = cross ? (files.optical_preview || '/static/previews/assam_optical.png')
    : (files.t1_preview || '/static/previews/ahmedabad_t1.png');
  const rightImg = cross ? (files.sar_preview || '/static/previews/assam_sar.png')
    : (files.t2_preview || '/static/previews/ahmedabad_t2.png');
  const t1Date = activeScene?.timestamps?.t1 || (activeScene?.temporal_dates?.[0]) || 'T1';
  const t2Date = activeScene?.timestamps?.t2 || (activeScene?.temporal_dates?.[1]) || 'T2';
  const gsd = activeScene?.gsd || activeScene?.resolution_gsd || '0.65m';

  const leftLbl = cross ? `Optical (${gsd})` : single ? `Baseline (${gsd})` : `T1: ${t1Date} (${gsd})`;
  const rightLbl = cross ? 'SAR C-Band (3.0m)' : single ? 'Observation' : `T2: ${t2Date} (${gsd})`;

  const onMove = (cx) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos(Math.max(2, Math.min(98, ((cx - r.left) / r.width) * 100)));
  };

  useEffect(() => {
    const up = () => setDragging(false);
    const mv = (e) => { if (dragging) onMove(e.clientX); };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [dragging]);

  return (
    <div style={{
      background: 'rgba(24, 24, 27, 0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid #27272a',
      borderRadius: 6,
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid #27272a', background: 'rgba(20, 20, 22, 0.98)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Layers size={13} color="#22c55e" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fafafa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Dual-Canvas Raster Comparison
          </span>
          <span style={{ fontSize: 10, color: '#52525b', fontFamily: "'JetBrains Mono', monospace" }}>
            · SUB-PIXEL CO-REGISTERED
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setView('swipe')}
            style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              color: view === 'swipe' ? '#22c55e' : '#a1a1aa',
              background: view === 'swipe' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${view === 'swipe' ? 'rgba(34,197,94,0.4)' : '#27272a'}`,
              boxShadow: view === 'swipe' ? '0 0 10px rgba(34,197,94,0.15)' : 'none',
              transition: 'all 0.15s ease',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {cross ? 'Optical ⟷ SAR' : single ? 'Baseline' : `T1 (${t1Date}) ⟷ T2 (${t2Date})`}
          </button>
          {visualArtifactUrl && (
            <button
              onClick={() => setView('artifact')}
              style={{
                padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                color: view === 'artifact' ? '#38bdf8' : '#a1a1aa',
                background: view === 'artifact' ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${view === 'artifact' ? 'rgba(56,189,248,0.4)' : '#27272a'}`,
                boxShadow: view === 'artifact' ? '0 0 10px rgba(56,189,248,0.15)' : 'none',
                transition: 'all 0.15s ease',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <Sparkles size={12} color="#38bdf8" />
              <span>Evidence Mask</span>
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={ref}
        onMouseDown={(e) => { setDragging(true); onMove(e.clientX); }}
        style={{ position: 'relative', width: '100%', height: 235, cursor: 'ew-resize', background: '#09090b', overflow: 'hidden' }}
      >
        {view === 'artifact' && visualArtifactUrl ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img src={visualArtifactUrl} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <span style={{
              position: 'absolute', top: 10, left: 10,
              padding: '4px 10px', borderRadius: 4, background: 'rgba(9,9,11,0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(56,189,248,0.4)', fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, fontWeight: 700, color: '#38bdf8',
            }}>
              MODEL EVIDENCE MASK (BIT-CD)
            </span>
          </div>
        ) : (
          <>
            {/* Right (background) */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <img src={rightImg} alt={rightLbl} draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{
                position: 'absolute', bottom: 10, right: 10,
                padding: '4px 10px', borderRadius: 4, background: 'rgba(9,9,11,0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, fontWeight: 600, color: '#38bdf8',
              }}>{rightLbl}</span>
            </div>

            {/* Left (clipped) */}
            <div style={{
              position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden',
              borderRight: '2px solid #22c55e',
            }}>
              <img src={leftImg} alt={leftLbl} draggable={false}
                style={{
                  position: 'absolute', top: 0, left: 0, height: '100%', objectFit: 'cover',
                  width: ref.current?.clientWidth || '100%', maxWidth: 'none',
                }} />
              <span style={{
                position: 'absolute', bottom: 10, left: 10,
                padding: '4px 10px', borderRadius: 4, background: 'rgba(9,9,11,0.88)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, fontWeight: 600, color: '#22c55e',
              }}>{leftLbl}</span>
            </div>

            {/* Divider Handle */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${pos}%`, transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(18, 18, 22, 0.95)', border: '2px solid #22c55e',
                boxShadow: '0 0 14px rgba(34,197,94,0.5)',
              }}>
                <Columns2 size={13} color="#22c55e" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
