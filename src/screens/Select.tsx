import { useEffect, useState } from 'react';
import styles from './Select.module.css';
import PixelButton from '../components/PixelButton';
import PixelSprite, { SpriteName } from '../components/PixelArt';
import { GAME_SELECT } from '../content';
import { Screen, useStore } from '../store';
import { audio } from '../sound/AudioEngine';

const GAME_ICONS: Record<string, { sprite: SpriteName; glow: string }> = {
  quest: { sprite: 'mushroom', glow: 'rgba(255, 74, 107, 0.6)' },
  fighter: { sprite: 'glove', glow: 'rgba(255, 92, 200, 0.6)' },
  invaders: { sprite: 'invader', glow: 'rgba(76, 242, 255, 0.6)' },
};

/** Game select: three idle-bobbing cabinets + contact / about. */
export default function Select() {
  const navigateTo = useStore((s) => s.navigateTo);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setSel((s) => (s + GAME_SELECT.games.length - 1) % GAME_SELECT.games.length);
        audio.cursor();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setSel((s) => (s + 1) % GAME_SELECT.games.length);
        audio.cursor();
      } else if (e.key === 'Enter') {
        audio.confirm();
        navigateTo(GAME_SELECT.games[sel].id as Screen);
      } else if (e.key === 'Escape') {
        audio.back();
        navigateTo('title');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, navigateTo]);

  return (
    <div className={`screen ${styles.screen}`}>
      <button
        className={styles.back}
        onClick={() => {
          audio.back();
          navigateTo('title');
        }}
      >
        {GAME_SELECT.back}
      </button>
      <div className={styles.title}>{GAME_SELECT.title}</div>
      <div className={styles.cabinets}>
        {GAME_SELECT.games.map((g, i) => (
          <button
            key={g.id}
            className={`${styles.cab} ${i === sel ? styles.selected : ''}`}
            onMouseEnter={() => {
              setSel(i);
              audio.cursor();
            }}
            onClick={() => {
              audio.confirm();
              navigateTo(g.id as Screen);
            }}
          >
            <div className={styles.cabScreen}>
              <PixelSprite name={GAME_ICONS[g.id].sprite} px={5} glow={GAME_ICONS[g.id].glow} />
            </div>
            <div className={styles.cabName}>{g.name}</div>
            <div className={styles.cabLabel}>{g.label}</div>
          </button>
        ))}
      </div>
      <div className={styles.buttons}>
        <PixelButton color="magenta" onClick={() => navigateTo('contact')}>
          {GAME_SELECT.contact}
        </PixelButton>
        <PixelButton color="amber" onClick={() => navigateTo('about')}>
          {GAME_SELECT.about}
        </PixelButton>
      </div>
    </div>
  );
}
