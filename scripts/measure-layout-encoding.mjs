/**
 * One-off script to measure layout encoding length: base64url vs LZ compressToEncodedURIComponent.
 * Run: node scripts/measure-layout-encoding.mjs
 */

import LZString from 'lz-string'

const LZ_PREFIX = '~'

function toUrlBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromUrlBase64(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  return Buffer.from(b64, 'base64').toString('utf8')
}

const preloaded = [
  'eyJ2IjoxLCJtIjpbeyJuIjoiMTUuNlwiIExhcHRvcCBGSEQiLCJkIjoxNS42LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjU5LjA2MjcsInkiOjUwLjQxNzEsImJ6IjpbOCwxOCw1LDVdfSx7Im4iOiIyNFwiIEZIRCIsImQiOjI0LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjczLjE3MTEsInkiOjM3LjU0MTEsInJvdCI6OTAsImJ6IjpbOCw4LDgsOF19XX0',
  'eyJ2IjoxLCJtIjpbeyJuIjoiMTUuNlwiIExhcHRvcCBGSEQiLCJkIjoxNS42LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjQzLjcxMywieSI6NTAuMzc0MSwiYnoiOls4LDE4LDUsNV19LHsibiI6IjI0XCIgRkhEIiwiZCI6MjQsImFyIjpbMTYsOV0sInJ4IjoxOTIwLCJyeSI6MTA4MCwieCI6NTcuODIxNCwieSI6MzcuOTc3OSwiYnoiOls4LDgsOCw4XX0seyJuIjoiMjRcIiBGSEQiLCJkIjoyNCwiYXIiOlsxNiw5XSwicngiOjE5MjAsInJ5IjoxMDgwLCJ4Ijo3OS4zNjkxLCJ5IjozNy45Nzc5LCJieiI6WzgsOCw4LDhdfV19',
  'eyJ2IjoxLCJtIjpbeyJuIjoiMjRcIiBGSEQiLCJkIjoyNCwiYXIiOlsxNiw5XSwicngiOjE5MjAsInJ5IjoxMDgwLCJ4Ijo4NC4zOTYyLCJ5IjozNy41NDExLCJyb3QiOjkwLCJieiI6WzgsOCw4LDhdfSx7Im4iOiIyN1wiIEZIRCIsImQiOjI3LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjYwLjIzMzcsInkiOjQ1LjIyMTksImJ6IjpbOCw4LDgsOF19LHsibiI6IjI0XCIgRkhEIiwiZCI6MjQsImFyIjpbMTYsOV0sInJ4IjoxOTIwLCJyeSI6MTA4MCwieCI6NDcuODM3NSwieSI6MzcuNTQxMSwicm90Ijo5MCwiYnoiOls4LDgsOCw4XX1dfQ',
]

console.log('Layout encoding length comparison (base64url vs LZ + prefix)\n')

let totalOld = 0
let totalNew = 0

for (let i = 0; i < preloaded.length; i++) {
  const encoded = preloaded[i]
  const json = fromUrlBase64(encoded)
  const oldLen = encoded.length
  const compressed = LZString.compressToEncodedURIComponent(json)
  const newLen = compressed ? LZ_PREFIX.length + compressed.length : oldLen
  totalOld += oldLen
  totalNew += newLen
  const pct = oldLen ? Math.round((1 - newLen / oldLen) * 100) : 0
  console.log(`  Layout ${i + 1}: ${oldLen} → ${newLen} chars  (${pct}% reduction)`)
}

console.log(`\n  Total: ${totalOld} → ${totalNew} chars  (${Math.round((1 - totalNew / totalOld) * 100)}% reduction)`)
