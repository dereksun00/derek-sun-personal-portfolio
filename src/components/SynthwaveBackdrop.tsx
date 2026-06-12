import { useEffect, useRef, useState } from 'react';
import styles from './SynthwaveBackdrop.module.css';

interface BgStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkles: boolean;
  tw: number;
  twSpeed: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/** Fraction of canvas height where the grid meets the sky. Must match .horizon top in the CSS module. */
const HORIZON = 0.62;
const GRID_ROWS = 14;
const GRID_VERTS = 17;

/**
 * Synthwave backdrop for the game-select screen: scrolling perspective grid,
 * dense twinkling stars and shooting stars on one 2D canvas, with CSS nebula
 * blobs + horizon glow layered behind it and a gentle counter-parallax on
 * mouse move. Lives INSIDE the screen so the black hole eats it on navigate.
 *
 * Phones / coarse pointers skip the canvas entirely and get a static CSS
 * gradient grid instead (see .staticGrid).
 */
export default function SynthwaveBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nebulaRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [heavy] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px) and (pointer: fine)').matches,
  );

  /* canvas: stars + shooting stars + perspective grid */
  useEffect(() => {
    if (!heavy) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let stars: BgStar[] = [];
    let meteors: Meteor[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    let gridOffset = 0;
    let nextMeteor = 2 + Math.random() * 3;
    let last = performance.now();

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = [];
      // ~3x the global StarField density, sky only
      const count = Math.round((w * h) / 3800);
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h * (HORIZON + 0.04),
          size: r < 0.55 ? 1 : r < 0.85 ? 1.5 : r < 0.97 ? 2 : 3,
          alpha: 0.25 + Math.random() * 0.65,
          twinkles: Math.random() < 0.16,
          tw: Math.random() * Math.PI * 2,
          twSpeed: 0.6 + Math.random() * 1.6, // rad/s
        });
      }
    };

    const spawnMeteor = () => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = 110 + Math.random() * 110; // slow streak, not a flash
      meteors.push({
        x: Math.random() * w * 0.8 + w * 0.1,
        y: Math.random() * h * 0.3,
        vx: dir * speed,
        vy: speed * (0.35 + Math.random() * 0.3),
        life: 0,
        maxLife: 1.4 + Math.random() * 1,
      });
    };

    const drawGrid = () => {
      const hy = h * HORIZON;

      // vertical fan converging on the vanishing point, fading out at the horizon
      const vGrad = ctx.createLinearGradient(0, hy, 0, h);
      vGrad.addColorStop(0, 'rgba(42, 13, 74, 0)');
      vGrad.addColorStop(0.3, 'rgba(120, 40, 140, 0.3)');
      vGrad.addColorStop(1, 'rgba(255, 92, 200, 0.55)');
      ctx.strokeStyle = vGrad;
      ctx.lineWidth = 1;
      for (let i = -GRID_VERTS; i <= GRID_VERTS; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2, hy);
        ctx.lineTo(w / 2 + (i / GRID_VERTS) * w * 1.6, h + 24);
        ctx.stroke();
      }

      // horizontals scrolling toward the camera; magenta near, deep purple far
      for (let i = 0; i < GRID_ROWS; i++) {
        const z = ((i + gridOffset) % GRID_ROWS) / GRID_ROWS; // 0 = horizon, 1 = camera
        const y = hy + Math.pow(z, 2.6) * (h - hy + 30);
        const cr = Math.round(42 + 213 * z);
        const cg = Math.round(13 + 79 * z);
        const cb = Math.round(74 + 126 * z);
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.1 + z * 0.5})`;
        ctx.lineWidth = z > 0.75 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const frame = (dt: number) => {
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        let a = s.alpha;
        if (s.twinkles) {
          s.tw += s.twSpeed * dt;
          const pulse = Math.sin(s.tw);
          a *= pulse > 0.9 ? 1.6 : 0.6 + 0.4 * (pulse * 0.5 + 0.5);
        }
        ctx.globalAlpha = Math.min(a, 1);
        ctx.fillStyle = '#d8d4ec';
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      if (!reduced) {
        nextMeteor -= dt;
        if (nextMeteor <= 0 && meteors.length < 2) {
          spawnMeteor();
          nextMeteor = 3 + Math.random() * 6;
        }
        meteors = meteors.filter((m) => {
          m.life += dt;
          if (m.life > m.maxLife || m.y > h * HORIZON) return false;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          // head bright, tail fading along the travel direction
          const fade = Math.sin((m.life / m.maxLife) * Math.PI); // ease in + out
          const tx = m.x - m.vx * 0.45;
          const ty = m.y - m.vy * 0.45;
          const trail = ctx.createLinearGradient(m.x, m.y, tx, ty);
          trail.addColorStop(0, `rgba(232, 240, 255, ${0.9 * fade})`);
          trail.addColorStop(1, 'rgba(120, 160, 255, 0)');
          ctx.strokeStyle = trail;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          return true;
        });

        gridOffset = (gridOffset + dt * 0.9) % GRID_ROWS;
      }

      drawGrid();
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(tick);
    };

    seed();
    if (reduced) {
      frame(0); // single static frame: stars + grid, no scroll, no meteors
    } else {
      raf = requestAnimationFrame(tick);
    }
    const onResize = () => {
      seed();
      if (reduced) frame(0);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [heavy]);

  /* parallax: nebula drifts against the cursor, grid layer with it (~6-12px) */
  useEffect(() => {
    if (!heavy) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    const apply = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      if (nebulaRef.current)
        nebulaRef.current.style.transform = `translate3d(${cx * -14}px, ${cy * -10}px, 0)`;
      if (gridRef.current)
        gridRef.current.style.transform = `translate3d(${cx * 8}px, ${cy * 6}px, 0)`;
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, [heavy]);

  return (
    <div className={styles.bg} aria-hidden>
      <div className={styles.layer} ref={nebulaRef}>
        <span className={`${styles.nebula} ${styles.nebMagenta}`} />
        <span className={`${styles.nebula} ${styles.nebCyan}`} />
        <span className={`${styles.nebula} ${styles.nebBlue}`} />
        <span className={`${styles.nebula} ${styles.nebMagenta2}`} />
        <span className={`${styles.nebula} ${styles.nebCyan2}`} />
      </div>
      <div className={styles.layer} ref={gridRef}>
        <div className={styles.horizon} />
        {heavy ? (
          <canvas ref={canvasRef} className={styles.canvas} />
        ) : (
          <div className={styles.staticGrid} />
        )}
      </div>
    </div>
  );
}
