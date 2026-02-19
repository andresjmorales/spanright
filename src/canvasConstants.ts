/**
 * Physical canvas workspace bounds in inches (~12 ft × 8 ft).
 * Used for pan/zoom limits and for centering preloaded layouts.
 */
export const PHYS_MIN_X = 0
export const PHYS_MAX_X = 144
export const PHYS_MIN_Y = 0
export const PHYS_MAX_Y = 96

export const CANVAS_PHYSICAL_WIDTH_IN = PHYS_MAX_X - PHYS_MIN_X
export const CANVAS_PHYSICAL_HEIGHT_IN = PHYS_MAX_Y - PHYS_MIN_Y

/** Canvas center in inches; preloaded layouts are centered here. */
export const CANVAS_CENTER_X_IN = (PHYS_MIN_X + PHYS_MAX_X) / 2
export const CANVAS_CENTER_Y_IN = (PHYS_MIN_Y + PHYS_MAX_Y) / 2
