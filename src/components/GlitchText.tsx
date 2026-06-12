import { CSSProperties, useEffect, useState } from 'react';
import styles from './GlitchText.module.css';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

interface Props {
  text: string;
  /** breathing glow pulse on the base layer */
  breathe?: boolean;
  /** average seconds between arcs DURING THE BOOT WARM-UP (0 = never) */
  glitchEvery?: number;
  withSound?: boolean;
  /** arc once on mouse enter (default true) — glitch is punctuation, not baseline */
  hoverArc?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Chromatic-aberration glitch text. The red/cyan ghost layers only snap
 * apart during the first-load CRT warm-up window and on hover — static
 * state stays clean and sharp.
 */
export default function GlitchText({
  text,
  breathe = false,
  glitchEvery = 1.2,
  withSound = false,
  hoverArc = true,
  className,
  style,
}: Props) {
  const booted = useStore((s) => s.booted);
  const [glitching, setGlitching] = useState(false);

  const arc = (sound: boolean) => {
    setGlitching(true);
    if (sound) audio.glitch();
    window.setTimeout(() => setGlitching(false), 180);
  };

  // periodic electrical arcs only while the tube is still warming up
  useEffect(() => {
    if (booted || !glitchEvery) return;
    let alive = true;
    let timer: number;
    const schedule = () => {
      const wait = glitchEvery * 1000 * (0.4 + Math.random());
      timer = window.setTimeout(() => {
        if (!alive) return;
        setGlitching(true);
        if (withSound) audio.glitch();
        window.setTimeout(() => {
          if (alive) setGlitching(false);
          schedule();
        }, 180);
      }, wait);
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [booted, glitchEvery, withSound]);

  return (
    <span
      className={`${styles.wrap} ${glitching ? styles.glitching : ''} ${className ?? ''}`}
      style={style}
      onMouseEnter={hoverArc ? () => arc(false) : undefined}
    >
      <span className={`${styles.layer} ${styles.r}`} aria-hidden>{text}</span>
      <span className={`base ${breathe ? styles.breathe : ''}`}>{text}</span>
      <span className={`${styles.layer} ${styles.b}`} aria-hidden>{text}</span>
    </span>
  );
}
