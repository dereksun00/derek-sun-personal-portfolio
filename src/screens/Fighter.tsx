import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Fighter.module.css';
import PixelSprite, { SpriteName } from '../components/PixelArt';
import { EXPERIENCES, LOCKED_FIGHTER } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

const PORTRAITS: Record<string, SpriteName> = { nova: 'mic', maybole: 'envelope' };
const STAT_LABELS = [
  { key: 'power', label: 'PWR' },
  { key: 'speed', label: 'SPD' },
  { key: 'defense', label: 'DEF' },
] as const;

/** Segmented stat bar — cells light up in sequence while the card is hovered. */
function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.cells}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`${styles.cell} ${i < value ? styles.cellOn : ''}`}
            style={{ transitionDelay: `${i * 70}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * SELECT EXPERIENCE: each internship is a fighter. Picking one runs a
 * 2s VS intro — portraits slam in, FIGHT! — then the experience log
 * opens through the black hole.
 */
export default function Fighter() {
  const navigateTo = useStore((s) => s.navigateTo);
  const openOverlay = useStore((s) => s.openOverlay);
  const overlayId = useStore((s) => s.overlayId);
  const [vsId, setVsId] = useState<string | null>(null);
  const [fight, setFight] = useState(false);
  const [shake, setShake] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

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
    setFight(false);
    timers.current.push(window.setTimeout(() => {
      setFight(true);
      audio.ko();
    }, 1100));
    // the VS intro IS the transition — the overlay lands instantly under it
    timers.current.push(window.setTimeout(() => openOverlay('experience', id, 'instant'), 2000));
    timers.current.push(window.setTimeout(() => {
      setVsId(null);
      setFight(false);
    }, 2150));
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
            <div className={styles.portrait}>
              <PixelSprite name={PORTRAITS[e.id] ?? 'hero'} px={6} glow="rgba(255, 92, 200, 0.45)" />
            </div>
            <div className={styles.name}>{e.name}</div>
            <div className={styles.subtitle}>"{e.subtitle}"</div>
            <div className={styles.role}>{e.role}</div>
            <div className={styles.dates}>{e.dates}</div>
            <div className={styles.bars}>
              {STAT_LABELS.map((s) => (
                <StatBar key={s.key} label={s.label} value={e.stats[s.key]} />
              ))}
            </div>
          </motion.button>
        ))}
        <motion.button
          className={`${styles.card} ${styles.locked}`}
          transition={{ duration: 0.35 }}
          onClick={() => {
            audio.glitch();
            setShake(true);
            window.setTimeout(() => setShake(false), 380);
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={shake ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, y: 0 }}
        >
          <div className={`${styles.portrait} ${styles.lockedPortrait}`}>
            <PixelSprite name="silhouette" px={6} />
          </div>
          <div className={styles.name}>{LOCKED_FIGHTER.name}</div>
          <div className={styles.lockedRole}>{LOCKED_FIGHTER.role}</div>
        </motion.button>
      </div>

      <AnimatePresence>
        {vsFighter && (
          <motion.div className={styles.vs} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className={styles.vsSide}
              initial={{ x: '-60vw', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 220 }}
            >
              <div className={`${styles.vsPortrait} ${styles.vsPortraitLeft}`}>
                <PixelSprite name={PORTRAITS[vsFighter.id] ?? 'hero'} px={9} glow="rgba(76, 242, 255, 0.6)" />
              </div>
              <div className={styles.vsName}>{vsFighter.name}</div>
              <div className={styles.vsSub}>{vsFighter.subtitle.toUpperCase()}</div>
            </motion.div>

            <motion.div
              className={styles.vsLetter}
              initial={{ scale: 4, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.35, duration: 0.22 }}
            >
              VS
            </motion.div>

            <motion.div
              className={styles.vsSide}
              initial={{ x: '60vw', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 220 }}
            >
              <div className={`${styles.vsPortrait} ${styles.vsPortraitRight}`}>
                <PixelSprite name="hero" px={9} glow="rgba(255, 92, 200, 0.6)" />
              </div>
              <div className={styles.vsName}>DEREK SUN</div>
              <div className={styles.vsSub}>THE INTERN</div>
            </motion.div>

            <AnimatePresence>
              {fight && (
                <motion.div
                  className={styles.fight}
                  initial={{ scale: 5, opacity: 0, x: '-50%' }}
                  animate={{ scale: 1, opacity: 1, x: '-50%' }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', damping: 11, stiffness: 320 }}
                >
                  FIGHT!
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
