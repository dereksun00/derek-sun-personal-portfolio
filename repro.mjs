// Repro on REAL GPU: boot → Enter → watch state/console, screenshot the aftermath.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

mkdirSync('smoke-shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new'], // new headless uses the real GPU (AMD 780M here)
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  const t = m.text();
  if (!t.includes('AudioContext') && !t.includes('[vite]') && !t.includes('DevTools')) {
    console.log(`[${m.type()}]`, t.slice(0, 200));
  }
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
console.log('pressing Enter on boot');
await page.keyboard.press('Enter');
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => {
    const s = window.__derekos.getState();
    const canvases = [...document.querySelectorAll('canvas')].map((c) => {
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return { w: c.width, h: c.height, lost: gl ? gl.isContextLost() : null };
    });
    return { screen: s.screen, phase: s.phase, canvases };
  });
  console.log(`${i + 1}s`, JSON.stringify(st));
}
await page.screenshot({ path: 'smoke-shots/repro-after.png' });
await browser.close();
