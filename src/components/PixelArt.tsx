/**
 * Pixel-art sprites rendered as SVG rects — the site's replacement for
 * emoji glyphs. Each map is a string grid; chars index into PALETTE.
 */
const PALETTE: Record<string, string> = {
  R: '#ff4a6b', // red
  M: '#ff5cc8', // magenta
  A: '#ffcf52', // amber
  C: '#4cf2ff', // cyan
  W: '#ffffff',
  S: '#ffd9a0', // skin
  K: '#1d1430', // dark outline
  D: '#0a0612', // near-black
  G: '#8d8aa3', // grey
  T: '#e8e6dc', // cream text
};

export const SPRITES = {
  /** Super Mushroom — game select: MARIO / PROJECTS */
  mushroom: [
    '...RRRRRR...',
    '..RRWWWRRR..',
    '.RWWRRRRWWR.',
    '.RWRRWWRRWR.',
    'RRWRRWWRRWRR',
    'RRRRRRRRRRRR',
    '.RRWWRRWWRR.',
    '..SSSSSSSS..',
    '..SKSSSSKS..',
    '..SSSSSSSS..',
    '...SSSSSS...',
  ],
  /** Boxing glove — game select: STREET FIGHTER / EXPERIENCE */
  glove: [
    '....MMMMM...',
    '..MMMMMMMM..',
    '.MMMMMMMMMM.',
    '.MMMMMMMMWW.',
    'MMMMMMMMMMWW',
    'MMMMMMMMMMM.',
    '.MMMMMMMMM..',
    '..MMMMMMM...',
    '...AAAAA....',
    '...AAAAA....',
  ],
  /** Classic crab invader — game select: SPACE INVADERS / SKILLS */
  invader: [
    '..C......C..',
    '...C....C...',
    '..CCCCCCCC..',
    '.CC.CCCC.CC.',
    'CCCCCCCCCCCC',
    'C.CCCCCCCC.C',
    'C.C......C.C',
    '...CC..CC...',
  ],
  /** Studio microphone — Nova (AI voice receptionist) portrait */
  mic: [
    '....AAAA....',
    '...AAAAAA...',
    '...AWAAAA...',
    '...AAAAAA...',
    '...AAAAAA...',
    '....AAAA....',
    '..C..CC..C..',
    '..C..CC..C..',
    '...CCCCCC...',
    '.....CC.....',
    '.....CC.....',
    '....CCCC....',
  ],
  /** Envelope + spark — Maybole (cold outreach AI) portrait */
  envelope: [
    'CCCCCCCCCCCC',
    'CWC........C',
    'C.CC......CC',
    'C..CC....CC.',
    'C...CCCCC..C',
    'C..........C',
    'C..........C',
    'CCCCCCCCCCCC',
    '.....A......',
    '....AAA.....',
    '.....A......',
  ],
  /** Mystery fighter silhouette — locked slot */
  silhouette: [
    '....KKKK....',
    '...KKKKKK...',
    '...KKKKKK...',
    '....KKKK....',
    '..KKKKKKKK..',
    '.KKKKKKKKKK.',
    'KK.KKKKKK.KK',
    'K..KKKKKK..K',
    '...KKKKKK...',
    '...KK..KK...',
    '...KK..KK...',
    '..KKK..KKK..',
  ],
  /** Derek's fighter portrait — dev with headphones */
  hero: [
    '..KKKKKKKK..',
    '.KKKKKKKKKK.',
    'CKKSSSSSSKKC',
    'CKSSSSSSSSKC',
    'CKSKSSSSKSKC',
    '.KSSSSSSSSK.',
    '..SSSKKSSS..',
    '..SSSSSSSS..',
    '...CCCCCC...',
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
  ],
  /** RPG equipment tiles for the About sheet */
  sword: [
    '.........CC.',
    '........CCC.',
    '.......CCC..',
    '......CCC...',
    '.....CCC....',
    '.A..CCC.....',
    '..AACC......',
    '..AAA.......',
    '.AAAA.......',
    'AA..A.......',
  ],
  shield: [
    '.CCCCCCCCC..',
    '.CWCCCCCCC..',
    '.CCCCACCCC..',
    '.CCCAAACCC..',
    '.CCCCACCCC..',
    '.CCCCCCCCC..',
    '..CCCCCCC...',
    '...CCCCC....',
    '....CCC.....',
    '.....C......',
  ],
  dagger: [
    '.....CC.....',
    '.....CC.....',
    '.....CC.....',
    '.....CC.....',
    '.....CC.....',
    '...AAAAAA...',
    '.....AA.....',
    '.....AA.....',
    '....AAAA....',
  ],
  orb: [
    '...MMMMMM...',
    '..MMMWWMMM..',
    '.MMMMWWMMMM.',
    'MMMMMMMMMMMM',
    'MMMMMMMMMMMM',
    '.MMMMMMMMMM.',
    '..MMMMMMMM..',
    '...MMMMMM...',
    '....AAAA....',
    '...AAAAAA...',
  ],
  hourglass: [
    'AAAAAAAAAA..',
    '.AWWWWWWA...',
    '.AWWWWWWA...',
    '..AWWWWA....',
    '...AWWA.....',
    '...AWWA.....',
    '..AW..WA....',
    '.AW....WA...',
    '.AWWWWWWA...',
    'AAAAAAAAAA..',
  ],
  chest: [
    '..AAAAAAAA..',
    '.AAAAAAAAAA.',
    '.AKAAAAAAKA.',
    '.AAAAAAAAAA.',
    '.AAAACCAAAA.',
    '.AAAACCAAAA.',
    '.AKAAAAAAKA.',
    '.AAAAAAAAAA.',
  ],
  /** Barbell — powerlifting (cyan plates, amber bar) */
  barbell: [
    '.C........C.',
    '.C........C.',
    '.CC......CC.',
    '.CC......CC.',
    'ACCAAAAAACCA',
    'ACCAAAAAACCA',
    '.CC......CC.',
    '.CC......CC.',
    '.C........C.',
    '.C........C.',
  ],
  /** Chess knight — tactics */
  knight: [
    '....MMMM....',
    '...MMMMMM...',
    '..MMMWMMMM..',
    '.MMMMMMMMM..',
    '.MM..MMMMM..',
    '.....MMMM...',
    '....MMMMM...',
    '...MMMMMM...',
    '..MMMMMMMM..',
    '.MMMMMMMMMM.',
  ],
  /** Basketball — amber ball, dark seams */
  basketball: [
    '...AAAAAA...',
    '..AAAKAAAA..',
    '.AAAAKAAAAA.',
    'AAAAAKAAAAAA',
    'AKKKKKKKKKKA',
    'AAAAAKAAAAAA',
    '.AAAAKAAAAA.',
    '..AAAKAAAA..',
    '...AAAAAA...',
  ],
  /** </> bracket cluster — amber brackets, cyan slash */
  brackets: [
    '...A...CA...',
    '..A...C..A..',
    '.A....C...A.',
    'A....C.....A',
    '.A...C....A.',
    '..A.C....A..',
    '...AC...A...',
  ],
  /** Trophy — achievements */
  trophy: [
    '.AAAAAAAAAA.',
    '.A.AAAAAA.A.',
    '.A.AAAAAA.A.',
    '..AAAAAAAA..',
    '...AAAAAA...',
    '....AAAA....',
    '.....AA.....',
    '.....AA.....',
    '...AAAAAA...',
    '..AAAAAAAA..',
  ],
} as const;

export type SpriteName = keyof typeof SPRITES;

interface Props {
  name: SpriteName;
  /** size of one sprite pixel in CSS px */
  px?: number;
  glow?: string;
  className?: string;
}

export default function PixelSprite({ name, px = 4, glow, className }: Props) {
  const map = SPRITES[name];
  const w = map[0].length * px;
  const h = map.length * px;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 6px ${glow})` } : undefined}
      aria-hidden
    >
      {map.flatMap((row, y) =>
        row.split('').map((ch, x) => {
          const fill = PALETTE[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px + 0.2} height={px + 0.2} fill={fill} />;
        }),
      )}
    </svg>
  );
}
