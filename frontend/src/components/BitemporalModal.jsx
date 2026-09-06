import React, { useState, useRef, useEffect } from 'react';
import {
  X, Columns2, Sparkles, Layers, Maximize2, SplitSquareVertical,
  ShieldCheck, Upload, FileUp, Image as ImageIcon, Loader2, ArrowRight,
  CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';

export default function BitemporalModal({
  isOpen,
  onClose,
  activeScene,
  visualArtifactUrl,
  analysisResult,
  onCustomUploadSuccess
}) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [viewMode, setViewMode] = useState('swipe'); // 'swipe', 'side_by_side', 'mask', 'upload'
  const [scaleMode, setScaleMode] = useState('fit'); // 'fit', 'original'
  const containerRef = useRef(null);

  // Upload State
  const [t1File, setT1File] = useState(null);
  const [t2File, setT2File] = useState(null);
  const [t1Preview, setT1Preview] = useState(null);
  const [t2Preview, setT2Preview] = useState(null);
  const [t1Label, setT1Label] = useState('2021 (Pre-Event)');
  const [t2Label, setT2Label] = useState('2024 (Post-Event)');
  const [customTitle, setCustomTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

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
  const locName = activeScene?.location || activeScene?.title || activeScene?.name || activeScene?.id || 'Target AOI';

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

  const handleT1Select = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setT1File(f);
      setUploadError(null);
      if (f.type.startsWith('image/')) {
        setT1Preview(URL.createObjectURL(f));
      } else {
        setT1Preview(null);
      }
    }
  };

  const handleT2Select = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setT2File(f);
      setUploadError(null);
      if (f.type.startsWith('image/')) {
        setT2Preview(URL.createObjectURL(f));
      } else {
        setT2Preview(null);
      }
    }
  };

  const handleRunCustomAnalysis = async () => {
    if (!t1File || !t2File) {
      setUploadError('Please select both T1 (Baseline) and T2 (Observation) raster files.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('t1_file', t1File);
    formData.append('t2_file', t2File);
    formData.append('title', customTitle.trim() || `Custom Upload (${t1File.name} vs ${t2File.name})`);
    formData.append('t1_label', t1Label.trim() || 'T1 (Baseline)');
    formData.append('t2_label', t2Label.trim() || 'T2 (Observation)');
    formData.append('crs', crs || 'EPSG:32643');
    formData.append('gsd', gsd || '0.65m GSD');

    try {
      const res = await fetch('/api/upload/compare', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Upload failed');
      }

      const data = await res.json();
      if (data.status === 'SUCCESS') {
        if (onCustomUploadSuccess) {
          onCustomUploadSuccess(data);
        }
        setViewMode('swipe');
      }
    } catch (err) {
      console.error('Custom upload error:', err);
      setUploadError(err.message || 'Error processing rasters with BiT-CD model.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(4, 4, 8, 0.94)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px 20px',
      boxSizing: 'border-box',
    }}>
      {/* Modal Container */}
      <div style={{
        width: '100%', maxWidth: 1320, height: '94vh',
        background: '#0d0d12',
        border: '1px solid rgba(0, 240, 255, 0.4)',
        borderRadius: 10,
        boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 0 40px rgba(0,240,255,0.15)',
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
                  Bi-Temporal Raster Swath Workspace
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
              <span>Side-by-Side</span>
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
                <span>Neural Mask</span>
              </button>
            )}

            <button
              onClick={() => setViewMode('upload')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                color: viewMode === 'upload' ? '#00F0FF' : '#a1a1aa',
                background: viewMode === 'upload' ? 'rgba(0,240,255,0.15)' : 'transparent',
                border: `1px solid ${viewMode === 'upload' ? 'rgba(0,240,255,0.4)' : 'transparent'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <Upload size={13} />
              <span>Upload Custom Rasters</span>
            </button>
          </div>

          {/* Right: Scale Mode & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {viewMode !== 'upload' && (
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
            )}

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

        {/* Main Workspace Area */}
        <div style={{
          flex: 1, position: 'relative', overflow: (scaleMode === 'original' && viewMode !== 'upload') ? 'auto' : 'hidden',
          background: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* View 1: Interactive Swipe */}
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

          {/* View 2: Side-by-Side Dual View */}
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

          {/* View 3: Neural Evidence Mask */}
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

          {/* View 4: Upload Custom Rasters Workspace */}
          {viewMode === 'upload' && (
            <div style={{
              width: '100%', height: '100%', overflowY: 'auto',
              padding: '24px 32px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', gap: 20,
              maxWidth: 960,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#fafafa' }}>
                  Upload Custom Satellite / Aerial Rasters
                </span>
                <span style={{ fontSize: 12, color: '#a1a1aa', fontFamily: "'Inter', sans-serif" }}>
                  Ingest multi-temporal raster pairs (.tif, .tiff, .geotiff, .png, .jpg, .jpeg) for instant sub-pixel co-registration and BiT-CD neural change detection.
                </span>
              </div>

              {uploadError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
                  fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertCircle size={16} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Upload Dropzones Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* T1 Uploader */}
                <div style={{
                  border: '1px dashed #3f3f46', borderRadius: 8, padding: 16,
                  background: 'rgba(18, 18, 22, 0.7)', display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: "'JetBrains Mono', monospace" }}>
                      T1: BASELINE RASTER
                    </span>
                    <span style={{ fontSize: 10, color: '#71717a' }}>.TIF / .GEOTIFF / .PNG / .JPG</span>
                  </div>

                  <label style={{
                    minHeight: 140, border: '1px solid #27272a', borderRadius: 6,
                    background: '#09090c', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    position: 'relative', overflow: 'hidden', padding: 12, textAlign: 'center',
                    transition: 'border-color 0.15s',
                  }}>
                    <input
                      type="file"
                      accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg"
                      onChange={handleT1Select}
                      style={{ display: 'none' }}
                    />
                    {t1Preview ? (
                      <img src={t1Preview} alt="T1 Preview" style={{ width: '100%', height: 130, objectFit: 'contain' }} />
                    ) : t1File ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={24} color="#22c55e" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{t1File.name}</span>
                        <span style={{ fontSize: 10, color: '#71717a' }}>{(t1File.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#71717a' }}>
                        <FileUp size={24} color="#22c55e" />
                        <span style={{ fontSize: 12, color: '#fafafa', fontWeight: 600 }}>Select T1 (Pre-Event) File</span>
                        <span style={{ fontSize: 10 }}>Click or drag GeoTIFF / PNG / JPEG</span>
                      </div>
                    )}
                  </label>

                  <input
                    type="text"
                    value={t1Label}
                    onChange={(e) => setT1Label(e.target.value)}
                    placeholder="T1 Label / Date (e.g. 2021-03-14)"
                    style={{
                      height: 32, padding: '0 10px', borderRadius: 4, background: '#09090b',
                      border: '1px solid #27272a', fontSize: 11, color: '#fafafa',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>

                {/* T2 Uploader */}
                <div style={{
                  border: '1px dashed #3f3f46', borderRadius: 8, padding: 16,
                  background: 'rgba(18, 18, 22, 0.7)', display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace" }}>
                      T2: OBSERVATION RASTER
                    </span>
                    <span style={{ fontSize: 10, color: '#71717a' }}>.TIF / .GEOTIFF / .PNG / .JPG</span>
                  </div>

                  <label style={{
                    minHeight: 140, border: '1px solid #27272a', borderRadius: 6,
                    background: '#09090c', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    position: 'relative', overflow: 'hidden', padding: 12, textAlign: 'center',
                    transition: 'border-color 0.15s',
                  }}>
                    <input
                      type="file"
                      accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg"
                      onChange={handleT2Select}
                      style={{ display: 'none' }}
                    />
                    {t2Preview ? (
                      <img src={t2Preview} alt="T2 Preview" style={{ width: '100%', height: 130, objectFit: 'contain' }} />
                    ) : t2File ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={24} color="#38bdf8" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{t2File.name}</span>
                        <span style={{ fontSize: 10, color: '#71717a' }}>{(t2File.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#71717a' }}>
                        <FileUp size={24} color="#38bdf8" />
                        <span style={{ fontSize: 12, color: '#fafafa', fontWeight: 600 }}>Select T2 (Post-Event) File</span>
                        <span style={{ fontSize: 10 }}>Click or drag GeoTIFF / PNG / JPEG</span>
                      </div>
                    )}
                  </label>

                  <input
                    type="text"
                    value={t2Label}
                    onChange={(e) => setT2Label(e.target.value)}
                    placeholder="T2 Label / Date (e.g. 2024-02-18)"
                    style={{
                      height: 32, padding: '0 10px', borderRadius: 4, background: '#09090b',
                      border: '1px solid #27272a', fontSize: 11, color: '#fafafa',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
              </div>

              {/* Optional Scene Title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>
                  CUSTOM AOI TITLE (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Ahmedabad Sabarmati Corridor Inspection"
                  style={{
                    height: 36, padding: '0 12px', borderRadius: 5, background: '#09090b',
                    border: '1px solid #27272a', fontSize: 12, color: '#fafafa',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleRunCustomAnalysis}
                disabled={isUploading || !t1File || !t2File}
                style={{
                  height: 44, borderRadius: 6, background: isUploading ? '#27272a' : '#00F0FF',
                  border: 'none', color: isUploading ? '#71717a' : '#09090b',
                  fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.04em', cursor: (isUploading || !t1File || !t2File) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: (!isUploading && t1File && t2File) ? '0 0 20px rgba(0,240,255,0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>INGESTING & RUNNING BIT-CD NEURAL INFERENCE...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>RUN BIT-CD NEURAL CHANGE DETECTION</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
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
