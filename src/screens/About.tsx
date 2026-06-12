import { useEffect } from 'react';
import { motion } from 'framer-motion';
import styles from './About.module.css';
import GlitchText from '../components/GlitchText';
import ScanlinePanel from '../components/ScanlinePanel';
import PixelSprite, { SpriteName } from '../components/PixelArt';
import { ABOUT } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';


/* ── pixel dev-at-desk portrait, layered so head/hands can animate ── */
const PAL: Record<string, string> = {
  K: '#1d1430', // outlines / monitor frame
  C: '#4cf2ff', // screen glow / headphones
  D: '#8a5a2c', // desk
  G: '#8d8aa3', // keyboard
  P: '#2a0d4a', // chair
  M: '#ff5cc8', // shirt
  S: '#ffd9a0', // skin
  H: '#2b1a10', // hair
};

const BASE = [
  '..............................',
  '..............................',
  '..............................',
  '............KKKKKKKKKKK.......',
  '............K.........K.......',
  '............K.........K.......',
  '............K.........K.......',
  '............K.........K.......',
  '............K.........K.......',
  '............KKKKKKKKKKK.......',
  '.................KK...........',
  '...............KKKKKK.........',
  '.....GGGGGGG..................',
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '..DD......................DD..',
  '..DD......................DD..',
  '..DD......................DD..',
  '..DD......................DD..',
];

const BODY = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..PP..........................',
  '..PP..........................',
  '..PP.MMMM.....................',
  '..PP.MMMMM....................',
  '..PPMMMMMM....................',
  '..PPMMMMMMM...................',
  '..PP.MMMM.....................',
  '..PPPPPPPP....................',
];

const HEAD = [
  '....HHHH......................',
  '...HHHHHH.....................',
  '..CHSSSSHC....................',
  '..CHSSKSHC....................',
  '...HSSSSS.....................',
  '....SSSS......................',
];

const PXL = 8;

function Layer({ map, className }: { map: string[]; className?: string }) {
  return (
    <g className={className}>
      {map.flatMap((row, y) =>
        row.split('').map((ch, x) => {
          const fill = PAL[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x * PXL} y={y * PXL} width={PXL + 0.2} height={PXL + 0.2} fill={fill} />;
        }),
      )}
    </g>
  );
}

/** Dev at his desk: head bobs, hands type, code scrolls on the monitor. */
function Portrait() {
  const w = 30 * PXL;
  const h = 18 * PXL;
  const screenX = 13 * PXL;
  const lineColors = ['#ffcf52', '#ff5cc8', '#e8e6dc', '#4cf2ff'];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.portraitSvg} aria-label="Pixel developer at a desk">
      {/* screen glow base */}
      <rect x={screenX} y={4 * PXL} width={9 * PXL} height={5 * PXL} fill="#0a1a26" />
      <Layer map={BASE} />
      {/* animated code lines on the monitor */}
      {lineColors.map((c, i) => (
        <rect
          key={i}
          className={styles.codeLine}
          style={{ animationDelay: `${i * 0.55}s` }}
          x={screenX + 4}
          y={(4 + i) * PXL + 3}
          width={(7 - (i % 3)) * PXL}
          height={4}
          fill={c}
        />
      ))}
      <Layer map={BODY} />
      <Layer map={HEAD} className={styles.head} />
      {/* typing hands */}
      <rect className={styles.handL} x={6 * PXL} y={11 * PXL + 4} width={PXL} height={PXL - 2} fill={PAL.S} />
      <rect className={styles.handR} x={9 * PXL} y={11 * PXL + 4} width={PXL} height={PXL - 2} fill={PAL.S} />
    </svg>
  );
}

/** ABOUT ME as a full RPG character sheet. */
export default function About() {
  const navigateTo = useStore((s) => s.navigateTo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        audio.back();
        navigateTo('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateTo]);

  return (
    <div className={`screen ${styles.screen}`}>
      {/* ambient drifting motes */}
      <div className={styles.motes} aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={styles.mote} style={{ left: `${(i * 11.3 + 4) % 100}%`, animationDelay: `${i * 1.7}s`, animationDuration: `${11 + (i % 4) * 3}s` }} />
        ))}
      </div>

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
        <GlitchText text={ABOUT.title} breathe className={styles.name} />
        <div className={styles.class}>{ABOUT.class}</div>
      </div>

      <div className={styles.sheet}>
        <motion.div className={styles.portraitWrap} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <ScanlinePanel title="► CHARACTER" color="amber">
            <div className={styles.portraitBox}>
              <Portrait />
            </div>
            <div className={styles.portraitCaption}>{ABOUT.caption}</div>
          </ScanlinePanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <ScanlinePanel title={ABOUT.panels.stats}>
            <div className={styles.stats}>
              {ABOUT.stats.map((s) => (
                <div key={s.label} className={styles.statRow}>
                  <span className={styles.statLabel}>{s.label}</span>
                  <span className={styles.statValue}>{s.value}</span>
                </div>
              ))}
            </div>
            <div className={styles.xpRow}>
              <span className={styles.xpLabel}>XP</span>
              <span className={styles.xpTrack}>
                <motion.span
                  className={styles.xpFill}
                  initial={{ width: 0 }}
                  animate={{ width: `${(3.93 / 4) * 100}%` }}
                  transition={{ delay: 0.5, duration: 1.1, ease: 'easeOut' }}
                />
              </span>
              <span className={styles.xpValue}>3.93 / 4.00</span>
            </div>
          </ScanlinePanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <ScanlinePanel title={ABOUT.panels.backstory} color="magenta">
            <p className={styles.backstory}>{ABOUT.backstory}</p>
          </ScanlinePanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <ScanlinePanel title={ABOUT.panels.equipment}>
            <div className={styles.equipGrid}>
              {ABOUT.equipment.map((eq) => (
                <div key={eq.name} className={styles.equipTile}>
                  <PixelSprite name={eq.icon as SpriteName} px={3} glow="rgba(76, 242, 255, 0.35)" />
                  <div>
                    <div className={styles.equipName}>{eq.name}</div>
                    <div className={styles.equipKind}>{eq.kind}</div>
                  </div>
                </div>
              ))}
            </div>
          </ScanlinePanel>
        </motion.div>

        <motion.div className={styles.achievementsWrap} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <ScanlinePanel title={ABOUT.panels.achievements} color="amber">
            <div className={styles.achievements}>
              {ABOUT.achievements.map((a) => (
                <div key={a.name} className={styles.achievement}>
                  <PixelSprite name="trophy" px={3} glow="rgba(255, 207, 82, 0.5)" />
                  <div>
                    <div className={styles.achName}>{a.name}</div>
                    <div className={styles.achDetail}>{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </ScanlinePanel>
        </motion.div>
      </div>
    </div>
  );
}
