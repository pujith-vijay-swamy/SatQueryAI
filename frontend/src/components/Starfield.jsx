import React, { useRef, useEffect } from 'react';

export default function Starfield({ active = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = 0;
    let height = 0;

    const STAR_COUNT = 320;
    const colors = ['#ffffff', '#ffffff', '#c7d2fe', '#bae6fd', '#a5f3fc', '#fef08a'];

    // Generate fixed star seeds
    const stars = Array.from({ length: STAR_COUNT }, () => {
      const isBright = Math.random() < 0.05;
      return {
        x: Math.random(),
        y: Math.random(),
        r: isBright ? (Math.random() * 0.8 + 1.6) : (Math.random() * 0.9 + 0.6),
        baseAlpha: Math.random() * 0.4 + 0.5,
        twinkleSpeed: Math.random() * 1.5 + 0.8,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        isBright
      };
    });

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    let startTime = performance.now();

    const render = (now) => {
      if (!active) {
        animId = requestAnimationFrame(render);
        return;
      }
      const elapsed = (now - startTime) * 0.001;

      ctx.clearRect(0, 0, width, height);

      // 1. Deep Space Cosmic Background
      const bgGrad = ctx.createRadialGradient(
        width * 0.5, height * 0.5, Math.min(width, height) * 0.2,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.8
      );
      bgGrad.addColorStop(0, '#0a0a0f');
      bgGrad.addColorStop(0.6, '#06060a');
      bgGrad.addColorStop(1, '#020204');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle Galactic Nebula clouds
      const nebula1 = ctx.createRadialGradient(width * 0.2, height * 0.25, 10, width * 0.2, height * 0.25, width * 0.45);
      nebula1.addColorStop(0, 'rgba(30, 58, 138, 0.08)');
      nebula1.addColorStop(0.7, 'rgba(6, 78, 59, 0.03)');
      nebula1.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const nebula2 = ctx.createRadialGradient(width * 0.8, height * 0.75, 10, width * 0.8, height * 0.75, width * 0.4);
      nebula2.addColorStop(0, 'rgba(67, 24, 255, 0.05)');
      nebula2.addColorStop(0.6, 'rgba(14, 165, 233, 0.02)');
      nebula2.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Twinkling Stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const px = s.x * width;
        const py = s.y * height;
        const flicker = Math.sin(elapsed * s.twinkleSpeed + s.phase);
        const alpha = Math.max(0.15, Math.min(1.0, s.baseAlpha + flicker * 0.35));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;

        // Draw star core
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle diffraction cross spikes for bright stars
        if (s.isBright) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          const spike = s.r * 2.8;
          ctx.moveTo(px - spike, py);
          ctx.lineTo(px + spike, py);
          ctx.moveTo(px, py - spike);
          ctx.lineTo(px, py + spike);
          ctx.stroke();

          // Soft glow halo
          ctx.globalAlpha = alpha * 0.25;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
