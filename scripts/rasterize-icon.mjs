// Rasterize assets/icon.svg to a 1024x1024 transparent PNG using Playwright's
// bundled Chromium (the same engine that renders the logo inside the app).
// Run: node scripts/rasterize-icon.mjs
import pw from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'assets/icon.svg'), 'utf8')
// The viewBox-only SVG needs explicit pixel dimensions to rasterize at 1024².
const sized = svg.replace('<svg ', '<svg width="1024" height="1024" ')
const html = `<!doctype html><meta charset="utf8"><style>html,body{margin:0;background:transparent}</style>${sized}`

const browser = await pw.chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'networkidle' })
  const el = await page.$('svg')
  // omitBackground keeps the rounded-corner regions transparent, not white.
  await el.screenshot({ path: join(root, 'assets/icon.png'), omitBackground: true })
} finally {
  await browser.close()
}
console.log('wrote assets/icon.png (1024x1024, transparent corners)')
