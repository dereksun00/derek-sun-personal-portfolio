import { useEffect, useRef, useState } from 'react';
import styles from './BootLoader.module.css';
import { TITLE } from '../content';

interface Props {
  /** flips true once the cabinet has actually rendered — start powering off */
  ready: boolean;
  /** called after the power-off animation finishes, to unmount the loader */
  onExited: () => void;
}

/**
 * CRT power-on boot screen shown from the first paint until the 3D cabinet
 * is ready to render, so the title never appears as an empty starfield.
 * When `ready` flips true it powers off (collapses to a bright line) to
 * reveal the already-rendered cabinet behind it.
 */
export default function BootLoader({ ready, onExited }: Props) {
  const [exiting, setExiting] = useState(false);
  const exitedRef = useRef(false);

  useEffect(() => {
    if (!ready || exiting) return;
    // small beat so the power-on animation is never cut off mid-unfold
    const id = window.setTimeout(() => setExiting(true), 260);
    return () => window.clearTimeout(id);
  }, [ready, exiting]);

  useEffect(() => {
    if (!exiting) return;
    // fallback in case animationend doesn't fire (reduced-motion, bg tab)
    const id = window.setTimeout(() => {
      if (!exitedRef.current) {
        exitedRef.current = true;
        onExited();
      }
    }, 420);
    return () => window.clearTimeout(id);
  }, [exiting, onExited]);

  return (
    <div
      className={`${styles.boot} ${exiting ? styles.exiting : ''} no-capture`}
      aria-hidden
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && exiting && !exitedRef.current) {
          exitedRef.current = true;
          onExited();
        }
      }}
    >
      <div className={styles.screen}>
        <div className={styles.brand}>{TITLE.heading}</div>
        <div className={styles.ver}>DEREK OS v1.0</div>
        <div className={styles.loading}>LOADING</div>
        <div className={styles.bar}>
          <div className={styles.barFill} />
        </div>
      </div>
      <div className={styles.scan} />
    </div>
  );
}
