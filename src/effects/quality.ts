/**
 * Adaptive quality for the black hole transition, in three tiers:
 *
 *   high   — discrete GPU / Apple Silicon / high core count: full shader
 *            (swirl, accretion disk, photon ring, chromatic aberration),
 *            bloom, 80 debris, up to 1.5x dpr.
 *   medium — decent integrated / mid hardware: shader without chromatic
 *            aberration, reduced bloom, 40 debris, 1x dpr.
 *   low    — weak integrated / low memory / low core count / software GL:
 *            NO WebGL transition at all — a fast CSS iris-wipe + flash.
 *
 * The tier is chosen pre-emptively on load from hardware signals (GPU
 * renderer string, core count, device memory, dpr) so weak machines never
 * run the heavy version even once. The first measured WebGL transition can
 * still downgrade a machine that was classified optimistically but stutters
 * below 50fps. The verdict is cached per session.
 *
 * Overrides (handy for testing on real machines): `?tier=high|medium|low`.
 */
export type BHTier = 'high' | 'medium' | 'low';

const KEY = 'derek-bh-tier';

export interface TierInfo {
  tier: BHTier;
  fps: number | null; // measured fps of the first transition, once known
  cores: number;
  memory: number | null; // GB, where exposed
  dpr: number;
  gpu: string;
  source: 'forced' | 'cached' | 'measured' | 'detected';
}

const isTier = (v: unknown): v is BHTier => v === 'high' || v === 'medium' || v === 'low';

function readCached(): BHTier | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return isTier(v) ? v : null;
  } catch {
    return null;
  }
}
function persist(t: BHTier): void {
  try {
    sessionStorage.setItem(KEY, t);
  } catch {
    /* private mode: verdict lives for this page load only */
  }
}

/** Unmasked GPU renderer string (lowercased), or '' if blocked/unavailable. */
function detectGpu(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'none';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(raw || '').toLowerCase();
  } catch {
    return '';
  }
}

const NAV = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
const cores = NAV.hardwareConcurrency || 4;
const memory = (NAV as Navigator & { deviceMemory?: number }).deviceMemory ?? null;
const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
const gpu = typeof document !== 'undefined' ? detectGpu() : '';

function classify(): BHTier {
  // software rasteriser → never attempt the shader
  if (/swiftshader|llvmpipe|basic render|software|softpipe/.test(gpu)) return 'low';
  // hard floors regardless of GPU
  if (cores <= 2) return 'low';
  if (memory !== null && memory <= 2) return 'low';
  // genuinely old/weak integrated GPUs → CSS path
  if (/hd graphics (1[0-9]{2,3}|2[0-9]{3}|3000|4000)|gma|mali-[0-4]\b|adreno \(tm\) [1-3]|videocore|powervr sgx/.test(gpu))
    return 'low';

  // discrete GPU / Apple Silicon / modern strong integrated → full quality
  const strongGpu =
    /nvidia|geforce|rtx|gtx|quadro|radeon|\bamd\b|apple m[1-9]|apple gpu|intel.*\barc\b|iris xe|\bmx[0-9]{2,3}\b|adreno \(tm\) [6-9]|mali-g[5-9][0-9]/.test(
      gpu,
    );
  if (strongGpu) return 'high';
  if (cores >= 8 && (memory === null || memory >= 8)) return 'high';

  // very high pixel load on a non-discrete GPU with few cores is a stutter risk
  if (dpr >= 3 && cores < 6) return 'low';

  // anything left is mid-range integrated
  return 'medium';
}

const forced = (() => {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('tier');
  return isTier(v) ? v : null;
})();

let tier: BHTier;
let source: TierInfo['source'];
let measuredFps: number | null = null;
let decided: boolean;

if (forced) {
  tier = forced;
  source = 'forced';
  decided = true;
} else {
  const cached = readCached();
  if (cached) {
    tier = cached;
    source = 'cached';
    decided = true;
  } else {
    tier = classify();
    source = 'detected';
    // potato has no WebGL transition to measure — lock it in now
    decided = tier === 'low';
    if (decided) persist(tier);
  }
}

const downgrade = (t: BHTier): BHTier => (t === 'high' ? 'medium' : 'low');

export const getBHTier = (): BHTier => tier;
export const bhTierDecided = (): boolean => decided;
export const getTierInfo = (): TierInfo => ({ tier, fps: measuredFps, cores, memory, dpr, gpu, source });

/** Called once after the first WebGL transition's consume phase is profiled. */
export function reportTransitionFps(avgFps: number): void {
  measuredFps = Math.round(avgFps);
  if (decided) return;
  decided = true;
  if (avgFps < 50) {
    tier = downgrade(tier);
    source = 'measured';
  }
  persist(tier);
}
