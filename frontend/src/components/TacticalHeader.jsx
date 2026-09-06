import React, { useState, useEffect } from 'react';
import {
  Cpu, Activity, Satellite, Radio, Shield, Globe, MessageSquare,
  Server, Upload, CheckCircle2, AlertCircle, Loader2, X, ExternalLink
} from 'lucide-react';

export default function TacticalHeader({
  activeScene,
  loraActive,
  bitCdActive,
  bitCdValAcc = 0.9469,
  isChatOpen,
  onToggleChat,
  onOpenUploadModal,
  geochatUrl = '',
  onUpdateGeochatUrl
}) {
  const [utc, setUtc] = useState('');
  const [isGeochatModalOpen, setIsGeochatModalOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState(geochatUrl);
  const [isChecking, setIsChecking] = useState(false);
  const [geochatStatusMsg, setGeochatStatusMsg] = useState(null);
  const [isOnline, setIsOnline] = useState(Boolean(geochatUrl));

  useEffect(() => {
    const t = () => setUtc(new Date().toISOString().replace('T', ' · ').slice(0, 22) + ' UTC');
    t(); const id = setInterval(t, 1000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setInputUrl(geochatUrl);
    setIsOnline(Boolean(geochatUrl));
  }, [geochatUrl]);

  const sensorName = activeScene?.sensor || (activeScene?.mode === 'cross_modal' ? 'RISAT-1 SAR + Optical' : 'Sentinel-2 MSI (10m)');

  const handleSaveGeochat = async () => {
    setIsChecking(true);
    setGeochatStatusMsg(null);
    try {
      const res = await fetch('/api/config/geochat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsOnline(data.ping_ok);
        setGeochatStatusMsg({
          type: data.ping_ok ? 'success' : 'warning',
          text: data.message
        });
        if (onUpdateGeochatUrl) {
          onUpdateGeochatUrl(data.url);
        }
      }
    } catch (err) {
      setGeochatStatusMsg({
        type: 'error',
        text: 'Failed to communicate with SatQuery backend.'
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <>
      <header style={{
        height: 54, background: 'rgba(15, 15, 18, 0.96)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #27272a',
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', flexShrink: 0, zIndex: 30, position: 'relative',
      }}>
        {/* Brand & Classification Watermark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)',
              border: '1px solid rgba(34,197,94,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(34,197,94,0.2)',
            }}>
              <Satellite size={18} strokeWidth={2.2} color="#22c55e" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em' }}>
                  SatQuery<span style={{ color: '#22c55e' }}>.AI</span>
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                  color: '#22c55e', letterSpacing: '0.04em'
                }}>
                  PRO
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500, letterSpacing: '0.02em' }}>
                Autonomous Earth Observation Intelligence
              </span>
            </div>
          </div>

          <div style={{ height: 22, width: 1, background: '#27272a' }} />

          {/* Quick Action: Upload Rasters */}
          <button
            onClick={onOpenUploadModal}
            title="Upload Custom TIFF / GeoTIFF / PNG / JPEG Rasters"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 11px', borderRadius: 4,
              background: 'rgba(0, 240, 255, 0.1)', border: '1px solid rgba(0, 240, 255, 0.35)',
              color: '#00F0FF', fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,240,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,240,255,0.1)'; }}
          >
            <Upload size={12} />
            <span>UPLOAD RASTERS</span>
          </button>
        </div>

        {/* Center: Target Telemetry & Sensor Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 14px', borderRadius: 6,
          background: 'rgba(24, 24, 27, 0.7)', border: '1px solid #27272a',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        }}>
          <Radio size={12} color="#3b82f6" className="animate-pulse" />
          <span style={{ color: '#71717a' }}>TARGET:</span>
          <span style={{ color: '#fafafa', fontWeight: 600 }}>
            {activeScene?.location?.split(',')[0]?.trim() || 'Global Orbit'}
          </span>
          <span style={{ color: '#3f3f46' }}>|</span>
          <span style={{ color: '#38bdf8' }}>{activeScene?.crs || 'EPSG:32643'}</span>
          <span style={{ color: '#3f3f46' }}>|</span>
          <span style={{ color: '#a1a1aa', fontSize: 10 }}>{sensorName}</span>
        </div>

        {/* Right: Model Hardware Status, GeoChat Kaggle, Time, Chat Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* GeoChat Kaggle Remote Pill */}
          <button
            onClick={() => setIsGeochatModalOpen(true)}
            title="Configure GeoChat-7B Kaggle / Remote GPU endpoint"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 9px', borderRadius: 5,
              background: isOnline ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${isOnline ? 'rgba(34, 197, 94, 0.4)' : '#27272a'}`,
              fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              color: isOnline ? '#22c55e' : '#a1a1aa', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Server size={12} color={isOnline ? '#22c55e' : '#71717a'} />
            <span>GEOCHAT: {isOnline ? 'KAGGLE GPU' : 'STANDBY'}</span>
          </button>

          {bitCdActive && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 9px', borderRadius: 5,
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.35)', fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              boxShadow: '0 0 10px rgba(34,197,94,0.1)',
            }}>
              <Cpu size={12} color="#22c55e" />
              <span style={{ color: '#22c55e', fontWeight: 600 }}>
                BIT-CD: {((bitCdValAcc || 0.9469) * 100).toFixed(1)}% Acc
              </span>
            </div>
          )}

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 9px', borderRadius: 5,
            background: '#09090b', border: '1px solid #27272a',
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#71717a',
          }}>
            <Activity size={11} color="#3b82f6" />
            <span>{utc}</span>
          </div>

          {/* Toggle Chat & Analysis Console Button */}
          <button
            onClick={onToggleChat}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '5px 12px', borderRadius: 5,
              background: isChatOpen ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.08)',
              border: `1px solid ${isChatOpen ? '#22c55e' : 'rgba(34, 197, 94, 0.4)'}`,
              color: '#fafafa', fontSize: 11, fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer', transition: 'all 0.15s ease',
              boxShadow: isChatOpen ? '0 0 14px rgba(34,197,94,0.3)' : 'none',
            }}
            title={isChatOpen ? "Close Chat & Analysis Console" : "Open Chat & Analysis Console"}
          >
            <MessageSquare size={13} color="#22c55e" />
            <span>{isChatOpen ? 'CLOSE CONSOLE' : 'CHAT & ANALYSIS'}</span>
          </button>
        </div>
      </header>

      {/* ── GeoChat Kaggle Endpoint Config Modal ── */}
      {isGeochatModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(4, 4, 8, 0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, boxSizing: 'border-box',
        }}>
          <div style={{
            width: '100%', maxWidth: 560, background: '#0d0d12',
            border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: 8,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(34,197,94,0.15)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 18px', background: 'rgba(18, 18, 24, 0.98)',
              borderBottom: '1px solid #27272a', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={16} color="#22c55e" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
                  GeoChat-7B Kaggle / Remote GPU Integration
                </span>
              </div>
              <button
                onClick={() => setIsGeochatModalOpen(false)}
                style={{
                  background: 'transparent', border: 'none', color: '#71717a',
                  cursor: 'pointer', padding: 4, display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
                Connect your running Kaggle / Colab GeoChat instance by entering your public ngrok URL.
                SatQuery AI will route all Remote Sensing VQA queries directly to your GPU!
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#71717a' }}>
                  KAGGLE NGROK / API ENDPOINT URL
                </label>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://xxxx-xx-xx-xx.ngrok-free.app"
                  style={{
                    height: 38, padding: '0 12px', borderRadius: 5,
                    background: '#060609', border: '1px solid #27272a',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#fafafa',
                  }}
                />
              </div>

              {geochatStatusMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 5, fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: geochatStatusMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                  border: `1px solid ${geochatStatusMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  color: geochatStatusMsg.type === 'success' ? '#22c55e' : '#f59e0b',
                }}>
                  {geochatStatusMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{geochatStatusMsg.text}</span>
                </div>
              )}

              <div style={{
                padding: 12, borderRadius: 6, background: '#121216',
                border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fafafa' }}>
                  Quick Kaggle Setup:
                </span>
                <span style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5 }}>
                  1. Open Kaggle notebook with GPU T4 enabled.<br />
                  2. Run the script in <code style={{ color: '#38bdf8' }}>finetune/kaggle_geochat_server.py</code>.<br />
                  3. Copy the ngrok URL printed in Kaggle and paste it above!
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => { setInputUrl(''); handleSaveGeochat(); }}
                  style={{
                    padding: '8px 14px', borderRadius: 5, background: 'transparent',
                    border: '1px solid #27272a', color: '#a1a1aa', fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                  }}
                >
                  Clear URL (Use Local Engine)
                </button>
                <button
                  onClick={handleSaveGeochat}
                  disabled={isChecking}
                  style={{
                    padding: '8px 18px', borderRadius: 5, background: '#22c55e',
                    border: 'none', color: '#09090b', fontSize: 11, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", cursor: isChecking ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {isChecking ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>{isChecking ? 'VERIFYING...' : 'VERIFY & SAVE'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
