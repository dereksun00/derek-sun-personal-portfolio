import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import styles from './Title.module.css';
import ArcadeCabinet from '../three/ArcadeCabinet';
import GlitchText from '../components/GlitchText';
import GLBoundary from '../components/GLBoundary';
import PixelButton from '../components/PixelButton';
import { TITLE } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

/**
 * Title screen: a 3D arcade cabinet whose CRT face IS the title card.
 * ENTER dollies the camera into the tube, then the black hole fires.
 * Falls back to a flat DOM title without WebGL2.
 */
export default function Title() {
  const navigateTo = useStore((s) => s.navigateTo);
  const lowFi = useStore((s) => s.lowFi);
  const [entering, setEntering] = useState(false);
  // bumped on webglcontextlost to remount the Canvas with a fresh context
  const [glKey, setGlKey] = useState(0);

  const enter = () => {
    if (entering) return;
    void audio.unlock();
    audio.open();
    if (lowFi) {
      navigateTo('save');
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
  }, [entering, lowFi]);

  const domTitle = (
    <div className={styles.fallback}>
      <GlitchText text={TITLE.heading} breathe glitchEvery={4} withSound className={styles.fallbackHeading} />
      <div className={styles.fallbackSub}>{TITLE.subtitle}</div>
      <PixelButton color="amber" coinHover onClick={enter}>
        {TITLE.prompt}
      </PixelButton>
    </div>
  );

  if (lowFi) {
    return (
      <div className={`screen ${styles.screen}`}>
        {domTitle}
        <div className={styles.version}>DEREK OS v1.0 — © 2026</div>
      </div>
    );
  }

  return (
    <div className={`screen ${styles.screen}`}>
      {/* data-webgl: snapshotScreen proxies this canvas instead of letting
          html2canvas poison it with a 2D context (crashes three.js) */}
      <GLBoundary fallback={domTitle}>
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
            <pointLight position={[2.2, 1.2, 1.8]} color="#5ce8ff" intensity={5} />
            <spotLight position={[0, 3.2, 2.4]} angle={0.5} penumbra={0.7} intensity={9} color="#c9c6d6" />
            <Suspense fallback={null}>
              <ArcadeCabinet entering={entering} onEntered={() => navigateTo('save')} />
            </Suspense>
            <EffectComposer>
              <Bloom intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
            </EffectComposer>
          </Canvas>
        </div>
      </GLBoundary>
      <div className={styles.hint}>
        <PixelButton color="amber" coinHover onClick={enter}>
          {TITLE.prompt}
        </PixelButton>
      </div>
      <div className={styles.dragHint}>DRAG TO INSPECT THE CABINET</div>
    </div>
  );
}
