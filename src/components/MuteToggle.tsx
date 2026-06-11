import { useEffect } from 'react';
import { useAudioPrefs } from '../store';
import { audio } from '../sound/AudioEngine';

/** Corner speaker icon; state persists via the zustand-persist audio store. */
export default function MuteToggle() {
  const muted = useAudioPrefs((s) => s.muted);
  const toggleMute = useAudioPrefs((s) => s.toggleMute);

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  return (
    <button
      className="no-capture"
      aria-label={muted ? 'Unmute' : 'Mute'}
      onClick={() => {
        void audio.unlock();
        toggleMute();
      }}
      style={{
        position: 'fixed',
        right: 14,
        bottom: 12,
        zIndex: 9300,
        fontSize: 16,
        color: muted ? 'var(--green-dim)' : 'var(--green)',
        textShadow: muted ? 'none' : '0 0 8px rgba(107,255,138,0.5)',
        padding: 6,
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
