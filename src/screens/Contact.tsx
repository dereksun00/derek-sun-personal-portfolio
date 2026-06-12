import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Contact.module.css';
import PixelSprite from '../components/PixelArt';
import { CONTACT, SLOT_REVEALS } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

const SPIN_GLYPHS = ['in', '@', '★', '◆', '♥'];
const PULL_DURATIONS = [600, 800, 1000];

function ReelFace({ symbol }: { symbol: string }) {
  if (symbol === 'code') return <PixelSprite name="brackets" px={4} glow="rgba(255, 207, 82, 0.5)" />;
  return <>{symbol}</>;
}

/**
 * Contact slot machine: each lever pull spins the remaining reels and
 * locks in one more contact (LinkedIn → email → GitHub), with staggered
 * slow-down ticks. Third pull = JACKPOT.
 */
export default function Contact() {
  const navigateTo = useStore((s) => s.navigateTo);
  const [revealed, setRevealed] = useState(0); // reels locked in so far
  const [spinning, setSpinning] = useState(false);
  const [faces, setFaces] = useState<string[]>(['?', '?', '?']);
  const [pulled, setPulled] = useState(false);
  const [jackpot, setJackpot] = useState(false);
  const [inserted, setInserted] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        audio.back();
        navigateTo('select');
      }
      if (e.key === 'Enter' || e.key === ' ') pull();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, spinning]);

  const pull = () => {
    if (spinning || revealed >= SLOT_REVEALS.length) return;
    audio.lever();
    setPulled(true);
    timers.current.push(window.setTimeout(() => setPulled(false), 260));
    setSpinning(true);

    const reelIdx = revealed;
    const total = PULL_DURATIONS[reelIdx] ?? 800;
    const start = performance.now();

    // cycle glyphs on every still-hidden reel, ticking like a real reel
    const tick = () => {
      const elapsed = performance.now() - start;
      setFaces((prev) =>
        prev.map((f, i) => (i >= revealed ? SPIN_GLYPHS[Math.floor(Math.random() * SPIN_GLYPHS.length)] : f)),
      );
      audio.reelTick();
      if (elapsed < total) {
        // slow down toward the lock-in
        const remaining = 1 - elapsed / total;
        timers.current.push(window.setTimeout(tick, 50 + (1 - remaining) * 160));
      } else {
        setFaces((prev) => prev.map((f, i) => (i === reelIdx ? SLOT_REVEALS[i].symbol : f)));
        setRevealed(reelIdx + 1);
        setSpinning(false);
        audio.marioCoin();
        if (reelIdx + 1 === SLOT_REVEALS.length) {
          timers.current.push(
            window.setTimeout(() => {
              setJackpot(true);
              audio.jackpot();
            }, 350),
          );
        }
      }
    };
    tick();
  };

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
      <div className={styles.heading}>{CONTACT.heading}</div>
      <div className={styles.divider} />

      <div className={styles.machine}>
        {/* nameplate etched into the top of the bezel */}
        <div className={styles.nameplate}>{CONTACT.marquee}</div>

        <div className={styles.reels}>
          {/* payline only exists during the spin — a magenta scan, not a static artifact */}
          <AnimatePresence>
            {spinning && (
              <motion.div
                className={styles.payline}
                aria-hidden
                initial={{ opacity: 0, scaleX: 0.2 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            )}
          </AnimatePresence>
          {SLOT_REVEALS.map((r, i) => (
            // reel + info panel share one border so they read as a single component
            <div key={r.label} className={styles.reelUnit}>
              <div
                className={`${styles.reel} ${spinning && i >= revealed ? styles.spinning : ''} ${jackpot ? styles.matched : ''}`}
                style={jackpot ? { animationDelay: `${i * 0.12}s` } : undefined}
              >
                <ReelFace symbol={faces[i]} />
              </div>
              <div className={styles.reelInfo}>
                {i < revealed && (
                  <motion.div
                    className={styles.revealPanel}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    /* fixed tween (not a spring) so every panel lands with identical timing */
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className={styles.revealLabel}>{r.label}</span>
                    <a className={styles.reelValue} href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.value}
                    </a>
                  </motion.div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* coin door: slit cut into the bezel + chunky INSERT COIN button */}
        <div className={styles.coinDoor}>
          <span className={`${styles.coinSlit} ${inserted ? styles.slitGlow : ''}`} aria-hidden />
          <button
            className={styles.coinSlot}
            onClick={() => {
              audio.coinSlot();
              setInserted(true);
              timers.current.push(window.setTimeout(() => setInserted(false), 600));
              pull();
            }}
          >
            {CONTACT.coinSlot}
          </button>
        </div>

        <div className={`${styles.lever} ${pulled ? styles.pulled : ''}`} onClick={pull} role="button" aria-label={CONTACT.lever}>
          <div className={styles.leverArrow} aria-hidden>▶</div>
          <div className={styles.leverTrack}>
            <div className={styles.leverKnob} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {jackpot && (
          <motion.div
            className={styles.jackpot}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => {
              // let the banner breathe, then drop it so links are clickable
              timers.current.push(window.setTimeout(() => setJackpot(false), 2400));
            }}
          >
            <div className={styles.jackpotText}>{CONTACT.jackpot}</div>
            <div className={styles.cta}>{CONTACT.cta}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
