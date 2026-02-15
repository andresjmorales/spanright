export interface MonitorPreset {
  name: string
  diagonal: number        // inches
  aspectRatio: [number, number]  // e.g. [16, 9]
  resolutionX: number
  resolutionY: number
}

export interface Monitor {
  id: string
  preset: MonitorPreset
  // Physical position on canvas in inches (top-left corner)
  physicalX: number
  physicalY: number
  // Computed physical dimensions in inches
  physicalWidth: number
  physicalHeight: number
  // PPI
  ppi: number
}

export interface SourceImage {
  element: HTMLImageElement
  naturalWidth: number
  naturalHeight: number
  // Position and scale in physical space (inches)
  physicalX: number
  physicalY: number
  physicalWidth: number
  physicalHeight: number
}

export interface AppState {
  monitors: Monitor[]
  sourceImage: SourceImage | null
  canvasScale: number     // pixels per inch on the canvas display
  canvasOffsetX: number   // pan offset
  canvasOffsetY: number
  unit: 'inches' | 'cm'
}
