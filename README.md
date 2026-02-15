# Spanwright — Multi-Monitor Wallpaper Alignment Tool

Spanwright is a single-page web app that lets you create pixel-perfect spanning wallpapers for non-standard multi-monitor setups. Windows' "span" wallpaper mode concatenates monitors by pixel resolution, ignoring physical size differences — Spanwright solves this by letting you model your physical desk layout, position a source image across it, and export a stitched wallpaper that looks seamless when spanned.

## The Problem

If you have monitors of different sizes or resolutions (e.g., a 15.6" laptop next to a 27" QHD desktop), Windows span mode produces misaligned wallpapers. A single wide image gets split based on raw pixel counts, not physical dimensions. A mountain peak that should flow across both screens ends up with a jarring offset.

Spanwright operates in **physical space** (inches/cm), so you arrange monitors as they actually sit on your desk. It then renders each monitor's portion of the source image at the correct PPI, producing one output image that Windows can span correctly.

## Features

- **Physical-space monitor layout** — Arrange monitors on a canvas using real-world dimensions (calculated from diagonal size + resolution). A 27" monitor appears physically larger than a 15.6" laptop, exactly as on your desk.
- **Drag-and-drop presets** — Choose from 18+ built-in monitor presets (laptops, standard monitors, ultrawides, super ultrawides) and drag them directly onto the canvas.
- **Custom monitors** — Define any monitor by diagonal size, aspect ratio, and resolution. Supports fully custom resolution entry or filtered presets by aspect ratio.
- **Image placement** — Upload a source image and drag/scale it behind the monitor layout. Semi-transparent monitor overlays let you see exactly what portion of the image each screen will display.
- **Smart image recommendations** — Calculates the minimum source image resolution needed based on your layout's physical size and the highest-PPI monitor.
- **Accurate output generation** — Crops and scales the source image per-monitor at each screen's native PPI, then stitches the results side-by-side. Handles vertical offsets and fills empty space with black.
- **Preview & download** — Live preview of the final stitched wallpaper with one-click PNG/JPEG export.
- **Canvas controls** — Scroll to pan, Ctrl+Scroll to zoom, right-click drag to pan. Custom scrollbars, snap-to-grid, and fit-to-view.
- **Unit toggle** — Switch between inches and centimeters.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/your-username/spanwright.git
cd spanwright
npm install
```

### Development

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173) by default.

### Build for Production

```bash
npm run build
```

Output is in the `dist/` folder, ready for static hosting (e.g., Vercel, Netlify, GitHub Pages).

### Preview Production Build

```bash
npm run preview
```

## How to Use

### 1. Add Monitors

Use the sidebar on the left to add monitors to the canvas:

- **Click** a preset to add it at a default position
- **Drag** a preset directly onto the canvas to place it where you want
- **Custom monitors**: Click "+ Custom Monitor" to define a monitor by diagonal size, aspect ratio, and resolution

### 2. Arrange Your Layout

Drag monitors on the canvas to match your physical desk arrangement:

- Position your laptop screen lower-left, your main monitor centered, etc.
- The canvas uses physical dimensions — a 27" monitor will appear larger than a 13" laptop
- Enable **Snap to Grid** in the toolbar for precise alignment
- Click a monitor and press **Delete** to remove it
- Press **F** to fit all monitors in view

### 3. Upload & Position Your Image

- Drag and drop an image file onto the canvas, or use the upload button in the toolbar
- The image appears behind the monitors with 70% opacity
- **Drag** the image to reposition it
- **Click** the image and use the corner handles to resize it
- Check the **recommended image size** banner in the toolbar — green means your image is large enough, yellow/red means it may appear pixelated

### 4. Preview & Export

- The bottom panel shows a live preview of the final stitched wallpaper
- Click **Download** to save as PNG or JPEG
- The output dimensions are displayed (e.g., "7280 x 1440")

### 5. Set as Windows Wallpaper

1. Download the generated image
2. Open **Settings > Personalization > Background**
3. Set "Choose a fit" to **Span**
4. Select the downloaded image

> **Important:** Make sure your Windows display arrangement (Settings > Display) matches the physical layout you configured in Spanwright.

## Canvas Controls

| Action | Control |
|--------|---------|
| Pan | Scroll wheel / Right-click drag |
| Horizontal pan | Shift + Scroll |
| Zoom | Ctrl + Scroll |
| Fit view | Press **F** / click **Fit** button |
| Select monitor | Click on it |
| Delete monitor | Select + **Delete** or **Backspace** |
| Deselect | **Escape** or click empty space |

## How It Works

### Coordinate Spaces

Spanwright operates in two coordinate spaces:

- **Physical space (inches)** — The canvas grid. Monitor sizes and image positioning happen here. 1 canvas unit = 1 physical inch.
- **Pixel space** — Each monitor's native resolution. The output image lives here.

### PPI Calculation

```
PPI = sqrt(resolutionX² + resolutionY²) / diagonalInches
physicalWidth = resolutionX / PPI
physicalHeight = resolutionY / PPI
```

For example, a 27" QHD (2560x1440) monitor:
- PPI = sqrt(2560² + 1440²) / 27 ≈ 109
- Physical width = 2560 / 109 ≈ 23.5"
- Physical height = 1440 / 109 ≈ 13.2"

### Output Generation

For each monitor (sorted left-to-right by physical position):
1. Determine the physical bounding box on the canvas
2. Find the overlapping region of the source image
3. Map physical coordinates back to source image pixels
4. Crop and scale that region to the monitor's native resolution
5. Stitch all strips side-by-side into the final output

The output height equals the tallest monitor's resolution. Shorter monitors are vertically positioned based on their physical offset, with black fill for empty space.

## Tech Stack

- [React](https://react.dev/) 19 + TypeScript
- [Konva](https://konvajs.org/) / [react-konva](https://github.com/konvajs/react-konva) for canvas rendering
- [Tailwind CSS](https://tailwindcss.com/) 4 for styling
- [Vite](https://vite.dev/) 7 for build tooling
- No backend — all processing is client-side

## Project Structure

```
src/
├── App.tsx                    # Main layout
├── main.tsx                   # Entry point
├── store.tsx                  # Global state (useReducer + Context)
├── types.ts                   # TypeScript interfaces
├── utils.ts                   # PPI calculations, coordinate math
├── presets.ts                 # Monitor preset definitions
├── generateOutput.ts          # Wallpaper stitching logic
├── index.css                  # Tailwind imports
└── components/
    ├── EditorCanvas.tsx       # Interactive canvas editor
    ├── MonitorPresetsSidebar.tsx  # Preset list + custom form
    ├── Toolbar.tsx            # Top toolbar controls
    ├── PreviewPanel.tsx       # Output preview + download
    └── ImageUpload.tsx        # File upload component
```

## License

MIT
