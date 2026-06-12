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
 * projects, reach the flagpole at the far right to reveal CONTACT.
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
      ctx.clearRect(0, 0, w, h);

      // layer 1: distant mountains (slowest)
      ctx.fillStyle = 'rgba(42, 13, 74, 0.55)';
      for (let i = 0; i < 14; i++) {
        const mx = i * 320 + 60 - camX * 0.25;
        if (mx < -200 || mx > w + 200) continue;
        const mh2 = 90 + (i % 3) * 50;
        ctx.beginPath();
        ctx.moveTo(mx - 130, GROUND());
        ctx.lineTo(mx, GROUND() - mh2);
        ctx.lineTo(mx + 130, GROUND());
        ctx.fill();
      }
      // layer 2: mid hills
      ctx.fillStyle = 'rgba(143, 58, 115, 0.28)';
      for (let i = 0; i < 12; i++) {
        const hx = i * 380 + 140 - camX * 0.5;
        if (hx < -160 || hx > w + 160) continue;
        ctx.beginPath();
        ctx.arc(hx, GROUND() + 30, 110, Math.PI, 0);
        ctx.fill();
      }
      // layer 3: clouds (slow drift + light parallax)
      ctx.fillStyle = 'rgba(232, 230, 220, 0.25)';
      for (let i = 0; i < 12; i++) {
        const cw = 70 + (i % 3) * 30;
        const cx = ((i * 300 + t * (6 + i * 2)) % (LEVEL + cw)) - cw - camX * 0.7;
        if (cx < -cw || cx > w + cw) continue;
        const cy = 60 + (i * 53) % 140;
        ctx.fillRect(cx, cy, cw, 14);
        ctx.fillRect(cx + 12, cy - 10, cw - 24, 12);
      }

      // ground: pixel brick strip (world-locked)
      ctx.fillStyle = '#1d0f33';
      ctx.fillRect(0, GROUND(), w, h - GROUND());
      ctx.fillStyle = '#2a0d4a';
      const startBrick = Math.floor(camX / 24) * 24;
      for (let x = startBrick; x < camX + w; x += 24) {
        ctx.fillRect(x - camX, GROUND(), 22, 10);
        ctx.fillRect(x - camX + 12, GROUND() + 12, 22, 10);
      }
      ctx.fillStyle = 'rgba(76, 242, 255, 0.5)';
      ctx.fillRect(0, GROUND(), w, 2);

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
