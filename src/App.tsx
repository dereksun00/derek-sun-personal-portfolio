import { useStore } from './store';
import Boot from './screens/Boot';
import Title from './screens/Title';
import Save from './screens/Save';
import Select from './screens/Select';
import QuestLog from './screens/QuestLog';
import Fighter from './screens/Fighter';
import Invaders from './screens/Invaders';
import Contact from './screens/Contact';
import ProjectOverlay from './screens/ProjectOverlay';
import AboutOverlay from './screens/AboutOverlay';
import StarField from './components/StarField';
import CRTOverlay from './components/CRTOverlay';
import Cursor from './components/Cursor';
import MuteToggle from './components/MuteToggle';
import DebugOverlay from './components/DebugOverlay';
import TransitionManager from './effects/TransitionManager';
import KonamiHandler from './effects/KonamiHandler';

const SCREENS = {
  boot: Boot,
  title: Title,
  save: Save,
  select: Select,
  quest: QuestLog,
  fighter: Fighter,
  invaders: Invaders,
  contact: Contact,
} as const;

export default function App() {
  const screen = useStore((s) => s.screen);
  const overlayId = useStore((s) => s.overlayId);
  const aboutOpen = useStore((s) => s.aboutOpen);
  const ActiveScreen = SCREENS[screen];

  return (
    <>
      <StarField />
      {/* #screen-root is exactly what the black hole snapshots */}
      <div id="screen-root" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <ActiveScreen />
        {overlayId && <ProjectOverlay />}
        {aboutOpen && <AboutOverlay />}
      </div>
      <TransitionManager />
      <KonamiHandler />
      <DebugOverlay />
      <MuteToggle />
      <Cursor />
      <CRTOverlay />
    </>
  );
}
