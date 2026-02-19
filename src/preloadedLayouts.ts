/**
 * Preloaded layout presets. Users can generate a layout in the app, use "Share Layout"
 * to copy the URL, then provide the encoded part (the value of the `layout` hash param)
 * to add here. Each entry is { name, encoded }; encoded is the base64url string from
 * the share URL (e.g. from #layout=ENCODED). Leave encoded empty to hide that slot.
 */
import { decodeLayout, type LayoutEntry } from './urlLayout'

export interface PreloadedLayout {
  name: string
  /** Base64url-encoded layout from share URL (#layout=...). Empty = slot unused. */
  encoded: string
}

/** All preloaded layouts are centered at canvas center (see CANVAS_CENTER_*_IN in canvasConstants.ts). */
export const PRELOADED_LAYOUTS: PreloadedLayout[] = [
  { name: '15.6" Laptop + Vertical 24" Monitor', encoded: 'eyJ2IjoxLCJtIjpbeyJuIjoiMTUuNlwiIExhcHRvcCBGSEQiLCJkIjoxNS42LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjU5LjA2MjcsInkiOjUwLjQxNzEsImJ6IjpbOCwxOCw1LDVdfSx7Im4iOiIyNFwiIEZIRCIsImQiOjI0LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjczLjE3MTEsInkiOjM3LjU0MTEsInJvdCI6OTAsImJ6IjpbOCw4LDgsOF19XX0' },
  { name: '15.6" Laptop + 2 24" Monitors', encoded: 'eyJ2IjoxLCJtIjpbeyJuIjoiMTUuNlwiIExhcHRvcCBGSEQiLCJkIjoxNS42LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjQzLjcxMywieSI6NTAuMzc0MSwiYnoiOls4LDE4LDUsNV19LHsibiI6IjI0XCIgRkhEIiwiZCI6MjQsImFyIjpbMTYsOV0sInJ4IjoxOTIwLCJyeSI6MTA4MCwieCI6NTcuODIxNCwieSI6MzcuOTc3OSwiYnoiOls4LDgsOCw4XX0seyJuIjoiMjRcIiBGSEQiLCJkIjoyNCwiYXIiOlsxNiw5XSwicngiOjE5MjAsInJ5IjoxMDgwLCJ4Ijo3OS4zNjkxLCJ5IjozNy45Nzc5LCJieiI6WzgsOCw4LDhdfV19' },
  { name: '27" + 2 24" Vertical Monitors', encoded: 'eyJ2IjoxLCJtIjpbeyJuIjoiMjRcIiBGSEQiLCJkIjoyNCwiYXIiOlsxNiw5XSwicngiOjE5MjAsInJ5IjoxMDgwLCJ4Ijo4NC4zOTYyLCJ5IjozNy41NDExLCJyb3QiOjkwLCJieiI6WzgsOCw4LDhdfSx7Im4iOiIyN1wiIEZIRCIsImQiOjI3LCJhciI6WzE2LDldLCJyeCI6MTkyMCwicnkiOjEwODAsIngiOjYwLjIzMzcsInkiOjQ1LjIyMTksImJ6IjpbOCw4LDgsOF19LHsibiI6IjI0XCIgRkhEIiwiZCI6MjQsImFyIjpbMTYsOV0sInJ4IjoxOTIwLCJyeSI6MTA4MCwieCI6NDcuODM3NSwieSI6MzcuNTQxMSwicm90Ijo5MCwiYnoiOls4LDgsOCw4XX1dfQ' },
]

/**
 * Decode a preloaded layout. Returns null if encoded is empty or invalid.
 */
export function decodePreloadedLayout(entry: PreloadedLayout): LayoutEntry[] | null {
  if (!entry.encoded.trim()) return null
  return decodeLayout(entry.encoded)
}
