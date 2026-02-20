import { useState, useEffect } from 'react'
import { VIEWPORT_BP_TABLET, VIEWPORT_BP_DESKTOP } from './viewportConstants'

export interface ViewportSize {
  width: number
  height: number
  isPhone: boolean
  isTablet: boolean
  isDesktop: boolean
}

function getSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return {
      width: VIEWPORT_BP_DESKTOP,
      height: 768,
      isPhone: false,
      isTablet: false,
      isDesktop: true,
    }
  }
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    width: w,
    height: h,
    isPhone: w < VIEWPORT_BP_TABLET,
    isTablet: w >= VIEWPORT_BP_TABLET && w < VIEWPORT_BP_DESKTOP,
    isDesktop: w >= VIEWPORT_BP_DESKTOP,
  }
}

export function useViewport(): ViewportSize {
  const [size, setSize] = useState(getSize)

  useEffect(() => {
    const onResize = () => setSize(getSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return size
}
