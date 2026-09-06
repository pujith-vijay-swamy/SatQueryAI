import React, { useState, useEffect, Component } from 'react';
import { MessageSquare } from 'lucide-react';
import TacticalHeader from './components/TacticalHeader';
import GlobeViewer from './components/GlobeViewer';
import ChatWorkbench from './components/ChatWorkbench';
import BitemporalModal from './components/BitemporalModal';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("SatQuery UI Error Boundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#18181b', color: '#ef4444', border: '1px solid #27272a', margin: 10, fontFamily: 'monospace' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>Component Rendering Error</h3>
          <p style={{ margin: 0, fontSize: 12 }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 10, padding: '4px 12px', background: '#27272a', color: '#fafafa', border: 'none', cursor: 'pointer' }}
          >
            Retry Component
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [scenes, setScenes] = useState({});
  const [activeScene, setActiveScene] = useState(null);
  const [preflightData, setPreflightData] = useState(null);
  const [query, setQuery] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loraActive, setLoraActive] = useState(false);
  const [bitCdActive, setBitCdActive] = useState(false);
  const [bitCdValAcc, setBitCdValAcc] = useState(0.9469);
  const [geochatUrl, setGeochatUrl] = useState('');

  // Layout & Modal states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBitemporalModalOpen, setIsBitemporalModalOpen] = useState(false);

  // ── Init ──
  useEffect(() => {
    (async () => {
      try {
        const [sRes, hRes, gRes] = await Promise.all([
          fetch('/api/scenes'),
          fetch('/api/health'),
          fetch('/api/config/geochat')
        ]);
        if (sRes.ok) {
          const d = await sRes.json();
          setScenes(d.scenes || {});
        }
        if (hRes.ok) {
          const hd = await hRes.json();
          setLoraActive(Boolean(hd.lora_adapter_present));
          setBitCdActive(Boolean(hd.bit_cd_model_present));
          if (hd.bit_cd_val_acc) setBitCdValAcc(hd.bit_cd_val_acc);
        }
        if (gRes.ok) {
          const gd = await gRes.json();
          if (gd.url) setGeochatUrl(gd.url);
        }
      } catch (e) { console.error('Init:', e); }
    })();
  }, []);

  // ── Scene change ──
  useEffect(() => {
    if (!activeScene) return;
    if (activeScene.sample_queries?.length) setQuery(activeScene.sample_queries[0]);
    (async () => {
      try {
        const r = await fetch(`/api/preflight/${activeScene.id}`);
        if (r.ok) setPreflightData(await r.json());
      } catch (e) { console.error('Preflight:', e); }
    })();
  }, [activeScene]);

  // ── Execute analysis ──
  const run = async (overrideQuery) => {
    const q = (typeof overrideQuery === 'string' ? overrideQuery : query).trim();
    if (!activeScene || !q) return;
    setIsLoading(true);
    setIsChatOpen(true);
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_id: activeScene.id, query: q }),
      });
      if (r.ok) setAnalysisResult(await r.json());
    } catch (e) { console.error('Analyze:', e); }
    finally { setIsLoading(false); }
  };

  // ── Handle Custom Raster Upload Success ──
  const handleCustomUploadSuccess = (uploadData) => {
    if (uploadData.scene) {
      setScenes(prev => ({ ...prev, [uploadData.scene.id]: uploadData.scene }));
      setActiveScene(uploadData.scene);
    }
    if (uploadData.preflight) setPreflightData(uploadData.preflight);
    if (uploadData.analysis) setAnalysisResult(uploadData.analysis);
    setIsChatOpen(true);
  };

  // ── On-demand temporal swath tasking (Sentinel-2 COGs) ──
  const handleTaskSwath = async ({ lat, lon, t1_year, t2_year, radius_km, max_cloud, season }) => {
    setIsChatOpen(true);
    setIsLoading(true);
    try {
      const r = await fetch('/api/swath/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lon,
          t1_year: parseInt(t1_year),
          t2_year: parseInt(t2_year),
          radius_km: parseFloat(radius_km),
          max_cloud: parseFloat(max_cloud || 20.0),
          season: season || 'any',
          auto_analyze: true
        }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.scene) {
          setScenes(prev => ({ ...prev, [d.scene.id]: d.scene }));
          setActiveScene(d.scene);
        }
        if (d.preflight) setPreflightData(d.preflight);
        if (d.analysis) setAnalysisResult(d.analysis);
      }
    } catch (e) {
      console.error('Task swath error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#09090b', color: '#fafafa' }}>
      <ErrorBoundary>
        <TacticalHeader
          activeScene={activeScene}
          loraActive={loraActive}
          bitCdActive={bitCdActive}
          bitCdValAcc={bitCdValAcc}
          isChatOpen={isChatOpen}
          onToggleChat={() => setIsChatOpen(prev => !prev)}
          onOpenUploadModal={() => setIsBitemporalModalOpen(true)}
          geochatUrl={geochatUrl}
          onUpdateGeochatUrl={(url) => setGeochatUrl(url)}
        />
      </ErrorBoundary>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* ── 3D Earth Globe: Initially Fullscreen, contracts gracefully when chat opened ── */}
        <div style={{
          flex: isChatOpen ? '1 1 54%' : '1 1 100%',
          height: '100%', position: 'relative',
          borderRight: isChatOpen ? '1px solid #27272a' : 'none',
          transition: 'flex 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <ErrorBoundary>
            <GlobeViewer
              activeScene={activeScene}
              onSelectScene={(s) => {
                setActiveScene(s);
                setAnalysisResult(null);
                setIsChatOpen(true);
              }}
              scenes={scenes}
              onTaskSwath={handleTaskSwath}
            />
          </ErrorBoundary>

          {/* Floating Drawer Tab Toggle when Chat is closed */}
          {!isChatOpen && (
            <button
              onClick={() => setIsChatOpen(true)}
              title="Open SatQuery Chat & Analysis Console"
              style={{
                position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                zIndex: 25,
                background: 'rgba(15, 15, 20, 0.95)',
                border: '1px solid #22c55e',
                borderRight: 'none',
                borderRadius: '8px 0 0 8px',
                padding: '12px 8px',
                color: '#22c55e',
                cursor: 'pointer',
                boxShadow: '-4px 0 20px rgba(0,0,0,0.6), 0 0 15px rgba(34,197,94,0.25)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                backdropFilter: 'blur(16px)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(15, 15, 20, 0.95)'; }}
            >
              <MessageSquare size={16} color="#22c55e" />
              <span style={{
                writingMode: 'vertical-rl', textOrientation: 'mixed',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', color: '#fafafa',
              }}>
                CHAT & ANALYSIS
              </span>
            </button>
          )}
        </div>

        {/* ── Slide-Out Organized Chat & Analysis Console ── */}
        {isChatOpen && (
          <div style={{
            flex: '1 1 46%', minWidth: 380, maxWidth: 640, height: '100%',
            display: 'flex', flexDirection: 'column',
            background: '#0a0a0e', zIndex: 10,
            boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
          }}>
            <ErrorBoundary>
              <ChatWorkbench
                activeScene={activeScene}
                preflightData={preflightData}
                analysisResult={analysisResult}
                isLoading={isLoading}
                query={query}
                setQuery={setQuery}
                onExecute={run}
                onClose={() => setIsChatOpen(false)}
                onOpenModal={() => setIsBitemporalModalOpen(true)}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* ── High-Resolution Bitemporal Popup Modal (1:1 Exact Resolution & Upload Workspace) ── */}
      <BitemporalModal
        isOpen={isBitemporalModalOpen}
        onClose={() => setIsBitemporalModalOpen(false)}
        activeScene={activeScene}
        visualArtifactUrl={analysisResult?.visual_artifact_url}
        analysisResult={analysisResult}
        onCustomUploadSuccess={handleCustomUploadSuccess}
      />
    </div>
  );
}
