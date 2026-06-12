/**
 * All site copy. This file is the single source of truth for content —
 * screens render from here.
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
  subtitle: string;
  role: string;
  dates: string;
  body: string;
  bullets: string[];
  tech: string[];
  stats: { power: number; speed: number; defense: number; special: string };
}

export interface SlotReveal {
  symbol: 'in' | '@' | 'code';
  label: string;
  value: string;
  url: string;
}

export const TITLE = {
  heading: 'DEREK SUN',
  subtitle: 'COMPUTER SCIENCE @ UNIVERSITY OF TORONTO',
  prompt: '[ PRESS ENTER TO PLAY ]',
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
    status: 'UOFT × AWS HACKATHON — 1ST PLACE',
    body: 'T-Care is a campus support navigator built for UofT students — winner of Best Project for Improving Access to Campus Support Services among 30+ teams at the UofT × AWS Hackathon. Describe a need in plain language, losing a TCard, needing exam accommodations, looking for counselling, and T-Care routes you to the exact campus office or resource. Amazon Bedrock resolves natural-language queries into specific campus destinations with addresses, or plain-language answers with support links.',
    tech: ['TYPESCRIPT', 'REACT', 'NODE.JS', 'AMAZON BEDROCK', 'AMAZON KENDRA', 'GOOGLE MAPS API', 'VITE'],
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
    body: 'Envora provisions isolated sandbox environments for QA and sales demos with deterministic data generation. Describe a scenario in natural language and Envora generates realistic synthetic seed data using the Anthropic API, spins up a fresh Postgres database and Docker container, and hands you a shareable URL. Built for teams that need realistic demo environments without touching production data.',
    tech: ['TYPESCRIPT', 'NODE.JS', 'REACT', 'SQL', 'DOCKER', 'ANTHROPIC API', 'POSTGRESQL', 'PRISMA'],
    url: 'https://github.com/dereksun00/envora',
    screenshots: ['/projects/envora/01.png', '/projects/envora/02.png', '/projects/envora/03.png'],
  },
];

export const EXPERIENCES: Experience[] = [
  {
    id: 'nova',
    name: 'NOVA VACATION HOMES',
    subtitle: 'AI Voice Receptionist',
    role: 'Software Engineer Intern',
    dates: 'May 2026 – Aug 2026',
    body: 'Shipped a production-grade multi-tenant AI voice receptionist with real paying users — live inbound calls, automatic multilingual detection, appointment booking, calendar integration, and a real-time ops dashboard.',
    bullets: [
      'Shipped a production-grade multi-tenant AI voice receptionist with real paying users — live inbound calls, automatic multilingual detection, appointment booking, calendar integration, and a real-time ops dashboard',
      'Built an autonomous post-call learning loop — knowledge gaps extracted from transcripts, owner-approval flow, then re-injected into the live RAG pipeline as searchable embeddings',
    ],
    tech: ['TWILIO', 'PGVECTOR', 'RAG', 'HNSW', '768-DIM EMBEDDINGS', 'NODE.JS', 'REAL-TIME WEBSOCKETS'],
    stats: { power: 4, speed: 5, defense: 3, special: 'AI Voice Receptionist' },
  },
  {
    id: 'maybole',
    name: 'MAYBOLE',
    subtitle: 'Cold Outreach AI',
    role: 'Software Engineer Intern',
    dates: 'May 2026 – Aug 2026 · NY (Remote)',
    body: 'Engineered a full-stack cold-outreach SaaS platform with AI-powered email personalization, real-time contact matching, and a curated database of 21,000+ investment banking contacts across bulge brackets and elite boutiques.',
    bullets: [
      'Engineered a full-stack cold-outreach SaaS platform with AI-powered email personalization, real-time contact matching, and a curated database of 21,000+ investment banking contacts across bulge brackets and elite boutiques',
      'Patched auth bypass vulnerabilities, eliminating PII exposure across 15+ user-facing API routes; built subscription-gated credit enforcement across concurrent workflows',
    ],
    tech: ['TYPESCRIPT', 'REACT', 'NODE.JS', 'AI EMAIL GENERATION', 'STRIPE'],
    stats: { power: 5, speed: 4, defense: 2, special: 'Cold Outreach AI' },
  },
];

export const LOCKED_FIGHTER = { name: '???', role: 'SECRET CHARACTER' };

export interface SkillRow {
  category: string;
  color: 'amber' | 'cyan' | 'magenta';
  skills: string[];
}

export const SKILL_ROWS: SkillRow[] = [
  { category: 'LANGUAGES', color: 'amber', skills: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'R', 'Java', 'HTML/CSS'] },
  { category: 'FRAMEWORKS', color: 'cyan', skills: ['React', 'Node.js', 'Express', 'FastAPI'] },
  { category: 'LIBRARIES', color: 'magenta', skills: ['pandas', 'NumPy', 'scikit-learn'] },
  { category: 'TOOLS', color: 'cyan', skills: ['AWS', 'Docker', 'Git', 'GitHub'] },
];

/** One-line context shown when an invader is shot down. */
export const SKILL_INFO: Record<string, string> = {
  Python: 'Toretto fall-detection ML, data pipelines, FastAPI services',
  TypeScript: 'T-Care, Envora, Maybole — full-stack apps end to end',
  JavaScript: 'Browser games, canvas rendering, this whole site',
  SQL: 'Postgres schemas for Envora sandboxes + Nova RAG store',
  R: 'Statistical modeling — UofT statistics minor coursework',
  Java: 'Data structures, OOP foundations, coursework projects',
  'HTML/CSS': 'Pixel-art UIs, CRT effects, responsive layouts',
  React: 'Every frontend I ship — T-Care, Envora, Nova dashboard',
  'Node.js': 'Nova voice backend, Maybole SaaS APIs, Express servers',
  Express: 'REST APIs for T-Care and Envora provisioning',
  FastAPI: 'Toretto real-time fall classification endpoint',
  pandas: 'Sensor data wrangling for fall-detection training',
  NumPy: 'Feature extraction — magnitude, jerk, orientation',
  'scikit-learn': 'Random Forest classifier behind Toretto alerts',
  AWS: 'Bedrock + Kendra at the UofT × AWS hackathon (1st place)',
  Docker: 'Envora container-per-sandbox provisioning',
  Git: 'Daily driver — feature branches, clean history',
  GitHub: 'github.com/dereksun00 — actions, reviews, releases',
};

export const INVADERS_COPY = {
  title: 'SPACE INVADERS',
  subtitle: 'SHOOT A SKILL TO SCAN IT',
  controls: ['[ ←→ ] MOVE', '[ SPACE ] FIRE', '[ ESC ] BACK'],
  win: 'SKILLS LOADED',
  winSub: 'ALL SYSTEMS OPERATIONAL',
  again: '[ R ] REDEPLOY FLEET',
};

export const SLOT_REVEALS: SlotReveal[] = [
  { symbol: 'in', label: 'LINKEDIN', value: 'linkedin.com/in/derek-sun', url: 'https://www.linkedin.com/in/derek-sun/' },
  { symbol: '@', label: 'EMAIL', value: 'sunderek3602@gmail.com', url: 'mailto:sunderek3602@gmail.com' },
  { symbol: 'code', label: 'GITHUB', value: 'github.com/dereksun00', url: 'https://github.com/dereksun00' },
];

export const CONTACT = {
  heading: 'CONTACT',
  marquee: 'DEREK SUN',
  lever: 'PULL TO SPIN',
  coinSlot: 'INSERT COIN',
  jackpot: 'JACKPOT',
  cta: "Let's build something.",
};

export const ABOUT = {
  title: 'DEREK SUN',
  class: 'LV. 19 — FULL-STACK BUILDER',
  stats: [
    { label: 'CLASS', value: 'CS + STATS' },
    { label: 'GUILD', value: 'UNIVERSITY OF TORONTO' },
    { label: 'GPA', value: '3.93' },
    { label: 'MINOR', value: 'STATISTICS' },
    { label: 'EXPECTED', value: '2029' },
    { label: 'QUESTS', value: '3 COMPLETE' },
  ],
  caption: 'FULL-STACK ENGINEER',
  backstory:
    'Software engineer building AI systems and full-stack products that run in production. Away from the keyboard I powerlift — current total: 1,145 lb (SBD).',
  equipment: [
    { name: 'CLAUDE', kind: 'PRIMARY WEAPON', icon: 'orb' },
    { name: 'LEETCODE', kind: 'SECONDARY WEAPON', icon: 'sword' },
    { name: 'GIT', kind: 'TIME MAGIC', icon: 'hourglass' },
    { name: 'BARBELL', kind: 'STRENGTH GEAR', icon: 'barbell' },
    { name: 'KNIGHT', kind: 'TACTICS', icon: 'knight' },
    { name: 'BASKETBALL', kind: 'SIDE QUEST', icon: 'basketball' },
  ],
  achievements: [
    { name: 'T-CARE — 1ST PLACE', detail: 'UofT × AWS Hackathon · Best Project for Improving Access to Campus Support Services · 30+ teams' },
    { name: 'TWO INTERNSHIPS, ONE SUMMER', detail: 'Nova Vacation Homes + Maybole · May–Aug 2026' },
    { name: 'SHIPPED TO PAYING USERS', detail: 'Multi-tenant AI voice receptionist live in production' },
  ],
  panels: { stats: '► STATS', backstory: '► BACKSTORY', equipment: '► EQUIPMENT', achievements: '► ACHIEVEMENTS' },
};

export const QUEST_HUD = {
  name: 'NAME: DEREK SUN',
  klass: 'CLASS: CS + STATS',
  right: 'QUEST LOG',
  leftPanel: '► QUESTS',
  rightPanel: '► DETAILS',
  controls: ['[ ←→ ] MOVE', '[ SPACE/↑ ] JUMP', '[ ENTER ] OPEN QUEST', '[ ESC ] BACK'],
};

export const KONAMI_MESSAGE = '★ CHEAT CODE ACTIVATED ★';

export const VISUAL_LOG_HEADER = '► VISUAL LOG';
export const GITHUB_BUTTON = '[G] GITHUB';
export const ESC_BACK = '[ESC] BACK';
