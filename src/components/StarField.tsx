import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  layer: number; // 0 = far, 2 = near
  tw: number; // twinkle phase
  twSpeed: number;
}

const LAYER_SPEED = [0.004, 0.012, 0.028]; // px/frame drift per layer
const LAYER_ALPHA = [0.35, 0.6, 0.95];
const LAYER_COUNT = [90, 60, 30];

/**
 * 3-layer parallax star field on a 2D canvas. Lives behind every screen
 * and outside #screen-root so transitions never capture it.
 */
export default function StarField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let stars: Star[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    const seed = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      stars = [];
      LAYER_COUNT.forEach((count, layer) => {
        for (let i = 0; i < count; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            size: layer === 2 ? 2 : 1,
            layer,
            tw: Math.random() * Math.PI * 2,
            twSpeed: 0.005 + Math.random() * 0.02,
          });
        }
      });
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.x -= LAYER_SPEED[s.layer] * (w / 100);
        if (s.x < -2) s.x = w + 2;
        s.tw += s.twSpeed;
        // most stars are steady; the sin gate makes twinkles occasional
        const twinkle = Math.sin(s.tw) > 0.92 ? 1.6 : 1;
        ctx.globalAlpha = Math.min(LAYER_ALPHA[s.layer] * twinkle, 1);
        ctx.fillStyle = twinkle > 1 ? '#ffffff' : '#c9c6d6';
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    seed();
    tick();
    window.addEventListener('resize', seed);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', seed);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="no-capture"
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
