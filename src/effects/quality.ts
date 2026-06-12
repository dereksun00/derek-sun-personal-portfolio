/**
 * Adaptive quality for the black hole transition. TransitionManager
 * profiles the first full-quality transition by sampling rAF during the
 * consume phase; if it can't hold ~45fps the verdict drops to 'low' for
 * every later transition: 1x dpr, no bloom pass, half the debris, no
 * chromatic aberration (the swirl, accretion disk and collapse beats all
 * stay). Cached per session so we never re-measure.
 */
export type BHQuality = 'high' | 'low';

const KEY = 'derek-bh-quality';

function readCached(): BHQuality | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === 'low' || v === 'high' ? v : null;
  } catch {
    return null;
  }
}

let quality: BHQuality = readCached() ?? 'high';
let decided = readCached() !== null;

export const getBHQuality = (): BHQuality => quality;
export const bhQualityDecided = (): boolean => decided;

export function reportTransitionFps(avgFps: number): void {
  if (decided) return;
  decided = true;
  quality = avgFps < 45 ? 'low' : 'high';
  try {
    sessionStorage.setItem(KEY, quality);
  } catch {
    /* private mode: verdict lives for this page load only */
  }
}
