import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Invaders.module.css';
import InvadersBackdrop from '../components/InvadersBackdrop';
import InvadersGame, { InvaderStats } from '../components/InvadersGame';
import { INVADERS_COPY, SKILL_INFO } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

/**
 * SKILLS as a playable Space Invaders round. The canvas owns the game;
 * this screen owns the scan readout, the win tally and touch controls.
 */
export default function Invaders() {
  const navigateTo = useStore((s) => s.navigateTo);
  const [scan, setScan] = useState<string | null>(null);
  const [stats, setStats] = useState<InvaderStats | null>(null);
  const [round, setRound] = useState(0); // bump to remount the game
  const scanTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(scanTimer.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        audio.back();
        navigateTo('select');
      }
      if ((e.key === 'r' || e.key === 'R') && stats) {
        audio.confirm();
        setStats(null);
        setScan(null);
        setRound((r) => r + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateTo, stats]);

  const fire = (key: string, type: 'inv-down' | 'inv-up') =>
    window.dispatchEvent(new CustomEvent(type, { detail: key }));

  const holdBtn = (key: string, label: string) => (
    <button
      key={key}
      className={styles.touchBtn}
      onPointerDown={(e) => {
        e.preventDefault();
        fire(key, 'inv-down');
      }}
      onPointerUp={() => fire(key, 'inv-up')}
      onPointerLeave={() => fire(key, 'inv-up')}
      aria-label={key}
    >
      {label}
    </button>
  );

  return (
    <div className={`screen ${styles.screen}`}>
      <InvadersBackdrop />
      <InvadersGame
        key={round}
        onZap={(skill) => {
          setScan(skill);
          window.clearTimeout(scanTimer.current);
          scanTimer.current = window.setTimeout(() => setScan(null), 3400);
        }}
        onWin={setStats}
      />

      <button
        className={styles.back}
        onClick={() => {
          audio.back();
          navigateTo('select');
        }}
      >
        ← BACK
      </button>

      <div className={styles.header}>
        <div className={styles.title}>{INVADERS_COPY.title}</div>
        <div className={styles.subtitle}>{INVADERS_COPY.subtitle}</div>
      </div>

      <div className={styles.controls}>
        {INVADERS_COPY.controls.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>

      {/* scan readout: one line of real context per skill shot down */}
      <AnimatePresence>
        {scan && (
          <motion.div
            key={scan}
            className={styles.scan}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className={styles.scanSkill}>{scan.toUpperCase()}</div>
            <div className={styles.scanInfo}>{SKILL_INFO[scan] ?? ''}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* win state */}
      <AnimatePresence>
        {stats && (
          <motion.div className={styles.win} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className={styles.winTitle}
              initial={{ scale: 2.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              {INVADERS_COPY.win}
            </motion.div>
            <div className={styles.winSub}>{INVADERS_COPY.winSub}</div>
            <div className={styles.winStats}>
              <span>TIME {stats.seconds}s</span>
              <span>SHOTS {stats.shots}</span>
              <span>ACCURACY {stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 100}%</span>
            </div>
            <div className={styles.winAgain}>{INVADERS_COPY.again}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* touch controls (coarse pointers only, via CSS) */}
      <div className={styles.touchPad}>
        {holdBtn('ArrowLeft', '◀')}
        {holdBtn('ArrowRight', '▶')}
        <button
          className={`${styles.touchBtn} ${styles.fireBtn}`}
          onPointerDown={(e) => {
            e.preventDefault();
            fire('fire', 'inv-down');
          }}
          aria-label="fire"
        >
          FIRE
        </button>
      </div>
    </div>
  );
}
