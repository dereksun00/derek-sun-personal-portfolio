import { useMemo, useRef, useEffect, MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import vert from '../three/shaders/blackhole.vert';
import frag from '../three/shaders/blackhole.frag';
import { useStore } from '../store';

const DEBRIS_COUNT = 80;

interface SceneProps {
  texRef: MutableRefObject<THREE.CanvasTexture | null>;
  progressRef: MutableRefObject<number>;
  texVersion: number;
}

/** Fullscreen quad warped by the black hole fragment shader. */
function HoleQuad({ texRef, progressRef, texVersion }: SceneProps) {
  const { viewport } = useThree();
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const debug = useStore((s) => s.debug);

  const uniforms = useMemo(
    () => ({
      uTex: { value: null as THREE.Texture | null },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
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
  });

  // ShaderMaterial is created once per mount; dispose with the transition
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
 * ~80 instanced debris sparks pulled into the hole on log-spiral
 * trajectories, shrinking as they fall in. Additive amber/cyan.
 */
function Debris({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const { viewport } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const seeds = useMemo(
    () =>
      Array.from({ length: DEBRIS_COUNT }, (_, i) => ({
        ang: (i / DEBRIS_COUNT) * Math.PI * 2 + Math.sin(i * 37.7) * 0.8,
        rad: 0.35 + ((i * 0.6180339887) % 1) * 1.1, // golden-ratio spread
        size: 0.006 + ((i * 0.7548776662) % 1) * 0.014,
        speed: 0.7 + ((i * 0.2387) % 1) * 0.8,
      })),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const amber = new THREE.Color('#ffcf52');
    const cyan = new THREE.Color('#5ce8ff');
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      mesh.setColorAt(i, i % 3 === 0 ? cyan : amber);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const p = progressRef.current;
    const scaleX = viewport.width / 2;
    const scaleY = viewport.height / 2;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffcf52" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

export interface BlackHoleCanvasProps {
  texRef: MutableRefObject<THREE.CanvasTexture | null>;
  progressRef: MutableRefObject<number>;
  texVersion: number;
}

/**
 * The fullscreen transition overlay. Mounted by TransitionManager only
 * while a transition is running, so it costs nothing at idle.
 */
export default function BlackHoleTransition({ texRef, progressRef, texVersion }: BlackHoleCanvasProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000 }} className="no-capture" aria-hidden>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 5], zoom: 1 }}
        dpr={Math.min(window.devicePixelRatio, 2)}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <HoleQuad texRef={texRef} progressRef={progressRef} texVersion={texVersion} />
        <Debris progressRef={progressRef} />
        {!window.location.search.includes('nobloom') && (
          <EffectComposer>
            <Bloom intensity={0.85} luminanceThreshold={0.78} luminanceSmoothing={0.25} mipmapBlur />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
