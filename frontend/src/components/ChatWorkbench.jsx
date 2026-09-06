import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, Loader2, Sparkles, X, Play, Maximize2,
  ChevronDown, ChevronRight, ShieldCheck, AlertTriangle, Layers,
  Copy, Check, Activity, FileText, CornerDownLeft, Eye, Upload,
  FileUp, Image as ImageIcon, Plus, ArrowRight, CheckCircle2,
  Zap, BrainCircuit, Scan
} from 'lucide-react';

export default function ChatWorkbench({
  activeScene,
  preflightData,
  analysisResult,
  isLoading,
  query,
  setQuery,
  onExecute,
  onClose,
  onOpenModal,
  onCustomUploadSuccess
}) {
  const [showGisDetails, setShowGisDetails] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showJsonTrace, setShowJsonTrace] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  // Inline Quick Upload State
  const [showUploader, setShowUploader] = useState(false);
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [file1Preview, setFile1Preview] = useState(null);
  const [file2Preview, setFile2Preview] = useState(null);
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);

  const presets = activeScene?.sample_queries || [];
  const files = activeScene?.files || {};
  const cross = activeScene?.mode === 'cross_modal';
  const single = activeScene?.mode === 'single_image';

  const leftImg = cross ? (files.optical_preview || '/static/previews/assam_optical.png')
    : (files.t1_preview || '/static/previews/ahmedabad_t1.png');
  const rightImg = cross ? (files.sar_preview || '/static/previews/assam_sar.png')
    : (files.t2_preview || '/static/previews/ahmedabad_t2.png');

  const t1Date = activeScene?.timestamps?.t1 || (activeScene?.temporal_dates?.[0]) || (single ? 'Observation' : 'T1');
  const t2Date = activeScene?.timestamps?.t2 || (activeScene?.temporal_dates?.[1]) || 'T2';
  const gsd = activeScene?.gsd || activeScene?.resolution_gsd || '0.65m GSD';
  const crs = activeScene?.crs || 'EPSG:32643';
  const locName = activeScene?.location?.split(',')[0]?.trim() || activeScene?.title || activeScene?.name || 'Target AOI';

  const audit = preflightData?.audit || {};
  const auditStatus = audit.gis_preflight || 'PASSED';
  const isHarmonized = audit.crs_harmonized || false;
  const isAuditOk = auditStatus === 'PASSED' || auditStatus.includes('PASSED');

  const trace = analysisResult?.execution_trace;
  const textResponse = analysisResult?.text_response;
  const metrics = analysisResult?.metrics;
  const visualArtifactUrl = analysisResult?.visual_artifact_url;

  useEffect(() => {
    if (scrollRef.current) {
      if (isLoading) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else if (analysisResult) {
        scrollRef.current.scrollTop = 0;
      }
    }
  }, [analysisResult, isLoading]);

  const copyJSON = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(JSON.stringify(analysisResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFile1Select = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile1(f);
      setUploadFeedback(null);
      if (f.type.startsWith('image/')) {
        setFile1Preview(URL.createObjectURL(f));
      } else {
        setFile1Preview(null);
      }
    }
  };

  const handleFile2Select = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile2(f);
      setUploadFeedback(null);
      if (f.type.startsWith('image/')) {
        setFile2Preview(URL.createObjectURL(f));
      } else {
        setFile2Preview(null);
      }
    }
  };

  const handleExecuteUpload = async () => {
    if (!file1) {
      setUploadFeedback('Please select at least 1 image to analyze.');
      return;
    }

    setIsSubmittingUpload(true);
    setUploadFeedback(null);

    const formData = new FormData();
    formData.append('t1_file', file1);
    if (file2) {
      formData.append('t2_file', file2);
      formData.append('title', `Custom Bi-Temporal (${file1.name} vs ${file2.name})`);
    } else {
      formData.append('title', `Custom Single-Scene (${file1.name})`);
    }

    try {
      const res = await fetch('/api/upload/raster', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Upload failed');
      }
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        if (onCustomUploadSuccess) {
          onCustomUploadSuccess(data);
        }
        setShowUploader(false);
        setFile1(null);
        setFile2(null);
        setFile1Preview(null);
        setFile2Preview(null);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadFeedback('Error ingesting rasters. Verify valid TIFF, GeoTIFF, PNG, or JPEG format.');
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
      background: '#0a0a0e', color: '#fafafa', overflow: 'hidden',
      borderLeft: '1px solid #27272a',
    }}>
      {/* ── Console Header ── */}
      <div style={{
        padding: '10px 16px', background: 'rgba(18, 18, 22, 0.98)',
        borderBottom: '1px solid #27272a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: 12,
      }}>
        {/* Title & Target */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: single ? '#00F0FF' : '#22c55e',
            boxShadow: `0 0 8px ${single ? '#00F0FF' : '#22c55e'}`
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fafafa', letterSpacing: '0.04em' }}>
              SatQuery Console
            </span>
            <span style={{ fontSize: 10, color: '#a1a1aa', fontFamily: "'JetBrains Mono', monospace" }}>
              {locName} · {single ? 'Single-Image VQA' : 'Bi-Temporal BiT-CD'}
            </span>
          </div>
        </div>

        {/* Compact GIS Audit Chip & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowGisDetails(prev => !prev)}
            title="Toggle GIS Co-Registration Details"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 9px', borderRadius: 4,
              background: isAuditOk ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${isAuditOk ? 'rgba(34, 197, 94, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
              fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              color: isAuditOk ? '#22c55e' : '#f59e0b',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {isAuditOk ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
            <span>{isHarmonized ? 'HARMONIZED' : (single ? 'GIS VERIFIED' : 'CO-REG PASSED')}</span>
            <ChevronDown size={11} style={{ transform: showGisDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          <button
            onClick={onClose}
            title="Collapse Chat Console to Fullscreen Globe"
            style={{
              width: 28, height: 28, borderRadius: 5,
              background: 'rgba(255,255,255,0.03)', border: '1px solid #27272a',
              color: '#a1a1aa', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fafafa'; e.currentTarget.style.borderColor = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#27272a'; }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Expandable GIS Audit Details Dropdown ── */}
      {showGisDetails && (
        <div style={{
          padding: '10px 14px', background: '#121216',
          borderBottom: '1px solid #27272a', fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#71717a', fontSize: 9 }}>COORDINATES</div>
            <div style={{ color: '#fafafa', fontWeight: 600 }}>{crs}</div>
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 9 }}>RESOLUTION</div>
            <div style={{ color: '#38bdf8', fontWeight: 600 }}>{gsd}</div>
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 9 }}>OVERLAP</div>
            <div style={{ color: '#22c55e', fontWeight: 600 }}>{single ? '100.0%' : (audit.overlap_percentage || 99.8) + '%'}</div>
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 9 }}>DISPATCH</div>
            <div style={{ color: single ? '#00F0FF' : '#22c55e', fontWeight: 600 }}>
              {single ? 'GEOCHAT VQA' : 'BIT-CD'}
            </div>
          </div>
        </div>
      )}

      {/* ── Conversation & Results Feed ── */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* ── Smart Raster Ingestion & Intelligence Card ── */}
        <div style={{
          borderRadius: 8, overflow: 'hidden',
          border: '1px solid #27272a', background: 'rgba(18, 18, 22, 0.95)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {/* Card Action Header */}
          <div style={{
            padding: '8px 12px', background: 'rgba(25, 25, 30, 0.98)',
            borderBottom: '1px solid #27272a',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#fafafa' }}>
              {single ? <BrainCircuit size={13} color="#00F0FF" /> : <Layers size={13} color="#22c55e" />}
              <span>{single ? 'Remote Sensing VQA Model (GeoChat)' : 'Bitemporal Change Detection (BiT-CD)'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setShowUploader(prev => !prev)}
                title="Upload 1 Image (VQA) or 2 Images (BiT-CD)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px', borderRadius: 4,
                  background: showUploader ? 'rgba(0, 240, 255, 0.2)' : 'rgba(0, 240, 255, 0.08)',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                  color: '#00F0FF', fontSize: 10, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <Upload size={11} />
                <span>{showUploader ? 'CANCEL' : 'UPLOAD RASTERS'}</span>
              </button>

              {!showUploader && (
                <button
                  onClick={onOpenModal}
                  title="Open in High-Resolution Inspection Workspace"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 9px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid #3f3f46',
                    color: '#fafafa', fontSize: 10, fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#22c55e'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3f3f46'; }}
                >
                  <Maximize2 size={11} />
                  <span>INSPECT 1:1</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline Uploader Workspace */}
          {showUploader ? (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, background: '#09090c' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fafafa', letterSpacing: '0.02em' }}>
                  INGEST SATELLITE RASTERS (.TIF / .PNG / .JPG)
                </span>
                <span style={{ fontSize: 10, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>
                  1 Image → VQA | 2 Images → BiT-CD
                </span>
              </div>

              {uploadFeedback && (
                <div style={{
                  padding: '6px 10px', borderRadius: 4, background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontSize: 11,
                }}>
                  {uploadFeedback}
                </div>
              )}

              {/* Dual Slots */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Image 1 Slot */}
                <label style={{
                  border: '1px dashed #3f3f46', borderRadius: 6, padding: 10,
                  background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 90,
                  textAlign: 'center', position: 'relative',
                }}>
                  <input type="file" accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg" onChange={handleFile1Select} style={{ display: 'none' }} />
                  {file1Preview ? (
                    <img src={file1Preview} alt="Image 1" style={{ width: '100%', height: 80, objectFit: 'contain' }} />
                  ) : file1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={18} color="#22c55e" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#fafafa' }}>{file1.name}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#71717a' }}>
                      <FileUp size={18} color="#00F0FF" />
                      <span style={{ fontSize: 11, color: '#fafafa', fontWeight: 600 }}>1. Primary Raster</span>
                      <span style={{ fontSize: 9 }}>Required (GeoTIFF / PNG)</span>
                    </div>
                  )}
                </label>

                {/* Image 2 Slot */}
                <label style={{
                  border: '1px dashed #3f3f46', borderRadius: 6, padding: 10,
                  background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 90,
                  textAlign: 'center', position: 'relative',
                }}>
                  <input type="file" accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg" onChange={handleFile2Select} style={{ display: 'none' }} />
                  {file2Preview ? (
                    <img src={file2Preview} alt="Image 2" style={{ width: '100%', height: 80, objectFit: 'contain' }} />
                  ) : file2 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={18} color="#38bdf8" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#fafafa' }}>{file2.name}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#71717a' }}>
                      <Plus size={18} color="#38bdf8" />
                      <span style={{ fontSize: 11, color: '#fafafa', fontWeight: 600 }}>2. Observation Raster</span>
                      <span style={{ fontSize: 9 }}>Optional (Enables BiT-CD)</span>
                    </div>
                  )}
                </label>
              </div>

              {/* Mode Intelligence Badge */}
              <div style={{
                padding: '6px 10px', borderRadius: 4,
                background: file2 ? 'rgba(34,197,94,0.08)' : 'rgba(0,240,255,0.08)',
                border: `1px solid ${file2 ? 'rgba(34,197,94,0.3)' : 'rgba(0,240,255,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {file2 ? <Zap size={12} color="#22c55e" /> : <BrainCircuit size={12} color="#00F0FF" />}
                  <span style={{ color: file2 ? '#22c55e' : '#00F0FF', fontWeight: 700 }}>
                    TARGET AGENT: {file2 ? 'BIT-CD BITEMPORAL TRANSFORMER' : 'GEOCHAT RS-VQA & GROUNDING'}
                  </span>
                </div>
                <span style={{ color: '#71717a' }}>
                  {file2 ? '2 Files Selected' : (file1 ? '1 File Selected' : '0 Files')}
                </span>
              </div>

              {/* Ingest Action Button */}
              <button
                onClick={handleExecuteUpload}
                disabled={isSubmittingUpload || !file1}
                style={{
                  height: 36, borderRadius: 5,
                  background: isSubmittingUpload ? '#27272a' : (file2 ? '#22c55e' : '#00F0FF'),
                  border: 'none', color: '#09090b', fontSize: 11, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: (isSubmittingUpload || !file1) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {isSubmittingUpload ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>INGESTING & ROUTING TO SPECIALIST MODEL...</span>
                  </>
                ) : (
                  <>
                    <span>INGEST & DISPATCH TO {file2 ? 'BIT-CD MODEL' : 'VQA MODEL'}</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Active Raster Thumbnails View */
            <div
              onClick={onOpenModal}
              style={{
                display: single ? 'block' : 'grid',
                gridTemplateColumns: single ? 'none' : '1fr 1fr',
                height: 110, cursor: 'pointer', position: 'relative', overflow: 'hidden',
              }}
              title="Click for 1:1 Resolution Modal"
            >
              {single ? (
                /* Single Image Preview for VQA */
                <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', background: '#09090c' }}>
                  <img src={leftImg} alt="VQA Observation" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <div style={{
                    position: 'absolute', bottom: 6, left: 8,
                    padding: '2px 8px', borderRadius: 3, background: 'rgba(9,9,11,0.85)',
                    fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#00F0FF',
                    border: '1px solid rgba(0,240,255,0.3)',
                  }}>
                    Single Scene · {gsd} · {crs}
                  </div>
                </div>
              ) : (
                /* Dual Image Comparison Preview for BiT-CD */
                <>
                  <div style={{ position: 'relative', height: '100%', overflow: 'hidden', borderRight: '1px solid #27272a' }}>
                    <img src={leftImg} alt="T1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', bottom: 4, left: 6,
                      padding: '2px 6px', borderRadius: 3, background: 'rgba(9,9,11,0.85)',
                      fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#22c55e',
                    }}>
                      T1: {t1Date}
                    </div>
                  </div>

                  <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
                    <img src={rightImg} alt="T2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', bottom: 4, right: 6,
                      padding: '2px 6px', borderRadius: 3, background: 'rgba(9,9,11,0.85)',
                      fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8',
                    }}>
                      T2: {t2Date}
                    </div>
                  </div>
                </>
              )}

              {/* Hover hint */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
              >
                <span style={{
                  padding: '4px 10px', borderRadius: 4, background: 'rgba(0,0,0,0.85)',
                  border: '1px solid #00F0FF', color: '#00F0FF', fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                }}>
                  CLICK FOR 1:1 RESOLUTION POPUP
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Loading Indicator Card */}
        {isLoading && (
          <div style={{
            padding: '16px 18px', borderRadius: 8,
            background: single ? 'rgba(0, 240, 255, 0.06)' : 'rgba(34, 197, 94, 0.06)',
            border: `1px solid ${single ? 'rgba(0, 240, 255, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
            display: 'flex', alignItems: 'center', gap: 12, color: single ? '#00F0FF' : '#22c55e',
          }}>
            <Loader2 size={18} className="animate-spin" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
                {single ? 'DISPATCHING RS-VQA & GEOCHAT MODEL' : 'DISPATCHING BITEMPORAL NEURAL TRANSFORMER'}
              </span>
              <span style={{ fontSize: 10, color: '#a1a1aa', fontFamily: "'JetBrains Mono', monospace" }}>
                {single ? 'Executing spatial feature grounding and multi-spectral VQA...' : 'Running BIT-CD model inference across multi-spectral bands...'}
              </span>
            </div>
          </div>
        )}

        {/* Active Analysis Response */}
        {textResponse && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Spatial Reasoning Synthesis Bubble */}
            <div style={{
              borderRadius: 8, overflow: 'hidden',
              border: `1px solid ${single ? 'rgba(0,240,255,0.3)' : 'rgba(34,197,94,0.3)'}`,
              background: single
                ? 'linear-gradient(135deg, rgba(0,240,255,0.08) 0%, rgba(18,18,22,0.95) 100%)'
                : 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(18,18,22,0.95) 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              <div style={{
                padding: '8px 14px', background: 'rgba(20, 25, 22, 0.98)',
                borderBottom: `1px solid ${single ? 'rgba(0,240,255,0.2)' : 'rgba(34,197,94,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: single ? '#00F0FF' : '#22c55e',
                  fontSize: 11, fontWeight: 700
                }}>
                  <Sparkles size={13} />
                  <span>{single ? 'VQA & VISUAL GROUNDING SYNTHESIS' : 'SPATIAL REASONING SYNTHESIS'}</span>
                </div>
                {trace && (
                  <span style={{
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                    color: '#38bdf8', padding: '1px 6px', borderRadius: 3,
                    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                  }}>
                    {trace.latency_ms} ms · {(trace.confidence_score * 100).toFixed(1)}% CONF
                  </span>
                )}
              </div>

              <div style={{ padding: 14 }}>
                <p style={{
                  margin: 0, fontSize: 12, lineHeight: 1.7, color: '#f4f4f5',
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {textResponse}
                </p>
              </div>
            </div>

            {/* Extracted Key Metrics Grid */}
            {metrics && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 8,
              }}>
                {metrics.change_area_km2 !== undefined && (
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: '#121216', border: '1px solid #27272a' }}>
                    <div style={{ fontSize: 9, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>NET CHANGE</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      {metrics.change_area_km2} km² ({metrics.change_percentage}%)
                    </div>
                  </div>
                )}
                {metrics.water_t2_km2 !== undefined && (
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: '#121216', border: '1px solid #27272a' }}>
                    <div style={{ fontSize: 9, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>WATER CHANNEL</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      {metrics.water_t2_km2} km²
                    </div>
                  </div>
                )}
                {metrics.sandbar_t2_km2 !== undefined && (
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: '#121216', border: '1px solid #27272a' }}>
                    <div style={{ fontSize: 9, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>RIVERBED SAND</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      {metrics.sandbar_t2_km2} km²
                    </div>
                  </div>
                )}
                {metrics.builtup_km2 !== undefined && metrics.builtup_km2 > 0 && (
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: '#121216', border: '1px solid #27272a' }}>
                    <div style={{ fontSize: 9, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>BUILT-UP EXPANSION</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      +{metrics.builtup_km2} km²
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Neural Evidence Mask Button */}
            {visualArtifactUrl && (
              <div style={{
                padding: '10px 14px', borderRadius: 6,
                background: 'rgba(255,255,255,0.02)', border: '1px solid #27272a',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#fafafa' }}>
                  <Sparkles size={13} color="#f59e0b" />
                  <span>{single ? 'Visual Grounding Coordinate Mask' : 'BIT-CD Neural Evidence Mask Generated'}</span>
                </div>
                <button
                  onClick={onOpenModal}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 4,
                    background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b', fontSize: 10, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                  }}
                >
                  <Eye size={11} />
                  <span>VIEW FULL MASK</span>
                </button>
              </div>
            )}

            {/* Collapsible Agent Reasoning Chain */}
            {trace?.reasoning_steps?.length > 0 && (
              <div style={{ borderRadius: 6, border: '1px solid #27272a', background: '#0d0d12', overflow: 'hidden' }}>
                <button
                  onClick={() => setShowReasoning(prev => !prev)}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', color: '#a1a1aa', fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={12} color="#38bdf8" />
                    <span>Agent Reasoning Steps ({trace.reasoning_steps.length})</span>
                  </div>
                  <ChevronRight size={12} style={{ transform: showReasoning ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {showReasoning && (
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {trace.reasoning_steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'start', gap: 6, fontSize: 10, color: '#71717a', fontFamily: "'JetBrains Mono', monospace" }}>
                        <span style={{ color: '#38bdf8' }}>▸</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Raw Telemetry JSON */}
            <div style={{ borderRadius: 6, border: '1px solid #27272a', background: '#0d0d12', overflow: 'hidden' }}>
              <div style={{
                padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <button
                  onClick={() => setShowJsonTrace(prev => !prev)}
                  style={{
                    background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer', color: '#71717a', fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <FileText size={12} />
                  <span>Structured Observable Trace</span>
                  <ChevronRight size={12} style={{ transform: showJsonTrace ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                <button
                  onClick={copyJSON}
                  title="Copy Trace JSON"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#71717a', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
                  }}
                >
                  {copied ? <><Check size={11} color="#22c55e" /> <span style={{ color: '#22c55e' }}>Copied</span></>
                    : <><Copy size={11} /> <span>Copy</span></>}
                </button>
              </div>

              {showJsonTrace && (
                <pre style={{
                  margin: 0, padding: 12, borderTop: '1px solid #27272a',
                  background: '#070709', fontSize: 10, color: '#a1a1aa',
                  fontFamily: "'JetBrains Mono', monospace",
                  maxHeight: 220, overflow: 'auto', lineHeight: 1.5,
                }}>
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Empty Standby State */}
        {!textResponse && !isLoading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '36px 20px', color: '#71717a', textAlign: 'center', gap: 8,
          }}>
            <MessageSquare size={24} color="#3f3f46" />
            <span style={{ fontSize: 12, color: '#fafafa', fontWeight: 600 }}>
              {single ? 'GeoChat Vision-Language Specialist Active' : 'Autonomous Geospatial Analyst Ready'}
            </span>
            <span style={{ fontSize: 11, maxWidth: 320, lineHeight: 1.5 }}>
              {single
                ? 'Ask scene captioning questions, pinpoint bounding box coordinates, or survey land cover features.'
                : 'Choose a prompt chip below or type an AOI inquiry to analyze bitemporal surface shifts, riverbeds, and canopy dynamics.'}
            </span>
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Query Dock ── */}
      <div style={{
        padding: 12, background: 'rgba(15, 15, 18, 0.98)',
        borderTop: '1px solid #27272a', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Preset Chips */}
        {presets.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
            scrollbarWidth: 'none',
          }}>
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => { setQuery(p); onExecute(p); }}
                title={`Run query: "${p}"`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 4,
                  fontSize: 11, color: '#a1a1aa', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid #27272a', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: "'Inter', sans-serif", flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fafafa';
                  e.currentTarget.style.borderColor = single ? 'rgba(0,240,255,0.4)' : 'rgba(34,197,94,0.4)';
                  e.currentTarget.style.background = single ? 'rgba(0,240,255,0.08)' : 'rgba(34,197,94,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.borderColor = '#27272a';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <Play size={10} color={single ? '#00F0FF' : '#22c55e'} />
                <span>{p.length > 46 ? p.slice(0, 46) + '…' : p}</span>
              </button>
            ))}
          </div>
        )}

        {/* Query Input Row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onExecute(); } }}
              disabled={isLoading}
              placeholder={single
                ? "Ask GeoChat: Describe scene, ground buildings, locate riverbed..."
                : "Query riverbed changes, vegetative shifts, built-up growth..."}
              style={{
                width: '100%', height: 40, padding: '0 34px 0 12px', borderRadius: 5,
                background: '#070709', border: '1px solid #27272a',
                fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#fafafa',
                outline: 'none', transition: 'all 0.15s ease',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = single ? '#00F0FF' : '#22c55e';
                e.target.style.boxShadow = `0 0 0 1px ${single ? '#00F0FF' : '#22c55e'}`;
              }}
              onBlur={(e) => { e.target.style.borderColor = '#27272a'; e.target.style.boxShadow = 'none'; }}
            />
            {query && !isLoading && (
              <button
                onClick={() => setQuery('')}
                title="Clear input"
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#71717a', padding: 4, display: 'flex',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => onExecute()}
            disabled={isLoading || !query.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 18px', height: 40, borderRadius: 5,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              color: isLoading ? '#52525b' : '#09090b',
              background: isLoading ? '#27272a' : (single ? '#00F0FF' : '#22c55e'),
              border: `1px solid ${isLoading ? '#27272a' : (single ? '#00F0FF' : '#22c55e')}`,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isLoading ? 'none' : `0 0 14px ${single ? 'rgba(0,240,255,0.3)' : 'rgba(34,197,94,0.3)'}`,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.background = single ? '#38bdf8' : '#4ade80';
            }}
            onMouseLeave={(e) => {
              if (!isLoading) e.currentTarget.style.background = single ? '#00F0FF' : '#22c55e';
            }}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
            <span>{isLoading ? 'DISPATCHING' : 'SEND'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
