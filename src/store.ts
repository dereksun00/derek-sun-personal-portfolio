import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Screen =
  | 'boot'
  | 'title'
  | 'save'
  | 'select'
  | 'quest'
  | 'fighter'
  | 'invaders'
  | 'contact';

export type TransitionPhase =
  | 'idle'
  | 'capturing' // html2canvas snapshot of outgoing screen in flight
  | 'consume'   // black hole eats the outgoing snapshot
  | 'swap'      // screen committed behind opaque flash; incoming snapshot in flight
  | 'expand';   // reverse-expand reveals the incoming snapshot

interface DerekOS {
  screen: Screen;
  pendingScreen: Screen | null;
  phase: TransitionPhase;
  /** WebGL2 + html2canvas unavailable → CSS iris fallback */
  lowFi: boolean;
  booted: boolean;
  debug: boolean;
  aboutOpen: boolean;
  /** id of the open project/experience overlay, null when closed */
  overlayId: string | null;
  overlayKind: 'project' | 'experience' | null;

  navigateTo: (s: Screen) => void;
  setPhase: (p: TransitionPhase) => void;
  commitScreen: () => void;
  setBooted: () => void;
  toggleDebug: () => void;
  setAboutOpen: (v: boolean) => void;
  openOverlay: (kind: 'project' | 'experience', id: string) => void;
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
  screen: 'boot',
  pendingScreen: null,
  phase: 'idle',
  lowFi: detectLowFi(),
  booted: false,
  debug: false,
  aboutOpen: false,
  overlayId: null,
  overlayKind: null,

  navigateTo: (s) => {
    const { screen, phase } = get();
    if (s === screen || phase !== 'idle') return;
    set({ pendingScreen: s, phase: 'capturing', aboutOpen: false, overlayId: null, overlayKind: null });
  },
  setPhase: (p) => set({ phase: p }),
  commitScreen: () => {
    const { pendingScreen } = get();
    if (pendingScreen) set({ screen: pendingScreen, pendingScreen: null });
  },
  setBooted: () => set({ booted: true }),
  toggleDebug: () => set((st) => ({ debug: !st.debug })),
  setAboutOpen: (v) => set({ aboutOpen: v }),
  openOverlay: (kind, id) => set({ overlayKind: kind, overlayId: id }),
  closeOverlay: () => set({ overlayId: null, overlayKind: null }),
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
