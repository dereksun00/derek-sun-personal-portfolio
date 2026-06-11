import { useEffect, useState } from 'react';
import styles from './QuestLog.module.css';
import ScanlinePanel from '../components/ScanlinePanel';
import MarioWorld from '../components/MarioWorld';
import { PROJECTS, QUEST_HUD } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

/**
 * Quest log = the Mario world. W/S navigates the quest list, ENTER opens
 * the selected quest, arrow keys drive Mario — jumping under a ? block
 * opens that project, the pipe warps to contact.
 */
export default function QuestLog() {
  const navigateTo = useStore((s) => s.navigateTo);
  const openOverlay = useStore((s) => s.openOverlay);
  const overlayId = useStore((s) => s.overlayId);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlayId) return; // overlay owns the keyboard while open
      if (e.key === 'w' || e.key === 'W') {
        setSel((s) => (s + PROJECTS.length - 1) % PROJECTS.length);
        audio.cursor();
      } else if (e.key === 's' || e.key === 'S') {
        setSel((s) => (s + 1) % PROJECTS.length);
        audio.cursor();
      } else if (e.key === 'Enter') {
        audio.open();
        openOverlay('project', PROJECTS[sel].id);
      } else if (e.key === 'Escape') {
        audio.back();
        navigateTo('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, overlayId, navigateTo, openOverlay]);

  const fire = (key: string, type: 'mario-down' | 'mario-up') =>
    window.dispatchEvent(new CustomEvent(type, { detail: key }));

  const dpad = (key: string, label: string, cls: string) => (
    <button
      key={key}
      className={`${styles.dpadBtn} ${cls}`}
      onPointerDown={(e) => {
        e.preventDefault();
        fire(key, 'mario-down');
      }}
      onPointerUp={() => fire(key, 'mario-up')}
      onPointerLeave={() => fire(key, 'mario-up')}
      aria-label={key}
    >
      {label}
    </button>
  );

  const project = PROJECTS[sel];

  return (
    <div className={`screen ${styles.screen}`}>
      <MarioWorld
        selected={sel}
        onBump={(id) => {
          setSel(Math.max(0, PROJECTS.findIndex((p) => p.id === id)));
          openOverlay('project', id);
        }}
        onPipe={() => navigateTo('contact')}
      />

      <div className={styles.hudTop}>
        <span>
          {QUEST_HUD.name}
          <span className={styles.sep}>|</span>
          {QUEST_HUD.klass}
        </span>
        <span className={styles.right}>{QUEST_HUD.right}</span>
      </div>

      <div className={styles.questPanelWrap}>
        <ScanlinePanel title={QUEST_HUD.leftPanel}>
        <div className={styles.questList}>
          {PROJECTS.map((p, i) => (
            <button
              key={p.id}
              className={`${styles.questItem} ${i === sel ? styles.sel : ''}`}
              onMouseEnter={() => {
                setSel(i);
                audio.cursor();
              }}
              onClick={() => {
                audio.open();
                openOverlay('project', p.id);
              }}
            >
              <span className={styles.arrow}>►</span>
              {p.name}
              {p.tags.includes('1ST PLACE') && <span className={styles.tag}>1ST PLACE</span>}
            </button>
          ))}
        </div>
        </ScanlinePanel>
      </div>

      <div className={styles.detailPanelWrap}>
        <ScanlinePanel title={QUEST_HUD.rightPanel} color="amber">
          <div className={styles.detailStatus}>STATUS: {project.status}</div>
          <div>{project.body.slice(0, 150)}…</div>
          <div className={styles.detailMore}>[ ENTER ] FULL LOG</div>
        </ScanlinePanel>
      </div>

      <div className={styles.hudBottom}>
        {QUEST_HUD.controls.map((c) => (
          <span key={c}>{c}</span>
        ))}
        <span>[ ←→↑ ] MARIO</span>
      </div>

      <div className={styles.dpad}>
        {dpad('ArrowUp', '▲', styles.up)}
        {dpad('ArrowLeft', '◀', styles.left)}
        {dpad('ArrowDown', '▼', styles.downBtn)}
        {dpad('ArrowRight', '▶', styles.rightBtn)}
      </div>
    </div>
  );
}
