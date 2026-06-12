import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { TITLE } from '../content';
import { useStore } from '../store';

const SCREEN_W = 512;
const SCREEN_H = 400;

/**
 * Draws the live title content onto the CRT face texture each frame:
 * mini star drift, DEREK SUN in amber, blinking PLAY prompt, scanlines.
 * `warm` ∈ [0,1] drives the power-on effect: the image unfolds from a
 * bright horizontal line, with RGB-split jitter that dies as it warms.
 * Cheap 2D canvas → CanvasTexture.
 */
function drawTitleFace(ctx: CanvasRenderingContext2D, t: number, warm: number) {
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // power-on: collapse the whole frame toward a glowing center line
  const cold = 1 - warm;
  ctx.save();
  if (warm < 1) {
    const squash = Math.max(0.012, Math.pow(warm / 0.45, 2)); // unfolds in the first ~45%
    ctx.translate(0, SCREEN_H / 2);
    ctx.scale(1, Math.min(1, squash));
    ctx.translate((Math.random() - 0.5) * 10 * cold, -SCREEN_H / 2 + (Math.random() - 0.5) * 6 * cold);
  }

  // deterministic mini starfield (no allocations per frame)
  for (let i = 0; i < 42; i++) {
    const sx = ((i * 137.5 + t * (4 + (i % 3) * 4)) % SCREEN_W);
    const sy = (i * 89.3) % SCREEN_H;
    ctx.fillStyle = i % 7 === 0 ? '#ffffff' : 'rgba(232,230,220,0.5)';
    ctx.fillRect(SCREEN_W - sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }

  ctx.textAlign = 'center';
  const cx = SCREEN_W / 2;

  // heading: RGB-split arcs only while the tube is still warming up
  const glitch = warm < 1 && Math.random() < 0.5;
  const breathe = 6 + 6 * (0.5 + 0.5 * Math.sin(t * 2));
  ctx.font = '38px "Press Start 2P"';
  if (glitch) {
    const j = () => (Math.random() - 0.5) * 10 * cold;
    ctx.fillStyle = '#ff5cc8';
    ctx.fillText(TITLE.heading, cx + j(), 150 + j() * 0.4);
    ctx.fillStyle = '#4cf2ff';
    ctx.fillText(TITLE.heading, cx + j(), 150 + j() * 0.4);
  }
  ctx.shadowColor = '#ffcf52';
  ctx.shadowBlur = breathe;
  ctx.fillStyle = '#ffcf52';
  ctx.fillText(TITLE.heading, cx, 150);
  ctx.shadowBlur = 0;

  ctx.font = '11px "Press Start 2P"';
  ctx.fillStyle = '#4cf2ff';
  ctx.fillText(TITLE.subtitle, cx, 205);

  if (Math.sin(t * 4.5) > -0.35) {
    ctx.font = '14px "Press Start 2P"';
    ctx.shadowColor = '#ffcf52';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffcf52';
    ctx.fillText(TITLE.prompt, cx, 295);
    ctx.shadowBlur = 0;
  }

  ctx.font = '8px "Press Start 2P"';
  ctx.fillStyle = '#2a7d8f';
  ctx.fillText('DEREK OS v1.0 — © 2026', cx, 372);

  // baked scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < SCREEN_H; y += 4) ctx.fillRect(0, y, SCREEN_W, 2);

  ctx.restore();

  // overbright bloom flash that decays as the phosphor settles
  if (warm < 1) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * cold})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = `rgba(76, 242, 255, ${0.18 * cold})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }
}

function makeMarqueeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#2a0d4a');
  grad.addColorStop(0.5, '#3d1566');
  grad.addColorStop(1, '#2a0d4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);
  ctx.textAlign = 'center';
  ctx.font = '34px "Press Start 2P"';
  ctx.shadowColor = '#ff5cc8';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ff5cc8';
  ctx.fillText('DEREK SUN', 256, 80);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Props {
  /** true once the user pressed enter — camera dollies into the CRT */
  entering: boolean;
  onEntered: () => void;
}

export default function ArcadeCabinet({ entering, onEntered }: Props) {
  const group = useRef<THREE.Group>(null);
  const debug = useStore((s) => s.debug);
  const booted = useStore((s) => s.booted);
  const setBooted = useStore((s) => s.setBooted);
  // CRT warm-up runs only on first load; t0 captured on the first frame
  const warmRef = useRef({ t0: -1, skip: booted });
  const { camera, gl } = useThree();
  const [dragging, setDragging] = useState(false);
  const targetRot = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });

  // live CRT face texture
  const { faceTex, faceCtx } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { faceTex: tex, faceCtx: c.getContext('2d')! };
  }, []);
  const marqueeTex = useMemo(makeMarqueeTexture, []);

  useEffect(
    () => () => {
      faceTex.dispose();
      marqueeTex.dispose();
    },
    [faceTex, marqueeTex],
  );

  /* aim the camera at the CRT face once */
  useEffect(() => {
    camera.lookAt(0, 0.62, 0.36);
  }, [camera]);

  /* drag-rotate within ±15° */
  useEffect(() => {
    const dom = gl.domElement;
    const down = (e: PointerEvent) => {
      setDragging(true);
      last.current = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      const lim = THREE.MathUtils.degToRad(15);
      targetRot.current.y = THREE.MathUtils.clamp(targetRot.current.y + dx * 0.004, -lim, lim);
      targetRot.current.x = THREE.MathUtils.clamp(targetRot.current.x + dy * 0.002, -lim * 0.4, lim * 0.4);
    };
    const up = () => setDragging(false);
    dom.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      dom.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl, dragging]);

  /* dolly into the screen when entering */
  useEffect(() => {
    if (!entering) return;
    const tl = gsap.timeline({ onComplete: onEntered });
    tl.to(camera.position, { x: 0, y: 0.62, z: 0.62, duration: 0.85, ease: 'power2.in' });
    tl.to(targetRot.current, { x: 0, y: 0, duration: 0.4, ease: 'power2.out' }, 0);
    return () => {
      tl.kill();
    };
  }, [entering, camera, onEntered]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // ease toward drag target + gentle idle sway/bob
    const idleY = entering ? 0 : Math.sin(t * 0.5) * 0.03;
    g.rotation.y += (targetRot.current.y + idleY - g.rotation.y) * 0.08;
    g.rotation.x += (targetRot.current.x - g.rotation.x) * 0.08;
    g.position.y = Math.sin(t * 0.8) * 0.008;
    // redraw the CRT face (camera looks at it, so always live)
    const wr = warmRef.current;
    if (wr.t0 < 0) wr.t0 = t;
    const warm = wr.skip ? 1 : Math.min(1, (t - wr.t0) / 0.8);
    drawTitleFace(faceCtx, t, warm);
    faceTex.needsUpdate = true;
    // arm the "booted" flag once the tube has settled (+ glitch tail)
    if (!wr.skip && t - wr.t0 > 1.6) {
      wr.skip = true;
      setBooted();
    }
  });

  const plastic = { color: '#170d2b', roughness: 0.62, metalness: 0.15, wireframe: debug };
  const darkPlastic = { color: '#0d0719', roughness: 0.7, metalness: 0.1, wireframe: debug };

  return (
    <group ref={group} position={[0, -0.55, 0]}>
      {/* main body */}
      <mesh position={[0, 0.78, -0.05]}>
        <boxGeometry args={[1.06, 2.1, 0.78]} />
        <meshStandardMaterial {...plastic} />
      </mesh>
      {/* side panels with neon edge stripes */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.56, 0.78, -0.05]}>
            <boxGeometry args={[0.06, 2.14, 0.82]} />
            <meshStandardMaterial {...darkPlastic} />
          </mesh>
          <mesh position={[s * 0.595, 0.78, 0.18]}>
            <boxGeometry args={[0.012, 1.9, 0.025]} />
            <meshStandardMaterial color="#ff5cc8" emissive="#ff5cc8" emissiveIntensity={2.2} toneMapped={false} wireframe={debug} />
          </mesh>
        </group>
      ))}
      {/* marquee */}
      <mesh position={[0, 1.78, 0.13]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[1.04, 0.3, 0.06]} />
        <meshStandardMaterial map={marqueeTex} emissiveMap={marqueeTex} emissive="#ffffff" emissiveIntensity={1.15} roughness={0.4} wireframe={debug} />
      </mesh>
      {/* CRT bezel + screen */}
      <mesh position={[0, 1.18, 0.305]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[0.94, 0.78, 0.1]} />
        <meshStandardMaterial {...darkPlastic} />
      </mesh>
      <mesh position={[0, 1.18, 0.362]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[0.78, 0.6]} />
        <meshBasicMaterial map={faceTex} toneMapped={false} />
      </mesh>
      {/* curved glass over the tube */}
      <mesh position={[0, 1.18, 0.372]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[0.8, 0.62]} />
        <meshPhysicalMaterial transparent opacity={0.1} roughness={0.05} metalness={0} clearcoat={1} color="#9ad8ff" wireframe={debug} />
      </mesh>
      {/* control deck */}
      <mesh position={[0, 0.72, 0.38]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.98, 0.08, 0.42]} />
        <meshStandardMaterial {...plastic} />
      </mesh>
      {/* joystick */}
      <group position={[-0.22, 0.82, 0.46]} rotation={[0.5, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.018, 0.025, 0.14, 8]} />
          <meshStandardMaterial color="#222" roughness={0.4} wireframe={debug} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#ff4a6b" roughness={0.25} wireframe={debug} />
        </mesh>
      </group>
      {/* buttons */}
      {[0.08, 0.26].map((x, i) => (
        <mesh key={x} position={[x, 0.805, 0.47]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.05, 0.035, 12]} />
          <meshStandardMaterial
            color={i === 0 ? '#4cf2ff' : '#ffcf52'}
            emissive={i === 0 ? '#4cf2ff' : '#ffcf52'}
            emissiveIntensity={0.7}
            roughness={0.3}
            wireframe={debug}
          />
        </mesh>
      ))}
      {/* coin door */}
      <mesh position={[0, 0.22, 0.34]}>
        <boxGeometry args={[0.4, 0.34, 0.03]} />
        <meshStandardMaterial {...darkPlastic} />
      </mesh>
      <mesh position={[0, 0.26, 0.36]}>
        <boxGeometry args={[0.035, 0.1, 0.012]} />
        <meshStandardMaterial color="#ffcf52" emissive="#ffcf52" emissiveIntensity={1.6} toneMapped={false} wireframe={debug} />
      </mesh>
      {/* floor glow puddle */}
      <mesh position={[0, -0.275, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 32]} />
        <meshBasicMaterial color="#2a0d4a" transparent opacity={0.55} wireframe={debug} />
      </mesh>
    </group>
  );
}
