import React, { useState, useEffect } from 'react';
import { Cpu, Activity, Satellite, Radio, Shield, Globe, MessageSquare } from 'lucide-react';

export default function TacticalHeader({ activeScene, loraActive, bitCdActive, bitCdValAcc = 0.9469, isChatOpen, onToggleChat }) {
  const [utc, setUtc] = useState('');
  useEffect(() => {
    const t = () => setUtc(new Date().toISOString().replace('T', ' · ').slice(0, 22) + ' UTC');
    t(); const id = setInterval(t, 1000); return () => clearInterval(id);
  }, []);

  const sensorName = activeScene?.sensor || (activeScene?.mode === 'cross_modal' ? 'RISAT-1 SAR + Optical' : 'Sentinel-2 MSI (10m)');

  return (
    <header style={{
      height: 54, background: 'rgba(15, 15, 18, 0.96)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #27272a',
      boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', flexShrink: 0, zIndex: 30, position: 'relative',
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

        {/* Tactical Security Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 9px', borderRadius: 4,
          background: 'rgba(255,255,255,0.02)', border: '1px solid #27272a',
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#a1a1aa',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          <span style={{ letterSpacing: '0.06em', color: '#71717a' }}>DEFENSE INTEL:</span>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>READY</span>
        </div>
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

      {/* Right: Model Hardware Status & Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {bitCdActive && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 5,
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.35)', fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            boxShadow: '0 0 10px rgba(34,197,94,0.1)',
          }}>
            <Cpu size={13} color="#22c55e" />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>
              BIT-CD: {((bitCdValAcc || 0.9469) * 100).toFixed(1)}% Acc
            </span>
          </div>
        )}

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 5,
          background: 'rgba(24, 24, 27, 0.6)', border: '1px solid #27272a',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
        }}>
          <Cpu size={13} color={loraActive ? '#22c55e' : '#52525b'} />
          <span style={{ color: loraActive ? '#22c55e' : '#71717a', fontWeight: 600 }}>
            LoRA {loraActive ? 'Active' : 'Standby'}
          </span>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 5,
          background: '#09090b', border: '1px solid #27272a',
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#71717a',
        }}>
          <Activity size={12} color="#3b82f6" />
          <span>{utc}</span>
        </div>

        {/* Toggle Chat & Analysis Console Button */}
        <button
          onClick={onToggleChat}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 13px', borderRadius: 5,
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
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: isChatOpen ? '#22c55e' : 'rgba(255,255,255,0.06)',
            color: isChatOpen ? '#09090b' : '#a1a1aa',
          }}>
            {isChatOpen ? 'OPEN' : 'READY'}
          </span>
        </button>
      </div>
    </header>
  );
}
