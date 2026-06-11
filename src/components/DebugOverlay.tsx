import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

const FAKE_LOG = [
  'derekOS kernel 1.0.0-arcade',
  'gpu: CRT-9000 phosphor array online',
  'shader: blackhole.frag compiled (0 warnings)',
  'tone.js: audio graph ready',
  'zustand: 2 stores hydrated',
  'starfield: 180 instances seeded',
  'konami: listener armed',
  'html2canvas: snapshot pipeline ok',
  'bloom: mipmap chain x6',
  'quest data: 3 projects, 2 experiences loaded',
  'memcheck: 64K OK',
];

/** DEBUG MODE chrome: FPS counter + scrolling dev console at the screen edge. */
export default function DebugOverlay() {
  const debug = useStore((s) => s.debug);
  const [fps, setFps] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const frames = useRef(0);

  useEffect(() => {
    if (!debug) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames.current++;
      if (now - last >= 500) {
        setFps(Math.round((frames.current * 1000) / (now - last)));
        frames.current = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let i = 0;
    const timer = window.setInterval(() => {
      setLines((prev) => [...prev.slice(-9), `[${(i * 0.37).toFixed(2)}] ${FAKE_LOG[i % FAKE_LOG.length]}`]);
      i++;
    }, 700);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      setLines([]);
    };
  }, [debug]);

  if (!debug) return null;
  return (
    <div className="no-capture" aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 9200, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 14,
          color: 'var(--green)',
          fontSize: 12,
          textShadow: '0 0 6px rgba(107,255,138,0.6)',
        }}
      >
        FPS {fps}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          fontFamily: 'var(--font-term)',
          fontSize: 14,
          lineHeight: 1.3,
          color: 'rgba(107,255,138,0.45)',
          maxWidth: '40ch',
        }}
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
