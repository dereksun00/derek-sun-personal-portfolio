import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Contact.module.css';
import { CONTACT, SLOT_REVEALS } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

const SPIN_GLYPHS = ['in', '@', '★', '◆', '♥'];
const PULL_DURATIONS = [600, 800, 1000];

/** Pixel-art GitHub octocat for the third reel. */
function Octocat({ size = 34 }: { size?: number }) {
  const MAP = [
    '..XXXXXXXX..',
    '.XXXXXXXXXX.',
    'XX.XXXXXX.XX',
    'XXXXXXXXXXXX',
    'XXXXXXXXXXXX',
    'XX.XX..XX.XX',
    'XXXXXXXXXXXX',
    '.XXXXXXXXXX.',
    '..XX.XX.XX..',
    '..XXXXXXXX..',
  ];
  const px = size / 12;
  return (
    <svg width={size} height={(MAP.length * size) / 12} aria-label="GitHub octocat">
      {MAP.flatMap((row, y) =>
        row.split('').map((c, x) =>
          c === 'X' ? <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px + 0.3} height={px + 0.3} fill="#1d0f33" /> : null,
        ),
      )}
    </svg>
  );
}

function ReelFace({ symbol }: { symbol: string }) {
  if (symbol === 'octocat') return <Octocat />;
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
        <div className={styles.marquee}>{CONTACT.marquee}</div>

        <div className={styles.reels}>
          <div className={styles.payline} aria-hidden />
          <span className={styles.paylineTag}>{CONTACT.payline}</span>
          {SLOT_REVEALS.map((r, i) => (
            <div key={r.label}>
              <div className={`${styles.reel} ${spinning && i >= revealed ? styles.spinning : ''}`}>
                <ReelFace symbol={faces[i]} />
              </div>
              <div className={styles.reelLabel}>
                {i < revealed && (
                  <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    {r.label}
                    <a className={styles.reelValue} href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.value}
                    </a>
                  </motion.span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className={styles.coinSlot} onClick={pull} onMouseEnter={() => audio.coin()}>
          {CONTACT.coinSlot}
        </button>

        <div className={`${styles.lever} ${pulled ? styles.pulled : ''}`} onClick={pull} role="button" aria-label={CONTACT.lever}>
          <div className={styles.leverTrack}>
            <div className={styles.leverKnob} />
          </div>
          <div className={styles.leverText}>
            PULL
            <br />
            TO
            <br />
            SPIN
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
