import { useEffect, useRef, useState } from 'react';
import styles from './InvadersBackdrop.module.css';

interface DeepStar { x: number; y: number; size: number; layer: number; tw: number }
interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  verts: { a: number; r: number }[];
}
interface Streak { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }

const LAYER_SPEED = [4, 9, 18]; // px/s downward drift per depth
const LAYER_ALPHA = [0.3, 0.55, 0.9];

/**
 * Deep-space battle station backdrop behind the Invaders game: 3-depth
 * drifting starfield, ringed planet, slow tumbling asteroids, a faint
 * space station and occasional debris streaks on one canvas. The big
 * nebula is CSS (blurred blobs) so it costs nothing per frame. Static
 * single frame on coarse pointers / prefers-reduced-motion.
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
    let asteroids: Asteroid[] = [];
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
      asteroids = Array.from({ length: 6 }, () => {
        const base = 6 + Math.random() * 11;
        return {
          x: Math.random() * w,
          y: Math.random() * h * 0.8,
          vx: (Math.random() - 0.5) * 14,
          vy: 3 + Math.random() * 7,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.5,
          verts: Array.from({ length: 7 }, (_, k) => ({
            a: (k / 7) * Math.PI * 2,
            r: base * (0.7 + Math.random() * 0.55),
          })),
        };
      });
    };

    const drawPlanet = () => {
      const px = w * 0.82;
      const py = h * 0.3;
      const r = Math.min(w, h) * 0.13 + 30;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-0.32);
      // ring back half (hidden behind the planet at the middle)
      ctx.strokeStyle = 'rgba(130, 160, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.75, r * 0.42, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(0.32);
      // sphere with an off-center highlight
      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.15, 0, 0, r);
      grad.addColorStop(0, '#4a3ed8');
      grad.addColorStop(0.55, '#2a1d72');
      grad.addColorStop(1, '#120c33');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // faint latitude bands
      ctx.strokeStyle = 'rgba(255, 92, 200, 0.1)';
      ctx.lineWidth = 3;
      for (const yy of [-0.35, 0, 0.4]) {
        ctx.beginPath();
        ctx.ellipse(0, r * yy, r * Math.sqrt(1 - yy * yy) * 0.96, r * 0.1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // ring front half passes over the planet
      ctx.rotate(-0.32);
      ctx.strokeStyle = 'rgba(150, 180, 255, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.75, r * 0.42, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    };

    const drawStation = () => {
      // barely-visible station silhouette, far background
      const sx = w * 0.16 + (animate ? Math.sin(t * 0.05) * 12 : 0);
      const sy = h * 0.2 + (animate ? Math.sin(t * 0.08) * 5 : 0);
      ctx.strokeStyle = 'rgba(110, 130, 200, 0.2)';
      ctx.fillStyle = 'rgba(110, 130, 200, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2); // outer ring
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2); // hub
      ctx.fill();
      ctx.beginPath(); // spokes
      ctx.moveTo(sx - 26, sy);
      ctx.lineTo(sx + 26, sy);
      ctx.moveTo(sx, sy - 26);
      ctx.lineTo(sx, sy + 26);
      ctx.stroke();
      ctx.fillRect(sx - 48, sy - 3, 14, 6); // solar panels
      ctx.fillRect(sx + 34, sy - 3, 14, 6);
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

      drawStation();
      drawPlanet();

      // asteroids: slow tumble + drift, wrapping at the edges
      for (const a of asteroids) {
        if (animate) {
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          a.rot += a.vr * dt;
          if (a.y > h + 30) { a.y = -30; a.x = Math.random() * w; }
          if (a.x > w + 30) a.x = -30;
          if (a.x < -30) a.x = w + 30;
        }
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.fillStyle = '#0d0a22';
        ctx.strokeStyle = 'rgba(140, 120, 200, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        a.verts.forEach((v, i) => {
          const vx = Math.cos(v.a) * v.r;
          const vy = Math.sin(v.a) * v.r;
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

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
