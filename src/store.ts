import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Screen =
  | 'title'
  | 'select'
  | 'quest'
  | 'fighter'
  | 'invaders'
  | 'contact'
  | 'about';

export type TransitionPhase =
  | 'idle'
  | 'capturing' // html2canvas snapshot of outgoing screen in flight
  | 'consume'   // black hole eats the outgoing snapshot
  | 'swap'      // screen committed behind opaque flash; incoming snapshot in flight
  | 'expand';   // reverse-expand reveals the incoming snapshot

/**
 * blackhole — the whole world changes (screen-level navigation only)
 * scanline  — CRT channel-change wipe, ~250ms (overlays open/close)
 * instant   — commit now with a brief flash (something else IS the transition)
 */
export type TransitionKind = 'blackhole' | 'scanline' | 'instant';

interface DerekOS {
  screen: Screen;
  /** state mutation applied at the swap point of the running transition */
  pendingCommit: (() => void) | null;
  phase: TransitionPhase;
  transitionKind: TransitionKind;
  /** bumped by 'instant' transitions; TransitionManager renders the flash */
  flashNonce: number;
  /** WebGL2 + html2canvas unavailable → CSS iris fallback */
  lowFi: boolean;
  /** true once the title CRT warm-up has played (first load only) */
  booted: boolean;
  debug: boolean;
  /** id of the open project/experience overlay, null when closed */
  overlayId: string | null;
  overlayKind: 'project' | 'experience' | null;

  /** run any state change through a transition; black hole is opt-in, not default */
  transition: (commit: () => void, kind?: TransitionKind) => void;
  navigateTo: (s: Screen) => void;
  setPhase: (p: TransitionPhase) => void;
  commitScreen: () => void;
  setBooted: () => void;
  toggleDebug: () => void;
  openOverlay: (kind: 'project' | 'experience', id: string, t?: TransitionKind) => void;
  closeOverlay: () => void;
}

function detectLowFi(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return !canvas.getContext('webgl2');
  } catch {
    return true;
  }
}

export const useStore = create<DerekOS>((set, get) => ({
  screen: 'title',
  pendingCommit: null,
  phase: 'idle',
  transitionKind: 'blackhole',
  flashNonce: 0,
  lowFi: detectLowFi(),
  booted: false,
  debug: false,
  overlayId: null,
  overlayKind: null,

  transition: (commit, kind = 'blackhole') => {
    if (get().phase !== 'idle') return;
    if (kind === 'instant') {
      commit();
      set((s) => ({ flashNonce: s.flashNonce + 1 }));
      return;
    }
    set({ pendingCommit: commit, phase: 'capturing', transitionKind: kind });
  },
  navigateTo: (s) => {
    const { screen, phase } = get();
    if (s === screen || phase !== 'idle') return;
    // screen changes are the only world-changes — always the black hole
    get().transition(() => set({ screen: s, overlayId: null, overlayKind: null }), 'blackhole');
  },
  setPhase: (p) => set({ phase: p }),
  commitScreen: () => {
    const { pendingCommit } = get();
    pendingCommit?.();
    set({ pendingCommit: null });
  },
  setBooted: () => set({ booted: true }),
  toggleDebug: () => set((st) => ({ debug: !st.debug })),
  openOverlay: (kind, id, t = 'scanline') => {
    const { phase, overlayId } = get();
    if (phase !== 'idle' || overlayId === id) return;
    get().transition(() => set({ overlayKind: kind, overlayId: id }), t);
  },
  closeOverlay: () => {
    const { phase, overlayId } = get();
    if (phase !== 'idle' || !overlayId) return;
    get().transition(() => set({ overlayId: null, overlayKind: null }), 'scanline');
  },
}));

// dev-only escape hatch so integration tests can await screen/phase state
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__derekos = useStore;
}

/** Mute lives in its own persisted store so the main store stays ephemeral. */
interface AudioPrefs {
  muted: boolean;
  toggleMute: () => void;
}

export const useAudioPrefs = create<AudioPrefs>()(
  persist(
    (set) => ({
      muted: false,
      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: 'derek-os-audio', storage: createJSONStorage(() => localStorage) },
  ),
);
