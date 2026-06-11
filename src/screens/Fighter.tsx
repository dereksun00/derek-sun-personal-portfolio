import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Fighter.module.css';
import { EXPERIENCES, LOCKED_FIGHTER } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

function bar(v: number) {
  return '█'.repeat(v) + '░'.repeat(5 - v);
}

/**
 * SELECT EXPERIENCE: each internship is a fighter card. Picking one slams
 * a VS splash (fighter vs DEREK SUN), then opens the experience log.
 */
export default function Fighter() {
  const navigateTo = useStore((s) => s.navigateTo);
  const openOverlay = useStore((s) => s.openOverlay);
  const overlayId = useStore((s) => s.overlayId);
  const [vsId, setVsId] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !overlayId && !vsId) {
        audio.back();
        navigateTo('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateTo, overlayId, vsId]);

  const pick = (id: string) => {
    if (vsId) return;
    audio.punch();
    setVsId(id);
    window.setTimeout(() => audio.ko(), 700);
    window.setTimeout(() => {
      setVsId(null);
      openOverlay('experience', id);
    }, 1300);
  };

  const vsFighter = EXPERIENCES.find((e) => e.id === vsId);

  return (
    <div className={`screen ${styles.screen}`}>
      <button
        className={styles.back}
        onClick={() => {
          audio.back();
          navigateTo('select');
        }}
      >
        ← BACK
      </button>
      <div className={styles.title}>— SELECT EXPERIENCE —</div>
      <div className={styles.cards}>
        {EXPERIENCES.map((e, i) => (
          <motion.button
            key={e.id}
            className={styles.card}
            onClick={() => pick(e.id)}
            onMouseEnter={() => audio.cursor()}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}
          >
            <div className={styles.portrait}>{i === 0 ? '🎙️' : '🧠'}</div>
            <div className={styles.name}>{e.name}</div>
            <div className={styles.role}>{e.role}</div>
            <div className={styles.bars}>
              PWR <span className={styles.barFill}>{bar(e.stats.power)}</span>
              <br />
              SPD <span className={styles.barFill}>{bar(e.stats.speed)}</span>
              <br />
              DEF <span className={styles.barFill}>{bar(e.stats.defense)}</span>
            </div>
            <div className={styles.special}>"{e.stats.special}"</div>
          </motion.button>
        ))}
        <motion.button
          className={`${styles.card} ${styles.locked}`}
          transition={{ duration: 0.35 }}
          onClick={() => {
            audio.glitch();
            setShake('locked');
            window.setTimeout(() => setShake(null), 380);
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={shake === 'locked' ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, y: 0 }}
        >
          <div className={styles.portrait}>🔒</div>
          <div className={styles.name}>{LOCKED_FIGHTER.name}</div>
          <div className={styles.role}>{LOCKED_FIGHTER.role}</div>
        </motion.button>
      </div>

      <AnimatePresence>
        {vsFighter && (
          <motion.div className={styles.vs} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.vsName} initial={{ x: -140, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', damping: 14 }}>
              {vsFighter.name}
            </motion.div>
            <motion.div className={styles.vsLetter} initial={{ scale: 4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25, duration: 0.2 }}>
              VS
            </motion.div>
            <motion.div className={styles.vsName} initial={{ x: 140, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', damping: 14 }}>
              DEREK SUN
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
