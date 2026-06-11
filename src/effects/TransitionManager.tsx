import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { useStore } from '../store';
import { snapshotScreen } from './snapshot';
import BlackHoleTransition from './BlackHoleTransition';
import { audio } from '../sound/AudioEngine';

const CONSUME_S = 0.85;
const EXPAND_S = 0.6;

// A main-thread hitch (WebGL context creation, snapshot upload) must not
// fast-forward the collapse: clamp any frame gap > 250ms to a ~30fps step.
gsap.ticker.lagSmoothing(250, 33);

/**
 * Owns the whole transition lifecycle:
 *   capturing → consume (black hole eats snapshot A)
 *   → swap (white flash holds; screen commits; snapshot B captured)
 *   → expand (hole runs in reverse over snapshot B) → idle
 * Falls back to a CSS iris wipe when WebGL2/html2canvas aren't available.
 */
export default function TransitionManager() {
  const phase = useStore((s) => s.phase);
  const lowFi = useStore((s) => s.lowFi);
  const setPhase = useStore((s) => s.setPhase);
  const commitScreen = useStore((s) => s.commitScreen);

  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const progressRef = useRef(0);
  const [texVersion, setTexVersion] = useState(0);
  const [flash, setFlash] = useState(false);

  /* ── capture outgoing screen ───────────────────────────── */
  useEffect(() => {
    if (phase !== 'capturing') return;
    if (lowFi) {
      setPhase('consume');
      return;
    }
    let cancelled = false;
    audio.startRumble(CONSUME_S + 0.2);
    snapshotScreen()
      .then((tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        texRef.current?.dispose();
        texRef.current = tex;
        progressRef.current = 0;
        setTexVersion((v) => v + 1);
        setPhase('consume');
      })
      .catch(() => {
        // capture failed (foreignObject quirk etc.) — degrade gracefully
        if (!cancelled) setPhase('consume');
      });
    return () => {
      cancelled = true;
    };
  }, [phase, lowFi, setPhase]);

  /* ── consume: collapse to the singularity ──────────────── */
  useEffect(() => {
    if (phase !== 'consume') return;
    const obj = { p: progressRef.current };
    const tween = gsap.to(obj, {
      p: 1,
      duration: lowFi ? 0.45 : CONSUME_S,
      ease: 'power2.in',
      onUpdate: () => {
        progressRef.current = obj.p;
      },
      onComplete: () => {
        audio.whoomp();
        setFlash(true);
        setPhase('swap');
      },
    });
    return () => {
      tween.kill();
    };
  }, [phase, lowFi, setPhase]);

  /* ── swap: commit screen behind the flash, capture incoming ── */
  useEffect(() => {
    if (phase !== 'swap') return;
    let cancelled = false;
    commitScreen();
    // two rAFs so React paints the incoming screen before we rasterize it
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (cancelled) return;
        if (!lowFi) {
          try {
            // scale 1: this capture happens during the white-flash hold,
            // so latency is more visible than texture sharpness
            const tex = await snapshotScreen(1);
            if (cancelled) {
              tex.dispose();
              return;
            }
            texRef.current?.dispose();
            texRef.current = tex;
            setTexVersion((v) => v + 1);
          } catch {
            /* expand will reveal live DOM through the fading flash instead */
          }
        }
        progressRef.current = 1;
        setFlash(false);
        setPhase('expand');
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [phase, lowFi, commitScreen, setPhase]);

  /* ── expand: reverse the collapse over the incoming snapshot ── */
  useEffect(() => {
    if (phase !== 'expand') return;
    const obj = { p: 1 };
    const tween = gsap.to(obj, {
      p: 0,
      duration: lowFi ? 0.4 : EXPAND_S,
      ease: 'power3.out',
      onUpdate: () => {
        progressRef.current = obj.p;
      },
      onComplete: () => {
        texRef.current?.dispose();
        texRef.current = null;
        audio.stopRumble();
        setPhase('idle');
      },
    });
    return () => {
      tween.kill();
    };
  }, [phase, lowFi, setPhase]);

  // dispose any lingering snapshot if the manager itself unmounts
  useEffect(
    () => () => {
      texRef.current?.dispose();
      texRef.current = null;
    },
    [],
  );

  const active = phase === 'consume' || phase === 'swap' || phase === 'expand';

  return (
    <>
      {active && !lowFi && texRef.current && (
        <BlackHoleTransition texRef={texRef} progressRef={progressRef} texVersion={texVersion} />
      )}
      {active && lowFi && <IrisFallback collapsing={phase === 'consume'} />}
      {/* white flash at the moment of total collapse */}
      <div
        className="no-capture"
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 8500,
          background: '#fff',
          pointerEvents: 'none',
          opacity: flash ? 1 : 0,
          transition: flash ? 'opacity 60ms linear' : 'opacity 280ms ease-out',
        }}
      />
    </>
  );
}

/**
 * Cheap iris wipe for devices without WebGL2. A transparent circle with a
 * viewport-sized box-shadow: black everywhere except the circle, and the
 * circle's width/height animate smoothly (gradients/clip-paths can't).
 */
function IrisFallback({ collapsing }: { collapsing: boolean }) {
  const [size, setSize] = useState(collapsing ? '170vmax' : '0vmax');
  useEffect(() => {
    const id = requestAnimationFrame(() => setSize(collapsing ? '0vmax' : '170vmax'));
    return () => cancelAnimationFrame(id);
  }, [collapsing]);
  return (
    <div
      className="no-capture"
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 8000, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: size,
          height: size,
          borderRadius: '50%',
          boxShadow: '0 0 0 200vmax #000',
          transition: `width 420ms ${collapsing ? 'ease-in' : 'ease-out'}, height 420ms ${collapsing ? 'ease-in' : 'ease-out'}`,
        }}
      />
    </div>
  );
}
