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
  wavePhase: number;
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

    // Exact Techkriti.org Color Palette:
    // Core Ring: Crisp White, Light Gold, Rose Pink, Neon Violet
    // Outer Space: Deep Lavender, Indigo Blue, Soft Cyan
    const ringColors = ['#ffffff', '#ffffff', '#fffbeb', '#fef08a', '#fbcfe8', '#e879f9', '#c084fc'];
    const outerColors = ['#e9d5ff', '#c084fc', '#a855f7', '#818cf8', '#60a5fa', '#38bdf8'];

    const particleCount = width < 768 ? 1600 : 3000;
    const particles: Particle[] = [];

    const minDim = Math.min(width, height);
    // Exact Techkriti Ring Geometry: Centered, Hollow Hole inside
    const ringRadius = minDim * 0.26;    // Main Ring Radius
    const ringWidth = minDim * 0.075;    // Dense Ring Band Thickness

    for (let i = 0; i < particleCount; i++) {
      const isMainRing = i < particleCount * 0.65; // 65% in main dense ring

      let radius: number;
      let color: string;
      let size: number;
      let alpha: number;
      let yOffset: number;
      let speed: number;
      let wavePhase: number;

      if (isMainRing) {
        // High density ring with clean hollow center hole
        const bandOffset = (Math.random() - 0.5) * ringWidth;
        radius = ringRadius + bandOffset;
        color = ringColors[Math.floor(Math.random() * ringColors.length)];
        size = Math.random() < 0.15 ? Math.random() * 2.2 + 1.2 : Math.random() * 1.2 + 0.5;
        alpha = Math.random() * 0.8 + 0.2;
        wavePhase = Math.random() * Math.PI * 2;
        // Subtle 3D vertical thickness & wave
        yOffset = (Math.random() - 0.5) * 20;
        speed = 0.0014 + (Math.random() - 0.5) * 0.0004;
      } else {
        // Dispersed outer space particle cloud fading outwards
        const distFactor = Math.pow(Math.random(), 0.55);
        radius = ringRadius + 25 + distFactor * (minDim * 0.55);
        color = outerColors[Math.floor(Math.random() * outerColors.length)];
        size = Math.random() < 0.08 ? Math.random() * 1.8 + 1.0 : Math.random() * 1.1 + 0.4;
        alpha = Math.random() * 0.5 + 0.1;
        wavePhase = Math.random() * Math.PI * 2;
        yOffset = (Math.random() - 0.5) * (35 + distFactor * 65);
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
        isMainRing,
        wavePhase
      });
    }

    // Exact Techkriti 3D Tilt Angle (~62° X-axis inclination)
    const tiltAngleX = Math.PI * 0.34;
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
      // Clean Pitch Black Space Background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 680;

      // Continuous 3D Y-axis Rotation (Techkriti Ring Spin)
      targetRotY += 0.0022;
      currentRotY += (targetRotY + mouseX * 0.12 - currentRotY) * 0.04;

      const cosRotY = Math.cos(currentRotY);
      const sinRotY = Math.sin(currentRotY);

      // Project particles in 3D Space
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.speed;

        // Twinkle effect
        p.alpha = p.baseAlpha + Math.sin(p.angle * 8 + p.wavePhase) * 0.2;
        const currentAlpha = Math.max(0.1, Math.min(1, p.alpha));

        // Ring vertical 3D wave modulation (Techkriti wavy ring motion)
        const waveY = p.isMainRing ? Math.sin(p.angle * 3 + p.wavePhase) * 8 : 0;

        // 1. Initial Position on 3D Ring Plane
        const x0 = p.radius * Math.cos(p.angle);
        const z0 = p.radius * Math.sin(p.angle);
        const y0 = p.yOffset + waveY;

        // 2. Y-Axis Orbit Rotation
        const x1 = x0 * cosRotY - z0 * sinRotY;
        const z1 = x0 * sinRotY + z0 * cosRotY;

        // 3. X-Axis 3D Tilt Angle
        const y2 = y0 * cosTilt - z1 * sinTilt;
        const z2 = y0 * sinTilt + z1 * cosTilt;

        // 4. Perspective Projection Math
        const scale = fov / (fov + z2 + 450);
        const projX = centerX + x1 * scale;
        const projY = centerY + (y2 + mouseY * 20) * scale;

        if (projX >= -40 && projX <= width + 40 && projY >= -40 && projY <= height + 40) {
          projected.push({
            x: projX,
            y: projY,
            size: Math.max(0.35, p.size * scale),
            color: p.color,
            alpha: currentAlpha * Math.min(1, scale),
            z: z2,
            isMainRing: p.isMainRing
          });
        }
      }

      // Depth Sorting (Back-to-Front 3D particle rendering)
      projected.sort((a, b) => b.z - a.z);

      // Render 3D Particle Stars
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Soft outer glow highlight for bright ring stars
        if (p.isMainRing && p.size > 1.7) {
          ctx.globalAlpha = p.alpha * 0.3;
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
