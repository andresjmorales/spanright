import type { MonitorPreset } from './types'

export const MONITOR_PRESETS: MonitorPreset[] = [
  // Laptops
  { name: '13.3" Laptop FHD', diagonal: 13.3, aspectRatio: [16, 9], resolutionX: 1920, resolutionY: 1080 },
  { name: '14" Laptop FHD', diagonal: 14, aspectRatio: [16, 9], resolutionX: 1920, resolutionY: 1080 },
  { name: '14" Laptop QHD+', diagonal: 14, aspectRatio: [16, 10], resolutionX: 2560, resolutionY: 1600 },
  { name: '15.6" Laptop FHD', diagonal: 15.6, aspectRatio: [16, 9], resolutionX: 1920, resolutionY: 1080 },
  { name: '15.6" Laptop 4K', diagonal: 15.6, aspectRatio: [16, 9], resolutionX: 3840, resolutionY: 2160 },
  { name: '16" Laptop QHD+', diagonal: 16, aspectRatio: [16, 10], resolutionX: 2560, resolutionY: 1600 },
  { name: '17.3" Laptop FHD', diagonal: 17.3, aspectRatio: [16, 9], resolutionX: 1920, resolutionY: 1080 },

  // Standard Monitors
  { name: '24" FHD', diagonal: 24, aspectRatio: [16, 9], resolutionX: 1920, resolutionY: 1080 },
  { name: '24" QHD', diagonal: 24, aspectRatio: [16, 9], resolutionX: 2560, resolutionY: 1440 },
  { name: '27" FHD', diagonal: 27, aspectRatio: [16, 9], resolutionX: 1920, resolutionY: 1080 },
  { name: '27" QHD', diagonal: 27, aspectRatio: [16, 9], resolutionX: 2560, resolutionY: 1440 },
  { name: '27" 4K', diagonal: 27, aspectRatio: [16, 9], resolutionX: 3840, resolutionY: 2160 },
  { name: '32" QHD', diagonal: 32, aspectRatio: [16, 9], resolutionX: 2560, resolutionY: 1440 },
  { name: '32" 4K', diagonal: 32, aspectRatio: [16, 9], resolutionX: 3840, resolutionY: 2160 },

  // Ultrawides
  { name: '34" Ultrawide QHD', diagonal: 34, aspectRatio: [21, 9], resolutionX: 3440, resolutionY: 1440 },
  { name: '34" Ultrawide WFHD', diagonal: 34, aspectRatio: [21, 9], resolutionX: 2560, resolutionY: 1080 },
  { name: '38" Ultrawide QHD+', diagonal: 38, aspectRatio: [21, 9], resolutionX: 3840, resolutionY: 1600 },

  // Super Ultrawides
  { name: '49" Super UW QHD', diagonal: 49, aspectRatio: [32, 9], resolutionX: 5120, resolutionY: 1440 },
]

export const COMMON_ASPECT_RATIOS: [number, number][] = [
  [16, 9],
  [16, 10],
  [21, 9],
  [32, 9],
  [3, 2],
  [4, 3],
]

export const COMMON_RESOLUTIONS: { label: string; w: number; h: number }[] = [
  { label: '1920 x 1080 (FHD)', w: 1920, h: 1080 },
  { label: '2560 x 1440 (QHD)', w: 2560, h: 1440 },
  { label: '2560 x 1600 (QHD+)', w: 2560, h: 1600 },
  { label: '3840 x 2160 (4K)', w: 3840, h: 2160 },
  { label: '2560 x 1080 (UW FHD)', w: 2560, h: 1080 },
  { label: '3440 x 1440 (UW QHD)', w: 3440, h: 1440 },
  { label: '3840 x 1600 (UW QHD+)', w: 3840, h: 1600 },
  { label: '5120 x 1440 (SUW QHD)', w: 5120, h: 1440 },
]
