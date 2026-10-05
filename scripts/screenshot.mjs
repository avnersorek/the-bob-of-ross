#!/usr/bin/env node
/**
 * screenshot.mjs — headless capture + diagnostics for the Bob of Ross app.
 *
 * Drives the locally installed Brave (Chromium) via puppeteer-core, so no
 * browser download is needed. Prints a JSON report (DOM state, canvas size,
 * control buttons, HUD text, console/page errors, failed requests) AND writes
 * a PNG screenshot. Use it to iterate: capture -> inspect -> change code ->
 * capture again.
 *
 * Usage:
 *   node scripts/screenshot.mjs [options]
 * Options:
 *   --url <url>          page to open            (default http://127.0.0.1:5173/)
 *   --out <path>         PNG output path         (default docs/qa/app.png)
 *   --width <px>         viewport width          (default 1600)
 *   --height <px>        viewport height         (default 1000)
 *   --wait <ms>          settle time after load  (default 4000)
 *   --click <selector>   click an element, then wait (repeatable)
 *   --eval <js>          evaluate JS in-page and include the result (repeatable)
 *   --exec <path>        browser executable      (default $BRAVE_PATH or /usr/bin/brave-browser)
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
  else if (a === '--eval') opt.evals.push(argv[++i]);
  else if (a === '--exec') opt.executablePath = argv[++i];
  else if (a === '-h' || a === '--help') { console.log('see header comment for usage'); process.exit(0); }
}

const events = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const dom = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const btnText = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40);
    return {
      title: document.title,
      canvas: canvas ? { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight } : null,
      buttons: [...document.querySelectorAll('button,[role=button]')].map(btnText).filter(Boolean).slice(0, 25),
      inputs: [...document.querySelectorAll('input,select')].length,
      iframes: [...document.querySelectorAll('iframe')].map((f) => ({ src: (f.getAttribute('src') || '').slice(0, 120), w: f.clientWidth, h: f.clientHeight })),
      hud: (() => { const el = document.querySelector('[class*=hud],[class*=Hud],[id*=hud],[class*=tool],[class*=Tool]'); return el ? (el.textContent || '').trim().slice(0, 160) : null; })(),
      bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
      bg: getComputedStyle(document.body).backgroundColor,
    };
  });

  await page.screenshot({ path: opt.out, fullPage: false });
  const report = {
    ok: true,
    url: opt.url,
    screenshot: opt.out,
    viewport: { width: opt.width, height: opt.height },
    dom,
    evals,
    issues: events.filter((e) => !['log', 'debug', 'info'].includes(e.type)).slice(0, 30),
    consoleLogs: events.filter((e) => ['log', 'debug', 'info'].includes(e.type)).slice(0, 20),
  };
  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  console.log(JSON.stringify({ ok: false, error: String(err).slice(0, 600), issues: events.slice(0, 30) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
