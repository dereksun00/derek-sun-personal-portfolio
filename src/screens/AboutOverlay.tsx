import { useEffect } from 'react';
import { motion } from 'framer-motion';
import styles from './AboutOverlay.module.css';
import GlitchText from '../components/GlitchText';
import { ABOUT } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

export default function AboutOverlay() {
  const setAboutOpen = useStore((s) => s.setAboutOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        audio.back();
        setAboutOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setAboutOpen]);

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          audio.back();
          setAboutOpen(false);
        }
      }}
    >
      <motion.div className={styles.card} initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }}>
        <button className={styles.close} onClick={() => { audio.back(); setAboutOpen(false); }} aria-label="Close">
          [ × ]
        </button>
        <GlitchText text={ABOUT.title} breathe glitchEvery={4} className={styles.title} />
        {ABOUT.lines.map((line, i) =>
          line === '' ? (
            <br key={i} />
          ) : (
            <div key={i} className={i < 2 ? styles.meta : undefined}>
              {line}
            </div>
          ),
        )}
      </motion.div>
    </motion.div>
  );
}
