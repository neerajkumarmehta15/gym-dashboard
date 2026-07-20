'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  radius: number;
  angle: number;
  speed: number;
  verticalOffset: number;
  size: number;
  color: string;
  alpha: number;
  twinkleSpeed: number;
}

export default function TechkritiGalaxyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Color palette matching Techkriti galaxy (purple, pink, ice blue, sparkling white)
    const colors = [
      '#e879f9', // Pink-Purple
      '#c084fc', // Violet
      '#a855f7', // Deep Purple
      '#60a5fa', // Soft Ice Blue
      '#d4ff00', // Volt Accent
      '#ffffff', // Pure White Star
      '#f472b6'  // Rose Pink
    ];

    // Generate 1,400 3D galaxy particles in a tilted ring disc
    const particleCount = width < 768 ? 700 : 1400;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Spiral disc density distribution
      const distRatio = Math.pow(Math.random(), 0.7);
      const minR = 40;
      const maxR = Math.min(width, height) * 0.75;
      const radius = minR + distRatio * (maxR - minR);

      // Core density bias
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.0008 + (1 - distRatio) * 0.0015) * (Math.random() < 0.5 ? 1 : 1);
      
      // Vertical thickness dispersion (thicker near center)
      const verticalOffset = (Math.random() - 0.5) * (80 * (1 - distRatio * 0.5));
      const size = Math.random() < 0.15 ? Math.random() * 2.2 + 1.5 : Math.random() * 1.4 + 0.6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const alpha = Math.random() * 0.7 + 0.3;
      const twinkleSpeed = Math.random() * 0.02 + 0.005;

      particles.push({
        radius,
        angle,
        speed,
        verticalOffset,
        size,
        color,
        alpha,
        twinkleSpeed
      });
    }

    // 3D Tilt parameters (Matching Techkriti 65° tilt angle)
    const tiltAngleX = Math.PI * 0.35; // ~63 degree tilt
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
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 600; // 3D Perspective Field of View

      // Smooth mouse rotation damping
      targetRotY += 0.0025; // Continuous galaxy rotation
      currentRotY += (targetRotY + mouseX * 0.2 - currentRotY) * 0.05;

      const cosRotY = Math.cos(currentRotY);
      const sinRotY = Math.sin(currentRotY);

      // Sort particles by projected 3D Z depth for realistic layering
      const projectedParticles = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.speed;
        p.alpha += Math.sin(p.angle * 10) * p.twinkleSpeed;
        const currentAlpha = Math.max(0.2, Math.min(1, p.alpha));

        // 1. Position in flat ring plane
        const x0 = p.radius * Math.cos(p.angle);
        const z0 = p.radius * Math.sin(p.angle);
        const y0 = p.verticalOffset;

        // 2. Rotate around Y-axis (Galaxy Spin)
        const x1 = x0 * cosRotY - z0 * sinRotY;
        const z1 = x0 * sinRotY + z0 * cosRotY;

        // 3. Tilt around X-axis (Techkriti 3D Angle)
        const y2 = y0 * cosTilt - z1 * sinTilt;
        const z2 = y0 * sinTilt + z1 * cosTilt;

        // 4. Perspective Projection
        const scale = fov / (fov + z2 + 400);
        const projX = centerX + x1 * scale;
        const projY = centerY + (y2 + mouseY * 30) * scale;
        const projSize = Math.max(0.4, p.size * scale);

        projectedParticles.push({
          x: projX,
          y: projY,
          size: projSize,
          color: p.color,
          alpha: currentAlpha * Math.min(1, scale),
          z: z2
        });
      }

      // Sort back-to-front
      projectedParticles.sort((a, b) => b.z - a.z);

      // Draw Particles & Glows
      for (let i = 0; i < projectedParticles.length; i++) {
        const p = projectedParticles[i];
        
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Extra outer glow for larger bright core stars
        if (p.size > 1.8) {
          ctx.globalAlpha = p.alpha * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
