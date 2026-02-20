import LZString from 'lz-string'
import type { SavedConfig, SavedImagePosition } from './types'

/**
 * Prefix for LZ-compressed layout payloads; legacy base64url never starts with this.
 * LZ (compressToEncodedURIComponent) typically reduces encoded length by ~26–37% vs base64url.
 */
const LAYOUT_ENCODING_LZ_PREFIX = '~'

// Compact URL representation of a monitor
type UrlMonitor = {
  n: string               // preset.name
  d: number               // preset.diagonal
  ar: [number, number]    // preset.aspectRatio
  rx: number              // preset.resolutionX
  ry: number              // preset.resolutionY
  x: number               // physicalX
  y: number               // physicalY
  rot?: 90                // rotation (only when portrait)
  dn?: string             // displayName (only when set)
  bz?: [number, number, number, number]  // bezels [top, bottom, left, right] mm
}

// Compact URL representation of image position (physical inches + aspect ratio)
type UrlImagePosition = {
  x: number
  y: number
  w: number
  h: number
  ar: number  // aspect ratio (width/height)
}

type UrlLayout = {
  v: 1
  m: UrlMonitor[]
  img?: UrlImagePosition   // optional; when present, next uploaded image uses this position
}

const HASH_KEY = 'layout'

function toUrlBase64(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromUrlBase64(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  return atob(b64)
}

export type LayoutEntry = SavedConfig['monitors'][number]

export interface DecodedLayout {
  monitors: LayoutEntry[]
  imagePosition: SavedImagePosition | null
}

export function encodeLayout(monitors: LayoutEntry[], imagePosition?: SavedImagePosition | null): string {
  const m: UrlMonitor[] = monitors.map(mon => {
    const entry: UrlMonitor = {
      n: mon.preset.name,
      d: mon.preset.diagonal,
      ar: mon.preset.aspectRatio,
      rx: mon.preset.resolutionX,
      ry: mon.preset.resolutionY,
      x: Math.round(mon.physicalX * 10000) / 10000,
      y: Math.round(mon.physicalY * 10000) / 10000,
    }
    if (mon.rotation === 90) entry.rot = 90
    if (mon.displayName) entry.dn = mon.displayName
    if (mon.bezels) {
      const { top, bottom, left, right } = mon.bezels
      if (top || bottom || left || right) {
        entry.bz = [top, bottom, left, right]
      }
    }
    return entry
  })

  const layout: UrlLayout = { v: 1, m }
  if (imagePosition && Number.isFinite(imagePosition.x) && Number.isFinite(imagePosition.y)) {
    layout.img = {
      x: Math.round(imagePosition.x * 10000) / 10000,
      y: Math.round(imagePosition.y * 10000) / 10000,
      w: Math.round(imagePosition.width * 10000) / 10000,
      h: Math.round(imagePosition.height * 10000) / 10000,
      ar: imagePosition.aspectRatio,
    }
  }
  const json = JSON.stringify(layout)
  const compressed = LZString.compressToEncodedURIComponent(json)
  return compressed ? LAYOUT_ENCODING_LZ_PREFIX + compressed : toUrlBase64(json)
}

export function decodeLayout(encoded: string): DecodedLayout | null {
  try {
    const json =
      encoded.startsWith(LAYOUT_ENCODING_LZ_PREFIX)
        ? LZString.decompressFromEncodedURIComponent(encoded.slice(LAYOUT_ENCODING_LZ_PREFIX.length))
        : fromUrlBase64(encoded)
    if (json == null) return null
    const layout = JSON.parse(json) as UrlLayout
    if (!layout || layout.v !== 1 || !Array.isArray(layout.m)) return null

    const monitors: LayoutEntry[] = layout.m.map(mon => ({
      preset: {
        name: mon.n,
        diagonal: mon.d,
        aspectRatio: mon.ar,
        resolutionX: mon.rx,
        resolutionY: mon.ry,
      },
      physicalX: mon.x,
      physicalY: mon.y,
      rotation: mon.rot,
      displayName: mon.dn,
      bezels: mon.bz
        ? { top: mon.bz[0], bottom: mon.bz[1], left: mon.bz[2], right: mon.bz[3] }
        : undefined,
    }))

    let imagePosition: SavedImagePosition | null = null
    if (layout.img && Number.isFinite(layout.img.x) && Number.isFinite(layout.img.y) && Number.isFinite(layout.img.ar)) {
      imagePosition = {
        x: layout.img.x,
        y: layout.img.y,
        width: layout.img.w,
        height: layout.img.h,
        aspectRatio: layout.img.ar,
      }
    }

    return { monitors, imagePosition }
  } catch {
    return null
  }
}

/** Read layout from the current URL hash. Returns null if none present or invalid. */
export function getLayoutFromHash(): DecodedLayout | null {
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  const encoded = params.get(HASH_KEY)
  if (!encoded) return null
  return decodeLayout(encoded)
}

/** Encode the given monitors (and optional image position) into the URL hash and return the full URL string. */
export function buildShareUrl(monitors: LayoutEntry[], imagePosition?: SavedImagePosition | null): string {
  const encoded = encodeLayout(monitors, imagePosition)
  const url = new URL(window.location.href)
  url.hash = `${HASH_KEY}=${encoded}`
  return url.toString()
}

/** Write the layout hash to the current URL (pushes a new history entry). */
export function setLayoutHash(monitors: LayoutEntry[], imagePosition?: SavedImagePosition | null): string {
  const encoded = encodeLayout(monitors, imagePosition)
  window.location.hash = `${HASH_KEY}=${encoded}`
  return window.location.href
}

/** Remove the layout param from the URL hash without adding a history entry. */
export function clearLayoutHash(): void {
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  params.delete(HASH_KEY)
  const remaining = params.toString()
  history.replaceState(
    null,
    '',
    remaining
      ? `${window.location.pathname}${window.location.search}#${remaining}`
      : window.location.pathname + window.location.search,
  )
}
