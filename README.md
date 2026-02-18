# Spanright — Multi-Monitor Wallpaper Alignment Tool

Spanright is a single-page web app that lets you create pixel-perfect spanning wallpapers for non-standard multi-monitor setups. Windows' "span" wallpaper mode concatenates monitors by pixel resolution, ignoring physical size differences — Spanright solves this by letting you model your physical desk layout, position a source image across it, and export a stitched wallpaper that looks seamless when spanned.

## The Problem

If you have monitors of different sizes or resolutions (e.g., a 15.6" laptop next to a 27" QHD desktop), Windows span mode produces misaligned wallpapers. A single wide image gets split based on raw pixel counts, not physical dimensions. A mountain peak that should flow across both screens ends up with a jarring offset.

Spanright operates in **physical space** (inches/cm), so you arrange monitors as they actually sit on your desk. It then renders each monitor's portion of the source image at the correct PPI, producing one output image that Windows can span correctly.

## Features

- **Physical-space monitor layout** — Arrange monitors on a canvas using real-world dimensions (calculated from diagonal size + resolution). A 27" monitor appears physically larger than a 15.6" laptop, exactly as on your desk.
- **Drag-and-drop presets** — Choose from 18+ built-in monitor presets (laptops, standard monitors, ultrawides, super ultrawides) and drag them directly onto the canvas.
- **Custom monitors** — Define any monitor by diagonal size, aspect ratio, and resolution. Supports fully custom resolution entry or filtered presets by aspect ratio. Diagonal is limited to 5"–120"; aspect ratio is limited to 10:1 or less (no ultra-thin “line” monitors). Validation warnings appear when limits are exceeded; Add is disabled until fixed.
- **Monitor rotation** — Rotate any monitor 90° (portrait/landscape) via the ↻ button on each monitor tile. Resolution is swapped (e.g. 1080×1920 when rotated); rotation is saved in saved layouts and reflected in output and the Windows Arrangement view.
- **Image placement** — Upload a source image and drag/scale it behind the monitor layout. Semi-transparent monitor overlays let you see exactly what portion of the image each screen will display. Vertical images (height > width) default to 6 ft tall; horizontal ones default to 6 ft wide.
- **Smart image recommendations** — Calculates the minimum source image resolution needed based on your layout's physical size and the highest-PPI monitor.
- **Accurate output generation** — Crops and scales the source image per-monitor at each screen's native PPI, then stitches at each monitor's Windows arrangement position (side-by-side, stacked, or mixed). Fills any gaps in the layout with black.
- **Preview & download** — Live preview of the final stitched wallpaper with one-click PNG/JPEG export.
- **Canvas controls** — Scroll to pan, Ctrl+Scroll to zoom (up to 300%), right-click drag to pan. Custom scrollbars, snap-to-grid, and fit-to-view.
- **Saved Layouts** — Save and load monitor layouts (names, positions, rotation, Windows arrangement). Layouts are stored in your browser (localStorage); you can keep several setups (e.g. desk vs laptop-only) and switch between them. Basic but very useful for multi-setup workflows.

## Example
Dragon image [source](https://unsplash.com/photos/dragon-effigy-breathes-fire-over-a-crowd-at-night-TP7InDDpeRE) from Unsplash.
### Physical Layout & Editor Canvas
<img width="1920" height="1039" alt="dragonfire-canvas-zoomed" src="https://github.com/user-attachments/assets/26e5b87c-73d8-4ce9-af2a-90069d98f721" />

### Windows Arrangement
<img width="1920" height="1039" alt="dragonfire-windows" src="https://github.com/user-attachments/assets/564adb2d-9b27-4f4e-8afe-2d7601512303" />

### Preview & Export
<img width="1920" height="1039" alt="dragonfire-preview" src="https://github.com/user-attachments/assets/fb335e52-bd18-4b3f-9083-f53ad9e047cc" />

### Result
Spanright's output wallpaper (6400x1080) displayed on a 14" 1080p laptop, a 24" 1080p monitor, and 34" 2560x1080 ultrawide monitor. The total resolution of this setup is (1920 + 1920 + 2560) x (1080) = 6400x1080. And the the total aspect ratio of this setup would be (16 + 16 + 21) / (9) = 53:9. The image will only look good when Spanright modifies the image to take account of the physical monitor dimensions and spacing as well. Even though the preview looks disjointed, it actually alignes perfectly when used as the wallpaper.

Standard 53:9 crop of dragon picture:
![dragonfire-lazy-53-9](https://github.com/user-attachments/assets/a4d9ee67-5bb5-4a6d-9987-703bf339b208)
Spanright 53:9 crop of dragon picture:
![spanright-dragonfire-6400x1080-demo-jpg](https://github.com/user-attachments/assets/17f802e3-b2ae-4afe-ac83-4ad04e4239a1)
Standard crop set as my wallpaper in my real setup (see the unaligned neck/head):
![dragonfire-demo-bad-crop](https://github.com/user-attachments/assets/a5e1d428-12da-415c-a5ed-26389b98458f)
Spanright result working in my real setup:
![dragonfire-demo-real](https://github.com/user-attachments/assets/116198b6-087a-49cb-8dd1-8e3de17d6f23)

## Directions

### 1. Add Monitors

Use the sidebar on the left to add monitors to the canvas:

- **Click** a preset to add it at a default position
- **Drag** a preset directly onto the canvas to place it where you want
- **Custom monitors**: Click "+ Custom Monitor" to define a monitor by diagonal size, aspect ratio, and resolution (diagonal 5"–120", aspect ratio ≤ 10:1)

### 2. Arrange Your Layout

Drag monitors on the canvas to match your physical desk arrangement:

- Position your laptop screen lower-left, your main monitor centered, etc.
- The canvas uses physical dimensions — a 27" monitor will appear larger than a 13" laptop
- Enable **Snap to Grid** in the toolbar for precise alignment
- Use the **↻** (rotate) button on a monitor to switch it between landscape and portrait
- Click a monitor and press **Delete** to remove it
- Press **F** to fit all monitors in view
- Use **Saved Layouts** in the toolbar to save or load monitor layouts (e.g. desk vs laptop-only); layouts are stored in your browser

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

### 5. Windows Arrangement (optional)

The **Windows Arrangement** tab (next to Physical Layout) lets you match how Windows sees your displays (Settings > System > Display). Use it if your Windows display order or positions don’t match a simple left-to-right layout.

> **Warning:** Changing Windows Display Settings (position, order, resolution) can get messy. For best results, keep all monitors **top-aligned or bottom-aligned** in Windows; other alignments may produce unwanted (visible) black bars in the spanned wallpaper.

### 6. Set as Windows Wallpaper

1. Download the generated image
2. Open **Settings > Personalization > Background**
3. Set "Choose a fit" to **Span**
4. Select the downloaded image

> **Important:** Make sure your Windows display arrangement (Settings > Display) matches the physical layout you configured in Spanright.

## Canvas Controls

| Action | Control |
|--------|---------|
| Pan | Scroll wheel / Right-click drag |
| Horizontal pan | Shift + Scroll |
| Zoom | Ctrl + Scroll (up to 300%) |
| Fit view | Press **F** / click **Fit** button |
| Select monitor | Click on it |
| Delete monitor | Select + **Delete** or **Backspace** |
| Deselect | **Escape** or click empty space |

## How It Works

### Coordinate Spaces

Spanright operates in two coordinate spaces:

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

Output matches the Windows virtual desktop bounding box (Settings > Display). For each monitor:

1. **Physical layout** determines what portion of the source image that monitor sees.
2. **Windows arrangement** (pixel positions) determines where the monitor sits in the output image.
3. The source image is cropped and scaled to the monitor's native resolution (PPI-correct).
4. Each monitor is drawn at its `(pixelX, pixelY)` position in the output. This supports side-by-side, stacked vertical, and mixed layouts.
5. Output dimensions = bounding box of all monitors (`maxX − minX` × `maxY − minY`). Any unfilled area (gaps or differing sizes) is filled with black.

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
    ├── EditorCanvas.tsx           # Physical layout canvas
    ├── WindowsArrangementCanvas.tsx  # Windows display-order canvas
    ├── MonitorPresetsSidebar.tsx   # Preset list + custom form
    ├── Toolbar.tsx                 # Top toolbar controls
    ├── PreviewPanel.tsx            # Output preview + download
    ├── ImageUpload.tsx             # File upload component
    ├── ConfigManager.tsx            # Saved layouts (save/load)
    ├── InfoDialog.tsx              # App info / keyboard shortcuts
    └── TroubleshootingGuide.tsx     # Wallpaper troubleshooting
```

## Running locally

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/your-username/spanright.git
cd spanright
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
