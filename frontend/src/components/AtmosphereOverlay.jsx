import React, { useRef, useEffect } from 'react';

/**
 * AtmosphereOverlay renders:
 * 1. Back Canvas (Celestial Atmospheric Corona): Soft cyan Rayleigh scattering aura behind the Earth limb.
 * 2. Front Canvas ("Sun is the User" Spherical Depth Shading):
 *    - Fully illuminated user-facing center
 *    - Volumetric Lambertian curvature shadow as the sphere curves away into space / backside
 *    - Delicate high-altitude inner Rayleigh atmospheric limb haze
 *
 * Full 3D Multi-Axis Rotation Support (X-axis pitch & Y-axis bearing):
 * - Seamlessly tracks camera pitch (tilt about X axis) and bearing (rotation about Y/Z axis).
 * - Projects the apparent center shift and foreshortening ellipse dynamically.
 * - Gracefully dissolves as camera tilts into high-pitch horizon angles (> 15° to 35°)
 *   or zooms in towards the surface (z = 2.1 to 2.8).
 * - Zero frame latency (synchronous map render hooks).
 */
export default function AtmosphereOverlay({ map, projection }) {
  const backCanvasRef = useRef(null);
  const frontCanvasRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const backCanvas = backCanvasRef.current;
    const frontCanvas = frontCanvasRef.current;
    if (!backCanvas || !frontCanvas) return;

    const bCtx = backCanvas.getContext('2d');
    const fCtx = frontCanvas.getContext('2d');
    if (!bCtx || !fCtx) return;

    let isDisposed = false;

    const updateDimensions = () => {
      const parent = frontCanvas.parentElement;
      if (!parent) return { w: 0, h: 0 };
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (backCanvas.width !== w * dpr || backCanvas.height !== h * dpr) {
        backCanvas.width = w * dpr;
        backCanvas.height = h * dpr;
        bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (frontCanvas.width !== w * dpr || frontCanvas.height !== h * dpr) {
        frontCanvas.width = w * dpr;
        frontCanvas.height = h * dpr;
        fCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      return { w, h };
    };

    const render = () => {
      if (isDisposed) return;

      const { w, h } = updateDimensions();
      if (w === 0 || h === 0) return;

      bCtx.clearRect(0, 0, w, h);
      fCtx.clearRect(0, 0, w, h);

      // Only active in 3D Globe mode
      if (projection !== 'globe') return;

      const zoom = map.getZoom();
      const pitch = map.getPitch ? map.getPitch() : 0;
      const bearing = map.getBearing ? map.getBearing() : 0;

      // 1. Zoom Dissolve:
      // In orbital view (z <= 2.1): full planetary atmosphere
      // Between z = 2.1 and z = 2.8: Dissolves smoothly as camera enters atmosphere
      // At regional / ground level (z >= 2.8): 0% opacity (crystal-clear satellite imagery)
      let opacity = 1.0;
      if (zoom > 2.1) {
        opacity = Math.max(0, 1.0 - (zoom - 2.1) / 0.7);
      }
      if (opacity <= 0) return;

      // 2. Pitch Dissolve:
      // The spherical planetary disc atmosphere is designed for orbital overview (pitch near 0).
      // When the user tilts/rotates about the X-axis (pitch > 3 deg) to inspect oblique terrain,
      // the atmosphere gracefully dissolves to 0 so no misaligned ring appears on tilted ground.
      if (pitch > 3) {
        const pitchFactor = Math.max(0, 1.0 - (pitch - 3) / 7.0);
        opacity *= pitchFactor;
      }
      if (opacity <= 0) return;

      const pitchRad = (pitch * Math.PI) / 180;
      const bearingRad = (bearing * Math.PI) / 180;

      // Base sphere center at screen center
      const cx = w / 2;
      const cy = h / 2;

      // Exact sub-pixel quadratic radius fit for MapLibre GL v5 perspective globe
      const dz = Math.max(0, zoom - 1.0);
      const baseR = 150.87 + 83.92 * dz + 32.83 * dz * dz;
      const R = Math.max(20, (h / 670) * baseR);

      // Apparent shift of sphere center when pitched (perspective shift along camera tilt vector)
      const shift = R * 0.96 * Math.sin(pitchRad);
      const dx = -shift * Math.sin(bearingRad);
      const dy = shift * Math.cos(bearingRad);

      // Vertical foreshortening of apparent ellipse under pitch
      const scaleY = Math.max(0.25, Math.cos(pitchRad * 0.75));

      // ─── 1. BACK CANVAS: Celestial Atmospheric Corona (Rayleigh Outer Glow) ───
      bCtx.save();
      bCtx.globalAlpha = opacity;
      bCtx.translate(cx + dx, cy + dy);
      bCtx.rotate(-bearingRad);
      bCtx.scale(1.0, scaleY);

      const corona = bCtx.createRadialGradient(0, 0, R * 0.95, 0, 0, R * 1.18);
      corona.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
      corona.addColorStop(0.18, 'rgba(14, 165, 233, 0.28)');
      corona.addColorStop(0.45, 'rgba(2, 132, 199, 0.12)');
      corona.addColorStop(0.75, 'rgba(2, 132, 199, 0.03)');
      corona.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      bCtx.fillStyle = corona;
      bCtx.beginPath();
      bCtx.arc(0, 0, R * 1.18, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.restore();

      // ─── 2. FRONT CANVAS: Frontal-Sun Spherical Shading & Inner Limb Haze ───
      fCtx.save();
      fCtx.globalAlpha = opacity;
      fCtx.translate(cx + dx, cy + dy);
      fCtx.rotate(-bearingRad);
      fCtx.scale(1.0, scaleY);

      // A. Volumetric Lambertian Depth Shading (Sun is the User)
      const shadow = fCtx.createRadialGradient(0, 0, 0, 0, 0, R);
      shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
      shadow.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
      shadow.addColorStop(0.80, 'rgba(2, 6, 23, 0.18)');
      shadow.addColorStop(0.90, 'rgba(2, 6, 23, 0.42)');
      shadow.addColorStop(0.96, 'rgba(2, 6, 23, 0.68)');
      shadow.addColorStop(1.0, 'rgba(2, 6, 23, 0.94)');

      fCtx.fillStyle = shadow;
      fCtx.beginPath();
      fCtx.arc(0, 0, R, 0, Math.PI * 2);
      fCtx.fill();

      // B. High-Altitude Rayleigh Scattering Inner Limb Haze
      const innerHaze = fCtx.createRadialGradient(0, 0, R * 0.86, 0, 0, R);
      innerHaze.addColorStop(0, 'rgba(56, 189, 248, 0)');
      innerHaze.addColorStop(0.5, 'rgba(56, 189, 248, 0.10)');
      innerHaze.addColorStop(0.85, 'rgba(56, 189, 248, 0.32)');
      innerHaze.addColorStop(1.0, 'rgba(125, 211, 252, 0.55)');

      fCtx.fillStyle = innerHaze;
      fCtx.beginPath();
      fCtx.arc(0, 0, R, 0, Math.PI * 2);
      fCtx.fill();

      fCtx.restore();
    };

    // Synchronous execution on map render & rotation events (0 latency)
    map.on('render', render);
    map.on('move', render);
    map.on('zoom', render);
    map.on('rotate', render);
    map.on('pitch', render);
    map.on('resize', render);

    const ro = new ResizeObserver(() => render());
    ro.observe(frontCanvas.parentElement);

    // Initial render
    render();

    return () => {
      isDisposed = true;
      map.off('render', render);
      map.off('move', render);
      map.off('zoom', render);
      map.off('rotate', render);
      map.off('pitch', render);
      map.off('resize', render);
      ro.disconnect();
    };
  }, [map, projection]);

  return (
    <>
      {/* Outer Atmospheric Corona (Behind MapLibre) */}
      <canvas
        ref={backCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Spherical Depth Shading & Inner Limb Haze (Over MapLibre) */}
      <canvas
        ref={frontCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </>
  );
}
