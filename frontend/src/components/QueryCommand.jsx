import React from 'react';
import { Send, Loader2, Sparkles, Terminal, CornerDownLeft, X, Play } from 'lucide-react';

export default function QueryCommand({ query, setQuery, onExecute, isLoading, activeScene }) {
  const presets = activeScene?.sample_queries || [];

  const handleChipClick = (p) => {
    setQuery(p);
    if (onExecute) onExecute(p);
  };

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
        padding: '8px 14px', borderBottom: '1px solid #27272a', background: 'rgba(20, 20, 22, 0.98)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Terminal size={13} color="#22c55e" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fafafa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Natural Language Geospatial Query
          </span>
          <span style={{ fontSize: 10, color: '#52525b', fontFamily: "'JetBrains Mono', monospace" }}>
            · LLM ROUTED
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 4,
          fontSize: 9, color: '#71717a', background: 'rgba(255,255,255,0.03)',
          border: '1px solid #27272a', fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span>PRESS</span>
          <CornerDownLeft size={10} color="#22c55e" />
          <span style={{ color: '#22c55e', fontWeight: 600 }}>ENTER</span>
        </div>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Presets */}
        {presets.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => handleChipClick(p)}
                title={`Click to immediately run: "${p}"`}
                style={{
                  padding: '5px 10px', borderRadius: 4, fontSize: 11, color: '#a1a1aa',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid #27272a',
                  cursor: 'pointer', textAlign: 'left', maxWidth: '100%',
                  fontFamily: "'Inter', sans-serif",
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fafafa';
                  e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)';
                  e.currentTarget.style.background = 'rgba(34,197,94,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.borderColor = '#27272a';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                <Play size={10} color="#22c55e" style={{ flexShrink: 0 }} />
                <span>{p.length > 68 ? p.slice(0, 68) + '…' : p}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input & Dispatch Button (Fluid Responsive Row) */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onExecute(); } }}
              disabled={isLoading}
              placeholder="Query riverbed changes, vegetative shifts, built-up growth..."
              style={{
                width: '100%', height: 42, padding: '0 36px 0 14px', borderRadius: 5,
                background: '#09090b', border: '1px solid #27272a',
                fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#fafafa',
                outline: 'none', transition: 'all 0.15s ease',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.boxShadow = '0 0 0 1px #22c55e, inset 0 1px 2px rgba(0,0,0,0.5)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#27272a'; e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.5)'; }}
            />
            {query && !isLoading && (
              <button
                onClick={() => setQuery('')}
                title="Clear query input"
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#71717a', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => onExecute()}
            disabled={isLoading || !query.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '0 20px', height: 42, flexShrink: 0, borderRadius: 5,
              fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              color: isLoading ? '#52525b' : '#09090b',
              background: isLoading ? '#27272a' : '#22c55e',
              border: `1px solid ${isLoading ? '#27272a' : '#22c55e'}`,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isLoading ? 'none' : '0 0 16px rgba(34,197,94,0.3)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.background = '#4ade80'; } }}
            onMouseLeave={(e) => { if (!isLoading) { e.currentTarget.style.background = '#22c55e'; } }}
          >
            {isLoading ? <><Loader2 size={15} className="animate-spin" /> DISPATCHING…</>
              : <><Send size={13} /> DISPATCH AGENT</>}
          </button>
        </div>
      </div>
    </div>
  );
}
