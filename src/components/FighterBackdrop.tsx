import { useEffect, useRef, useState } from 'react';
import styles from './FighterBackdrop.module.css';

interface Building { x: number; w: number; h: number }
interface Win { x: number; y: number; lit: boolean; color: string }
interface Head { fx: number; r: number; ph: number; row: number }
interface Drop { x: number; y: number; sp: number; len: number }

/** deterministic pseudo-random so the skyline is stable across frames */
const rng = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Neon Tokyo fight stage behind the SELECT EXPERIENCE cards: skyline with
 * blinking windows, swaying crowd silhouettes, diagonal rain and a rare
 * lightning flash on one canvas; kanji neon signs are DOM so the glyphs
 * render through real fonts. Static single frame on coarse pointers and
 * under prefers-reduced-motion.
 */
export default function FighterBackdrop() {
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
    let far: Building[] = [];
    let near: Building[] = [];
    let wins: Win[] = [];
    let heads: Head[] = [];
    let drops: Drop[] = [];
    let t = 0;
    let last = performance.now();
    let nextFlash = 12 + Math.random() * 10; // first flash arrives sooner
    let flashT = -1; // <0 = no flash running

    const seed = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      far = [];
      near = [];
      wins = [];
      let x = -20;
      let bi = 0;
      while (x < w + 40) {
        const bw = 50 + rng(bi) * 90;
        far.push({ x, w: bw, h: h * (0.22 + rng(bi + 50) * 0.2) });
        x += bw + 6 + rng(bi + 99) * 30;
        bi++;
      }
      x = -30;
      bi = 200;
      while (x < w + 40) {
        const bw = 70 + rng(bi) * 110;
        const bh = h * (0.3 + rng(bi + 50) * 0.24);
        near.push({ x, w: bw, h: bh });
        for (let wy = h - bh + 12; wy < h - 40; wy += 22) {
          for (let wx = x + 8; wx < x + bw - 12; wx += 17) {
            const r = rng(wx * 7.3 + wy * 13.7);
            if (r < 0.2) {
              wins.push({
                x: wx,
                y: wy,
                lit: rng(wx * 3.1 + wy * 1.7) < 0.45,
                color: r < 0.13 ? 'rgba(255, 214, 150,' : r < 0.17 ? 'rgba(76, 242, 255,' : 'rgba(255, 92, 200,',
              });
            }
          }
        }
        x += bw + 8 + rng(bi + 99) * 36;
        bi++;
      }
      heads = [];
      for (let i = 0; i < 26; i++) {
        const side = i < 13 ? 0 : 1;
        heads.push({
          fx: side === 0 ? rng(i * 31) * 0.26 : 0.74 + rng(i * 31) * 0.26,
          r: 9 + rng(i * 7) * 8,
          ph: rng(i * 13) * Math.PI * 2,
          row: rng(i * 17),
        });
      }
      drops = Array.from({ length: animate ? 110 : 0 }, (_, i) => ({
        x: rng(i * 3) * w,
        y: rng(i * 5) * h,
        sp: 9 + rng(i * 11) * 6,
        len: 10 + rng(i * 13) * 10,
      }));
    };

    const frame = (dt: number) => {
      t += dt;
      ctx.clearRect(0, 0, w, h);

      // skyline: far layer lighter navy, near layer darker
      ctx.fillStyle = 'rgba(18, 24, 64, 0.8)';
      for (const b of far) ctx.fillRect(b.x, h - b.h, b.w, b.h);
      ctx.fillStyle = '#070a22';
      for (const b of near) ctx.fillRect(b.x, h - b.h, b.w, b.h);

      // windows: occasional random blink
      if (animate && Math.random() < dt * 1.6 && wins.length) {
        const wn = wins[Math.floor(Math.random() * wins.length)];
        wn.lit = !wn.lit;
      }
      for (const wn of wins) {
        if (!wn.lit) continue;
        ctx.fillStyle = `${wn.color} 0.5)`;
        ctx.fillRect(wn.x, wn.y, 6, 9);
      }

      // crowd silhouettes at the bottom edges, swaying
      ctx.fillStyle = 'rgba(3, 4, 12, 0.95)';
      ctx.fillRect(0, h - 24, w * 0.3, 24);
      ctx.fillRect(w * 0.7, h - 24, w * 0.3, 24);
      for (let i = 0; i < heads.length; i++) {
        const hd = heads[i];
        const sway = animate ? Math.sin(t * 1.3 + hd.ph) * 2.5 : 0;
        const bob = animate ? Math.sin(t * 0.9 + hd.ph * 2) * 1.5 : 0;
        ctx.beginPath();
        ctx.arc(hd.fx * w + sway, h - 18 - hd.row * 16 + bob, hd.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // rain: one batched stroke of thin diagonal streaks
      if (animate) {
        ctx.strokeStyle = 'rgba(150, 190, 255, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of drops) {
          d.y += d.sp * dt * 60 * 0.16;
          d.x -= dt * 60 * 0.22;
          if (d.y > h) {
            d.y = -d.len;
            d.x = Math.random() * (w + 60);
          }
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
        }
        ctx.stroke();

        // lightning: double-pulse white wash every 20-30s
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flashT = 0;
          nextFlash = 20 + Math.random() * 10;
        }
        if (flashT >= 0) {
          flashT += dt;
          const k = flashT < 0.08 ? 1 : flashT < 0.16 ? 0.25 : flashT < 0.24 ? 0.7 : Math.max(0, 1 - (flashT - 0.24) / 0.3);
          if (flashT > 0.6) flashT = -1;
          else {
            ctx.fillStyle = `rgba(225, 235, 255, ${k * 0.16})`;
            ctx.fillRect(0, 0, w, h);
          }
        }
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
      <canvas ref={canvasRef} className={styles.canvas} />
      <span className={`${styles.sign} ${styles.signLeft}`}>戦</span>
      <span className={`${styles.sign} ${styles.signRight}`}>龍</span>
      <span className={`${styles.sign} ${styles.signFar}`}>力</span>
    </div>
  );
}
