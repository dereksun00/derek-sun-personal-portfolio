import html2canvas from 'html2canvas';
import * as THREE from 'three';

/**
 * Rasterize the active screen (#screen-root) into a Three.js texture.
 * Persistent chrome (star field, CRT overlay, cursor) lives outside
 * #screen-root and is excluded via .no-capture.
 *
 * WebGL canvases need special handling: html2canvas calls
 * getContext('2d') on every canvas it parses, and a canvas can only ever
 * hold ONE context type — that call permanently poisons a WebGL canvas
 * (or, if it wins the race against three.js, prevents the WebGL context
 * from ever being created and crashes the <Canvas> render). So every R3F
 * canvas lives under a [data-webgl] wrapper: we overlay a throwaway 2D
 * copy (drawImage works because they render with preserveDrawingBuffer),
 * let html2canvas capture the copy, and ignore the original entirely.
 */
/**
 * One-time html2canvas warm-up against a tiny offscreen div. The first
 * html2canvas call pays module init / font parsing costs; doing it at
 * idle keeps that hitch out of the first real transition.
 *
 * CRITICAL: html2canvas always clones the ENTIRE document (not just the
 * target element), and its createCanvasClone calls getContext('2d') on
 * every ORIGINAL canvas it visits. A canvas that has no context yet
 * (e.g. the persistent black-hole canvas before R3F's ResizeObserver
 * fires) gets permanently locked to 2D by that call, and three.js then
 * dies with "Canvas has an existing context of a different type". The
 * ignoreElements predicate below prunes everything except the warm-up
 * div and its ancestors, so the clone can never reach a canvas.
 */
let warmed = false;
export function warmUpSnapshot(): void {
  if (warmed) return;
  warmed = true;
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:0;width:32px;height:32px;background:#000;color:#fff;';
  div.textContent = 'A';
  document.body.appendChild(div);
  html2canvas(div, {
    logging: false,
    ignoreElements: (e) => !e.contains(div) && !div.contains(e),
  })
    .catch(() => {})
    .finally(() => div.remove());
}

// maxScale 1 (not dpr): the snapshot is about to be swirled into a black
// hole, so capture latency hurts more than texture sharpness ever could.
export async function snapshotScreen(maxScale = 1): Promise<THREE.CanvasTexture> {
  const el = document.getElementById('screen-root');
  if (!el) throw new Error('#screen-root not mounted');

  const proxies: HTMLCanvasElement[] = [];
  for (const src of Array.from(el.querySelectorAll<HTMLCanvasElement>('[data-webgl] canvas'))) {
    if (src.classList.contains('webgl-proxy')) continue;
    const proxy = document.createElement('canvas');
    proxy.className = 'webgl-proxy';
    proxy.width = src.width || 1;
    proxy.height = src.height || 1;
    try {
      proxy.getContext('2d')?.drawImage(src, 0, 0);
    } catch {
      /* canvas not initialized yet — proxy stays blank, capture proceeds */
    }
    Object.assign(proxy.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    src.parentElement?.appendChild(proxy);
    proxies.push(proxy);
  }

  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#050310',
      scale: Math.min(window.devicePixelRatio || 1, maxScale),
      logging: false,
      ignoreElements: (e) =>
        e.classList?.contains('no-capture') ||
        // any canvas outside the capture root is invisible to the result
        // anyway — never let the cloner near it (see warmUpSnapshot note)
        (e.tagName === 'CANVAS' && !el.contains(e)) ||
        (e.tagName === 'CANVAS' && !e.classList.contains('webgl-proxy') && e.closest('[data-webgl]') !== null),
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  } finally {
    proxies.forEach((p) => p.remove());
  }
}
