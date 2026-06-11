import { useEffect, useRef } from 'react';
import { useStore } from '../store';

/**
 * Custom crosshair cursor for the game screens (quest / fighter / invaders),
 * matching the original canvas crosshair: green ring + cross, amber when
 * hovering interactive elements. Hidden on touch devices and menu screens.
 */
export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const screen = useStore((s) => s.screen);
  const active = screen === 'quest' || screen === 'fighter' || screen === 'invaders';

  useEffect(() => {
    if (!active) {
      document.body.style.cursor = '';
      return;
    }
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.body.style.cursor = 'none';
    const el = ref.current!;
    const move = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      const t = e.target as HTMLElement | null;
      const hot = !!t?.closest('button, a, [data-hot]');
      el.style.setProperty('--ch', hot ? '#ffcf52' : '#6bff8a');
    };
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mousemove', move);
      document.body.style.cursor = '';
    };
  }, [active]);

  if (!active || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)) return null;

  return (
    <div
      ref={ref}
      className="no-capture"
      aria-hidden
      style={{ position: 'fixed', left: 0, top: 0, zIndex: 9500, pointerEvents: 'none', willChange: 'transform' }}
    >
      <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform: 'translate(-17px, -17px)' }}>
        <circle cx="17" cy="17" r="10" fill="none" stroke="var(--ch, #6bff8a)" strokeWidth="2" opacity="0.8">
          <animate attributeName="r" values="9;12;9" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <line x1="17" y1="2" x2="17" y2="9" stroke="var(--ch, #6bff8a)" strokeWidth="2" />
        <line x1="17" y1="25" x2="17" y2="32" stroke="var(--ch, #6bff8a)" strokeWidth="2" />
        <line x1="2" y1="17" x2="9" y2="17" stroke="var(--ch, #6bff8a)" strokeWidth="2" />
        <line x1="25" y1="17" x2="32" y2="17" stroke="var(--ch, #6bff8a)" strokeWidth="2" />
        <rect x="16" y="16" width="2" height="2" fill="var(--ch, #6bff8a)" />
      </svg>
    </div>
  );
}
