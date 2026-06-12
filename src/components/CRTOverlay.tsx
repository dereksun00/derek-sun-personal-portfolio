import styles from './CRTOverlay.module.css';

/**
 * Global CRT layer: scanlines, phosphor triads, vignette, curvature
 * glass highlight and the periodic tracking wave. No constant flicker —
 * static state stays clean; glitch is punctuation elsewhere.
 * Pure CSS — sits above everything (including transitions) and is
 * excluded from html2canvas captures via .no-capture.
 */
export default function CRTOverlay() {
  return (
    <div className={`${styles.root} no-capture`} aria-hidden>
      <div className={styles.scanlines} />
      <div className={styles.phosphor} />
      <div className={styles.tracking} />
      <div className={styles.glass} />
      <div className={styles.vignette} />
    </div>
  );
}
