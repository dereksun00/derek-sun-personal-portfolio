import { useEffect } from 'react';
import { useAudioPrefs } from '../store';
import { audio } from '../sound/AudioEngine';

/** 12×10 pixel-art speaker drawn as SVG rects — no emoji, no font glyphs. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  const PX = 2;
  // speaker body + cone
  const BODY = [
    [3, 3], [4, 3],
    [2, 4], [3, 4], [4, 4],
    [0, 5], [1, 5], [2, 5], [3, 5], [4, 5],
    [0, 6], [1, 6], [2, 6], [3, 6], [4, 6],
    [2, 7], [3, 7], [4, 7],
    [3, 8], [4, 8],
  ];
  // sound waves (hidden when muted)
  const WAVES = [
    [7, 4], [8, 3], [7, 7], [8, 8],
    [9, 5], [9, 6], [10, 2], [10, 9], [11, 4], [11, 5], [11, 6], [11, 7],
  ];
  // X strike (shown when muted)
  const STRIKE = [
    [7, 3], [8, 4], [9, 5], [10, 6], [11, 7],
    [11, 3], [10, 4], [8, 6], [7, 7], [9, 5],
  ];
  const cells = muted ? [...BODY, ...STRIKE] : [...BODY, ...WAVES];
  const color = muted ? 'var(--cyan-dim)' : 'var(--cyan)';
  return (
    <svg width={13 * PX} height={11 * PX} viewBox={`0 0 ${13 * PX} ${11 * PX}`} aria-hidden>
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * PX} y={y * PX} width={PX} height={PX} fill={color} />
      ))}
    </svg>
  );
}

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
        padding: 8,
        lineHeight: 0,
        filter: muted ? 'none' : 'drop-shadow(0 0 6px rgba(76, 242, 255, 0.55))',
      }}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
