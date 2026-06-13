import { useEffect, useRef } from 'react';
import { SKILL_ROWS } from '../content';
import { audio } from '../sound/AudioEngine';

/* ── sprites ───────────────────────────────────────────────────── */
const INVADER_A = [
  '..X......X..',
  '...X....X...',
  '..XXXXXXXX..',
  '.XX.XXXX.XX.',
  'XXXXXXXXXXXX',
  'X.XXXXXXXX.X',
  'X.X......X.X',
  '...XX..XX...',
];
const INVADER_B = [
  '..X......X..',
  'X..X....X..X',
  'X.XXXXXXXX.X',
  'XXX.XXXX.XXX',
  'XXXXXXXXXXXX',
  '.XXXXXXXXXX.',
  '..X......X..',
  '.X........X.',
];
const SHIP = [
  '.....X.....',
  '....XXX....',
  '....XXX....',
  '.XXXXXXXXX.',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
];

/* 5×5 pixel font for the DEREK barriers */
const LETTERS: Record<string, string[]> = {
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  E: ['XXXXX', 'X....', 'XXXX.', 'X....', 'XXXXX'],
  R: ['XXXX.', 'X...X', 'XXXX.', 'X..X.', 'X...X'],
  K: ['X...X', 'X..X.', 'XXX..', 'X..X.', 'X...X'],
};

const COLOR: Record<string, string> = {
  amber: '#ffcf52',
  cyan: '#4cf2ff',
  magenta: '#ff5cc8',
};

function drawMap(ctx: CanvasRenderingContext2D, map: string[], x: number, y: number, px: number, color: string) {
  ctx.fillStyle = color;
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === 'X') ctx.fillRect(x + c * px, y + r * px, px, px);
    }
  }
}

interface Invader {
  skill: string;
  color: string;
  col: number;
  row: number;
  alive: boolean;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Cell { x: number; y: number; alive: boolean }

export interface InvaderStats { shots: number; hits: number; seconds: number }

interface Props {
  onZap: (skill: string) => void;
  onWin: (stats: InvaderStats) => void;
}

/**
 * A real Space Invaders. ←→ moves the ship, space fires. Each invader is
 * a skill — shooting it bursts particles and surfaces a one-line scan of
 * where that skill has shipped. Barriers spell DEREK and erode under fire
 * from both sides. Clearing the formation = SKILLS LOADED.
 */
export default function InvadersGame({ onZap, onWin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef({ onZap, onWin });
  cbRef.current = { onZap, onWin };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let raf = 0;

    const PX = 2;
    const INV_W = 12 * PX;
    const INV_H = 8 * PX;

    /* formation: one row per skill category, centered */
    const rows = SKILL_ROWS.map((r) => ({ color: COLOR[r.color], skills: r.skills }));
    const maxCols = Math.max(...rows.map((r) => r.skills.length));
    const invaders: Invader[] = [];
    rows.forEach((row, r) => {
      row.skills.forEach((skill, c) => {
        // center shorter rows inside the widest one
        const offset = (maxCols - row.skills.length) / 2;
        invaders.push({ skill, color: row.color, col: c + offset, row: r, alive: true });
      });
    });

    const SPACING_X = 92;
    const SPACING_Y = 58;
    let formX = 0; // group offset
    let formY = 0;
    let formDir = 1;

    const ship = { x: 0, fireCd: 0, hurtT: 0 };
    const keys = new Set<string>();
    const bullets: { x: number; y: number }[] = [];
    const bombs: { x: number; y: number; vy: number }[] = [];
    const particles: Particle[] = [];
    let barrier: Cell[] = [];
    let mouse = { x: -100, y: -100, inside: false };
    let shots = 0;
    let hits = 0;
    let frames = 0;
    let won = false;

    const burst = (x: number, y: number, color: string, n = 16) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
        const sp = 1 + Math.random() * 3.5;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 24 + Math.random() * 20, color, size: 1.5 + Math.random() * 3 });
      }
    };

    const buildBarrier = () => {
      barrier = [];
      const word = 'DEREK';
      const cell = 7;
      const letterW = 5 * cell;
      const gap = cell * 2.2;
      const total = word.length * letterW + (word.length - 1) * gap;
      const x0 = (w - total) / 2;
      const y0 = h - 170;
      [...word].forEach((ch, li) => {
        const map = LETTERS[ch];
        map.forEach((rowStr, r) => {
          [...rowStr].forEach((c, ci) => {
            if (c === 'X') barrier.push({ x: x0 + li * (letterW + gap) + ci * cell, y: y0 + r * cell, alive: true });
          });
        });
      });
    };

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      ship.x = w / 2;
      buildBarrier();
    };
    resize();
    window.addEventListener('resize', resize);

    const fire = () => {
      if (ship.fireCd > 0 || won) return;
      ship.fireCd = 16;
      shots++;
      bullets.push({ x: ship.x, y: h - 92 });
      audio.laser();
    };

    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) {
        e.preventDefault();
        keys.add(e.key === 'a' || e.key === 'A' ? 'ArrowLeft' : e.key === 'd' || e.key === 'D' ? 'ArrowRight' : e.key);
      }
      if (e.key === ' ') {
        e.preventDefault();
        fire();
      }
    };
    const up = (e: KeyboardEvent) =>
      keys.delete(e.key === 'a' || e.key === 'A' ? 'ArrowLeft' : e.key === 'd' || e.key === 'D' ? 'ArrowRight' : e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    // touch controls wire in through custom events from the screen's buttons
    const touchDown = (e: Event) => {
      const k = (e as CustomEvent<string>).detail;
      if (k === 'fire') fire();
      else keys.add(k);
    };
    const touchUp = (e: Event) => keys.delete((e as CustomEvent<string>).detail);
    window.addEventListener('inv-down', touchDown);
    window.addEventListener('inv-up', touchUp);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    };
    const onLeave = () => { mouse.inside = false; };
    const onClick = () => fire();
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('mousedown', onClick);

    const invX = (inv: Invader) => (w - maxCols * SPACING_X) / 2 + inv.col * SPACING_X + formX + SPACING_X / 2;
    const invY = (inv: Invader) => 96 + inv.row * SPACING_Y + formY;

    const tick = () => {
      frames++;

      /* ── update ── */
      const alive = invaders.filter((i) => i.alive);

      if (!won) {
        // ship
        const sp = 5;
        ship.x += (keys.has('ArrowRight') ? sp : 0) - (keys.has('ArrowLeft') ? sp : 0);
        ship.x = Math.max(30, Math.min(w - 30, ship.x));
        ship.fireCd = Math.max(0, ship.fireCd - 1);
        if (ship.hurtT > 0) ship.hurtT--;

        // formation march: slow horizontal sweep, stepping down at the edges
        if (alive.length) {
          const speed = 0.35 + (1 - alive.length / invaders.length) * 0.7; // speeds up as ranks thin
          formX += formDir * speed;
          const xs = alive.map(invX);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          if (maxX > w - 60 && formDir > 0) { formDir = -1; formY = Math.min(formY + 14, h - 380); }
          if (minX < 60 && formDir < 0) { formDir = 1; formY = Math.min(formY + 14, h - 380); }

          // occasional bombs from a random front-line invader
          if (frames % 75 === 0 && Math.random() < 0.75) {
            const shooter = alive[Math.floor(Math.random() * alive.length)];
            bombs.push({ x: invX(shooter), y: invY(shooter) + INV_H, vy: 2.4 });
          }
        }

        // player bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.y -= 8;
          let consumed = false;

          // barrier cells block friendly fire too (you chip your own name)
          for (const cell of barrier) {
            if (cell.alive && b.x > cell.x - 2 && b.x < cell.x + 9 && b.y > cell.y && b.y < cell.y + 9) {
              cell.alive = false;
              burst(cell.x + 3, cell.y + 3, '#8d8aa3', 4);
              consumed = true;
              break;
            }
          }
          if (!consumed) {
            for (const inv of alive) {
              const ix = invX(inv);
              const iy = invY(inv);
              if (inv.alive && b.x > ix - INV_W / 2 - 6 && b.x < ix + INV_W / 2 + 6 && b.y > iy - 6 && b.y < iy + INV_H + 6) {
                inv.alive = false;
                hits++;
                burst(ix, iy + INV_H / 2, inv.color, 22);
                audio.explosion();
                cbRef.current.onZap(inv.skill);
                consumed = true;
                break;
              }
            }
          }
          if (consumed || b.y < -10) bullets.splice(i, 1);
        }

        // bombs
        for (let i = bombs.length - 1; i >= 0; i--) {
          const bm = bombs[i];
          bm.y += bm.vy;
          let consumed = false;
          for (const cell of barrier) {
            if (cell.alive && bm.x > cell.x - 2 && bm.x < cell.x + 9 && bm.y > cell.y - 2 && bm.y < cell.y + 9) {
              cell.alive = false;
              burst(cell.x + 3, cell.y + 3, '#ff5cc8', 5);
              consumed = true;
              break;
            }
          }
          if (!consumed && ship.hurtT === 0 && bm.y > h - 96 && bm.y < h - 60 && Math.abs(bm.x - ship.x) < 24) {
            ship.hurtT = 50;
            burst(ship.x, h - 80, '#ff4a6b', 18);
            audio.hurt();
            consumed = true;
          }
          if (consumed || bm.y > h + 10) bombs.splice(i, 1);
        }

        // win
        if (!alive.length) {
          won = true;
          audio.fanfare();
          window.setTimeout(
            () => cbRef.current.onWin({ shots, hits, seconds: Math.round(frames / 60) }),
            600,
          );
        }
      }

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        if (p.life > p.max) particles.splice(i, 1);
      }

      /* ── draw ── */
      ctx.clearRect(0, 0, w, h);

      // invaders + skill labels
      ctx.textAlign = 'center';
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const ix = invX(inv);
        const iy = invY(inv);
        const map = (inv.row + Math.floor(frames / 30)) % 2 === 0 ? INVADER_A : INVADER_B;
        drawMap(ctx, map, ix - INV_W / 2, iy, PX, inv.color);
        ctx.font = '7px "Press Start 2P"';
        ctx.fillStyle = 'rgba(232, 230, 220, 0.85)';
        ctx.fillText(inv.skill, ix, iy + INV_H + 14);
      }

      // barrier (DEREK)
      ctx.fillStyle = '#8d8aa3';
      for (const cell of barrier) {
        if (cell.alive) ctx.fillRect(cell.x, cell.y, 6, 6);
      }

      // ship (flash during i-frames)
      if (ship.hurtT === 0 || Math.floor(ship.hurtT / 4) % 2 === 0) {
        drawMap(ctx, SHIP, ship.x - 11 * PX, h - 92, PX, '#4cf2ff');
        // engine glow
        ctx.fillStyle = `rgba(76, 242, 255, ${0.4 + 0.3 * Math.sin(frames * 0.4)})`;
        ctx.fillRect(ship.x - 4, h - 92 + 6 * PX, 8, 4);
      }

      // bullets / bombs
      ctx.fillStyle = '#ffcf52';
      for (const b of bullets) ctx.fillRect(b.x - 1.5, b.y - 8, 3, 10);
      ctx.fillStyle = '#ff5cc8';
      for (const bm of bombs) ctx.fillRect(bm.x - 2, bm.y, 4, 8);

      // particles
      for (const p of particles) {
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // crosshair cursor (only inside the game canvas)
      if (mouse.inside && !won) {
        ctx.strokeStyle = '#4cf2ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mouse.x - 12, mouse.y); ctx.lineTo(mouse.x - 4, mouse.y);
        ctx.moveTo(mouse.x + 4, mouse.y); ctx.lineTo(mouse.x + 12, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - 12); ctx.lineTo(mouse.x, mouse.y - 4);
        ctx.moveTo(mouse.x, mouse.y + 4); ctx.lineTo(mouse.x, mouse.y + 12);
        ctx.stroke();
      }

      // tally
      ctx.font = '9px "Press Start 2P"';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4cf2ff';
      ctx.fillText(`SCANNED ${String(hits).padStart(2, '0')}/${invaders.length}`, 16, h - 18);

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('inv-down', touchDown);
      window.removeEventListener('inv-up', touchUp);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('mousedown', onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, cursor: 'none' }}
    />
  );
}
