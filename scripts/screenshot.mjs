#!/usr/bin/env node
/**
 * screenshot.mjs — headless capture + diagnostics + stroke simulation.
 *
 * Drives the locally installed Brave (Chromium) via puppeteer-core (no browser
 * download). Prints a JSON report (DOM state, canvas size, buttons, iframe,
 * HUD text, console/page errors, failed requests, and CANVAS PIXEL STATS) and
 * writes a PNG screenshot. Optionally simulates pointer strokes so you can
 * verify that painting actually changes the canvas.
 *
 * Usage:
 *   node scripts/screenshot.mjs [options]
 * Options:
 *   --url <url>            page to open              (default http://127.0.0.1:5173/)
 *   --out <path>           PNG output path           (default docs/qa/app.png)
 *   --width <px>           viewport width            (default 1600)
 *   --height <px>          viewport height           (default 1000)
 *   --wait <ms>            settle time after load    (default 4000)
 *   --click <selector>     click an element (repeatable)
 *   --drag x1,y1,x2,y2     simulate a drag stroke (repeatable)
 *   --eval <js>            evaluate JS in-page (repeatable)
 *   --exec <path>          browser executable        (default $BRAVE_PATH or /usr/bin/brave-browser)
 *
 * Canvas stats (nonTransparentPixels, checksum, meanRgb) are sampled BEFORE and
 * AFTER the simulated strokes, so a change in checksum proves pixels were drawn.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const opt = {
  url: 'http://127.0.0.1:5173/',
  out: 'docs/qa/app.png',
  width: 1600,
  height: 1000,
  wait: 4000,
  clicks: [],
  drags: [],
  evals: [],
  executablePath: process.env.BRAVE_PATH || '/usr/bin/brave-browser',
};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--url') opt.url = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--width') opt.width = Number(argv[++i]);
  else if (a === '--height') opt.height = Number(argv[++i]);
  else if (a === '--wait') opt.wait = Number(argv[++i]);
  else if (a === '--click') opt.clicks.push(argv[++i]);
  else if (a === '--drag') { const [x1, y1, x2, y2] = argv[++i].split(',').map(Number); opt.drags.push([x1, y1, x2, y2]); }
  else if (a === '--eval') opt.evals.push(argv[++i]);
  else if (a === '--exec') opt.executablePath = argv[++i];
  else if (a === '-h' || a === '--help') { console.log('see header comment for usage'); process.exit(0); }
}

const events = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const canvasStatsFn = () => {
  const c = document.querySelector('canvas');
  if (!c) return null;
  const ctx = c.getContext('2d', { willReadFrequently: true }) || c.getContext('2d');
  let d;
  try { d = ctx.getImageData(0, 0, c.width, c.height).data; }
  catch (e) { return { error: String(e).slice(0, 120) }; }
  let nonTransparent = 0, opaque = 0, r = 0, g = 0, b = 0, checksum = 2166136261;
  const n = c.width * c.height;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a > 0) nonTransparent++;
    if (a === 255) opaque++;
    r += d[i]; g += d[i + 1]; b += d[i + 2];
    if ((i & 0xff) === 0) { checksum ^= d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + (a << 24); checksum = (checksum * 16777619) >>> 0; }
  }
  return {
    width: c.width, height: c.height, pixels: n,
    nonTransparentPixels: nonTransparent, opaquePixels: opaque,
    meanRgb: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
    checksum,
  };
};

mkdirSync(dirname(opt.out), { recursive: true });
const browser = await puppeteer.launch({
  executablePath: opt.executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: opt.width, height: opt.height, deviceScaleFactor: 1 });
  page.on('console', (m) => events.push({ type: m.type(), text: m.text().slice(0, 400) }));
  page.on('pageerror', (e) => events.push({ type: 'pageerror', text: String(e).slice(0, 400) }));
  page.on('requestfailed', (r) => events.push({ type: 'requestfailed', text: `${r.url().slice(0, 180)} ${r.failure()?.errorText || ''}` }));

  await page.goto(opt.url, { waitUntil: 'networkidle2', timeout: 30000 })
    .catch((e) => events.push({ type: 'goto-error', text: String(e).slice(0, 300) }));
  await sleep(opt.wait);

  for (const sel of opt.clicks) {
    try { await page.click(sel); await sleep(900); }
    catch (e) { events.push({ type: 'click-error', text: `${sel}: ${String(e).slice(0, 200)}` }); }
  }

  const evals = [];
  for (const code of opt.evals) {
    try { evals.push({ code, result: await page.evaluate(code) }); }
    catch (e) { evals.push({ code, error: String(e).slice(0, 200) }); }
  }

  const beforeStats = await page.evaluate(canvasStatsFn);

  for (const [x1, y1, x2, y2] of opt.drags) {
    try {
      await page.mouse.move(x1, y1);
      await page.mouse.down();
      const steps = 24;
      for (let s = 1; s <= steps; s++) {
        await page.mouse.move(x1 + ((x2 - x1) * s) / steps, y1 + ((y2 - y1) * s) / steps);
        await sleep(12);
      }
      await page.mouse.up();
      await sleep(400);
    } catch (e) { events.push({ type: 'drag-error', text: `${[x1, y1, x2, y2]}: ${String(e).slice(0, 160)}` }); }
  }

  const afterStats = await page.evaluate(canvasStatsFn);

  const dom = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const btnText = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40);
    return {
      title: document.title,
      canvas: canvas ? { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight } : null,
      buttons: [...document.querySelectorAll('button,[role=button]')].map(btnText).filter(Boolean).slice(0, 25),
      iframes: [...document.querySelectorAll('iframe')].map((f) => ({ src: (f.getAttribute('src') || '').slice(0, 120), w: f.clientWidth, h: f.clientHeight })),
      hud: (() => { const el = document.querySelector('[class*=hud],[class*=Hud],[id*=hud],[class*=tool],[class*=Tool]'); return el ? (el.textContent || '').trim().slice(0, 160) : null; })(),
      bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
    };
  });

  await page.screenshot({ path: opt.out, fullPage: false });
  const strokeChangedCanvas = Boolean(beforeStats && afterStats && !beforeStats.error && !afterStats.error && beforeStats.checksum !== afterStats.checksum);
  console.log(JSON.stringify({
    ok: true,
    url: opt.url,
    screenshot: opt.out,
    viewport: { width: opt.width, height: opt.height },
    drags: opt.drags,
    canvasBefore: beforeStats,
    canvasAfter: afterStats,
    strokeChangedCanvas,
    dom,
    evals,
    issues: events.filter((e) => !['log', 'debug', 'info'].includes(e.type)).slice(0, 30),
  }, null, 2));
} catch (err) {
  console.log(JSON.stringify({ ok: false, error: String(err).slice(0, 600), issues: events.slice(0, 30) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
