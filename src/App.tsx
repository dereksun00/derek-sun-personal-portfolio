import { useStore } from './store';
import Title from './screens/Title';
import Select from './screens/Select';
import QuestLog from './screens/QuestLog';
import Fighter from './screens/Fighter';
import Invaders from './screens/Invaders';
import Contact from './screens/Contact';
import About from './screens/About';
import ProjectOverlay from './screens/ProjectOverlay';
import StarField from './components/StarField';
import CRTOverlay from './components/CRTOverlay';
import MuteToggle from './components/MuteToggle';
import DebugOverlay from './components/DebugOverlay';
import TransitionManager from './effects/TransitionManager';
import KonamiHandler from './effects/KonamiHandler';
import GLBoundary from './components/GLBoundary';

const SCREENS = {
  title: Title,
  select: Select,
  quest: QuestLog,
  fighter: Fighter,
  invaders: Invaders,
  contact: Contact,
  about: About,
} as const;

export default function App() {
  const screen = useStore((s) => s.screen);
  const overlayId = useStore((s) => s.overlayId);
  const ActiveScreen = SCREENS[screen];

  return (
    <>
      <StarField />
      {/* #screen-root is exactly what the black hole snapshots */}
      <div id="screen-root" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <ActiveScreen />
        {overlayId && <ProjectOverlay />}
      </div>
      {/* boundary: a transition-layer crash must never unmount the site */}
      <GLBoundary fallback={null}>
        <TransitionManager />
      </GLBoundary>
      <KonamiHandler />
      <DebugOverlay />
      <MuteToggle />
      <CRTOverlay />
    </>
  );
}
