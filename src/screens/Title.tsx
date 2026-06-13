import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import styles from './Title.module.css';
import ArcadeCabinet from '../three/ArcadeCabinet';
import GlitchText from '../components/GlitchText';
import GLBoundary from '../components/GLBoundary';
import PixelButton from '../components/PixelButton';
import BootLoader from '../components/BootLoader';
import { TITLE } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

/** GLBoundary fallback that reports the failure up so Title can switch to
    the 2D path (and let the boot loader power off) instead of hanging. */
function FailSignal({ onFail }: { onFail: () => void }) {
  useEffect(() => onFail(), [onFail]);
  return null;
}

/**
 * Title screen: a 3D arcade cabinet whose CRT face IS the title card.
 * ENTER dollies the camera into the tube, then the black hole fires.
 *
 * Boot sequence (so the first paint is never an empty starfield): a CRT
 * power-on loader shows immediately; the cabinet's WebGL canvas mounts one
 * frame later and compiles behind it; once the cabinet has rendered a few
 * real frames the loader powers off to reveal it. Falls back to a flat DOM
 * title without WebGL2, or if the cabinet isn't ready within 5s.
 */
export default function Title() {
  const navigateTo = useStore((s) => s.navigateTo);
  const lowFi = useStore((s) => s.lowFi);
  const setBooted = useStore((s) => s.setBooted);
  const [entering, setEntering] = useState(false);
  // bumped on webglcontextlost to remount the Canvas with a fresh context
  const [glKey, setGlKey] = useState(0);

  // ── boot orchestration ──
  const [mountCanvas, setMountCanvas] = useState(false);
  const [cabinetReady, setCabinetReady] = useState(false);
  const [bootGone, setBootGone] = useState(false);
  const [fallback2D, setFallback2D] = useState(false);
  const readyOnce = useRef(false);
  const useFallback = lowFi || fallback2D;
  const ready = cabinetReady || useFallback;

  // paint the loader on the first frame, then mount the heavy Canvas next
  // frame so the loader is guaranteed to show before the WebGL compile hitch
  useEffect(() => {
    if (lowFi) return;
    const id = requestAnimationFrame(() => setMountCanvas(true));
    return () => cancelAnimationFrame(id);
  }, [lowFi]);

  // hard timeout: cabinet not ready within 5s (slow device / WebGL trouble)
  // → commit to the 2D title rather than holding the loader forever
  useEffect(() => {
    if (useFallback || cabinetReady) return;
    const id = window.setTimeout(() => setFallback2D(true), 5000);
    return () => window.clearTimeout(id);
  }, [useFallback, cabinetReady]);

  // 2D paths have no cabinet warm-up loop to arm `booted` — do it on a timer
  useEffect(() => {
    if (!useFallback) return;
    const id = window.setTimeout(setBooted, 1600);
    return () => window.clearTimeout(id);
  }, [useFallback, setBooted]);

  const handleReady = () => {
    if (readyOnce.current) return;
    readyOnce.current = true;
    setCabinetReady(true);
  };

  const enter = () => {
    if (entering || !ready) return;
    void audio.unlock();
    audio.open();
    if (useFallback) {
      navigateTo('select');
    } else {
      setEntering(true); // camera dolly first; onEntered fires the transition
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') enter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entering, useFallback, ready]);

  const domTitle = (
    <div className={styles.fallback}>
      <GlitchText text={TITLE.heading} breathe glitchEvery={4} withSound className={styles.fallbackHeading} />
      <div className={styles.fallbackSub}>{TITLE.subtitle}</div>
      <PixelButton color="amber" coinHover onClick={enter}>
        {TITLE.prompt}
      </PixelButton>
    </div>
  );

  return (
    <div className={`screen ${styles.screen}`}>
      {useFallback ? (
        <>
          {domTitle}
          <div className={styles.version}>DEREK OS v1.0 — © 2026</div>
        </>
      ) : (
        <>
          {/* data-webgl: snapshotScreen proxies this canvas instead of letting
              html2canvas poison it with a 2D context (crashes three.js) */}
          <GLBoundary fallback={<FailSignal onFail={() => setFallback2D(true)} />}>
            {mountCanvas && (
              <div className={styles.canvasWrap} data-webgl>
                <Canvas
                  key={glKey}
                  // portrait phones need a wider shot to fit the whole cabinet
                  camera={{ position: [0, 0.75, window.innerWidth < window.innerHeight ? 4.1 : 2.5], fov: 42 }}
                  dpr={Math.min(window.devicePixelRatio, 2)}
                  // preserveDrawingBuffer so the snapshot proxy can drawImage the cabinet
                  gl={{ preserveDrawingBuffer: true, antialias: true }}
                  onCreated={({ gl }) => {
                    gl.domElement.addEventListener('webglcontextlost', (e) => {
                      e.preventDefault();
                      setGlKey((k) => k + 1); // remount with a fresh context
                    });
                  }}
                >
                  <color attach="background" args={['#050310']} />
                  <ambientLight intensity={0.25} />
                  <pointLight position={[-2.2, 1.8, 1.6]} color="#ff5cc8" intensity={6} />
                  <pointLight position={[2.2, 1.2, 1.8]} color="#4cf2ff" intensity={5} />
                  <spotLight position={[0, 3.2, 2.4]} angle={0.5} penumbra={0.7} intensity={9} color="#c9c6d6" />
                  <Suspense fallback={null}>
                    <ArcadeCabinet entering={entering} onEntered={() => navigateTo('select')} onReady={handleReady} />
                  </Suspense>
                  <EffectComposer>
                    <Bloom intensity={1.2} luminanceThreshold={0.5} luminanceSmoothing={0.3} mipmapBlur />
                  </EffectComposer>
                </Canvas>
              </div>
            )}
          </GLBoundary>
          {/* prompt + drag hint only appear once the cabinet is visible */}
          {ready && (
            <>
              <div className={styles.hint}>
                <PixelButton color="amber" coinHover onClick={enter}>
                  {TITLE.prompt}
                </PixelButton>
              </div>
              <div className={styles.dragHint}>DRAG TO INSPECT THE CABINET</div>
            </>
          )}
        </>
      )}

      {/* CRT boot loader sits above everything until the cabinet is ready.
          Skipped entirely on the known-instant lowFi path. */}
      {!lowFi && !bootGone && <BootLoader ready={ready} onExited={() => setBootGone(true)} />}
    </div>
  );
}
