import { useEffect, useRef } from 'react';
import { PROJECTS } from '../content';
import { audio } from '../sound/AudioEngine';

/* ── pixel sprite maps ─────────────────────────────────────────── */
const PAL: Record<string, string> = {
  R: '#ff4a6b', // cap / shirt
  S: '#ffd9a0', // skin
  B: '#4a90ff', // overalls
  Y: '#ffcf52', // buttons
  K: '#2b1a10', // hair / boots
  W: '#ffffff',
  G: '#b06a3c', // goomba body
  D: '#6e4226', // goomba feet
  E: '#4cf2ff', // koopa shell (synthwave cyan)
  L: '#1d7a8c', // koopa dark
};

const MARIO_STAND = [
  '...RRRRR....',
  '..RRRRRRRRR.',
  '..KKKSSKS...',
  '.KSKSSSKSS..',
  '.KSKKSSSKSS.',
  '.KKSSSSKKKK.',
  '...SSSSSS...',
  '..RRBRRBRR..',
  '.RRRBRRBRRR.',
  'RRRRBBBBRRRR',
  'SSRBYBBYBRSS',
  'SSSBBBBBBSSS',
  'SSBBBBBBBBSS',
  '..BBB..BBB..',
  '.KKK....KKK.',
  'KKKK....KKKK',
];
const MARIO_WALK = [
  '...RRRRR....',
  '..RRRRRRRRR.',
  '..KKKSSKS...',
  '.KSKSSSKSS..',
  '.KSKKSSSKSS.',
  '.KKSSSSKKKK.',
  '...SSSSSS...',
  '..RRBRRBRR..',
  '.RRRBRRBRRR.',
  'RRRRBBBBRRRR',
  'SSRBYBBYBRSS',
  'SSSBBBBBBSSS',
  '.SBBBBBBBBS.',
  '..BBBBBB....',
  '..KKKKK.....',
  '.....KKKK...',
];
const GOOMBA = [
  '...KKKKKK...',
  '..GGGGGGGG..',
  '.GGGGGGGGGG.',
  'GGWWKGGKWWGG',
  'GGWWKGGKWWGG',
  'GGGGGGGGGGGG',
  '.GGGGGGGGGG.',
  '..DDDDDDDD..',
  '.DDD....DDD.',
  'DDDD....DDDD',
];
const GOOMBA_FLAT = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '..KKKKKKKK..',
  '.GGWWGGWWGG.',
  'GGGGGGGGGGGG',
  'DDDD....DDDD',
];
const KOOPA = [
  '....EEEE....',
  '..EELLLLEE..',
  '.ELLELLELLE.',
  '.ELELLLLELE.',
  '.ELLELLELLE.',
  '..EELLLLEE..',
  '...SSSSSS...',
  '..SS.SS.SS..',
  '.YYY....YYY.',
  'YYYY....YYYY',
];
const COIN = [
  '..AAAA..',
  '.AWAAAA.',
  'AWAAAAAA',
  'AWAAAAAA',
  'AAAAAAAA',
  '.AAAAAA.',
  '..AAAA..',
];
const COIN_PAL: Record<string, string> = { A: '#ffcf52', W: '#fff3c4' };

function drawSprite(
  ctx: CanvasRenderingContext2D,
  map: readonly string[],
  x: number,
  y: number,
  px: number,
  flip = false,
  pal: Record<string, string> = PAL,
) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = flip ? row[row.length - 1 - c] : row[c];
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c * px, y + r * px, px, px);
    }
  }
}

/* ── world state (lives in refs; React never re-renders the loop) ── */
interface Block {
  id: string;
  label: string;
  x: number; // world coords
  baseY: number;
  bump: number;
  cooldown: number;
  opened: boolean;
}
interface Walker {
  x: number;
  min: number;
  max: number;
  dir: number;
  kind: 'goomba' | 'koopa';
  state: 'walk' | 'squashed' | 'dead';
  squashT: number;
}
interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number;
}
interface Popup { x: number; y: number; text: string; life: number }
interface Coin { x: number; y: number; vy: number; life: number }

interface Props {
  selected: number;
  onBump: (projectId: string) => void;
  onFlag: () => void;
}

const LEVEL = 3200; // world width in px
const FLAG_X = LEVEL - 180;

/**
 * The quest world — a real scrolling platformer. Arrow keys / WASD move,
 * space or up jumps. Stomp goombas for points, bump ? blocks to open
 * projects, reach the flagpole at the far right to complete the level
 * (black hole back to game select).
 * Side hits knock Mario back with 0.5s of i-frames — never a restart.
 */
export default function MarioWorld({ selected, onBump, onFlag }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ selected, onBump, onFlag });
  propsRef.current = { selected, onBump, onFlag };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let raf = 0;

    const PX = 3; // sprite pixel size
    const GROUND = () => h - 56;

    const mario = {
      x: 120, y: 0, vx: 0, vy: 0, onGround: false, facing: 1, walkT: 0,
      hurtT: 0, // i-frames countdown (frames)
      knockVx: 0,
    };
    const keys = new Set<string>();
    let camX = 0;
    let score = 0;
    let coinsGot = 0;
    let flagged = false;

    const blocks: Block[] = PROJECTS.map((p, i) => ({
      id: p.id,
      label: p.name,
      x: 560 + i * 760,
      baseY: 0,
      bump: 0,
      cooldown: 0,
      opened: false,
    }));
    const walkers: Walker[] = [
      { x: 460, min: 360, max: 760, dir: 1, kind: 'goomba', state: 'walk', squashT: 0 },
      { x: 1100, min: 980, max: 1420, dir: -1, kind: 'goomba', state: 'walk', squashT: 0 },
      { x: 1700, min: 1560, max: 1980, dir: 1, kind: 'koopa', state: 'walk', squashT: 0 },
      { x: 2280, min: 2140, max: 2540, dir: -1, kind: 'goomba', state: 'walk', squashT: 0 },
      { x: 2750, min: 2620, max: 2950, dir: 1, kind: 'goomba', state: 'walk', squashT: 0 },
    ];
    const particles: Particle[] = [];
    const popups: Popup[] = [];
    const coins: Coin[] = [];

    /* ── nightscape backdrop: layers pre-rendered offscreen on resize,
       blitted per frame at their own parallax rates (stars 0.05 →
       mountains 0.15 → castle 0.2 → hills 0.4 → ground 1.0) ── */
    const stars: { x: number; y: number; size: number; tw: number }[] = [];
    const fireflies: { x: number; y: number; phase: number; speed: number; drift: number }[] = [];
    let shoots: { x: number; y: number; vx: number; vy: number; life: number; max: number }[] = [];
    let nextShoot = 5 + Math.random() * 7;
    let sky: HTMLCanvasElement | null = null;
    let aurora: HTMLCanvasElement | null = null;
    let moon: HTMLCanvasElement | null = null;
    let mountains: HTMLCanvasElement | null = null;
    let hills: HTMLCanvasElement | null = null;
    let castle: HTMLCanvasElement | null = null;
    let castleWins: { x: number; y: number; ph: number }[] = [];
    const CPX = 6; // castle sprite cell size

    /** deterministic pseudo-random so textures are stable across frames */
    const rng = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    const buildSky = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(w, 32);
      c.height = Math.max(h, 32);
      const g = c.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, 0, c.height);
      grad.addColorStop(0, '#050b2a'); // deep blue
      grad.addColorStop(0.45, '#150b38'); // purple
      grad.addColorStop(0.8, '#240e44');
      grad.addColorStop(1, '#321048'); // dark magenta at the horizon
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
      sky = c;
    };

    const buildAurora = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(w, 600);
      c.height = Math.max(Math.round(h * 0.34), 80);
      const g = c.getContext('2d')!;
      const ribbons = [
        { col: 'rgba(76, 242, 255, 0.11)', base: c.height * 0.42, amp: 26, ph: 0, th: 38 },
        { col: 'rgba(255, 92, 200, 0.09)', base: c.height * 0.6, amp: 34, ph: 2.1, th: 30 },
        { col: 'rgba(76, 242, 255, 0.07)', base: c.height * 0.28, amp: 20, ph: 4.4, th: 52 },
      ];
      g.filter = 'blur(12px)';
      for (const rb of ribbons) {
        g.fillStyle = rb.col;
        for (let x = -20; x < c.width + 20; x += 4) {
          const y = rb.base + Math.sin(x * 0.006 + rb.ph) * rb.amp + Math.sin(x * 0.0017 + rb.ph * 2) * rb.amp * 0.8;
          g.fillRect(x, y - rb.th / 2, 4, rb.th);
        }
      }
      g.filter = 'none';
      aurora = c;
    };

    const buildMoon = () => {
      const px = 4;
      const R = 14; // moon radius in cells
      const halo = R * px * 3;
      const c = document.createElement('canvas');
      c.width = c.height = halo * 2;
      const g = c.getContext('2d')!;
      const glow = g.createRadialGradient(halo, halo, R * px * 0.5, halo, halo, halo);
      glow.addColorStop(0, 'rgba(214, 226, 255, 0.3)');
      glow.addColorStop(0.5, 'rgba(190, 205, 255, 0.09)');
      glow.addColorStop(1, 'rgba(190, 205, 255, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, c.width, c.height);
      const craters = [
        { x: -6, y: -3, r: 3.2 },
        { x: 4, y: 5, r: 2.4 },
        { x: 2, y: -7, r: 1.8 },
        { x: -2, y: 8, r: 1.4 },
        { x: 7, y: -1, r: 1.6 },
      ];
      for (let yy = -R; yy <= R; yy++) {
        for (let xx = -R; xx <= R; xx++) {
          const d2 = xx * xx + yy * yy;
          if (d2 > R * R) continue;
          let col = '#e9ecff';
          if (xx + yy > R * 0.85) col = '#c9d1f2'; // shaded lower-right limb
          for (const cr of craters) {
            const dd = (xx - cr.x) ** 2 + (yy - cr.y) ** 2;
            if (dd <= cr.r * cr.r) col = '#b4bee4';
            else if (dd <= (cr.r + 0.9) ** 2 && xx - cr.x < 0) col = '#d6ddf8'; // rim catches the light
          }
          g.fillStyle = col;
          g.fillRect(halo + xx * px, halo + yy * px, px, px);
        }
      }
      moon = c;
    };

    const buildMountains = () => {
      const T = 1600;
      const MH = 230;
      const c = document.createElement('canvas');
      c.width = T;
      c.height = MH;
      const g = c.getContext('2d')!;
      // peaks drawn at x-T/x/x+T so the tile wraps without a seam
      const range = (col: string, seedBase: number, hMin: number, hVar: number, yBase: number) => {
        g.fillStyle = col;
        let x = rng(seedBase) * 120;
        let i = 0;
        while (x < T) {
          const ph = hMin + rng(seedBase + i * 13.7) * hVar;
          const hw = ph * (0.8 + rng(seedBase + i * 7.1) * 0.55);
          const steps = Math.ceil(ph / 12);
          for (const ox of [-T, 0, T]) {
            for (let k = 0; k < steps; k++) {
              const half = Math.round(((hw * (k + 1)) / steps / 8)) * 8;
              g.fillRect(x + ox - half, yBase - ph + k * 12, half * 2, 13);
            }
          }
          x += hw * (1.05 + rng(seedBase + i * 3.3) * 0.6);
          i++;
        }
        g.fillRect(0, yBase - 6, T, MH - yBase + 6);
      };
      range('#2a1452', 11, 100, 110, MH - 24); // back range, moonlit purple
      range('#1a0b38', 77, 60, 90, MH); // front range, deeper
      mountains = c;
    };

    const buildHills = () => {
      const T = 1400;
      const HH = 170;
      const c = document.createElement('canvas');
      c.width = T;
      c.height = HH;
      const g = c.getContext('2d')!;
      const pine = (x: number, base: number, s: number) => {
        g.fillStyle = '#160826';
        g.fillRect(x - s, base - 2 * s, 2 * s, 2 * s); // trunk
        g.fillStyle = '#170a30';
        g.fillRect(x - 4 * s, base - 4 * s, 8 * s, 2 * s);
        g.fillRect(x - 3 * s, base - 6 * s, 6 * s, 2 * s);
        g.fillRect(x - 2 * s, base - 8 * s, 4 * s, 2 * s);
        g.fillRect(x - s, base - 10 * s, 2 * s, 2 * s);
        g.fillStyle = '#2e165c'; // moonlit right side
        g.fillRect(x + 2 * s, base - 4 * s, s, s);
        g.fillRect(x + s, base - 6 * s, s, s);
        g.fillRect(x, base - 8 * s, s, s);
      };
      for (let i = 0; i < 6; i++) {
        const hx = (i * T) / 6 + rng(i * 5.3) * 70;
        const r = 95 + rng(i * 9.1) * 65;
        for (const ox of [-T, 0, T]) {
          g.fillStyle = '#2d1356';
          g.beginPath();
          g.arc(hx + ox, HH + r * 0.45, r, Math.PI, 0);
          g.fill();
          for (let p2 = 0; p2 < 2 + (i % 2); p2++) {
            const px2 = hx + ox - 44 + p2 * 42 + rng(i * 3.7 + p2) * 14;
            const crest = HH + r * 0.45 - Math.sqrt(Math.max(r * r - (px2 - hx - ox) ** 2, 0));
            pine(px2, crest + 8, 3 + (p2 % 2));
          }
        }
      }
      hills = c;
    };

    /** Bowser's castle, pre-rendered: crenellated keep, three towers with
        stepped pointed roofs, arched gate, moonlit edges, stone texture.
        Windows (torch flicker) and the flag (waves) are drawn live. */
    const buildCastle = () => {
      const COLS = 64;
      const ROWS = 50;
      const c = document.createElement('canvas');
      c.width = COLS * CPX;
      c.height = ROWS * CPX;
      const g = c.getContext('2d')!;
      const STONE = '#1f1040';
      const DARK = '#140929';
      const LIT = '#34205c';
      const EDGE = '#0c051e';
      const cl = (x: number, y: number, cw: number, ch: number, col: string) => {
        g.fillStyle = col;
        g.fillRect(x * CPX, y * CPX, cw * CPX, ch * CPX);
      };
      const roof = (xc: number, top: number, half: number) => {
        for (let k = 0; half - k > 0; k++) {
          cl(xc - (half - k), top - k, (half - k) * 2, 1, '#33125e');
          cl(xc - (half - k), top - k, 1, 1, '#462080'); // lit left slope
        }
      };
      // keep body + crenellated battlements
      cl(12, 24, 40, 26, STONE);
      cl(12, 24, 1, 26, LIT);
      cl(51, 24, 1, 26, EDGE);
      for (let mx = 12; mx < 52; mx += 4) cl(mx, 22, 2, 2, STONE);
      cl(12, 24, 40, 1, LIT);
      // side towers with pointed roofs
      for (const tx of [5, 51]) {
        cl(tx, 18, 8, 32, STONE);
        cl(tx, 18, 1, 32, LIT);
        cl(tx + 7, 18, 1, 32, EDGE);
        cl(tx - 1, 17, 10, 1, STONE);
        roof(tx + 4, 16, 6);
      }
      // central tower — tallest, carries the flag
      cl(27, 12, 10, 38, STONE);
      cl(27, 12, 1, 38, LIT);
      cl(36, 12, 1, 38, EDGE);
      cl(26, 11, 12, 1, STONE);
      roof(32, 10, 7);
      cl(31, 0, 1, 4, '#8d8aa3'); // flag pole above the apex
      // arched gate
      cl(30, 40, 4, 1, EDGE);
      cl(29, 41, 6, 1, EDGE);
      cl(28, 42, 8, 8, EDGE);
      cl(27, 42, 1, 8, LIT);
      // sparse stone texture
      g.globalAlpha = 0.4;
      for (let i = 0; i < 130; i++) {
        const sx2 = Math.floor(rng(i * 1.7) * COLS);
        const sy2 = 12 + Math.floor(rng(i * 3.1 + 9) * 38);
        cl(sx2, sy2, 1, 1, rng(i + 99) < 0.5 ? DARK : LIT);
      }
      g.globalAlpha = 1;
      castle = c;
      castleWins = [
        { x: 7 * CPX, y: 26 * CPX, ph: 0.9 }, // left tower
        { x: 53 * CPX, y: 26 * CPX, ph: 2.2 }, // right tower
        { x: 30 * CPX, y: 16 * CPX, ph: 4.1 }, // central tower
        { x: 17 * CPX, y: 30 * CPX, ph: 5.6 }, // keep left
        { x: 44 * CPX, y: 30 * CPX, ph: 1.6 }, // keep right
      ];
    };

    const burst = (x: number, y: number, color: string, n = 10) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const sp = 1.5 + Math.random() * 2.5;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 0, max: 28 + Math.random() * 14, color, size: 2 + Math.random() * 3 });
      }
    };

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      blocks.forEach((b, i) => {
        b.baseY = GROUND() - 150 - (i % 2) * 28;
      });
      mario.y = GROUND() - 16 * PX;

      buildSky();
      buildAurora();
      buildMoon();
      buildMountains();
      buildHills();
      buildCastle();
      stars.length = 0;
      const starCount = Math.round((w * h) / 6000); // dense night sky
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * (w + 400),
          y: Math.random() * Math.max(GROUND() - 160, 100),
          size: Math.random() < 0.82 ? 1 : 2,
          tw: Math.random() * Math.PI * 2,
        });
      }
      fireflies.length = 0;
      for (let i = 0; i < 14; i++) {
        fireflies.push({
          x: Math.random() * LEVEL,
          y: GROUND() - 10 - Math.random() * 150,
          phase: Math.random() * Math.PI * 2,
          speed: 0.12 + Math.random() * 0.25,
          drift: Math.random() * Math.PI * 2,
        });
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const KEYMAP: Record<string, string> = {
      a: 'ArrowLeft', A: 'ArrowLeft', d: 'ArrowRight', D: 'ArrowRight',
      w: 'ArrowUp', W: 'ArrowUp', ' ': 'ArrowUp',
    };
    const down = (e: KeyboardEvent) => {
      const k = KEYMAP[e.key] ?? e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) {
        e.preventDefault();
        keys.add(k);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(KEYMAP[e.key] ?? e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    // touch d-pad wires in through custom events from QuestLog's buttons
    const touchDown = (e: Event) => keys.add((e as CustomEvent<string>).detail);
    const touchUp = (e: Event) => keys.delete((e as CustomEvent<string>).detail);
    window.addEventListener('mario-down', touchDown);
    window.addEventListener('mario-up', touchUp);

    let t = 0;
    const tick = () => {
      t += 1 / 60;
      const MW = 12 * PX;
      const MH = 16 * PX;

      /* ── physics ── */
      const speed = 3.4;
      const steer = (keys.has('ArrowRight') ? speed : 0) - (keys.has('ArrowLeft') ? speed : 0);
      // knockback decays; steering blends back in as it fades
      mario.knockVx *= 0.85;
      mario.vx = steer + mario.knockVx;
      if (steer !== 0) mario.facing = Math.sign(steer);
      if (keys.has('ArrowUp') && mario.onGround) {
        mario.vy = -10.5;
        mario.onGround = false;
        audio.jump();
        keys.delete('ArrowUp'); // no auto-bounce on hold
      }
      mario.vy += 0.55;
      mario.x = Math.max(0, Math.min(LEVEL - MW, mario.x + mario.vx));
      mario.y += mario.vy;
      if (mario.y >= GROUND() - MH) {
        mario.y = GROUND() - MH;
        mario.vy = 0;
        mario.onGround = true;
      }
      mario.walkT += Math.abs(mario.vx) * 0.05;
      if (mario.hurtT > 0) mario.hurtT--;

      /* camera follows with a soft lead, clamped to the level */
      const target = mario.x - w * 0.42;
      camX += (target - camX) * 0.12;
      camX = Math.max(0, Math.min(LEVEL - w, camX));

      /* block head-bump */
      for (const b of blocks) {
        const bx = b.x - 24;
        const by = b.baseY + Math.sin(t * 2.2 + b.x * 0.01) * 6 - b.bump;
        b.cooldown = Math.max(0, b.cooldown - 1);
        b.bump *= 0.82;
        if (
          mario.vy < 0 &&
          mario.y <= by + 48 &&
          mario.y >= by + 24 &&
          mario.x + MW > bx + 6 &&
          mario.x < bx + 42
        ) {
          mario.vy = 1.5;
          b.bump = 14;
          if (b.cooldown === 0) {
            b.cooldown = 60;
            b.opened = true;
            score += 200;
            coinsGot++;
            coins.push({ x: b.x, y: by - 28, vy: -5, life: 0 });
            popups.push({ x: b.x, y: by - 40, text: '+200', life: 0 });
            burst(b.x, by, '#ffcf52', 8);
            audio.marioCoin();
            propsRef.current.onBump(b.id);
          }
        }
      }

      /* walkers: stomp vs side hit */
      for (const wk of walkers) {
        if (wk.state === 'dead') continue;
        if (wk.state === 'squashed') {
          wk.squashT--;
          if (wk.squashT <= 0) {
            wk.state = 'dead';
            burst(wk.x, GROUND() - 12, wk.kind === 'koopa' ? '#4cf2ff' : '#b06a3c', 12);
          }
          continue;
        }
        wk.x += wk.dir * 0.55;
        if (wk.x < wk.min || wk.x > wk.max) wk.dir *= -1;

        const map = wk.kind === 'goomba' ? GOOMBA : KOOPA;
        const wkW = 12 * PX;
        const wkH = map.length * PX;
        const wy = GROUND() - wkH;
        const overlapX = mario.x + MW > wk.x - wkW / 2 + 4 && mario.x < wk.x + wkW / 2 - 4;
        const marioBottom = mario.y + MH;

        if (overlapX && marioBottom > wy && mario.y < wy + wkH) {
          if (mario.vy > 1.5 && marioBottom < wy + wkH * 0.7) {
            // stomp: flatten, bounce, score
            wk.state = 'squashed';
            wk.squashT = 26;
            mario.vy = -6.5;
            score += 100;
            popups.push({ x: wk.x, y: wy - 16, text: '+100', life: 0 });
            burst(wk.x, wy + wkH / 2, '#ffffff', 6);
            audio.stomp();
          } else if (mario.hurtT === 0) {
            // side contact: knockback + 0.5s i-frames, never a restart
            mario.hurtT = 30;
            mario.knockVx = mario.x < wk.x ? -7 : 7;
            mario.vy = -4;
            mario.onGround = false;
            burst(mario.x + MW / 2, mario.y + MH / 2, '#ff4a6b', 8);
            audio.hurt();
          }
        }
      }

      /* flagpole */
      if (!flagged && mario.x + MW > FLAG_X - 6) {
        flagged = true;
        audio.flagpole();
        burst(FLAG_X, GROUND() - 160, '#ff5cc8', 18);
        window.setTimeout(() => propsRef.current.onFlag(), 700);
      }

      /* particles / popups / coins */
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        if (p.life > p.max) particles.splice(i, 1);
      }
      for (let i = popups.length - 1; i >= 0; i--) {
        popups[i].life++;
        popups[i].y -= 0.7;
        if (popups[i].life > 50) popups.splice(i, 1);
      }
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.life++;
        c.y += c.vy;
        c.vy += 0.3;
        if (c.life > 26) coins.splice(i, 1);
      }

      /* ── draw ── */

      // sky + aurora (aurora breathes and sways, never scrolls — no seam)
      if (sky) ctx.drawImage(sky, 0, 0, w, h);
      if (aurora) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.23);
        ctx.drawImage(aurora, Math.sin(t * 0.05) * 14, 8);
        ctx.globalAlpha = 1;
      }

      // stars: slowest layer (0.05), gentle twinkle
      ctx.fillStyle = '#e8e6dc';
      for (const s of stars) {
        const span = w + 400;
        const sx = ((((s.x - camX * 0.05) % span) + span) % span) - 200;
        ctx.globalAlpha = 0.25 + (0.5 + 0.5 * Math.sin(s.tw + t * 1.4)) * 0.5;
        ctx.fillRect(sx, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // moon: pre-rendered pixel disc with craters + halo, drifting slowly
      if (moon) {
        const moonX = w * 0.72 - camX * 0.05 + Math.sin(t * 0.04) * 18;
        const moonY = h * 0.17 + Math.sin(t * 0.06) * 7;
        ctx.drawImage(moon, moonX - moon.width / 2, moonY - moon.height / 2);
      }

      // occasional shooting star high in the sky
      nextShoot -= 1 / 60;
      if (nextShoot <= 0 && shoots.length < 1) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const sp = 2.4 + Math.random() * 1.8;
        shoots.push({
          x: Math.random() * w * 0.8 + w * 0.1,
          y: Math.random() * h * 0.22,
          vx: dir * sp,
          vy: sp * 0.45,
          life: 0,
          max: 70 + Math.random() * 50,
        });
        nextShoot = 8 + Math.random() * 10;
      }
      shoots = shoots.filter((m) => {
        m.life++;
        if (m.life > m.max) return false;
        m.x += m.vx;
        m.y += m.vy;
        const fade = Math.sin((m.life / m.max) * Math.PI);
        const trail = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 26, m.y - m.vy * 26);
        trail.addColorStop(0, `rgba(232, 240, 255, ${0.85 * fade})`);
        trail.addColorStop(1, 'rgba(140, 170, 255, 0)');
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 26, m.y - m.vy * 26);
        ctx.stroke();
        return true;
      });

      // classic 3-bump pixel clouds, two depths (far set behind mountains)
      const cloud = (cx2: number, cy2: number, sc: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#cfd2ee';
        ctx.fillRect(cx2, cy2 + 8 * sc, 56 * sc, 12 * sc);
        ctx.fillRect(cx2 + 6 * sc, cy2 + 2 * sc, 16 * sc, 8 * sc);
        ctx.fillRect(cx2 + 22 * sc, cy2 - 6 * sc, 16 * sc, 16 * sc);
        ctx.fillRect(cx2 + 38 * sc, cy2 + 2 * sc, 12 * sc, 8 * sc);
        ctx.fillStyle = '#9aa3d4'; // shaded underside
        ctx.fillRect(cx2 + 2 * sc, cy2 + 17 * sc, 52 * sc, 3 * sc);
        ctx.globalAlpha = 1;
      };
      for (let i = 0; i < 6; i++) {
        const sc = 0.8 + (i % 2) * 0.4;
        const cw = 56 * sc;
        const cx2 = ((i * 420 + t * (4 + i)) % (LEVEL + cw)) - cw - camX * 0.08;
        if (cx2 > -cw && cx2 < w + cw) cloud(cx2, 40 + ((i * 73) % 130), sc, 0.16);
      }

      // far mountains (0.15): stepped pixel ranges, two depths in one tile
      const tile = (img: HTMLCanvasElement, scroll: number, y: number) => {
        const tw = img.width;
        let x = (((scroll % tw) + tw) % tw) - tw;
        for (; x < w; x += tw) ctx.drawImage(img, x, y);
      };
      if (mountains) tile(mountains, -camX * 0.15, GROUND() - mountains.height + 24);

      // Bowser's castle (0.2): pre-rendered pixel-art keep that creeps in
      // from the right as Mario nears the flagpole — the reward beat
      if (castle) {
        // Far layer that slides in from the right as Mario nears the flag.
        // Anchored so it frames fully when the camera pins at its far edge
        // (which happens ~650px before the flag) and is hidden off-screen at
        // the start — a constant per-width parallax rate, robust to viewport
        // size where a fixed 0.2 would barely move on wide screens.
        const camXmax = Math.max(LEVEL - w, 1);
        const framedX = w - castle.width - Math.max(96, w * 0.07);
        const castleX = w + 60 - camX * ((w + 60 - framedX) / camXmax);
        if (castleX < w + 40 && castleX > -castle.width) {
          const castleY = GROUND() - castle.height + 4;
          ctx.drawImage(castle, castleX, castleY);
          // windows flicker like torchlight, each on its own clock
          for (const win of castleWins) {
            const wx2 = castleX + win.x;
            const wy2 = castleY + win.y;
            const flick = Math.max(0.35, Math.min(1, 0.66 + 0.2 * Math.sin(t * 8 + win.ph) + 0.16 * Math.sin(t * 21 + win.ph * 3)));
            ctx.fillStyle = '#ffb347';
            ctx.globalAlpha = flick * 0.16; // soft torch spill around the opening
            ctx.fillRect(wx2 - CPX, wy2 - CPX, 4 * CPX, 6 * CPX);
            ctx.globalAlpha = flick; // crisp arched window: 2-wide body, 1-cell arch cap
            ctx.fillStyle = '#ffd089';
            ctx.fillRect(wx2, wy2, 2 * CPX, 4 * CPX);
            ctx.fillRect(wx2 + 0.5 * CPX, wy2 - CPX, CPX, CPX);
          }
          ctx.globalAlpha = 1;
          // flag waving from the tallest tower
          const fpx = castleX + 31 * CPX;
          const fpy = castleY;
          ctx.fillStyle = '#ff5cc8';
          ctx.beginPath();
          ctx.moveTo(fpx, fpy + 1);
          ctx.lineTo(fpx - 17 - Math.sin(t * 4) * 3, fpy + 6);
          ctx.lineTo(fpx, fpy + 11);
          ctx.fill();
        }
      }

      // near clouds drift in front of the castle
      for (let i = 0; i < 4; i++) {
        const sc = 1.3 + (i % 2) * 0.5;
        const cw = 56 * sc;
        const cx2 = ((i * 760 + 200 + t * (9 + i * 3)) % (LEVEL + cw)) - cw - camX * 0.3;
        if (cx2 > -cw && cx2 < w + cw) cloud(cx2, 70 + ((i * 97) % 110), sc, 0.26);
      }

      // mid hills with pixel pines (0.4)
      if (hills) tile(hills, -camX * 0.4, GROUND() - hills.height + 8);

      // ground: textured pixel bricks, occasional cracks, world-locked
      const gy = GROUND();
      ctx.fillStyle = '#150b26';
      ctx.fillRect(0, gy, w, h - gy);
      const rows = Math.ceil((h - gy) / 12);
      const startB = Math.floor(camX / 24) - 1;
      const endB = Math.ceil((camX + w) / 24) + 1;
      for (let bxi = startB; bxi <= endB; bxi++) {
        for (let row = 0; row < rows; row++) {
          const off = row % 2 ? 12 : 0;
          const sx = bxi * 24 + off - camX;
          const idx = bxi * 31 + row * 57;
          const shade = rng(idx);
          ctx.fillStyle = shade < 0.18 ? '#241040' : shade < 0.38 ? '#2e1150' : '#2a0d4a';
          ctx.fillRect(sx, gy + row * 12 + 2, 22, 10);
          if (rng(idx * 1.93) < 0.1) {
            ctx.fillStyle = '#120822'; // cracked brick
            ctx.fillRect(sx + 6, gy + row * 12 + 3, 2, 5);
            ctx.fillRect(sx + 8, gy + row * 12 + 6, 2, 4);
            ctx.fillRect(sx + 13, gy + row * 12 + 2, 2, 4);
          }
        }
      }
      ctx.fillStyle = 'rgba(76, 242, 255, 0.5)';
      ctx.fillRect(0, gy, w, 2);
      // grass tufts along the lip
      for (let gx = Math.floor(camX / 46) * 46; gx < camX + w + 46; gx += 46) {
        const j = rng(gx * 0.137);
        if (j < 0.3) continue;
        const sx = gx - camX + j * 30;
        const th = 3 + Math.round(j * 4);
        ctx.fillStyle = 'rgba(58, 150, 168, 0.85)';
        ctx.fillRect(sx, gy - th, 2, th);
        ctx.fillRect(sx - 3, gy - th + 2, 2, th - 2);
        ctx.fillRect(sx + 3, gy - th + 2, 2, th - 2);
      }

      // fireflies: drift upward near the ground, pulsing in and out
      for (const f of fireflies) {
        f.phase += 0.025 + f.speed * 0.012;
        f.y -= f.speed;
        f.x += Math.sin(t * 0.8 + f.drift) * 0.3;
        if (f.y < GROUND() - 190) {
          f.y = GROUND() - 8;
          f.x = camX + Math.random() * w;
          f.phase = Math.random() * Math.PI * 2;
        }
        const ffx = f.x - camX;
        if (ffx < -10 || ffx > w + 10) continue;
        const a = Math.max(0, Math.sin(f.phase));
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = '#ffe88a';
        ctx.fillRect(ffx, f.y, 2, 2);
        ctx.globalAlpha = a * 0.22;
        ctx.fillRect(ffx - 2, f.y - 2, 6, 6);
      }
      ctx.globalAlpha = 1;

      // flagpole
      const fx = FLAG_X - camX;
      if (fx > -80 && fx < w + 80) {
        ctx.fillStyle = '#8d8aa3';
        ctx.fillRect(fx, GROUND() - 220, 5, 220);
        ctx.fillStyle = '#e8e6dc';
        ctx.fillRect(fx - 3, GROUND() - 228, 11, 8);
        // flag waves toward the pole top; slides down once reached
        const flagY = flagged ? GROUND() - 70 : GROUND() - 208;
        ctx.fillStyle = '#ff5cc8';
        ctx.beginPath();
        ctx.moveTo(fx, flagY);
        ctx.lineTo(fx - 38 - Math.sin(t * 5) * 3, flagY + 12);
        ctx.lineTo(fx, flagY + 24);
        ctx.fill();
      }

      // ? blocks
      blocks.forEach((b, i) => {
        const bx = b.x - 24 - camX;
        if (bx < -80 || bx > w + 80) return;
        const by = b.baseY + Math.sin(t * 2.2 + b.x * 0.01) * 6 - b.bump;
        const hot = i === propsRef.current.selected;
        ctx.fillStyle = hot ? '#ffe18a' : '#ffcf52';
        ctx.fillRect(bx, by, 48, 48);
        ctx.fillStyle = '#8a6a1c';
        ctx.fillRect(bx, by, 48, 4);
        ctx.fillRect(bx, by + 44, 48, 4);
        ctx.fillRect(bx, by, 4, 48);
        ctx.fillRect(bx + 44, by, 4, 48);
        if (hot) {
          ctx.shadowColor = '#ffcf52';
          ctx.shadowBlur = 18 + Math.sin(t * 6) * 8;
        }
        ctx.fillStyle = '#0a0612';
        ctx.font = '22px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('?', bx + 24, by + 36);
        ctx.shadowBlur = 0;
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = hot ? '#ffffff' : '#e8e6dc';
        ctx.fillText(b.label, bx + 24, by - 10);
      });

      // walkers
      for (const wk of walkers) {
        if (wk.state === 'dead') continue;
        const flat = wk.state === 'squashed';
        const map = flat ? GOOMBA_FLAT : wk.kind === 'goomba' ? GOOMBA : KOOPA;
        const wx = wk.x - 18 - camX;
        if (wx < -60 || wx > w + 60) continue;
        const wy = GROUND() - map.length * PX;
        drawSprite(ctx, map, wx, wy, PX, wk.dir < 0);
      }

      // coins
      for (const c of coins) {
        drawSprite(ctx, COIN, c.x - 12 - camX, c.y, PX, false, COIN_PAL);
      }

      // particles
      for (const p of particles) {
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camX, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // score popups
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      for (const pp of popups) {
        ctx.globalAlpha = 1 - pp.life / 50;
        ctx.fillStyle = '#ffcf52';
        ctx.fillText(pp.text, pp.x - camX, pp.y);
      }
      ctx.globalAlpha = 1;

      // mario (flash during i-frames)
      const frame = !mario.onGround || (Math.abs(mario.vx) > 0.3 && Math.floor(mario.walkT) % 2 === 0) ? MARIO_WALK : MARIO_STAND;
      if (mario.hurtT === 0 || Math.floor(mario.hurtT / 4) % 2 === 0) {
        drawSprite(ctx, frame, mario.x - camX, mario.y, PX, mario.facing < 0);
      }

      // HUD: score + coins, canvas-drawn so it never overlaps DOM panels
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffcf52';
      ctx.fillText(`SCORE ${String(score).padStart(6, '0')}`, 16, 64);
      ctx.fillStyle = '#4cf2ff';
      ctx.fillText(`COINS ${String(coinsGot).padStart(2, '0')}`, 16, 82);

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mario-down', touchDown);
      window.removeEventListener('mario-up', touchUp);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
