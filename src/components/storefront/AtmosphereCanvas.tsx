import React, { useEffect, useRef } from 'react';

interface AtmosphereCanvasProps {
  fragranceId: string;
  particleType: 'mist' | 'ember' | 'petal' | 'ribbon' | 'smoke' | 'sunlight';
  color: string;
  reducedMotion?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  rotation: number;
  vRot: number;
  wobble: number;
  life: number;
  maxLife: number;
}

export const AtmosphereCanvas: React.FC<AtmosphereCanvasProps> = ({
  fragranceId,
  particleType,
  color,
  reducedMotion = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = width < 768 ? 24 : 50;
    const particles: Particle[] = [];

    const createParticle = (): Particle => {
      const isEmber = particleType === 'ember';
      const isPetal = particleType === 'petal';
      const isMist = particleType === 'mist';
      const isSun = particleType === 'sunlight';
      const isSmoke = particleType === 'smoke';

      return {
        x: Math.random() * width,
        y: isEmber ? height + Math.random() * 50 : Math.random() * height,
        vx: isEmber ? (Math.random() - 0.5) * 0.8 : (Math.random() - 0.5) * 0.6,
        vy: isEmber
          ? -(Math.random() * 1.5 + 0.8) // Embers rise upward
          : isPetal
          ? Math.random() * 0.8 + 0.4 // Petals drift down
          : (Math.random() - 0.5) * 0.5,
        size: isPetal ? Math.random() * 8 + 6 : isSmoke ? Math.random() * 25 + 15 : Math.random() * 3.5 + 1.2,
        alpha: 0,
        maxAlpha: isSmoke ? 0.08 : Math.random() * 0.55 + 0.25,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.02,
        wobble: Math.random() * Math.PI * 2,
        life: 0,
        maxLife: Math.random() * 200 + 150
      };
    };

    for (let i = 0; i < particleCount; i++) {
      const p = createParticle();
      p.life = Math.random() * p.maxLife; // Stagger initial lifetime
      particles.push(p);
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, idx) => {
        p.life++;
        p.x += p.vx + Math.sin(p.wobble) * 0.4;
        p.y += p.vy;
        p.wobble += 0.02;
        p.rotation += p.vRot;

        // Fade in and out
        const halfLife = p.maxLife / 2;
        if (p.life < halfLife) {
          p.alpha = (p.life / halfLife) * p.maxAlpha;
        } else {
          p.alpha = ((p.maxLife - p.life) / halfLife) * p.maxAlpha;
        }

        // Reset if expired or out of bounds
        if (p.life >= p.maxLife || p.y < -30 || p.y > height + 30 || p.x < -30 || p.x > width + 30) {
          particles[idx] = createParticle();
          return;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;

        if (particleType === 'petal') {
          // Abstract organic petal silhouette
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (particleType === 'ember') {
          // Glowing hot ember core
          ctx.fillStyle = '#FFF7ED';
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (particleType === 'smoke') {
          // Soft diffuse smoke puff
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          grad.addColorStop(0, color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (particleType === 'ribbon') {
          // Luminous golden light ribbon segment
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 3, p.size * 0.4, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Mist / Sunlight mote
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          grad.addColorStop(0, '#FFFFFF');
          grad.addColorStop(0.4, color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [fragranceId, particleType, color, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
