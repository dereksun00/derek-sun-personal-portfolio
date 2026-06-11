import { CSSProperties, useEffect, useState } from 'react';
import styles from './GlitchText.module.css';
import { audio } from '../sound/AudioEngine';

interface Props {
  text: string;
  /** breathing glow pulse on the base layer */
  breathe?: boolean;
  /** average seconds between electrical-arc flickers (0 = never) */
  glitchEvery?: number;
  withSound?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Chromatic-aberration glitch text: red/cyan ghost layers that snap apart
 * during brief randomized "electrical arc" events.
 */
export default function GlitchText({ text, breathe = false, glitchEvery = 4, withSound = false, className, style }: Props) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    if (!glitchEvery) return;
    let alive = true;
    let timer: number;
    const schedule = () => {
      // jittered interval so arcs feel electrical, not metronomic
      const wait = glitchEvery * 1000 * (0.5 + Math.random());
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
  }, [glitchEvery, withSound]);

  return (
    <span className={`${styles.wrap} ${glitching ? styles.glitching : ''} ${className ?? ''}`} style={style}>
      <span className={`${styles.layer} ${styles.r}`} aria-hidden>{text}</span>
      <span className={`base ${breathe ? styles.breathe : ''}`}>{text}</span>
      <span className={`${styles.layer} ${styles.b}`} aria-hidden>{text}</span>
    </span>
  );
}
