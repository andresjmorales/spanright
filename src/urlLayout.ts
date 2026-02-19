import type { SavedConfig } from './types'

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

type UrlLayout = {
  v: 1
  m: UrlMonitor[]
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

export function encodeLayout(monitors: LayoutEntry[]): string {
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
  return toUrlBase64(JSON.stringify(layout))
}

export function decodeLayout(encoded: string): LayoutEntry[] | null {
  try {
    const json = fromUrlBase64(encoded)
    const layout = JSON.parse(json) as UrlLayout
    if (!layout || layout.v !== 1 || !Array.isArray(layout.m)) return null

    return layout.m.map(mon => ({
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
  } catch {
    return null
  }
}

/** Read layout from the current URL hash. Returns null if none present or invalid. */
export function getLayoutFromHash(): LayoutEntry[] | null {
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  const encoded = params.get(HASH_KEY)
  if (!encoded) return null
  return decodeLayout(encoded)
}

/** Encode the given monitors into the URL hash and return the full URL string. */
export function buildShareUrl(monitors: LayoutEntry[]): string {
  const encoded = encodeLayout(monitors)
  const url = new URL(window.location.href)
  url.hash = `${HASH_KEY}=${encoded}`
  return url.toString()
}

/** Write the layout hash to the current URL (pushes a new history entry). */
export function setLayoutHash(monitors: LayoutEntry[]): string {
  const encoded = encodeLayout(monitors)
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
