import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { useStore } from '../store';
import { snapshotScreen, warmUpSnapshot } from './snapshot';
import BlackHoleTransition from './BlackHoleTransition';
import GLBoundary from '../components/GLBoundary';
import { getBHTier, bhTierDecided, reportTransitionFps, getTierInfo } from './quality';
import wipeStyles from './ScanlineWipe.module.css';
import { audio } from '../sound/AudioEngine';

const WIPE_MS = 250; // scanline channel-change duration

// transition lengths per tier — a shorter effect that stays smooth beats a
// long one that stutters, so weaker tiers run faster
const DUR = {
  high: { consume: 0.85, expand: 0.6 },
  medium: { consume: 0.7, expand: 0.5 },
  low: { consume: 0.42, expand: 0.4 }, // potato (CSS iris)
} as const;

// A main-thread hitch (WebGL context creation, snapshot upload) must not
// fast-forward the collapse: clamp any frame gap > 250ms to a ~30fps step.
gsap.ticker.lagSmoothing(250, 33);

/**
 * Owns every transition kind from one place:
 *   blackhole — capturing → consume → swap → expand → idle (world changes)
 *   scanline  — 250ms CRT channel-change wipe (overlays open/close)
 *   instant   — commit already happened in the store; render a soft flash
 *
 * Black hole runs as a WebGL shader on the 'high'/'medium' tiers and as a
 * fast CSS iris wipe on the 'low'/potato tier (and without WebGL2). Tier is
 * chosen pre-emptively from hardware on load; the first WebGL transition is
 * profiled and can downgrade a machine that stutters. See quality.ts.
 */
export default function TransitionManager() {
  const phase = useStore((s) => s.phase);
  const kind = useStore((s) => s.transitionKind);
  const flashNonce = useStore((s) => s.flashNonce);
  const lowFi = useStore((s) => s.lowFi);
  const setPhase = useStore((s) => s.setPhase);
  const commitScreen = useStore((s) => s.commitScreen);

  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const progressRef = useRef(0);
  const [texVersion, setTexVersion] = useState(0);
  const [flash, setFlash] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [softFlash, setSoftFlash] = useState(false);
  const [bhTier, setBhTier] = useState(getBHTier());
  const [, setMeasuredFps] = useState<number | null>(getTierInfo().fps);

  // Whether the persistent WebGL canvas mounts at all. Stable for the page's
  // life (a later downgrade just stops *using* it; it never unmounts, which
  // would churn the context). Potato/no-WebGL2 machines never create it.
  const mountWebGL = useRef(!lowFi && getBHTier() !== 'low').current;
  // potato path for THIS transition (reactive: a measured downgrade flips it)
  const usePotato = lowFi || bhTier === 'low';
  const dur = DUR[usePotato ? 'low' : bhTier];

  /* ── warm html2canvas at idle so the first capture doesn't hitch ── */
  useEffect(() => {
    if (!mountWebGL) return; // CSS iris never snapshots
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(() => warmUpSnapshot())
      : window.setTimeout(warmUpSnapshot, 1500);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [mountWebGL]);

  /* ── profile the first WebGL transition's consume phase; downgrade a tier
        that can't hold ~50fps for the rest of the session ── */
  useEffect(() => {
    if (phase !== 'consume' || usePotato || bhTierDecided()) return;
    let frames = 0;
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      const secs = (performance.now() - start) / 1000;
      if (secs > 0.3) {
        reportTransitionFps(frames / secs);
        setBhTier(getBHTier());
        setMeasuredFps(getTierInfo().fps);
      }
    };
  }, [phase, usePotato]);

  /* ── scanline: commit mid-wipe, settle in ~250ms ───────── */
  useEffect(() => {
    if (phase !== 'capturing' || kind !== 'scanline') return;
    setWipe(true);
    audio.glitch();
    const commitT = window.setTimeout(commitScreen, WIPE_MS / 2);
    const doneT = window.setTimeout(() => {
      setWipe(false);
      setPhase('idle');
    }, WIPE_MS + 30);
    return () => {
      window.clearTimeout(commitT);
      window.clearTimeout(doneT);
    };
  }, [phase, kind, commitScreen, setPhase]);

  /* ── instant: the store already committed; brief soft flash ── */
  useEffect(() => {
    if (flashNonce === 0) return;
    setSoftFlash(true);
    const t = window.setTimeout(() => setSoftFlash(false), 90);
    return () => window.clearTimeout(t);
  }, [flashNonce]);

  /* ── capture outgoing screen (black hole only) ─────────── */
  useEffect(() => {
    if (phase !== 'capturing' || kind !== 'blackhole') return;
    if (usePotato) {
      // CSS iris needs no snapshot — go straight to the collapse
      setPhase('consume');
      return;
    }
    let cancelled = false;
    audio.startRumble(dur.consume + 0.2);
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
  }, [phase, kind, usePotato, dur.consume, setPhase]);

  /* ── consume: collapse to the singularity ──────────────── */
  useEffect(() => {
    if (phase !== 'consume') return;
    const obj = { p: progressRef.current };
    const tween = gsap.to(obj, {
      p: 1,
      duration: dur.consume,
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
  }, [phase, dur.consume, setPhase]);

  /* ── swap: commit screen behind the flash, capture incoming ── */
  useEffect(() => {
    if (phase !== 'swap') return;
    let cancelled = false;
    commitScreen();
    // two rAFs so React paints the incoming screen before we rasterize it
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (cancelled) return;
        if (!usePotato) {
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
  }, [phase, usePotato, commitScreen, setPhase]);

  /* ── expand: reverse the collapse over the incoming snapshot ── */
  useEffect(() => {
    if (phase !== 'expand') return;
    const obj = { p: 1 };
    const tween = gsap.to(obj, {
      p: 0,
      duration: dur.expand,
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
  }, [phase, dur.expand, setPhase]);

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
      {/* persistent: mounts once, pre-warms shaders, then idles at zero cost.
          GLBoundary: if the WebGL canvas ever fails, transitions degrade to
          the white flash (the phase machine runs independently of this
          canvas) instead of React unmounting the whole app. */}
      {mountWebGL && (
        <GLBoundary fallback={null}>
          <BlackHoleTransition
            texRef={texRef}
            progressRef={progressRef}
            texVersion={texVersion}
            active={active && !usePotato && texRef.current !== null}
            tier={bhTier}
          />
        </GLBoundary>
      )}
      {active && usePotato && <IrisFallback collapsing={phase === 'consume'} />}
      {/* scanline channel-change wipe (overlays) */}
      {wipe && (
        <div className={`${wipeStyles.wipe} no-capture`} aria-hidden>
          <div className={wipeStyles.tear} />
          <div className={wipeStyles.band} />
        </div>
      )}
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
      {/* soft flash for instant transitions */}
      <div
        className="no-capture"
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 8400,
          background: '#fff',
          pointerEvents: 'none',
          opacity: softFlash ? 0.3 : 0,
          transition: softFlash ? 'opacity 30ms linear' : 'opacity 160ms ease-out',
        }}
      />
      <PerfOverlay />
    </>
  );
}

/**
 * Cheap iris wipe for the potato tier / devices without WebGL2. A
 * transparent circle with a viewport-sized box-shadow: black everywhere
 * except the circle, and the circle's width/height animate smoothly
 * (gradients/clip-paths can't). A white flash bridges the swap.
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
          transition: `width 400ms ${collapsing ? 'ease-in' : 'ease-out'}, height 400ms ${collapsing ? 'ease-in' : 'ease-out'}`,
        }}
      />
    </div>
  );
}

/**
 * `?perf` overlay: current tier + the detection inputs + the measured fps of
 * the first transition, so different machines can be checked at a glance.
 */
function PerfOverlay() {
  const show = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');
  // re-read each render; the profiler's setState above forces a re-render
  // after measurement so fps/tier stay current
  if (!show) return null;
  const i = getTierInfo();
  const color = i.tier === 'high' ? '#4cf2ff' : i.tier === 'medium' ? '#ffcf52' : '#ff5cc8';
  return (
    <div
      className="no-capture"
      style={{
        position: 'fixed',
        bottom: 10,
        left: 10,
        zIndex: 9000,
        padding: '8px 10px',
        background: 'rgba(5,3,16,0.82)',
        border: `1px solid ${color}`,
        color: '#e8e6dc',
        font: "11px/1.5 'VT323', monospace",
        letterSpacing: '0.04em',
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {`TIER `}
      <b style={{ color }}>{i.tier.toUpperCase()}</b>
      {`  (${i.source})\n`}
      {`FPS  ${i.fps ?? '—'}\n`}
      {`cores ${i.cores}  mem ${i.memory ?? '?'}GB  dpr ${i.dpr}\n`}
      {`gpu  ${(i.gpu || 'unknown').slice(0, 42)}`}
    </div>
  );
}
