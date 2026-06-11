import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './Invaders.module.css';
import { SKILL_ROWS } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

const GLYPHS: Record<string, string> = { green: '👾', cyan: '🛸', magenta: '👽', amber: '🤖' };

/**
 * SKILLS as an invader formation: rows color-coded by category, each
 * alien is a skill. Click to zap (laser sfx + flash) — pure delight,
 * the data is always readable.
 */
export default function Invaders() {
  const navigateTo = useStore((s) => s.navigateTo);
  const [zapped, setZapped] = useState<string | null>(null);

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
      <button
        className={styles.back}
        onClick={() => {
          audio.back();
          navigateTo('select');
        }}
      >
        ← BACK
      </button>
      <div className={styles.title}>— SKILLS LOADED —</div>
      <div className={styles.grid}>
        {SKILL_ROWS.map((row, r) => (
          <motion.div
            key={row.category}
            className={styles.row}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: r * 0.12 }}
          >
            {row.skills.map((skill, i) => (
              <button
                key={skill}
                className={`${styles.alien} ${styles[row.color]} ${zapped === skill ? styles.zapped : ''}`}
                style={{ animationDelay: `${(i * 0.3 + r * 0.5) % 2.6}s` }}
                onMouseEnter={() => audio.cursor()}
                onClick={() => {
                  audio.zap();
                  setZapped(skill);
                  window.setTimeout(() => setZapped(null), 380);
                }}
              >
                <span className={styles.glyph} aria-hidden>
                  {GLYPHS[row.color]}
                </span>
                {skill}
              </button>
            ))}
          </motion.div>
        ))}
      </div>
      <div className={styles.legend}>
        {SKILL_ROWS.map((row) => (
          <div key={row.category}>
            <span className={styles.dot} style={{ background: `var(--${row.color === 'cyan' ? 'cyan' : row.color})` }} />
            {row.category}
          </div>
        ))}
      </div>
      <div className={styles.hint}>CLICK AN INVADER TO ZAP IT</div>
    </div>
  );
}
