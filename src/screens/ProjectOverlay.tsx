import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './ProjectOverlay.module.css';
import GlitchText from '../components/GlitchText';
import PixelButton from '../components/PixelButton';
import StaticScreenshot from '../components/StaticScreenshot';
import { ESC_BACK, EXPERIENCES, GITHUB_BUTTON, PROJECTS, VISUAL_LOG_HEADER } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

function bar(v: number) {
  return '█'.repeat(v) + '░'.repeat(5 - v);
}

/**
 * Full-screen quest detail ("VISUAL LOG") for both projects and
 * experiences: glitch title, typewriter lore, tech pills, static-tuned
 * screenshot frames (projects) or fighter stats + bullets (experiences).
 */
export default function ProjectOverlay() {
  const overlayId = useStore((s) => s.overlayId);
  const overlayKind = useStore((s) => s.overlayKind);
  const closeOverlay = useStore((s) => s.closeOverlay);

  const project = overlayKind === 'project' ? PROJECTS.find((p) => p.id === overlayId) : undefined;
  const exp = overlayKind === 'experience' ? EXPERIENCES.find((e) => e.id === overlayId) : undefined;
  const lore = project?.body ?? '';
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    setTyped(0);
    if (!lore) return;
    const timer = window.setInterval(() => {
      setTyped((n) => {
        if (n >= lore.length) {
          window.clearInterval(timer);
          return n;
        }
        return n + 3;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [lore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        audio.back();
        closeOverlay();
      }
      if ((e.key === 'g' || e.key === 'G') && (project?.url)) {
        window.open(project.url, '_blank', 'noopener');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOverlay, project]);

  if (!project && !exp) return null;
  const name = project?.name ?? exp!.name;
  const tech = project?.tech ?? exp!.tech;

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          audio.back();
          closeOverlay();
        }
      }}
    >
      <motion.div
        className={styles.frame}
        initial={{ scale: 0.94, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <button
          className={styles.esc}
          onClick={() => {
            audio.back();
            closeOverlay();
          }}
        >
          {ESC_BACK}
        </button>

        <GlitchText text={name} breathe glitchEvery={3} withSound className={styles.title} />

        {project && <div className={styles.status}>STATUS: {project.status}</div>}
        {exp && (
          <>
            <div className={styles.status}>ROLE: {exp.role}</div>
            <div className={styles.dates}>DATES: {exp.dates}</div>
            <div className={styles.statsRow}>
              <span>
                PWR <span className={styles.statBar}>{bar(exp.stats.power)}</span>
              </span>
              <span>
                SPD <span className={styles.statBar}>{bar(exp.stats.speed)}</span>
              </span>
              <span>
                DEF <span className={styles.statBar}>{bar(exp.stats.defense)}</span>
              </span>
              <span className={styles.special}>"{exp.stats.special}"</span>
            </div>
          </>
        )}

        {project && (
          <div className={styles.lore}>
            {lore.slice(0, typed)}
            {typed < lore.length && <span style={{ color: 'var(--amber)' }}>▌</span>}
          </div>
        )}

        {exp && (
          <ul className={styles.bullets}>
            {exp.bullets.map((b) => (
              <motion.li key={b} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                {b}
              </motion.li>
            ))}
          </ul>
        )}

        {project && (
          <>
            <div className={styles.sectionHead}>{VISUAL_LOG_HEADER}</div>
            <div className={styles.shots}>
              {project.screenshots.map((s, i) => (
                <StaticScreenshot key={s} src={s} label={`screenshot_0${i + 1}`} />
              ))}
            </div>
          </>
        )}

        <div className={styles.tags}>
          {tech.map((t, i) => (
            <motion.span
              key={t}
              className={styles.pill}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.04 }}
              onMouseEnter={() => audio.blip()}
            >
              {t}
            </motion.span>
          ))}
        </div>

        <div className={styles.footer}>
          {project ? (
            <PixelButton color="magenta" onClick={() => window.open(project.url, '_blank', 'noopener')}>
              {GITHUB_BUTTON}
            </PixelButton>
          ) : (
            <span />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
