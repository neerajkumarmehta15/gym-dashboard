'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  radius: number;
  angle: number;
  speed: number;
  armOffset: number;
  size: number;
  color: string;
  alpha: number;
  baseAlpha: number;
  twinkleSpeed: number;
  isDust: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
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

    // Hyper-realistic Galaxy Palette (Deep Purple, Neon Violet, Ice Blue, Gold, Rose Pink, White)
    const galaxyColors = [
      '#e879f9', // Neon Violet
      '#c084fc', // Bright Purple
      '#a855f7', // Deep Violet
      '#60a5fa', // Ice Cyan
      '#38bdf8', // Soft Sky Blue
      '#facc15', // Gold Core
      '#f472b6', // Rose Pink
      '#ffffff'  // Crisp White Star
    ];

    const particleCount = width < 768 ? 1200 : 2200;
    const particles: Particle[] = [];

    const numArms = 2; // Spiral Galaxy Arms

    for (let i = 0; i < particleCount; i++) {
      const isDust = Math.random() < 0.35; // 35% deep ambient star dust

      if (isDust) {
        // Uniform deep background stars dispersed in 3D box
        const x = (Math.random() - 0.5) * 1600;
        const y = (Math.random() - 0.5) * 1200;
        const z = (Math.random() - 0.5) * 1000;
        const size = Math.random() * 1.2 + 0.4;
        const color = galaxyColors[Math.floor(Math.random() * galaxyColors.length)];
        const alpha = Math.random() * 0.6 + 0.2;

        particles.push({
          x, y, z,
          radius: Math.sqrt(x * x + z * z),
          angle: Math.atan2(z, x),
          speed: (Math.random() * 0.0004 + 0.0002) * (Math.random() < 0.5 ? 1 : -1),
          armOffset: 0,
          size,
          color,
          alpha,
          baseAlpha: alpha,
          twinkleSpeed: Math.random() * 0.03 + 0.008,
          isDust: true
        });
      } else {
        // Logarithmic Spiral Galaxy Arm particles
        const armIndex = i % numArms;
        const armAngle = (armIndex * 2 * Math.PI) / numArms;

        // Radial distance with exponential density near core
        const distRatio = Math.pow(Math.random(), 0.65);
        const maxRadius = Math.min(width, height) * 0.8;
        const radius = 30 + distRatio * maxRadius;

        // Spiral angle formula: theta = armAngle + k * ln(r)
        const spiralAngle = armAngle + Math.log(radius / 30) * 1.8;
        
        // Scatter around arm line
        const scatter = (Math.random() - 0.5) * (35 + distRatio * 70);
        const verticalOffset = (Math.random() - 0.5) * (45 * (1 - distRatio * 0.4));

        const size = Math.random() < 0.1 ? Math.random() * 2.5 + 1.5 : Math.random() * 1.5 + 0.6;
        const color = galaxyColors[Math.floor(Math.random() * galaxyColors.length)];
        const alpha = Math.random() * 0.75 + 0.25;

        particles.push({
          x: 0,
          y: verticalOffset,
          z: 0,
          radius: radius + scatter,
          angle: spiralAngle,
          speed: 0.0008 + (1 - distRatio * 0.5) * 0.0012,
          armOffset: scatter,
          size,
          color,
          alpha,
          baseAlpha: alpha,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          isDust: false
        });
      }
    }

    // Shooting Stars / Comets Array
    const shootingStars: ShootingStar[] = [];
    const createShootingStar = () => {
      shootingStars.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.5),
        length: Math.random() * 120 + 80,
        speed: Math.random() * 12 + 10,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2, // ~45 degree angle
        alpha: 1.0,
        active: true
      });
    };

    // 3D Perspective Tilt (Techkriti ~60° Galaxy Disc Angle)
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

    let lastShootingStarTime = 0;

    // Render Loop
    const render = (time: number) => {
      // Spawn shooting stars periodically
      if (time - lastShootingStarTime > 4000) {
        if (Math.random() < 0.6) createShootingStar();
        lastShootingStarTime = time;
      }

      // Deep Space Gradient Background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 700;

      // Galaxy rotation
      targetRotY += 0.0018;
      currentRotY += (targetRotY + mouseX * 0.15 - currentRotY) * 0.04;

      const cosRotY = Math.cos(currentRotY);
      const sinRotY = Math.sin(currentRotY);

      // Draw Galaxy Core Radial Glow
      const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 220);
      coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      coreGlow.addColorStop(0.2, 'rgba(250, 204, 21, 0.45)');
      coreGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
      coreGlow.addColorStop(0.8, 'rgba(59, 130, 246, 0.1)');
      coreGlow.addColorStop(1, 'transparent');

      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 220, 0, Math.PI * 2);
      ctx.fill();

      // Process and Project Particles
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (p.isDust) {
          // Slow 3D drift for background stars
          p.angle += p.speed;
          const x0 = p.x;
          const y0 = p.y;
          const z0 = p.z;

          const x1 = x0 * cosRotY - z0 * sinRotY;
          const z1 = x0 * sinRotY + z0 * cosRotY;

          const scale = fov / (fov + z1 + 500);
          const projX = centerX + x1 * scale;
          const projY = centerY + (y0 + mouseY * 25) * scale;

          if (projX >= -20 && projX <= width + 20 && projY >= -20 && projY <= height + 20) {
            projected.push({
              x: projX,
              y: projY,
              size: Math.max(0.3, p.size * scale),
              color: p.color,
              alpha: p.baseAlpha * Math.min(1, scale),
              z: z1
            });
          }
        } else {
          // Spiral Arm rotation
          p.angle += p.speed;
          p.alpha = p.baseAlpha + Math.sin(p.angle * 8) * 0.25;
          const currentAlpha = Math.max(0.15, Math.min(1, p.alpha));

          const x0 = p.radius * Math.cos(p.angle);
          const z0 = p.radius * Math.sin(p.angle);
          const y0 = p.y;

          // Y-axis spin
          const x1 = x0 * cosRotY - z0 * sinRotY;
          const z1 = x0 * sinRotY + z0 * cosRotY;

          // X-axis 3D tilt
          const y2 = y0 * cosTilt - z1 * sinTilt;
          const z2 = y0 * sinTilt + z1 * cosTilt;

          const scale = fov / (fov + z2 + 450);
          const projX = centerX + x1 * scale;
          const projY = centerY + (y2 + mouseY * 30) * scale;

          if (projX >= -20 && projX <= width + 20 && projY >= -20 && projY <= height + 20) {
            projected.push({
              x: projX,
              y: projY,
              size: Math.max(0.4, p.size * scale),
              color: p.color,
              alpha: currentAlpha * Math.min(1, scale),
              z: z2
            });
          }
        }
      }

      // Sort depth (back-to-front rendering)
      projected.sort((a, b) => b.z - a.z);

      // Render 3D Particles
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Extra Outer Glow for Bright Star Cores
        if (p.size > 2.0) {
          ctx.globalAlpha = p.alpha * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Animated Shooting Stars / Comets
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        if (!s.active) continue;

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.alpha -= 0.012;

        if (s.alpha <= 0 || s.x > width + 100 || s.y > height + 100) {
          s.active = false;
          continue;
        }

        const headX = s.x;
        const headY = s.y;
        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const streakGradient = ctx.createLinearGradient(tailX, tailY, headX, headY);
        streakGradient.addColorStop(0, 'transparent');
        streakGradient.addColorStop(0.7, 'rgba(232, 121, 249, 0.4)');
        streakGradient.addColorStop(1, 'rgba(255, 255, 255, 0.95)');

        ctx.globalAlpha = s.alpha;
        ctx.strokeStyle = streakGradient;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
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
