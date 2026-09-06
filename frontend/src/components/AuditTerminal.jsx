import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Copy, Check, ChevronRight, Activity, Clock, ShieldCheck, Sparkles } from 'lucide-react';

export default function AuditTerminal({ analysisResult, isLoading }) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);
  const trace = analysisResult?.execution_trace;
  const text = analysisResult?.text_response;

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

  return (
    <div style={{
      background: 'rgba(24, 24, 27, 0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid #27272a',
      borderRadius: 6,
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 180, overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid #27272a', background: 'rgba(20, 20, 22, 0.98)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Terminal size={13} color="#22c55e" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fafafa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Observable Execution Trace
          </span>
          <span style={{ fontSize: 10, color: '#52525b', fontFamily: "'JetBrains Mono', monospace" }}>
            · AUDIT LOG
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {trace && (
            <>
              <span style={{
                padding: '3px 9px', borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)',
                background: 'rgba(56,189,248,0.08)', fontWeight: 600,
              }}>
                {trace.latency_ms} ms
              </span>
              <span style={{
                padding: '3px 9px', borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)',
                background: 'rgba(34,197,94,0.08)', fontWeight: 600,
              }}>
                {(trace.confidence_score * 100).toFixed(1)}% CONF
              </span>
            </>
          )}
          <button
            onClick={copyJSON}
            disabled={!analysisResult}
            title="Copy Raw JSON"
            style={{
              padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.02)',
              border: '1px solid #27272a', cursor: analysisResult ? 'pointer' : 'default',
              color: '#a1a1aa', display: 'flex', transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { if (analysisResult) { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#fafafa'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
          >
            {copied ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {isLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '24px 0', color: '#22c55e',
          }}>
            <Activity size={16} className="animate-pulse" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500 }}>
              Agentic routing & multi-modal inference pipeline running…
            </span>
          </div>
        )}

        {text && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Response */}
            <div style={{
              borderLeft: '3px solid #22c55e', borderRadius: '0 6px 6px 0', padding: '12px 16px',
              background: 'linear-gradient(90deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.01) 100%)',
              borderTop: '1px solid rgba(34,197,94,0.15)',
              borderRight: '1px solid rgba(34,197,94,0.15)',
              borderBottom: '1px solid rgba(34,197,94,0.15)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#22c55e',
                letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Sparkles size={12} color="#22c55e" />
                Spatial Reasoning Synthesis
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: '#f4f4f5', margin: 0, fontFamily: "'Inter', sans-serif" }}>
                {text}
              </p>
            </div>

            {/* Reasoning steps */}
            {trace?.reasoning_steps?.length > 0 && (
              <div style={{
                padding: '12px 14px', background: 'rgba(255,255,255,0.015)',
                border: '1px solid #27272a', borderRadius: 6,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#71717a',
                  letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase',
                }}>
                  Agent Reasoning Chain
                </div>
                {trace.reasoning_steps.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'start', gap: 7, marginBottom: 5,
                  }}>
                    <ChevronRight size={13} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                      color: '#a1a1aa', lineHeight: 1.5,
                    }}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* JSON */}
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#71717a',
                letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase',
              }}>
                Structured Observable Trace
              </div>
              <pre style={{
                margin: 0, padding: 14, borderRadius: 6,
                background: '#09090b', border: '1px solid #27272a',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                color: '#a1a1aa', lineHeight: 1.6,
                overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {!analysisResult && !isLoading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', minHeight: 130,
            color: '#52525b', textAlign: 'center', gap: 8,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: 'rgba(255,255,255,0.02)', border: '1px solid #27272a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Terminal size={22} color="#71717a" />
            </div>
            <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>
              Standby for Agent Query Dispatch
            </span>
            <span style={{ fontSize: 11, color: '#52525b', maxWidth: 320, lineHeight: 1.5 }}>
              Select a suggested prompt or submit a custom geospatial query to observe real-time execution telemetry.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
