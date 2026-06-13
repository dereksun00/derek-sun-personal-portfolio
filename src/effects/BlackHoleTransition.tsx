import { useMemo, useRef, useEffect, useState, MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import vert from '../three/shaders/blackhole.vert';
import frag from '../three/shaders/blackhole.frag';
import { useStore } from '../store';
import { BHTier } from './quality';

interface SceneProps {
  texRef: MutableRefObject<THREE.CanvasTexture | null>;
  progressRef: MutableRefObject<number>;
  texVersion: number;
  aberration: boolean;
}

/** Fullscreen quad warped by the black hole fragment shader. */
function HoleQuad({ texRef, progressRef, texVersion, aberration }: SceneProps) {
  const { viewport } = useThree();
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const debug = useStore((s) => s.debug);

  const uniforms = useMemo(
    () => ({
      uTex: { value: null as THREE.Texture | null },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uAberration: { value: 1 },
    }),
    [],
  );

  // swap in the freshly captured snapshot whenever the manager bumps texVersion
  useEffect(() => {
    if (matRef.current) matRef.current.uniforms.uTex.value = texRef.current;
  }, [texVersion, texRef]);

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uProgress.value = progressRef.current;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uAspect.value = viewport.aspect;
    m.uniforms.uAberration.value = aberration ? 1 : 0;
  });

  // ShaderMaterial is created once per mount; dispose with the canvas
  useEffect(() => {
    const m = matRef.current;
    return () => m?.dispose();
  }, []);

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={matRef} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} wireframe={debug} />
    </mesh>
  );
}

/**
 * Instanced debris sparks pulled into the hole on log-spiral trajectories,
 * shrinking as they fall in. Additive amber/cyan. One InstancedMesh, one
 * draw call regardless of count.
 */
function Debris({ progressRef, count }: { progressRef: MutableRefObject<number>; count: number }) {
  const { viewport } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        ang: (i / count) * Math.PI * 2 + Math.sin(i * 37.7) * 0.8,
        rad: 0.35 + ((i * 0.6180339887) % 1) * 1.1, // golden-ratio spread
        size: 0.006 + ((i * 0.7548776662) % 1) * 0.014,
        speed: 0.7 + ((i * 0.2387) % 1) * 0.8,
      })),
    [count],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const amber = new THREE.Color('#ffcf52');
    const cyan = new THREE.Color('#4cf2ff');
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, i % 3 === 0 ? cyan : amber);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const p = progressRef.current;
    const scaleX = viewport.width / 2;
    const scaleY = viewport.height / 2;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      // radius decays toward the singularity; angle accelerates as 1/r
      const fall = Math.pow(Math.max(1 - p * s.speed, 0), 1.6);
      const r = s.rad * fall;
      const ang = s.ang + (p * 6) / (r + 0.12);
      dummy.position.set(Math.cos(ang) * r * scaleX * 0.6, Math.sin(ang) * r * scaleY * 0.6, 0.1);
      const sc = s.size * (0.15 + fall) * Math.min(scaleX, scaleY);
      dummy.scale.setScalar(Math.max(sc, 1e-5));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // debris only visible while the hole is actually pulling
    mesh.visible = p > 0.04;
  });

  return (
    <instancedMesh key={count} ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffcf52" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

export interface BlackHoleCanvasProps {
  texRef: MutableRefObject<THREE.CanvasTexture | null>;
  progressRef: MutableRefObject<number>;
  texVersion: number;
  /** transition running AND a snapshot is loaded — controls visibility + frameloop */
  active: boolean;
  /** 'high' (full) or 'medium' (no aberration, reduced bloom, fewer debris).
      'low' is the potato tier and never reaches this component (CSS iris). */
  tier: BHTier;
}

/**
 * The fullscreen transition overlay. Mounted PERSISTENTLY by
 * TransitionManager (not per-transition): creating a WebGL context and
 * compiling the hole + bloom shaders mid-transition was the first-run
 * jank. Instead the canvas mounts once at app start, renders hidden for
 * ~700ms to compile everything, then parks with frameloop="never" (zero
 * idle cost). Activating a transition just flips visibility + frameloop.
 *
 * tier 'medium' (decent integrated, or a 'high' machine that measured slow):
 * 1x dpr, reduced bloom, half the debris, no chromatic aberration. 'high'
 * gets the full pass. The 'low'/potato tier never mounts this — it uses the
 * CSS iris in TransitionManager.
 *
 * StrictMode safety (verified against @react-three/fiber 8.17 source):
 * R3F defers root/renderer creation until its ResizeObserver measures the
 * container, which lands AFTER StrictMode's synchronous mount→unmount→
 * remount replay — the replay's unmountComponentAtNode no-ops because no
 * root exists yet, so the WebGL context is created exactly once. Two
 * rules keep it that way: (1) never key/conditionally remount this
 * component (its mount condition must stay the stable `!lowFi`), and
 * (2) nothing may call getContext on R3F's canvas before the renderer
 * does — html2canvas does exactly that to canvases it clones, which is
 * why snapshot.ts must never let a clone reach this canvas.
 */
export default function BlackHoleTransition({ texRef, progressRef, texVersion, active, tier }: BlackHoleCanvasProps) {
  const [warming, setWarming] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setWarming(false), 700);
    return () => window.clearTimeout(t);
  }, []);

  const high = tier === 'high';
  const running = active || warming;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8000,
        visibility: active ? 'visible' : 'hidden',
        pointerEvents: 'none',
      }}
      className="no-capture"
      aria-hidden
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 5], zoom: 1 }}
        dpr={high ? Math.min(window.devicePixelRatio, 1.5) : 1}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        frameloop={running ? 'always' : 'never'}
      >
        <HoleQuad texRef={texRef} progressRef={progressRef} texVersion={texVersion} aberration={high} />
        <Debris progressRef={progressRef} count={high ? 80 : 40} />
        {!window.location.search.includes('nobloom') && (
          <EffectComposer>
            {high ? (
              <Bloom intensity={1.15} luminanceThreshold={0.7} luminanceSmoothing={0.25} mipmapBlur />
            ) : (
              // reduced bloom for medium: lower intensity, higher threshold, no
              // mipmap chain (the cheaper single-pass blur)
              <Bloom intensity={0.6} luminanceThreshold={0.82} luminanceSmoothing={0.2} />
            )}
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
