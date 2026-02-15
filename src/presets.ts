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
  // 16:9
  { label: '1280 x 720 (HD)', w: 1280, h: 720 },
  { label: '1920 x 1080 (FHD)', w: 1920, h: 1080 },
  { label: '2560 x 1440 (QHD)', w: 2560, h: 1440 },
  { label: '3840 x 2160 (4K)', w: 3840, h: 2160 },
  { label: '5120 x 2880 (5K)', w: 5120, h: 2880 },
  { label: '7680 x 4320 (8K)', w: 7680, h: 4320 },
  // 16:10
  { label: '1280 x 800 (WXGA)', w: 1280, h: 800 },
  { label: '1920 x 1200 (WUXGA)', w: 1920, h: 1200 },
  { label: '2560 x 1600 (QHD+)', w: 2560, h: 1600 },
  { label: '3840 x 2400 (4K+)', w: 3840, h: 2400 },
  // 21:9
  { label: '2560 x 1080 (UW FHD)', w: 2560, h: 1080 },
  { label: '3440 x 1440 (UW QHD)', w: 3440, h: 1440 },
  { label: '3840 x 1600 (UW QHD+)', w: 3840, h: 1600 },
  { label: '5120 x 2160 (UW 4K)', w: 5120, h: 2160 },
  // 32:9
  { label: '3840 x 1080 (SUW FHD)', w: 3840, h: 1080 },
  { label: '5120 x 1440 (SUW QHD)', w: 5120, h: 1440 },
  // 3:2
  { label: '2160 x 1440 (3:2)', w: 2160, h: 1440 },
  { label: '2256 x 1504 (Surface)', w: 2256, h: 1504 },
  { label: '3000 x 2000 (3:2 3K)', w: 3000, h: 2000 },
  { label: '3240 x 2160 (3:2 QHD)', w: 3240, h: 2160 },
  // 4:3
  { label: '1024 x 768 (XGA)', w: 1024, h: 768 },
  { label: '1600 x 1200 (UXGA)', w: 1600, h: 1200 },
  { label: '2048 x 1536 (QXGA)', w: 2048, h: 1536 },
]
