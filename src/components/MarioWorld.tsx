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
  E: '#6bff8a', // koopa shell
  L: '#2a8c44', // koopa dark
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

function drawSprite(ctx: CanvasRenderingContext2D, map: string[], x: number, y: number, px: number, flip = false) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = flip ? row[row.length - 1 - c] : row[c];
      const col = PAL[ch];
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
  fx: number; // fraction of width
  baseY: number;
  bump: number; // bounce animation offset
  cooldown: number;
}
interface Walker {
  fx: number;
  min: number;
  max: number;
  dir: number;
  kind: 'goomba' | 'koopa';
}

interface Props {
  selected: number;
  onBump: (projectId: string) => void;
  onPipe: () => void;
}

/**
 * The quest world: parallax mountains/hills, drifting clouds, walking
 * goombas + a koopa, bobbing ? blocks (one per project) and an arrow-key
 * controllable Mario. Jumping under a block opens that project's overlay;
 * pressing ↓ on the CONTACT pipe warps to the contact screen.
 */
export default function MarioWorld({ selected, onBump, onPipe }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ selected, onBump, onPipe });
  propsRef.current = { selected, onBump, onPipe };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let raf = 0;

    const PX = 3; // sprite pixel size
    const GROUND = () => h - 56;

    const mario = { x: 120, y: 0, vx: 0, vy: 0, onGround: false, facing: 1, walkT: 0 };
    const keys = new Set<string>();

    const blocks: Block[] = PROJECTS.map((p, i) => ({
      id: p.id,
      label: p.name,
      fx: [0.23, 0.5, 0.78][i] ?? 0.3 + i * 0.25,
      baseY: 0,
      bump: 0,
      cooldown: 0,
    }));
    const walkers: Walker[] = [
      { fx: 0.3, min: 0.18, max: 0.42, dir: 1, kind: 'goomba' },
      { fx: 0.6, min: 0.52, max: 0.7, dir: -1, kind: 'goomba' },
      { fx: 0.5, min: 0.44, max: 0.56, dir: 1, kind: 'koopa' },
    ];

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      // blocks float at jump height above the ground, staggered slightly
      blocks.forEach((b, i) => {
        b.baseY = GROUND() - 150 - (i % 2) * 28;
      });
      mario.y = GROUND() - 16 * PX;
    };
    resize();
    window.addEventListener('resize', resize);

    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
        keys.add(e.key === ' ' ? 'ArrowUp' : e.key);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key === ' ' ? 'ArrowUp' : e.key);
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
      const speed = 3.2;
      mario.vx = (keys.has('ArrowRight') ? speed : 0) - (keys.has('ArrowLeft') ? speed : 0);
      if (mario.vx !== 0) mario.facing = Math.sign(mario.vx);
      if (keys.has('ArrowUp') && mario.onGround) {
        mario.vy = -10.5;
        mario.onGround = false;
        audio.jump();
        keys.delete('ArrowUp'); // no auto-bounce on hold
      }
      mario.vy += 0.55;
      mario.x = Math.max(0, Math.min(w - MW, mario.x + mario.vx));
      mario.y += mario.vy;
      if (mario.y >= GROUND() - MH) {
        mario.y = GROUND() - MH;
        mario.vy = 0;
        mario.onGround = true;
      }
      mario.walkT += Math.abs(mario.vx) * 0.05;

      /* block head-bump */
      for (const b of blocks) {
        const bx = b.fx * w - 24;
        const by = b.baseY + Math.sin(t * 2.2 + b.fx * 9) * 6 - b.bump;
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
            b.cooldown = 45;
            audio.marioCoin();
            propsRef.current.onBump(b.id);
          }
        }
      }

      /* pipe warp */
      const pipeX = 0.93 * w - 36;
      if (keys.has('ArrowDown') && mario.onGround && mario.x + MW > pipeX && mario.x < pipeX + 72) {
        keys.delete('ArrowDown');
        audio.open();
        propsRef.current.onPipe();
      }

      /* walkers */
      for (const wk of walkers) {
        wk.fx += wk.dir * 0.0006;
        if (wk.fx < wk.min || wk.fx > wk.max) wk.dir *= -1;
      }

      /* ── draw ── */
      ctx.clearRect(0, 0, w, h);
      const par = (mario.x / w - 0.5) * 1; // parallax driver

      // layer 1: distant mountains
      ctx.fillStyle = 'rgba(42, 13, 74, 0.55)';
      for (let i = 0; i < 5; i++) {
        const mx = ((i * 0.27 + 0.05) * w) - par * 18;
        const mh2 = 90 + (i % 3) * 50;
        ctx.beginPath();
        ctx.moveTo(mx - 130, GROUND());
        ctx.lineTo(mx, GROUND() - mh2);
        ctx.lineTo(mx + 130, GROUND());
        ctx.fill();
      }
      // layer 2: mid hills
      ctx.fillStyle = 'rgba(42, 140, 68, 0.30)';
      for (let i = 0; i < 4; i++) {
        const hx = ((i * 0.33 + 0.12) * w) - par * 42;
        ctx.beginPath();
        ctx.arc(hx, GROUND() + 30, 110, Math.PI, 0);
        ctx.fill();
      }
      // clouds (slow drift, wrap)
      ctx.fillStyle = 'rgba(201, 198, 214, 0.28)';
      for (let i = 0; i < 5; i++) {
        const cw = 70 + (i % 3) * 30;
        const cx = ((i * 0.23 * w + t * (6 + i * 2)) % (w + cw)) - cw - par * 60;
        const cy = 60 + (i * 53) % 140;
        ctx.fillRect(cx, cy, cw, 14);
        ctx.fillRect(cx + 12, cy - 10, cw - 24, 12);
      }

      // ground: pixel brick strip
      ctx.fillStyle = '#1d0f33';
      ctx.fillRect(0, GROUND(), w, h - GROUND());
      ctx.fillStyle = '#2a0d4a';
      for (let x = 0; x < w; x += 24) {
        ctx.fillRect(x, GROUND(), 22, 10);
        ctx.fillRect(x + 12, GROUND() + 12, 22, 10);
      }
      ctx.fillStyle = 'rgba(107, 255, 138, 0.5)';
      ctx.fillRect(0, GROUND(), w, 2);

      // contact pipe
      ctx.fillStyle = '#2a8c44';
      ctx.fillRect(pipeX + 8, GROUND() - 64, 56, 64);
      ctx.fillRect(pipeX, GROUND() - 80, 72, 22);
      ctx.fillStyle = '#6bff8a';
      ctx.fillRect(pipeX, GROUND() - 80, 72, 4);
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6bff8a';
      ctx.fillText('CONTACT', pipeX + 36, GROUND() - 92);
      ctx.fillText('▼', pipeX + 36, GROUND() - 110);

      // ? blocks
      blocks.forEach((b, i) => {
        const bx = b.fx * w - 24;
        const by = b.baseY + Math.sin(t * 2.2 + b.fx * 9) * 6 - b.bump;
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
        ctx.fillText('?', bx + 24, by + 36);
        ctx.shadowBlur = 0;
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = hot ? '#ffffff' : '#c9c6d6';
        ctx.fillText(b.label, bx + 24, by - 10);
      });

      // walkers
      for (const wk of walkers) {
        const map = wk.kind === 'goomba' ? GOOMBA : KOOPA;
        const wx = wk.fx * w - 18;
        const wy = GROUND() - map.length * PX;
        drawSprite(ctx, map, wx, wy, PX, wk.dir < 0);
      }

      // mario
      const frame = !mario.onGround || (Math.abs(mario.vx) > 0 && Math.floor(mario.walkT) % 2 === 0) ? MARIO_WALK : MARIO_STAND;
      drawSprite(ctx, frame, mario.x, mario.y, PX, mario.facing < 0);

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
