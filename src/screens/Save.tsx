import { useEffect } from 'react';
import { motion } from 'framer-motion';
import styles from './Save.module.css';
import { SAVE_FILE } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

/** Save file card — ENTER or click loads the game (→ select screen). */
export default function Save() {
  const navigateTo = useStore((s) => s.navigateTo);

  const load = () => {
    audio.confirm();
    navigateTo('select');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') load();
      if (e.key === 'Escape') {
        audio.back();
        navigateTo('title');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`screen ${styles.screen}`}>
      <div className={styles.title}>{SAVE_FILE.title}</div>
      <motion.div
        className={styles.card}
        onClick={load}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        whileHover={{ scale: 1.015 }}
      >
        <div className={styles.nameLine}>
          <span>{SAVE_FILE.name}</span>
          <span className={styles.slotTag}>{SAVE_FILE.slotTag}</span>
        </div>
        <div className={styles.divider} />
        {SAVE_FILE.rows.map((r, i) => (
          <motion.div
            key={r.label}
            className={styles.row}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.07 }}
          >
            <span className={styles.label}>{r.label}</span>
            <span className={styles.val}>{r.value}</span>
          </motion.div>
        ))}
        <div className={styles.divider} />
        <div className={styles.load}>
          <span className={styles.bracket}></span>
          {SAVE_FILE.load}
        </div>
      </motion.div>
    </div>
  );
}
