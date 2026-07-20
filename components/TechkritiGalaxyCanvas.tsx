'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  radius: number;
  angle: number;
  speed: number;
  yOffset: number;
  size: number;
  color: string;
  alpha: number;
  baseAlpha: number;
  isMainRing: boolean;
}

export default function TechkritiGalaxyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Color palettes matching exact Techkriti screenshot:
    // Bright cream/gold/white for dense ring, lavender/purple/blue for outer halo
    const ringColors = ['#ffffff', '#fffbeb', '#fef08a', '#fbcfe8', '#f472b6'];
    const haloColors = ['#e9d5ff', '#c084fc', '#a855f7', '#9333ea', '#93c5fd', '#818cf8'];

    const particleCount = width < 768 ? 1400 : 2600;
    const particles: Particle[] = [];

    const minDimension = Math.min(width, height);
    const ringBaseRadius = minDimension * 0.28; // Ring Radius
    const ringBandWidth = minDimension * 0.08;  // Thickness of dense ring

    for (let i = 0; i < particleCount; i++) {
      const isMainRing = i < particleCount * 0.55; // 55% dense ring, 45% outer halo

      let radius: number;
      let color: string;
      let size: number;
      let alpha: number;
      let yOffset: number;
      let speed: number;

      if (isMainRing) {
        // Gaussian-like concentration along the hollow ring circumference
        const spread = (Math.random() - 0.5) * ringBandWidth;
        radius = ringBaseRadius + spread;
        color = ringColors[Math.floor(Math.random() * ringColors.length)];
        size = Math.random() < 0.12 ? Math.random() * 2.4 + 1.4 : Math.random() * 1.3 + 0.6;
        alpha = Math.random() * 0.75 + 0.25;
        yOffset = (Math.random() - 0.5) * 22; // Thin vertical profile
        speed = 0.0012 + Math.random() * 0.0006;
      } else {
        // Outer halo & background field fading outwards
        const distFactor = Math.pow(Math.random(), 0.5);
        radius = ringBaseRadius + 20 + distFactor * (minDimension * 0.55);
        color = haloColors[Math.floor(Math.random() * haloColors.length)];
        size = Math.random() < 0.08 ? Math.random() * 2.0 + 1.0 : Math.random() * 1.2 + 0.4;
        alpha = Math.random() * 0.5 + 0.15;
        yOffset = (Math.random() - 0.5) * (40 + distFactor * 60);
        speed = (0.0004 + Math.random() * 0.0008) * (Math.random() < 0.5 ? 1 : -1);
      }

      particles.push({
        radius,
        angle: Math.random() * Math.PI * 2,
        speed,
        yOffset,
        size,
        color,
        alpha,
        baseAlpha: alpha,
        isMainRing
      });
    }

    // 3D Tilt parameters (Exact Techkriti ~58° tilt angle on X-axis)
    const tiltAngleX = Math.PI * 0.32;
    const cosTilt = Math.cos(tiltAngleX);
    const sinTilt = Math.sin(tiltAngleX);

    let mouseX = 0;
    let mouseY = 0;
    let targetRotY = 0;
    let currentRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - width / 2) / (width / 2);
      mouseY = (e.clientY - height / 2) / (height / 2);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    const render = () => {
      // Solid pitch black background (No center glow overlay so center stays hollow!)
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 650;

      // Smooth 3D Y-axis rotation
      targetRotY += 0.002;
      currentRotY += (targetRotY + mouseX * 0.15 - currentRotY) * 0.04;

      const cosRotY = Math.cos(currentRotY);
      const sinRotY = Math.sin(currentRotY);

      // Project particles into 3D perspective
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.speed;
        
        // Subtle twinkling opacity
        p.alpha = p.baseAlpha + Math.sin(p.angle * 6) * 0.15;
        const currentAlpha = Math.max(0.1, Math.min(1, p.alpha));

        // 1. Coordinates on ring plane
        const x0 = p.radius * Math.cos(p.angle);
        const z0 = p.radius * Math.sin(p.angle);
        const y0 = p.yOffset;

        // 2. Y-axis spin rotation
        const x1 = x0 * cosRotY - z0 * sinRotY;
        const z1 = x0 * sinRotY + z0 * cosRotY;

        // 3. X-axis 3D tilt rotation
        const y2 = y0 * cosTilt - z1 * sinTilt;
        const z2 = y0 * sinTilt + z1 * cosTilt;

        // 4. Perspective Projection
        const scale = fov / (fov + z2 + 450);
        const projX = centerX + x1 * scale;
        const projY = centerY + (y2 + mouseY * 25) * scale;

        if (projX >= -30 && projX <= width + 30 && projY >= -30 && projY <= height + 30) {
          projected.push({
            x: projX,
            y: projY,
            size: Math.max(0.3, p.size * scale),
            color: p.color,
            alpha: currentAlpha * Math.min(1, scale),
            z: z2,
            isMainRing: p.isMainRing
          });
        }
      }

      // Depth sorting (back-to-front rendering for 3D realism)
      projected.sort((a, b) => b.z - a.z);

      // Draw 3D Ring Particles
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Soft outer glow for main ring bright particles
        if (p.isMainRing && p.size > 1.6) {
          ctx.globalAlpha = p.alpha * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-screen h-screen pointer-events-none z-0"
    />
  );
}
