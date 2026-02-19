/**
 * One-off dev script: decode preloaded layout strings, center each at canvas center, re-encode.
 *
 * Why a standalone .mjs script instead of .ts/.tsx?
 * - This is a CLI tool you run when adding/updating preloaded layouts, not part of the app.
 * - The app is a browser bundle (Vite/React); this runs in Node. Plain .mjs runs with
 *   `node scripts/center-preloaded-layouts.mjs` with no build or ts-node.
 * - Logic is inlined (decode, encode, PPI) so the script has no project imports.
 *
 * Target center must match src/canvasConstants.ts: CANVAS_CENTER_X_IN, CANVAS_CENTER_Y_IN.
 * Run: node scripts/center-preloaded-layouts.mjs
 * Then paste the printed encoded strings into src/preloadedLayouts.ts
 */
const TARGET_CENTER_X = 72  // must match CANVAS_CENTER_X_IN in src/canvasConstants.ts
const TARGET_CENTER_Y = 48  // must match CANVAS_CENTER_Y_IN in src/canvasConstants.ts

function toUrlBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function fromUrlBase64(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  return Buffer.from(b64, 'base64').toString('utf8')
}

function calculatePPI(resX, resY, diagonal) {
  return Math.sqrt(resX * resX + resY * resY) / diagonal
}
function physicalDimensions(resX, resY, ppi) {
  return { width: resX / ppi, height: resY / ppi }
}

const ENCODED = [
  'eyJ2IjoxLCJtIjpbeyJuIjoiMTUuNlwiIExhcHRvcCBGSEQiLCJkIjoxNS42LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjQ0LjA5OTcsInkiOjMxLjQzODYsImJ6IjpbOCwxOCw1LDVdfSx7Im4iOiIyNFwiIEZIRCIsImQiOjI0LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjU4LjIwODEsInkiOjE4LjU2MjYsInJvdCI6OTAsImJ6IjpbOCw4LDgsOF19XX0',
  'eyJ2IjoxLCJtIjpbeyJuIjoiMTUuNlwiIExhcHRvcCBGSEQiLCJkIjoxNS42LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjQ0LjA5OTcsInkiOjQwLjExMDMsImJ6IjpbOCwxOCw1LDVdfSx7Im4iOiIyNFwiIEZIRCIsImQiOjI0LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjU4LjIwODEsInkiOjI3LjcxNDEsImJ6IjpbOCw4LDgsOF19LHsibiI6IjI0XCIgRkhEIiwiZCI6MjQsImFyIjpbMTYsOV0sInJ4IjoxOTIwLCJyeSI6MTA4MCwieCI6NzkuNzU1OCwieSI6MjcuNzE0MSwiYnoiOls4LDgsOCw4XX1dfQ',
  'eyJ2IjoxLCJtIjpbeyJuIjoiMjRcIiBGSEQiLCJkIjoyNCwiYXIiOlsxNiw5XSwicngiOjE5MjAsInJ5IjoxMDgwLCJ4Ijo3MS4zMTY4LCJ5IjoxMi4wNTkyLCJyb3QiOjkwLCJieiI6WzgsOCw4LDhdfSx7Im4iOiIyN1wiIEZIRCIsImQiOjI3LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjQ3LjE1NDMsInkiOjE5Ljc0LCJieiI6WzgsOCw4LDhdfSx7Im4iOiIyNFwiIEZIRCIsImQiOjI0LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjM0Ljc1ODEsInkiOjEyLjA1OTIsInJvdCI6OTAsImJ6IjpbOCw4LDgsOF19XX0',
]

function decode(encoded) {
  const json = fromUrlBase64(encoded)
  const layout = JSON.parse(json)
  if (!layout || layout.v !== 1 || !Array.isArray(layout.m)) return null
  return layout.m
}

function encode(monitors) {
  const m = monitors.map(mon => {
    const entry = {
      n: mon.n,
      d: mon.d,
      ar: mon.ar,
      rx: mon.rx,
      ry: mon.ry,
      x: Math.round(mon.x * 10000) / 10000,
      y: Math.round(mon.y * 10000) / 10000,
    }
    if (mon.rot === 90) entry.rot = 90
    if (mon.dn) entry.dn = mon.dn
    if (mon.bz && (mon.bz[0] || mon.bz[1] || mon.bz[2] || mon.bz[3])) entry.bz = mon.bz
    return entry
  })
  return toUrlBase64(JSON.stringify({ v: 1, m }))
}

function centerLayout(monitors) {
  if (monitors.length === 0) return monitors
  const withDims = monitors.map(mon => {
    const ppi = calculatePPI(mon.rx, mon.ry, mon.d)
    let { width, height } = physicalDimensions(mon.rx, mon.ry, ppi)
    if (mon.rot === 90) [width, height] = [height, width]
    return { ...mon, width, height }
  })
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const m of withDims) {
    minX = Math.min(minX, m.x)
    minY = Math.min(minY, m.y)
    maxX = Math.max(maxX, m.x + m.width)
    maxY = Math.max(maxY, m.y + m.height)
  }
  const layoutCenterX = (minX + maxX) / 2
  const layoutCenterY = (minY + maxY) / 2
  const shiftX = TARGET_CENTER_X - layoutCenterX
  const shiftY = TARGET_CENTER_Y - layoutCenterY
  return withDims.map(({ width, height, ...rest }) => ({
    ...rest,
    x: rest.x + shiftX,
    y: rest.y + shiftY,
  }))
}

const names = [
  '15.6" Laptop + Vertical 24" Monitor',
  '15.6" Laptop + 2 24" Monitors',
  '27" + 2 24" Vertical Monitors',
]

console.log(`// Centered at canvas center (${TARGET_CENTER_X}, ${TARGET_CENTER_Y}) in. Paste into PRELOADED_LAYOUTS in src/preloadedLayouts.ts:\n`)
for (let i = 0; i < ENCODED.length; i++) {
  const raw = decode(ENCODED[i])
  if (!raw) {
    console.log(`// ${names[i]}: decode failed\n`)
    continue
  }
  const centered = centerLayout(raw)
  const encoded = encode(centered)
  console.log(`  { name: '${names[i]}', encoded: '${encoded}' },`)
}
console.log('')
