import { useEffect, useState } from 'react';
import styles from './Boot.module.css';
import { BOOT_LINES } from '../content';
import { useStore } from '../store';
import { audio } from '../sound/AudioEngine';

const POWER_ON_MS = 900;
const LINE_MS = 380;

/** CRT power-on line → typed boot checklist → press enter. */
export default function Boot() {
  const navigateTo = useStore((s) => s.navigateTo);
  const setBooted = useStore((s) => s.setBooted);
  const [poweredOn, setPoweredOn] = useState(false);
  const [shown, setShown] = useState(0);
  const done = shown >= BOOT_LINES.length;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPoweredOn(true);
      audio.crtClick();
    }, POWER_ON_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!poweredOn || done) return;
    const t = window.setTimeout(() => {
      setShown((n) => n + 1);
      audio.bootBlip();
    }, LINE_MS);
    return () => window.clearTimeout(t);
  }, [poweredOn, shown, done]);

  useEffect(() => {
    const proceed = () => {
      void audio.unlock();
      if (!done) {
        setShown(BOOT_LINES.length); // skip ahead
        return;
      }
      audio.confirm();
      setBooted();
      navigateTo('title');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') proceed();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', proceed);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', proceed);
    };
  }, [done, navigateTo, setBooted]);

  return (
    <div className={`screen ${styles.screen}`}>
      {/* unmounted after the animation: html2canvas chokes on its scaleY(400) transform */}
      {!poweredOn && <div className={styles.powerLine} aria-hidden />}
      {poweredOn && (
        <div className={styles.console}>
          {BOOT_LINES.slice(0, shown).map((line) => {
            const m = line.match(/^(.*?)(OK)$/);
            return (
              <div key={line} className={styles.line}>
                {m ? (
                  <>
                    {m[1]}
                    <span className={styles.ok}>OK</span>
                  </>
                ) : (
                  line
                )}
              </div>
            );
          })}
          {!done && <span className={styles.caret} aria-hidden />}
          {done && <div className={styles.prompt}>[ PRESS ENTER TO CONTINUE ]</div>}
        </div>
      )}
    </div>
  );
}
