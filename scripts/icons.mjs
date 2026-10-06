// Renders the fastbeam mark (design/Main.dc.html) into the PWA icon set under public/icons.
// Run: npm run icons

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const ACCENT = '#12A1A6'

// Full mark: square at 23% radius, dot, beam, spark.
const mark = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="${rx}" fill="${ACCENT}"/>
  <circle cx="15" cy="33" r="5.5" fill="#FFFFFF"/>
  <path d="M18.6 27.2 L35.4 10.6 L37.6 12.8 L21 29.4 Z" fill="#FFFFFF"/>
  <circle cx="36.5" cy="11.7" r="2.2" fill="#FFFFFF"/>
</svg>`

// Maskable: full-bleed background, glyph kept inside the 80% safe zone, no spark.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${ACCENT}"/>
  <circle cx="17" cy="31" r="4.4" fill="#FFFFFF"/>
  <path d="M19.9 26.4 L31.5 14.9 L33.3 16.7 L21.7 28.2 Z" fill="#FFFFFF"/>
</svg>`

// Favicon: heavier dot and beam, spark dropped (it disappears below 32 px anyway).
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="${ACCENT}"/>
  <circle cx="15" cy="33" r="6.5" fill="#FFFFFF"/>
  <path d="M18 27 L36 9.5 L39 12.5 L21 30 Z" fill="#FFFFFF"/>
</svg>`

const png = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng()

await mkdir(out, { recursive: true })

const files = [
  ['icon-192.png', png(mark(11), 192)],
  ['icon-512.png', png(mark(11), 512)],
  ['maskable-512.png', png(maskable, 512)],
  // iOS applies its own corner mask, so the touch icon is full-bleed.
  ['apple-touch-icon-180.png', png(mark(0), 180)],
  ['favicon-32.png', png(favicon, 32)],
  ['favicon.svg', favicon],
]

for (const [name, data] of files) {
  await writeFile(join(out, name), data)
  console.log('wrote', join('public/icons', name))
}
