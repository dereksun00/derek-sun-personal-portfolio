import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { KONAMI_MESSAGE } from '../content';
import { audio } from '../sound/AudioEngine';

const SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
];

/** ↑↑↓↓←→←→BA toggles DEBUG MODE (wireframes, FPS, dev console scroll). */
export default function KonamiHandler() {
  const toggleDebug = useStore((s) => s.toggleDebug);
  const [banner, setBanner] = useState(false);

  useEffect(() => {
    let idx = 0;
    const onKey = (e: KeyboardEvent) => {
      idx = e.code === SEQUENCE[idx] ? idx + 1 : e.code === SEQUENCE[0] ? 1 : 0;
      if (idx === SEQUENCE.length) {
        idx = 0;
        toggleDebug();
        audio.fanfare();
        setBanner(true);
        window.setTimeout(() => setBanner(false), 2200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleDebug]);

  if (!banner) return null;
  return (
    <div
      className="no-capture"
      style={{
        position: 'fixed',
        top: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9400,
        color: 'var(--amber)',
        fontSize: 'clamp(10px, 2vw, 16px)',
        padding: '14px 22px',
        background: 'rgba(12, 8, 32, 0.92)',
        boxShadow: '0 0 0 2px var(--amber), 0 0 30px rgba(255,207,82,0.5)',
        textShadow: '0 0 10px rgba(255,207,82,0.8)',
        animation: 'pulse-amber 0.6s ease-in-out infinite',
        pointerEvents: 'none',
      }}
    >
      {KONAMI_MESSAGE}
    </div>
  );
}
