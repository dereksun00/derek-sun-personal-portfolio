/**
 * All site copy, pulled verbatim from the original DEREK OS v1.0 index.html.
 * This file is the single source of truth for content — screens render from here.
 */

export interface Project {
  id: string;
  name: string;
  tags: string[];
  status: string;
  body: string;
  tech: string[];
  url: string;
  /** Placeholder screenshot slots — swap these files in /public/projects/<id>/ */
  screenshots: string[];
}

export interface Experience {
  id: string;
  name: string;
  role: string;
  dates: string;
  bullets: string[];
  tech: string[];
  stats: { power: number; speed: number; defense: number; special: string };
}

export interface SlotReveal {
  symbol: 'in' | '@' | 'octocat';
  label: string;
  value: string;
  url: string;
}

export const BOOT_LINES = [
  'initializing...',
  '► MARIO             OK',
  '► STREET FIGHTER    OK',
  '► SPACE INVADERS    OK',
  '► CONTACT           OK',
  '► all systems ready.',
  '► welcome.',
];

export const TITLE = {
  heading: 'DEREK SUN',
  subtitle: 'COMPUTER SCIENCE @ UNIVERSITY OF TORONTO',
  prompt: '[ PRESS ENTER TO PLAY ]',
};

export const SAVE_FILE = {
  title: '— SAVE FILE —',
  slotTag: 'SLOT 1',
  name: 'DEREK SUN',
  rows: [
    { label: 'CLASS', value: 'CS + STATS' },
    { label: 'GUILD', value: 'UNIVERSITY OF TORONTO' },
    { label: 'GPA', value: '3.93' },
    { label: 'MINOR', value: 'STATISTICS' },
    { label: 'QUESTS', value: '3 COMPLETE' },
    { label: 'EXPECTED', value: '2029' },
  ],
  load: '[ LOAD GAME ]',
};

export const GAME_SELECT = {
  title: '— SELECT YOUR GAME —',
  games: [
    { id: 'quest', name: 'MARIO', label: 'PROJECTS' },
    { id: 'fighter', name: 'STREET FIGHTER', label: 'EXPERIENCE' },
    { id: 'invaders', name: 'SPACE INVADERS', label: 'SKILLS' },
  ] as const,
  contact: '[ CONTACT ]',
  about: '[ ABOUT ME ]',
  back: '← BACK',
};

export const PROJECTS: Project[] = [
  {
    id: 'tcare',
    name: 'T-CARE',
    tags: ['COMPLETED', '1ST PLACE'],
    status: 'COMPLETED — 1ST PLACE',
    body: 'T-Care is a campus support navigator built for UofT students. Describe a need in plain language, losing a TCard, needing exam accommodations, looking for counselling, and T-Care routes you to the exact campus office or resource. It uses Amazon Bedrock with optional Amazon Kendra context to resolve natural-language queries into specific campus destinations with addresses, or plain-language answers with support links.',
    tech: ['NODE.JS', 'EXPRESS', 'AMAZON BEDROCK', 'AMAZON KENDRA', 'REACT', 'TYPESCRIPT', 'VITE', 'GOOGLE MAPS API'],
    url: 'https://github.com/dereksun00/T-Care',
    screenshots: ['/projects/t-care/01.png', '/projects/t-care/02.png', '/projects/t-care/03.png'],
  },
  {
    id: 'toretto',
    name: 'TORETTO',
    tags: ['COMPLETED'],
    status: 'COMPLETED',
    body: 'Toretto is a mobile fall-detection system for families with elderly members. The phone streams accelerometer data in real time, acceleration magnitude, jerk, and orientation, into a Random Forest classifier trained to distinguish falls from normal movement. When a fall is detected every registered family member gets an immediate alert.',
    tech: ['REACT NATIVE', 'FASTAPI', 'RANDOM FOREST', 'PYTHON'],
    url: 'https://github.com/twitocode/machacks-2026',
    screenshots: ['/projects/toretto/01.png', '/projects/toretto/02.png', '/projects/toretto/03.png'],
  },
  {
    id: 'envora',
    name: 'ENVORA',
    tags: ['COMPLETED'],
    status: 'COMPLETED',
    body: 'Envora provisions isolated demo environments on demand. Describe a scenario in natural language and Envora generates realistic synthetic seed data using Claude, spins up a fresh Postgres database and Docker container, and hands you a shareable URL. Built for teams that need realistic demo environments without touching production data.',
    tech: ['NEXT.JS', 'EXPRESS', 'TYPESCRIPT', 'POSTGRESQL', 'DOCKER', 'SQLITE', 'PRISMA', 'CLAUDE API'],
    url: 'https://github.com/dereksun00/envora',
    screenshots: ['/projects/envora/01.png', '/projects/envora/02.png', '/projects/envora/03.png'],
  },
];

export const EXPERIENCES: Experience[] = [
  {
    id: 'nova',
    name: 'NOVA VACATION HOMES',
    role: 'Software Engineer Intern',
    dates: 'May 2026 – Aug 2026',
    bullets: [
      'Sole engineer on a voice AI receptionist POC, reducing front desk handling time by 70% by automating appointment scheduling and reservation management via natural language calls',
      'Integrated Vapi AI with a React + FastAPI stack and Google Calendar API, cutting booking confirmation latency to under 2 seconds end to end',
      'Implemented a RAG pipeline using pgvector and sentence-transformers to ground the voice agent in business-specific knowledge, resolving 90% of FAQ queries accurately without escalation',
    ],
    tech: ['VAPI AI', 'REACT', 'FASTAPI', 'GOOGLE CALENDAR API', 'PGVECTOR', 'SENTENCE-TRANSFORMERS', 'POSTGRESQL'],
    stats: { power: 4, speed: 5, defense: 3, special: 'Voice Stack' },
  },
  {
    id: 'maybole',
    name: 'MAYBOLE',
    role: 'Software Engineer Intern',
    dates: 'May 2026 – Aug 2026',
    bullets: [
      'Building AI agents simulating realistic consumer behavior across 1,000+ synthetic profiles generated from demographic, behavioral, and psychographic data for product and pricing evaluations',
      'Designing prompt architectures that improved agent decision-making fidelity by 40%, replicating human reasoning patterns across diverse consumer segments',
      'Developing RAG pipelines and vector database infrastructure, reducing agent hallucination rate by grounding responses in real consumer data',
    ],
    tech: ['PYTHON', 'RAG PIPELINES', 'VECTOR DATABASES', 'PROMPT ENGINEERING', 'SYNTHETIC DATA'],
    stats: { power: 5, speed: 4, defense: 2, special: 'Prompt Architect' },
  },
];

export const LOCKED_FIGHTER = { name: '?????', role: 'COMING SOON' };

export interface SkillRow {
  category: string;
  color: 'green' | 'cyan' | 'magenta' | 'amber';
  skills: string[];
}

export const SKILL_ROWS: SkillRow[] = [
  { category: 'LANGUAGES', color: 'green', skills: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'R', 'Java', 'HTML/CSS'] },
  { category: 'FRAMEWORKS', color: 'cyan', skills: ['React', 'Node.js', 'Express', 'FastAPI'] },
  { category: 'LIBRARIES', color: 'magenta', skills: ['pandas', 'NumPy', 'scikit-learn'] },
  { category: 'TOOLS', color: 'amber', skills: ['AWS', 'Docker', 'Git', 'GitHub'] },
];

export const SLOT_REVEALS: SlotReveal[] = [
  { symbol: 'in', label: 'LINKEDIN', value: 'linkedin.com/in/derek-sun', url: 'https://www.linkedin.com/in/derek-sun/' },
  { symbol: '@', label: 'EMAIL', value: 'sunderek3602@gmail.com', url: 'mailto:sunderek3602@gmail.com' },
  { symbol: 'octocat', label: 'GITHUB', value: 'github.com/dereksun00', url: 'https://github.com/dereksun00' },
];

export const CONTACT = {
  heading: 'CONTACT',
  marquee: 'DEREK SUN',
  lever: 'PULL TO SPIN',
  coinSlot: 'INSERT COIN',
  payline: 'PAYLINE',
  jackpot: 'JACKPOT',
  cta: "Let's build something.",
};

export const ABOUT = {
  title: 'DEREK SUN',
  lines: [
    'Computer Science @ University of Toronto',
    'Expected: 2029 · GPA: 3.93 · Minor: Statistics',
    '',
    'Builder and hackathon competitor. I focus on AI systems, full-stack development, and shipping things fast.',
  ],
};

export const QUEST_HUD = {
  name: 'NAME: DEREK SUN',
  klass: 'CLASS: CS + STATS',
  right: 'QUEST LOG',
  leftPanel: '► QUESTS',
  rightPanel: '► DETAILS',
  controls: ['[ W/S ] NAVIGATE', '[ ENTER ] OPEN QUEST', '[ ESC ] BACK'],
};

export const KONAMI_MESSAGE = '★ CHEAT CODE ACTIVATED ★';

export const VISUAL_LOG_HEADER = '► VISUAL LOG';
export const GITHUB_BUTTON = '[G] GITHUB';
export const ESC_BACK = '[ESC] BACK';
