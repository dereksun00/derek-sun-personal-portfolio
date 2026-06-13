import { useEffect, useRef, useState } from 'react';
import styles from './FighterBackdrop.module.css';

/* Self-hosted pixel font (declared in global.css, subset to just the glyphs
   below) leads the stack so the signs render identically for every visitor,
   with OS Japanese fonts only as a belt-and-braces fallback. Baked into the
   offscreen sign canvases once the webfont reports loaded (canvas ignores
   font-display, so we must wait explicitly — see the loader in the effect). */
const FONT = "'DotGothic16', 'Yu Gothic', 'Meiryo', 'Hiragino Kaku Gothic Pro', 'Noto Sans JP', sans-serif";
const SIGN_GLYPHS = '居酒屋ラーメンカラオケ寿司バー焼き鳥餃子酒心福赤提灯';

type Hue = 'magenta' | 'cyan' | 'amber';
const NEON: Record<Hue, { core: string; mid: string; glow: string }> = {
  magenta: { core: '#ffb3e6', mid: '#ff5cc8', glow: '255, 92, 200' },
  cyan: { core: '#b3f9ff', mid: '#4cf2ff', glow: '76, 242, 255' },
  amber: { core: '#ffe9ad', mid: '#ffcf52', glow: '255, 207, 82' },
};

interface SignDef { text: string; hue: Hue; side: -1 | 1; depth: number }
/** A Tokyo back-alley wall of stacked vertical signboards, both sides,
    receding toward the vanishing point (depth 0 = far/small, 1 = near/big). */
const SIGNS: SignDef[] = [
  { text: '居酒屋', hue: 'amber', side: -1, depth: 1 },
  { text: 'ラーメン', hue: 'cyan', side: -1, depth: 0.66 },
  { text: 'カラオケ', hue: 'magenta', side: -1, depth: 0.38 },
  { text: '寿司', hue: 'amber', side: -1, depth: 0.17 },
  { text: 'バー', hue: 'magenta', side: 1, depth: 1 },
  { text: '焼き鳥', hue: 'amber', side: 1, depth: 0.64 },
  { text: '餃子', hue: 'cyan', side: 1, depth: 0.36 },
  { text: '酒', hue: 'magenta', side: 1, depth: 0.16 },
];

interface SignInst extends SignDef {
  canvas: HTMLCanvasElement;
  x: number; y: number; w: number; h: number;
  ph: number; // flicker phase
  buzz: number; // independent neon-buzz speed
  dead: number; // >0 → mid flicker-out
  nextDead: number;
}
interface Lantern { x: number; y: number; r: number; ph: number; glyph: string }
interface Win { x: number; y: number; w: number; h: number; hue: string; lit: boolean }
interface Drop { x: number; y: number; sp: number; len: number; near: boolean }
interface Splash { x: number; y: number; life: number; max: number }
interface Puff { x: number; y: number; r: number; life: number; max: number; vx: number }

const rng = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Render one vertical signboard (dark panel, neon border + glowing
    stacked glyphs) to an offscreen canvas, supersampled for crisp blits. */
function renderSign(text: string, hue: Hue): HTMLCanvasElement {
  const C = NEON[hue];
  const chars = [...text];
  const SS = 2; // supersample
  const cell = 40 * SS;
  const pad = 14 * SS;
  const c = document.createElement('canvas');
  c.width = cell + pad * 2;
  c.height = chars.length * cell + pad * 2;
  const g = c.getContext('2d')!;
  // board: near-black with a faint hue tint + neon frame
  g.fillStyle = '#0a0613';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = C.mid;
  g.lineWidth = 2 * SS;
  g.shadowColor = `rgba(${C.glow}, 0.9)`;
  g.shadowBlur = 10 * SS;
  g.strokeRect(SS * 2, SS * 2, c.width - SS * 4, c.height - SS * 4);
  // glyphs (no synthetic bold — DotGothic16 is single-weight and bolding
  // would smear the pixel grid)
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(cell * 0.74)}px ${FONT}`;
  for (let i = 0; i < chars.length; i++) {
    const cy = pad + cell * (i + 0.5);
    g.shadowColor = `rgba(${C.glow}, 0.95)`;
    g.shadowBlur = 16 * SS;
    g.fillStyle = C.mid;
    g.fillText(chars[i], c.width / 2, cy);
    g.shadowBlur = 7 * SS;
    g.fillStyle = C.core; // bright filament core
    g.fillText(chars[i], c.width / 2, cy);
  }
  return c;
}

/**
 * Neon Tokyo back-alley behind SELECT EXPERIENCE: layered skyscraper
 * silhouettes with blinking windows, a wet perspective alley reflecting a
 * wall of independently-flickering vertical shop signs, swaying red
 * lanterns, two-depth rain with splashes, drifting steam, a vending-machine
 * glow, periodic lightning, and dark foreground framing. One 2D canvas;
 * static single frame on coarse pointers / prefers-reduced-motion.
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
    let hy = 0; // horizon / vanishing-point height
    let raf = 0;
    let t = 0;
    let last = performance.now();

    let farSky: HTMLCanvasElement | null = null;
    let nearSky: HTMLCanvasElement | null = null;
    // full-screen gradients are geometry-only (no per-frame change) → cache
    let gSky: CanvasGradient | null = null;
    let gHaze: CanvasGradient | null = null;
    let gFloor: CanvasGradient | null = null;
    let gPuddle: CanvasGradient | null = null;
    let wins: Win[] = [];
    let signs: SignInst[] = [];
    let lanterns: Lantern[] = [];
    let drops: Drop[] = [];
    let splashes: Splash[] = [];
    let puffs: Puff[] = [];
    let nextPuff = 0.5;
    let nextFlash = 9 + Math.random() * 8;
    let flashT = -1;

    /* skyline silhouette pre-rendered per depth, with a window grid baked in */
    const buildSky = (seedBase: number, color: string, hmin: number, hmax: number, winChance: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      g.fillStyle = color;
      let x = -20;
      let i = seedBase;
      while (x < w + 40) {
        const bw = 54 + rng(i) * 120;
        const bh = h * (hmin + rng(i + 50) * (hmax - hmin));
        const top = hy - bh * 0.18 + (h - hy) * 0.04; // bases sit just below the horizon band
        g.fillStyle = color;
        g.fillRect(x, top, bw, h - top);
        // rooftop water tanks / vents for a Tokyo skyline read
        if (rng(i + 7) < 0.5) g.fillRect(x + bw * 0.2, top - 10, 14, 10);
        if (rng(i + 9) < 0.4) g.fillRect(x + bw * 0.6, top - 16, 6, 16);
        // window grid baked dark; lit ones tracked separately for blinking
        for (let wy = top + 14; wy < h - 8; wy += 20) {
          for (let wx = x + 8; wx < x + bw - 12; wx += 16) {
            if (rng(wx * 3.1 + wy * 7.7) < 0.5) {
              g.fillStyle = 'rgba(0,0,0,0.4)';
              g.fillRect(wx, wy, 7, 11);
              if (rng(wx * 5.3 + wy * 2.1) < winChance) {
                const r = rng(wx * 1.7 + wy * 9.3);
                wins.push({
                  x: wx, y: wy, w: 7, h: 11,
                  hue: r < 0.6 ? '255, 214, 150' : r < 0.82 ? '76, 242, 255' : '255, 92, 200',
                  lit: rng(wx + wy) < 0.5,
                });
              }
            }
          }
        }
        x += bw + 4 + rng(i + 99) * 22;
        i++;
      }
      return c;
    };

    const placeSigns = () => {
      signs = SIGNS.map((s, i) => {
        const canvas = renderSign(s.text, s.hue);
        const scale = (0.5 + s.depth * 1.0) * (Math.min(w, h) / 700);
        const sw = canvas.width * 0.5 * scale;
        const sh = canvas.height * 0.5 * scale;
        // recede toward the vanishing point: far signs sit high & near the
        // centre, near signs low & out toward the wall — but kept clear of
        // the 7% foreground framing columns so the big ones aren't occluded
        const edge = s.side < 0 ? 0.085 : 0.915;
        const centre = 0.5 + s.side * 0.05;
        const fx = centre + (edge - centre) * s.depth; // wall-side edge as a fraction of width
        const x = s.side < 0 ? fx * w : fx * w - sw;
        const y = hy - sh * 0.08 + (h * 0.46 - hy) * 0.3 + (h * 0.54 - hy) * s.depth;
        return {
          ...s, canvas, x, y, w: sw, h: sh,
          ph: rng(i * 13) * Math.PI * 2,
          buzz: 7 + rng(i * 5) * 9,
          dead: 0,
          nextDead: 3 + rng(i * 17) * 9,
        };
      });
    };

    const seed = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      hy = h * 0.4;
      wins = [];
      farSky = buildSky(0, 'rgba(20, 26, 66, 0.85)', 0.18, 0.4, 0.1);
      nearSky = buildSky(200, '#070a20', 0.3, 0.6, 0.16);
      placeSigns();

      gSky = ctx.createLinearGradient(0, 0, 0, h);
      gSky.addColorStop(0, '#04061c');
      gSky.addColorStop(hy / h - 0.08, '#0a0a2a');
      gSky.addColorStop(hy / h, '#241036');
      gHaze = ctx.createRadialGradient(w * 0.5, hy + 10, 10, w * 0.5, hy + 10, w * 0.6);
      gHaze.addColorStop(0, 'rgba(255, 138, 120, 0.22)');
      gHaze.addColorStop(0.4, 'rgba(255, 92, 200, 0.14)');
      gHaze.addColorStop(1, 'rgba(255, 92, 200, 0)');
      gFloor = ctx.createLinearGradient(0, hy, 0, h);
      gFloor.addColorStop(0, '#0c0a22');
      gFloor.addColorStop(0.5, '#0a0820');
      gFloor.addColorStop(1, '#06040f');
      gPuddle = ctx.createLinearGradient(0, hy, 0, h);
      gPuddle.addColorStop(0, 'rgba(255, 92, 200, 0.2)');
      gPuddle.addColorStop(0.45, 'rgba(76, 242, 255, 0.09)');
      gPuddle.addColorStop(1, 'rgba(255, 138, 90, 0.05)');
      lanterns = [
        { x: w * 0.2, y: hy + 24, r: 17, ph: 0.4, glyph: '酒' },
        { x: w * 0.81, y: hy + 14, r: 14, ph: 2.1, glyph: '心' },
        { x: w * 0.66, y: hy + 40, r: 19, ph: 3.5, glyph: '福' },
      ];
      drops = Array.from({ length: animate ? 240 : 0 }, (_, i) => {
        const near = i % 5 < 2;
        return {
          x: rng(i * 3) * (w + 80) - 40,
          y: rng(i * 5) * h,
          sp: (near ? 17 : 9) + rng(i * 11) * 6,
          len: (near ? 18 : 10) + rng(i * 13) * 10,
          near,
        };
      });
      splashes = [];
      puffs = [];
    };

    /* ── per-frame draws ── */
    const drawAlley = () => {
      // wet street receding from the vanishing point, neon-stained
      ctx.fillStyle = gFloor!;
      ctx.beginPath();
      ctx.moveTo(w * 0.42, hy);
      ctx.lineTo(w * 0.58, hy);
      ctx.lineTo(w * 1.15, h);
      ctx.lineTo(-w * 0.15, h);
      ctx.closePath();
      ctx.fill();
      // centre-line puddles catching the sign glow down the wet street
      ctx.fillStyle = gPuddle!;
      ctx.beginPath();
      ctx.moveTo(w * 0.47, hy);
      ctx.lineTo(w * 0.53, hy);
      ctx.lineTo(w * 0.74, h);
      ctx.lineTo(w * 0.26, h);
      ctx.closePath();
      ctx.fill();
      // a few cross-street wet glints catching light
      ctx.fillStyle = 'rgba(150, 180, 220, 0.05)';
      for (let i = 1; i <= 4; i++) {
        const k = i / 5;
        const yy = hy + Math.pow(k, 1.8) * (h - hy);
        const spread = (0.08 + k * 0.5) * w;
        ctx.fillRect(w * 0.5 - spread, yy, spread * 2, 2 + k * 3);
      }
    };

    /** vertical wet reflection smear of a neon source on the pavement: a
        bright hotspot at the source base fading into a long wavering streak */
    const reflect = (x: number, top: number, color: string, width: number, strength: number) => {
      const wob = Math.sin(t * 2 + x) * 3;
      const g = ctx.createLinearGradient(0, top, 0, h);
      g.addColorStop(0, `rgba(${color}, ${strength})`);
      g.addColorStop(0.12, `rgba(${color}, ${strength * 0.6})`);
      g.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - width / 2 + wob, top, width, h - top);
      // narrow hot core
      const hot = ctx.createLinearGradient(0, top, 0, h);
      hot.addColorStop(0, `rgba(${color}, ${strength * 1.3})`);
      hot.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = hot;
      ctx.fillRect(x - width * 0.16 + wob * 1.4, top, width * 0.32, h - top);
    };

    const frame = (dt: number) => {
      t += dt;
      // sky: deep navy with a city-glow haze rising off the horizon
      ctx.fillStyle = gSky!;
      ctx.fillRect(0, 0, w, h);
      // light-pollution glow on the horizon (magenta → orange)
      ctx.fillStyle = gHaze!;
      ctx.fillRect(0, hy - h * 0.3, w, h * 0.5);

      // skyline silhouettes (far then near)
      if (farSky) ctx.drawImage(farSky, 0, 0);
      // blink a couple of windows each frame
      if (animate && wins.length) {
        for (let k = 0; k < 2; k++) {
          if (Math.random() < dt * 2.2) {
            const wn = wins[Math.floor(Math.random() * wins.length)];
            wn.lit = !wn.lit;
          }
        }
      }
      for (const wn of wins) {
        if (!wn.lit) continue;
        ctx.fillStyle = `rgba(${wn.hue}, 0.55)`;
        ctx.fillRect(wn.x, wn.y, wn.w, wn.h);
      }
      if (nearSky) ctx.drawImage(nearSky, 0, 0);

      drawAlley();

      // sign reflections on the wet ground (draw before the signs themselves)
      for (const s of signs) {
        const C = NEON[s.hue];
        const lit = s.dead > 0 ? 0.15 : 0.55 + 0.45 * Math.max(0, Math.sin(t * s.buzz + s.ph));
        reflect(s.x + s.w / 2, Math.max(hy + 8, s.y + s.h * 0.92), C.glow, s.w * 0.9, 0.34 * lit);
      }

      // lantern + vending reflections too
      for (const ln of lanterns) reflect(ln.x, hy + 20, '255, 70, 70', ln.r * 1.8, 0.22);

      // neon signs with independent flicker + occasional full dropout
      for (const s of signs) {
        if (animate) {
          s.nextDead -= dt;
          if (s.dead > 0) {
            s.dead -= dt;
          } else if (s.nextDead <= 0) {
            s.dead = 0.06 + Math.random() * 0.14;
            s.nextDead = 4 + Math.random() * 9;
          }
        }
        const buzz = animate ? 0.78 + 0.22 * Math.max(0, Math.sin(t * s.buzz + s.ph)) : 1;
        const a = s.dead > 0 ? 0.22 : buzz;
        ctx.globalAlpha = a;
        ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h);
        ctx.globalAlpha = 1;
      }

      // hanging red lanterns (赤提灯), swaying from a cord
      for (const ln of lanterns) {
        const sway = animate ? Math.sin(t * 1.1 + ln.ph) * 0.12 : 0;
        ctx.save();
        ctx.translate(ln.x, ln.y - ln.r * 2.2);
        ctx.rotate(sway);
        ctx.translate(0, ln.r * 2.2);
        // cord
        ctx.strokeStyle = 'rgba(20,16,30,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -ln.r * 2.2);
        ctx.lineTo(0, -ln.r);
        ctx.stroke();
        // glow
        const lg = ctx.createRadialGradient(0, 0, ln.r * 0.4, 0, 0, ln.r * 2.4);
        lg.addColorStop(0, 'rgba(255, 80, 70, 0.5)');
        lg.addColorStop(1, 'rgba(255, 80, 70, 0)');
        ctx.fillStyle = lg;
        ctx.fillRect(-ln.r * 2.4, -ln.r * 2.4, ln.r * 4.8, ln.r * 4.8);
        // body
        ctx.fillStyle = '#d22';
        ctx.beginPath();
        ctx.ellipse(0, 0, ln.r, ln.r * 1.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a0608'; // top & bottom caps
        ctx.fillRect(-ln.r * 0.5, -ln.r * 1.3, ln.r, ln.r * 0.22);
        ctx.fillRect(-ln.r * 0.5, ln.r * 1.1, ln.r, ln.r * 0.22);
        ctx.strokeStyle = 'rgba(80, 8, 8, 0.6)'; // ribbing
        ctx.lineWidth = 1;
        for (const ry of [-0.55, 0, 0.55]) {
          ctx.beginPath();
          ctx.ellipse(0, ln.r * ry, ln.r * Math.cos(ry), ln.r * 0.12, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#f5e9d0'; // kanji
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.round(ln.r * 1.0)}px ${FONT}`;
        ctx.fillText(ln.glyph, 0, 0);
        ctx.restore();
      }

      // vending-machine glow on the near-left, gently flickering
      const vmFlick = animate ? 0.82 + 0.18 * Math.sin(t * 13 + 1) : 1;
      const vx = w * 0.045;
      const vy = h * 0.6;
      const vg = ctx.createLinearGradient(vx, vy, vx, h);
      vg.addColorStop(0, `rgba(120, 245, 255, ${0.22 * vmFlick})`);
      vg.addColorStop(1, 'rgba(120, 245, 255, 0)');
      ctx.fillStyle = vg;
      ctx.fillRect(vx - 26, vy, 52, h - vy);
      ctx.fillStyle = `rgba(150, 250, 255, ${0.5 * vmFlick})`;
      ctx.fillRect(vx - 16, vy, 32, h * 0.3);
      for (let r = 0; r < 4; r++)
        for (let cc = 0; cc < 2; cc++) {
          ctx.fillStyle = ['#ff5cc8', '#ffcf52', '#4cf2ff', '#ff8a5c'][(r + cc) % 4];
          ctx.globalAlpha = 0.7 * vmFlick;
          ctx.fillRect(vx - 12 + cc * 14, vy + 8 + r * 18, 9, 12);
        }
      ctx.globalAlpha = 1;

      // steam rising from a street grate near centre
      if (animate) {
        nextPuff -= dt;
        if (nextPuff <= 0) {
          puffs.push({ x: w * 0.5 + (Math.random() - 0.5) * 40, y: h - 16, r: 10, life: 0, max: 3 + Math.random() * 2, vx: (Math.random() - 0.5) * 8 });
          nextPuff = 0.6 + Math.random() * 0.7;
        }
        puffs = puffs.filter((p) => {
          p.life += dt;
          if (p.life > p.max) return false;
          const k = p.life / p.max;
          p.y -= 16 * dt;
          p.x += p.vx * dt;
          const a = Math.sin(k * Math.PI) * 0.1;
          const rr = p.r + k * 46;
          const sg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
          sg.addColorStop(0, `rgba(200, 210, 235, ${a})`);
          sg.addColorStop(1, 'rgba(200, 210, 235, 0)');
          ctx.fillStyle = sg;
          ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
          return true;
        });
      }

      // rain: two depths, batched per depth
      if (animate) {
        for (const near of [false, true]) {
          ctx.strokeStyle = near ? 'rgba(180, 215, 255, 0.28)' : 'rgba(150, 190, 255, 0.13)';
          ctx.lineWidth = near ? 1.6 : 1;
          ctx.beginPath();
          for (const d of drops) {
            if (d.near !== near) continue;
            d.y += d.sp * dt * 60 * 0.16;
            d.x -= dt * 60 * 0.3;
            if (d.y > h) {
              d.y = -d.len;
              d.x = Math.random() * (w + 80);
              if (near && Math.random() < 0.5)
                splashes.push({ x: d.x, y: h - 2 - Math.random() * 4, life: 0, max: 0.32 });
            }
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.len * 0.22, d.y + d.len);
          }
          ctx.stroke();
        }
        // splashes where near drops land
        splashes = splashes.filter((s) => {
          s.life += dt;
          if (s.life > s.max) return false;
          const k = s.life / s.max;
          ctx.strokeStyle = `rgba(190, 220, 255, ${0.4 * (1 - k)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1 + k * 5, Math.PI, Math.PI * 2);
          ctx.stroke();
          return true;
        });
      }

      // foreground framing silhouettes (fire escape L, AC units R, cables)
      ctx.fillStyle = '#04030b';
      ctx.fillRect(0, 0, w * 0.07, h); // left wall column
      ctx.fillRect(w * 0.94, 0, w * 0.06, h); // right wall column
      // fire escape on the left edge
      ctx.strokeStyle = '#070512';
      ctx.lineWidth = 4;
      const fex = w * 0.085;
      for (let fy = h * 0.16; fy < h; fy += h * 0.2) {
        ctx.strokeRect(fex - 4, fy, 36, 5); // platform
        ctx.beginPath(); // diagonal stair
        ctx.moveTo(fex - 4, fy);
        ctx.lineTo(fex + 32, fy - h * 0.2 + 5);
        ctx.stroke();
        ctx.fillStyle = '#05030d';
        ctx.fillRect(fex + 30, fy - h * 0.2, 5, h * 0.2); // rail
      }
      // AC units bolted to the right wall
      ctx.fillStyle = '#06040f';
      for (let ay = h * 0.2; ay < h * 0.9; ay += h * 0.26) {
        ctx.fillRect(w * 0.9, ay, 40, 30);
        ctx.fillStyle = 'rgba(60, 70, 110, 0.35)';
        ctx.fillRect(w * 0.9 + 6, ay + 6, 28, 18); // grille glint
        ctx.fillStyle = '#06040f';
      }
      // sagging cables across the top
      ctx.strokeStyle = '#05030c';
      ctx.lineWidth = 2;
      for (const [y0, sag] of [[h * 0.08, 26], [h * 0.13, 40], [h * 0.05, 18]] as const) {
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(w * 0.5, y0 + sag, w, y0 - 6);
        ctx.stroke();
      }

      // lightning: multi-pulse white-blue wash every ~25-35s
      if (animate) {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flashT = 0;
          nextFlash = 25 + Math.random() * 10;
        }
        if (flashT >= 0) {
          flashT += dt;
          const k =
            flashT < 0.06 ? 0.9 :
            flashT < 0.14 ? 0.2 :
            flashT < 0.2 ? 0.7 :
            Math.max(0, 0.7 - (flashT - 0.2) / 0.4);
          if (flashT > 0.7) flashT = -1;
          else {
            ctx.fillStyle = `rgba(214, 230, 255, ${k * 0.22})`;
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
    // Explicitly pull the self-hosted pixel font (canvas honours neither
    // font-display nor lazy @font-face loading), then re-bake the signs so
    // the first frames can't catch a fallback or tofu. Robust whether or not
    // the visitor has any CJK fonts installed.
    if (document.fonts?.load) {
      document.fonts
        .load(`24px 'DotGothic16'`, SIGN_GLYPHS)
        .catch(() => {})
        .then(() => { if (w) placeSigns(); });
    }
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
    </div>
  );
}
