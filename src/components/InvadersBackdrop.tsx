import { useEffect, useRef, useState } from 'react';
import styles from './InvadersBackdrop.module.css';

interface DeepStar { x: number; y: number; size: number; layer: number; tw: number }
interface Streak { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }

const LAYER_SPEED = [4, 9, 18]; // px/s downward drift per depth
const LAYER_ALPHA = [0.3, 0.55, 0.9];

/**
 * Deep-space starfield behind the Invaders game: 3-depth drifting stars
 * and occasional debris streaks on one cheap 2D canvas, with a CSS nebula
 * band layered behind. The hero bodies — ringed planet, tumbling
 * asteroids, station — are real 3D and live in InvadersBodies, layered on
 * top of this. Static single frame on coarse pointers / reduced-motion.
 */
export default function InvadersBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [heavy] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px) and (pointer: fine)').matches,
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = heavy && !reduced;

    let w = 0;
    let h = 0;
    let raf = 0;
    let stars: DeepStar[] = [];
    let streaks: Streak[] = [];
    let nextStreak = 2 + Math.random() * 4;
    let t = 0;
    let last = performance.now();

    const seed = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      stars = [];
      const counts = [Math.round((w * h) / 6500), Math.round((w * h) / 10000), Math.round((w * h) / 18000)];
      counts.forEach((count, layer) => {
        for (let i = 0; i < count; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            size: layer === 2 ? 2 : 1,
            layer,
            tw: Math.random() * Math.PI * 2,
          });
        }
      });
    };

    const frame = (dt: number) => {
      t += dt;
      ctx.clearRect(0, 0, w, h);

      // starfield: 3 depths drifting down at different speeds
      ctx.fillStyle = '#cfd2ee';
      for (const s of stars) {
        if (animate) {
          s.y += LAYER_SPEED[s.layer] * dt;
          if (s.y > h + 2) {
            s.y = -2;
            s.x = Math.random() * w;
          }
        }
        s.tw += dt * 1.5;
        const twinkle = Math.sin(s.tw) > 0.92 ? 1.5 : 1;
        ctx.globalAlpha = Math.min(LAYER_ALPHA[s.layer] * twinkle, 1);
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // debris streaks
      if (animate) {
        nextStreak -= dt;
        if (nextStreak <= 0 && streaks.length < 2) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          const sp = 160 + Math.random() * 140;
          streaks.push({
            x: Math.random() * w,
            y: Math.random() * h * 0.4,
            vx: dir * sp,
            vy: sp * (0.3 + Math.random() * 0.3),
            life: 0,
            maxLife: 1 + Math.random() * 0.8,
          });
          nextStreak = 4 + Math.random() * 5;
        }
        streaks = streaks.filter((m) => {
          m.life += dt;
          if (m.life > m.maxLife) return false;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const fade = Math.sin((m.life / m.maxLife) * Math.PI);
          const trail = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.3, m.y - m.vy * 0.3);
          trail.addColorStop(0, `rgba(200, 240, 255, ${0.85 * fade})`);
          trail.addColorStop(1, 'rgba(76, 242, 255, 0)');
          ctx.strokeStyle = trail;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 0.3, m.y - m.vy * 0.3);
          ctx.stroke();
          return true;
        });
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(tick);
    };

    seed();
    if (animate) {
      raf = requestAnimationFrame(tick);
    } else {
      frame(0);
    }
    const onResize = () => {
      seed();
      if (!animate) frame(0);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [heavy]);

  return (
    <div className={styles.bg} aria-hidden>
      <span className={`${styles.nebula} ${styles.nebPurple}`} />
      <span className={`${styles.nebula} ${styles.nebCyan}`} />
      <span className={`${styles.nebula} ${styles.nebMagenta}`} />
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
