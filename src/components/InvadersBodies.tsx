import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import GLBoundary from './GLBoundary';
import { useStore } from '../store';

/* ── procedural textures ─────────────────────────────────────────── */

/** Banded gas-giant surface in synthwave hues, with turbulent streaks. */
function makePlanetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const bands = [
    ['#2a1a6e', '#3a2490'],
    ['#1a1048', '#241466'],
    ['#5a2a9a', '#7a3ac0'],
    ['#2a1a6e', '#1a1048'],
    ['#c23a96', '#7a2a8a'], // magenta storm belt
    ['#1a1048', '#2a1a6e'],
    ['#3a2490', '#4a3ab0'],
    ['#1a1048', '#120c38'],
  ];
  let y = 0;
  for (let i = 0; y < c.height; i++) {
    const bh = (c.height / bands.length) * (0.7 + (i % 3) * 0.25);
    const [a, b] = bands[i % bands.length];
    const grad = g.createLinearGradient(0, y, 0, y + bh);
    grad.addColorStop(0, a);
    grad.addColorStop(0.5, b);
    grad.addColorStop(1, a);
    g.fillStyle = grad;
    g.fillRect(0, y, c.width, bh + 1);
    // turbulent streaks within the band
    for (let s = 0; s < 60; s++) {
      g.globalAlpha = 0.05 + Math.random() * 0.08;
      g.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#0a0612';
      const sy = y + Math.random() * bh;
      g.fillRect(Math.random() * c.width, sy, 30 + Math.random() * 90, 1 + Math.random() * 2);
    }
    g.globalAlpha = 1;
    y += bh;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Concentric ring bands with gaps — maps onto RingGeometry's planar UVs. */
function makeRingTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, S, S);
  const cx = S / 2;
  const rings = 46;
  for (let i = 0; i < rings; i++) {
    const r = (i / rings) * cx;
    const lit = Math.sin(i * 0.9) * 0.5 + 0.5;
    const gap = (i % 7 === 3 || i % 11 === 6); // Cassini-style divisions
    g.strokeStyle = gap
      ? 'rgba(20, 14, 40, 0.0)'
      : `rgba(${180 + lit * 60}, ${190 + lit * 50}, 255, ${0.15 + lit * 0.5})`;
    g.lineWidth = cx / rings + 0.6;
    g.beginPath();
    g.arc(cx, cx, r, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── atmosphere rim-glow shader (fresnel) ────────────────────────── */
const RIM_VERT = `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const RIM_FRAG = `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(vN, vV)), uPower);
    gl_FragColor = vec4(uColor * f * uIntensity, f);
  }`;

function RingedPlanet() {
  const planet = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const surface = useMemo(makePlanetTexture, []);
  const ringTex = useMemo(makeRingTexture, []);
  const rimMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#7fc8ff') },
          uPower: { value: 3.0 },
          uIntensity: { value: 1.5 },
        },
        vertexShader: RIM_VERT,
        fragmentShader: RIM_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    [],
  );

  useFrame((_, dt) => {
    if (planet.current) planet.current.rotation.y += dt * 0.07;
    if (ring.current) ring.current.rotation.z += dt * 0.02;
  });

  return (
    <group position={[2.15, 1.25, 0]} rotation={[0.42, 0, 0.22]}>
      {/* atmosphere halo */}
      <mesh scale={1.16}>
        <sphereGeometry args={[1.6, 48, 48]} />
        <primitive object={rimMat} attach="material" />
      </mesh>
      {/* planet body */}
      <mesh ref={planet}>
        <sphereGeometry args={[1.6, 64, 64]} />
        <meshStandardMaterial map={surface} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* ring system */}
      <mesh ref={ring} rotation={[Math.PI / 2.05, 0, 0]}>
        <ringGeometry args={[2.1, 3.5, 96, 1]} />
        <meshBasicMaterial
          map={ringTex}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

interface RockDef {
  pos: [number, number, number];
  scale: number;
  spin: [number, number, number];
  drift: number;
}

function Asteroid({ def }: { def: RockDef }) {
  const ref = useRef<THREE.Mesh>(null);
  // low-poly rock: an icosahedron with vertices kicked around for irregularity
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 0.72 + Math.abs(Math.sin(v.x * 4.1 + v.y * 2.7 + v.z * 3.3)) * 0.5;
      v.multiplyScalar(n);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  useFrame((state, dt) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.x += def.spin[0] * dt;
    m.rotation.y += def.spin[1] * dt;
    m.rotation.z += def.spin[2] * dt;
    // slow downward drift, wrapping back to the top
    m.position.y -= def.drift * dt;
    if (m.position.y < -4.2) m.position.y = 4.2;
    m.position.x += Math.sin(state.clock.elapsedTime * 0.1 + def.pos[0]) * dt * 0.05;
  });

  return (
    <mesh ref={ref} geometry={geo} position={def.pos} scale={def.scale}>
      <meshStandardMaterial color="#4a3f63" roughness={1} metalness={0.1} flatShading />
    </mesh>
  );
}

function Station() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.25;
  });
  return (
    <group ref={ref} position={[-2.7, 1.9, -3]} rotation={[1.1, 0.3, 0]} scale={0.5}>
      <mesh>
        <torusGeometry args={[1, 0.12, 10, 32]} />
        <meshStandardMaterial color="#6e82c8" emissive="#243a66" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 12]} />
        <meshStandardMaterial color="#8a9ad6" emissive="#2a3a66" roughness={0.4} metalness={0.7} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i / 4) * Math.PI * 2]}>
          <boxGeometry args={[1, 0.05, 0.05]} />
          <meshStandardMaterial color="#5a6ea8" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

const ROCKS: RockDef[] = [
  { pos: [-2.6, 1.2, 1], scale: 0.5, spin: [0.3, 0.4, 0.15], drift: 0.35 },
  { pos: [-1.4, -1.8, 0.5], scale: 0.32, spin: [0.5, 0.2, 0.4], drift: 0.5 },
  { pos: [0.6, 2.4, -1], scale: 0.7, spin: [0.15, 0.3, 0.25], drift: 0.22 },
  { pos: [1.8, -2.2, 0], scale: 0.42, spin: [0.4, 0.5, 0.1], drift: 0.42 },
  { pos: [-3.4, -0.4, -1.5], scale: 0.55, spin: [0.2, 0.35, 0.3], drift: 0.3 },
  { pos: [3.2, 0.4, -2], scale: 0.28, spin: [0.6, 0.25, 0.5], drift: 0.55 },
];

/**
 * 3D set-pieces for the Space Invaders screen — a ringed gas giant with a
 * fresnel atmosphere, tumbling low-poly asteroids and a slowly rotating
 * station — layered between the 2D starfield and the flat pixel gameplay.
 *
 * Its own WebGL context (transparent, behind the game). Wrapped in
 * [data-webgl] so the html2canvas snapshot proxies it like the title
 * cabinet instead of poisoning it, and in GLBoundary so a context failure
 * degrades to the plain 2D starfield rather than blanking the app. Skipped
 * entirely without WebGL2 (lowFi).
 */
export default function InvadersBodies() {
  const lowFi = useStore((s) => s.lowFi);
  if (lowFi) return null;

  return (
    <GLBoundary fallback={null}>
      <div
        data-webgl
        aria-hidden
        style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}
      >
        <Canvas
          camera={{ position: [0, 0, 6], fov: 46 }}
          dpr={Math.min(window.devicePixelRatio, 1.75)}
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.35} />
          <pointLight position={[-6, 3, 4]} color="#9fb6ff" intensity={120} distance={40} />
          <pointLight position={[5, -2, 3]} color="#ff5cc8" intensity={50} distance={40} />
          <RingedPlanet />
          {ROCKS.map((r, i) => (
            <Asteroid key={i} def={r} />
          ))}
          <Station />
        </Canvas>
      </div>
    </GLBoundary>
  );
}
