// Renders public/og.png (1200×630) from the brand hero in design/Main.dc.html using the real webfonts.
// Needs a local Chrome (uses Playwright's "chrome" channel). Run: npm run og

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// Inline the fonts: a page set via setContent cannot read file:// URLs.
const font = (pkg, file) => {
  const p = join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file)
  return `data:font/woff2;base64,${readFileSync(p).toString('base64')}`
}

const fonts = {
  bricolage500: font('@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-500-normal.woff2'),
  bricolage800: font('@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff2'),
  figtree400: font('@fontsource/figtree', 'figtree-latin-400-normal.woff2'),
  figtree600: font('@fontsource/figtree', 'figtree-latin-600-normal.woff2'),
}

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
@font-face{font-family:'Bricolage Grotesque';font-weight:500;src:url(${fonts.bricolage500}) format('woff2')}
@font-face{font-family:'Bricolage Grotesque';font-weight:800;src:url(${fonts.bricolage800}) format('woff2')}
@font-face{font-family:'Figtree';font-weight:400;src:url(${fonts.figtree400}) format('woff2')}
@font-face{font-family:'Figtree';font-weight:600;src:url(${fonts.figtree600}) format('woff2')}
html,body{margin:0}
.card{width:1200px;height:630px;box-sizing:border-box;background:#0F1C1E;color:#E4EFEE;font-family:'Figtree',system-ui,sans-serif;padding:64px 80px 60px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.ring{position:absolute;border-radius:50%;border:1.5px solid}
.r1{right:-220px;top:-160px;width:760px;height:760px;border-color:rgba(77,208,204,.16)}
.r2{right:-100px;top:-40px;width:560px;height:560px;border-color:rgba(77,208,204,.26)}
.r3{right:20px;top:80px;width:320px;height:320px;border-color:rgba(77,208,204,.40)}
.lock{display:flex;align-items:center;gap:26px;position:relative}
.word{font-family:'Bricolage Grotesque';font-weight:800;font-size:112px;letter-spacing:-.04em;line-height:1}
.word b{font-weight:800;color:#4DD0CC}
.text{position:relative;display:flex;flex-direction:column;gap:14px}
.tag{font-family:'Bricolage Grotesque';font-weight:500;font-size:46px;line-height:1.12;letter-spacing:-.02em;max-width:780px}
.sub{font-size:25px;color:#93A9A8}
.sub b{color:#E4EFEE;font-weight:600}
.pills{display:flex;gap:10px;margin-top:14px}
.pills span{height:40px;padding:0 16px;border-radius:999px;border:1.5px solid #24393B;background:rgba(18,32,35,.7);color:#93A9A8;font-size:18px;font-weight:600;display:flex;align-items:center}
</style></head><body>
<div class="card">
  <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
  <div class="lock">
    <svg width="112" height="112" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#12A1A6"/><circle cx="15" cy="33" r="5.5" fill="#fff"/><path d="M18.6 27.2 L35.4 10.6 L37.6 12.8 L21 29.4 Z" fill="#fff"/><circle cx="36.5" cy="11.7" r="2.2" fill="#fff"/></svg>
    <div class="word">fast<b>beam</b></div>
  </div>
  <div class="text">
    <div class="tag">Files to the next device, straight across.</div>
    <div class="sub">No app, no account, no cloud. Open <b>fastbeam.app</b> on both devices.</div>
    <div class="pills"><span>Same Wi‑Fi: automatic</span><span>Anywhere: 6‑letter code</span><span>Device to device, encrypted</span></div>
  </div>
</div>
</body></html>`

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length)
if (loaded < 4) throw new Error(`only ${loaded} fonts loaded`)
const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
await browser.close()
const out = join(root, 'public', 'og.png')
writeFileSync(out, png)
console.log('wrote public/og.png', `${Math.round(readFileSync(out).length / 1024)} kB, fonts loaded: ${loaded}`)
