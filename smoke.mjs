// Full-flow smoke, synchronized on store state instead of fixed waits.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

mkdirSync('smoke-shots', { recursive: true });
const errors = [];
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

/** Wait until the app settles on `screen` with no transition running. */
const settled = (screen) =>
  page.waitForFunction(
    (s) => {
      const st = window.__derekos?.getState();
      return st && st.phase === 'idle' && st.screen === s;
    },
    screen,
    { timeout: 120000 },
  );
const overlayIs = (id) =>
  page.waitForFunction((v) => window.__derekos?.getState().overlayId === v, id, { timeout: 15000 });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await settled('boot');
await page.waitForTimeout(4200); // let the checklist type out
await page.keyboard.press('Enter');
await settled('title');
await page.waitForTimeout(2500); // cabinet idle
await page.screenshot({ path: 'smoke-shots/20-title.png' });

await page.keyboard.press('Enter'); // dolly → black hole → save
await settled('save');
await page.waitForTimeout(800);
await page.screenshot({ path: 'smoke-shots/21-save.png' });

await page.keyboard.press('Enter');
await settled('select');
await page.waitForTimeout(800);
await page.screenshot({ path: 'smoke-shots/22-select.png' });

await page.keyboard.press('Enter'); // MARIO → quest world
await settled('quest');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'smoke-shots/23-quest.png' });

await page.keyboard.press('Enter'); // open selected quest
await overlayIs('tcare');
await page.waitForTimeout(2200); // typewriter + pills
await page.screenshot({ path: 'smoke-shots/24-overlay.png' });
await page.keyboard.press('Escape');
await overlayIs(null);
await page.waitForTimeout(400);
await page.keyboard.press('Escape'); // quest → select
await settled('select');

await page.click('text=[ CONTACT ]');
await settled('contact');
await page.waitForTimeout(600);
await page.screenshot({ path: 'smoke-shots/25-contact.png' });
for (const wait of [1400, 1700, 2100]) {
  await page.keyboard.press('Enter'); // lever pulls
  await page.waitForTimeout(wait);
}
await page.screenshot({ path: 'smoke-shots/26-jackpot.png' });

await page.keyboard.press('Escape');
await settled('select');
await page.click('text=STREET FIGHTER', { force: true }); // cabinets idle-bob forever
await settled('fighter');
await page.waitForTimeout(700);
await page.screenshot({ path: 'smoke-shots/27-fighter.png' });
await page.click('text=NOVA VACATION HOMES');
await page.waitForTimeout(800); // VS splash mid-flight
await page.screenshot({ path: 'smoke-shots/28-vs.png' });
await overlayIs('nova');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'smoke-shots/29-exp-overlay.png' });
await page.keyboard.press('Escape');
await overlayIs(null);
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await settled('select');
await page.click('text=SPACE INVADERS', { force: true });
await settled('invaders');
await page.waitForTimeout(900);
await page.screenshot({ path: 'smoke-shots/30-invaders.png' });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
