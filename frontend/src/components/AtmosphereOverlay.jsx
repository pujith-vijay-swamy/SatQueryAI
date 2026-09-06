import React, { useRef, useEffect } from 'react';

/**
 * AtmosphereOverlay renders:
 * 1. Back Canvas (Celestial Atmospheric Corona): Soft cyan Rayleigh scattering aura behind the Earth limb.
 * 2. Front Canvas ("Sun is the User" Spherical Depth Shading):
 *    - Fully illuminated user-facing center
 *    - Volumetric Lambertian curvature shadow as the sphere curves away into space / backside
 *    - Delicate high-altitude inner Rayleigh atmospheric limb haze
 *
 * Projection-Locked via Spherical Geodesy:
 *   We project the map center and 8 limb probe points computed with proper great-circle
 *   destination formulas through map.project(). This handles poles, pitch, bearing, zoom,
 *   and viewport resize with zero drift — the atmosphere is mathematically locked to
 *   MapLibre's internal perspective engine.
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

    /**
     * Spherical geodesy: compute the destination point on the unit sphere given
     * a start (lat, lng) in degrees, a bearing in degrees, and an angular
     * distance in degrees. Returns {lat, lng} in degrees.
     *
     * This is the Vincenty direct formula and works correctly at ALL latitudes,
     * including poles where simple lat/lng offsets fail.
     */
    const destinationPoint = (lat, lng, bearingDeg, angDistDeg) => {
      const toRad = Math.PI / 180;
      const toDeg = 180 / Math.PI;
      const φ1 = lat * toRad;
      const λ1 = lng * toRad;
      const θ = bearingDeg * toRad;
      const δ = angDistDeg * toRad;

      const sinφ1 = Math.sin(φ1);
      const cosφ1 = Math.cos(φ1);
      const sinδ = Math.sin(δ);
      const cosδ = Math.cos(δ);

      const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ));
      const λ2 = λ1 + Math.atan2(
        Math.sin(θ) * sinδ * cosφ1,
        cosδ - sinφ1 * Math.sin(φ2)
      );

      return {
        lat: φ2 * toDeg,
        lng: ((λ2 * toDeg) + 540) % 360 - 180  // Normalize to [-180, 180]
      };
    };

    /**
     * Compute the screen-space center and radius of the globe disc.
     *
     * Projects the map center, then 8 probe points at 80° great-circle distance
     * along bearings 0°, 45°, 90°, …, 315° using proper spherical geodesy.
     * These probes sit near the visible limb of the globe regardless of which
     * part of the Earth is centered (equator, pole, or anything in between).
     * The average screen distance from center to valid probes gives R.
     */
    const computeGlobeScreenGeometry = (w, h) => {
      try {
        const center = map.getCenter();
        const cLat = center.lat;
        const cLng = center.lng;

        // Project the geographic center to screen coordinates
        const screenCenter = map.project([cLng, cLat]);
        const cx = screenCenter.x;
        const cy = screenCenter.y;

        if (!isFinite(cx) || !isFinite(cy)) return null;

        // Probe at 80° great-circle distance along 8 compass bearings
        const probeAngularDist = 80; // degrees of arc on the sphere
        const bearings = [0, 45, 90, 135, 180, 225, 270, 315];

        const distances = [];
        for (const brg of bearings) {
          const dest = destinationPoint(cLat, cLng, brg, probeAngularDist);
          const p = map.project([dest.lng, dest.lat]);

          if (p && isFinite(p.x) && isFinite(p.y)) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Sanity: reject impossibly small or impossibly large results
            if (dist > 5 && dist < Math.max(w, h) * 3) {
              distances.push(dist);
            }
          }
        }

        // Need at least 3 valid probes for reliable radius
        if (distances.length < 3) return null;

        // Use the median of distances for robustness against outliers
        distances.sort((a, b) => a - b);
        const mid = Math.floor(distances.length / 2);
        const medianDist = distances.length % 2 === 0
          ? (distances[mid - 1] + distances[mid]) / 2
          : distances[mid];

        // The probes are at 80° arc distance. On the projected disc, 80° from
        // center maps to R * sin(80°) ≈ R * 0.9848 of the full globe radius R.
        // So R = medianDist / sin(80°).
        const R = medianDist / Math.sin(80 * Math.PI / 180);

        return { cx, cy, R };
      } catch (e) {
        return null;
      }
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

      // Zoom Dissolve: orbital (z <= 2.1) full, transition (2.1–2.8), ground (>= 2.8) hidden
      let opacity = 1.0;
      if (zoom > 2.1) {
        opacity = Math.max(0, 1.0 - (zoom - 2.1) / 0.7);
      }
      if (opacity <= 0) return;

      // Compute actual screen geometry from MapLibre's projection
      const geo = computeGlobeScreenGeometry(w, h);
      if (!geo) return;

      const { cx, cy, R } = geo;

      // Safety: if radius is too small or center is way off screen, skip
      if (R < 15 || cx < -R * 2 || cx > w + R * 2 || cy < -R * 2 || cy > h + R * 2) return;

      // ─── 1. BACK CANVAS: Celestial Atmospheric Corona (Rayleigh Outer Glow) ───
      bCtx.save();
      bCtx.globalAlpha = opacity;

      const corona = bCtx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.18);
      corona.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
      corona.addColorStop(0.18, 'rgba(14, 165, 233, 0.28)');
      corona.addColorStop(0.45, 'rgba(2, 132, 199, 0.12)');
      corona.addColorStop(0.75, 'rgba(2, 132, 199, 0.03)');
      corona.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      bCtx.fillStyle = corona;
      bCtx.beginPath();
      bCtx.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.restore();

      // ─── 2. FRONT CANVAS: Frontal-Sun Spherical Shading & Inner Limb Haze ───
      fCtx.save();
      fCtx.globalAlpha = opacity;

      // A. Volumetric Lambertian Depth Shading (Sun is the User)
      const shadow = fCtx.createRadialGradient(cx, cy, 0, cx, cy, R);
      shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
      shadow.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
      shadow.addColorStop(0.80, 'rgba(2, 6, 23, 0.18)');
      shadow.addColorStop(0.90, 'rgba(2, 6, 23, 0.42)');
      shadow.addColorStop(0.96, 'rgba(2, 6, 23, 0.68)');
      shadow.addColorStop(1.0, 'rgba(2, 6, 23, 0.94)');

      fCtx.fillStyle = shadow;
      fCtx.beginPath();
      fCtx.arc(cx, cy, R, 0, Math.PI * 2);
      fCtx.fill();

      // B. High-Altitude Rayleigh Scattering Inner Limb Haze
      const innerHaze = fCtx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
      innerHaze.addColorStop(0, 'rgba(56, 189, 248, 0)');
      innerHaze.addColorStop(0.5, 'rgba(56, 189, 248, 0.10)');
      innerHaze.addColorStop(0.85, 'rgba(56, 189, 248, 0.32)');
      innerHaze.addColorStop(1.0, 'rgba(125, 211, 252, 0.55)');

      fCtx.fillStyle = innerHaze;
      fCtx.beginPath();
      fCtx.arc(cx, cy, R, 0, Math.PI * 2);
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
