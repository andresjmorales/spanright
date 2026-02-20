# Spanright — Multi-Monitor Wallpaper Alignment Tool

Spanright is a single-page web app that lets you create pixel-perfect spanning wallpapers for non-standard multi-monitor setups. Most operating systems concatenate monitors by pixel resolution when spanning wallpapers, ignoring physical size differences — Spanright solves this by letting you model your physical desk layout, position a source image across it, and export a stitched wallpaper that looks seamless across all your screens. Works for Windows, macOS, and Linux.

## The Problem

If you have monitors of different sizes or resolutions (e.g., a 15.6" laptop next to a 27" QHD desktop), spanning a single wallpaper produces misaligned images. The image gets split based on raw pixel counts, not physical dimensions. A mountain peak that should flow across both screens ends up with a jarring offset.

Spanright operates in **physical space** (inches/cm), so you arrange monitors as they actually sit on your desk. It then renders each monitor's portion of the source image at the correct PPI, producing one output image that your OS can span correctly.

## Features

- **Physical-space monitor layout** — Arrange monitors on a canvas using real-world dimensions (calculated from diagonal size + resolution). A 27" monitor appears physically larger than a 15.6" laptop, exactly as on your desk.
- **Drag-and-drop presets** — Choose from 18+ built-in monitor presets (laptops, standard monitors, ultrawides, super ultrawides) and drag them directly onto the canvas.
- **Custom monitors** — Define any monitor by diagonal size, aspect ratio, and resolution. Supports fully custom resolution entry or filtered presets by aspect ratio. Diagonal is limited to 5"–120"; aspect ratio is limited to 10:1 or less (no ultra-thin "line" monitors). Validation warnings appear when limits are exceeded; Add is disabled until fixed.
- **Monitor rotation** — Rotate any monitor 90° (portrait/landscape) via the ↻ button or **right-click** context menu. Resolution is swapped (e.g. 1080×1920 when rotated); rotation is saved in saved layouts and reflected in output and the Virtual Layout view.
- **Right-click or kebab menu** — Right-click any monitor, or when a monitor is selected click the **⋮** (kebab) button next to the **✕** delete button, for **Set Bezels**, **Rename**, **Rotate 90°**, **Duplicate**, and **Delete**. Bezels are optional per-edge borders (in mm) that extend outward from the display area; they help with alignment and matching real bezels, and Align Assist snaps to outer bezel edges when set. **Duplicate** copies the monitor (preset/size, bezels, rotation, name with " - Copy 1" appended) and places the copy offset so you can drag it easily.
- **Image placement** — Upload a source image and drag/scale it behind the monitor layout. Semi-transparent monitor overlays let you see exactly what portion of the image each screen will display. Vertical images (height > width) default to 6 ft tall; horizontal ones default to 6 ft wide.
- **Smart image recommendations** — Calculates the minimum source image resolution needed based on your layout's physical size and the highest-PPI monitor.
- **Accurate output generation** — Crops and scales the source image per-monitor at each screen's native PPI, then stitches at each monitor's virtual layout position (side-by-side, stacked, or mixed). Gaps in the layout use a configurable fill: solid color (default black), blurred edge extension, or transparent (PNG only).
- **Preview & download** — Live preview of the final stitched wallpaper with one-click PNG/JPEG export.
- **Canvas controls** — Scroll to pan, Ctrl+Scroll to zoom (up to 400%), right-click drag to pan. Custom scrollbars, Align Assist guides/snapping, and fit-to-view.
- **Saved Layouts** — Save and load monitor layouts (names, positions, rotation, bezels, virtual layout). Saving a layout also stores the current image position when an image is loaded; loading a layout and then uploading an image applies that saved position (with aspect-ratio adaptation). Layouts are stored in your browser (localStorage); you can keep several setups (e.g. desk vs laptop-only) and switch between them. Optional **Quick layouts** (preloaded in code) appear at the bottom of the Saved Layouts dropdown when configured. The Saved Layouts control sits on the right side of the toolbar, to the left of Share Layout.
- **Image position bookmark** — Right-click the source image for **Bookmark image position**, **Apply bookmarked position**, and **Clear bookmarked position**. The bookmark is stored per layout name (or "_default" when no layout is active) so you can pin a preferred image position independently of saving the full layout.
- **Cross-platform** — Works in any modern browser. Output can be applied as a spanned wallpaper on Windows (Span/Tile mode), macOS (per-monitor crop), and Linux (varies by DE — GNOME, KDE, feh, swaybg, etc.).

## Example
Dragon image [source](https://unsplash.com/photos/dragon-effigy-breathes-fire-over-a-crowd-at-night-TP7InDDpeRE) from Unsplash.

### Physical Layout & Editor Canvas
<img width="1920" height="1039" alt="dragonfire-canvas-zoomed" src="https://github.com/user-attachments/assets/26e5b87c-73d8-4ce9-af2a-90069d98f721" />

### Virtual Layout
<img width="1920" height="1039" alt="dragonfire-windows" src="https://github.com/user-attachments/assets/564adb2d-9b27-4f4e-8afe-2d7601512303" />

### Preview & Export
<img width="1920" height="1039" alt="dragonfire-preview" src="https://github.com/user-attachments/assets/fb335e52-bd18-4b3f-9083-f53ad9e047cc" />

### Result
Spanright's output wallpaper (6400x1080) displayed on a 14" 1080p laptop, a 24" 1080p monitor, and 34" 2560x1080 ultrawide monitor. The total resolution of this setup is (1920 + 1920 + 2560) x (1080) = 6400x1080. And the total aspect ratio of this setup would be (16 + 16 + 21) / (9) = 53:9. The image will only look good when Spanright modifies the image to take account of the physical monitor dimensions and spacing as well. Even though the preview looks disjointed, it actually aligns perfectly when used as the wallpaper.

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
- **Right-click** a monitor, or select it and click the **⋮** kebab next to the **✕**, for the context menu: **Set Bezels**, **Rename**, **Rotate 90°**, **Duplicate**, or **Delete**. Bezels extend outward from the display area; Align Assist snaps to outer bezel edges when bezels are set.
- When the **source image** is selected, use the **⋮** kebab or **right-click** the image for **Size image to fit**, **Bookmark image position**, **Apply bookmarked position** (when a bookmark exists), **Clear bookmarked position**, and **Remove image**.
- Use **Align Assist** (canvas menu) for dynamic edge/center alignment guides while dragging monitors
- Use the **↻** (rotate) button on a monitor, or **Rotate 90°** from the right-click menu, to switch between landscape and portrait
- Click a monitor and press **Delete** (or use the context menu) to remove it
- Press **F** to fit all monitors in view
- Use **Saved Layouts** (right side of toolbar, left of Share Layout) to save or load monitor layouts; layouts are stored in your browser and include bezel settings. Quick layouts can be preloaded in `src/preloadedLayouts.ts`.

### 3. Upload & Position Your Image

- Drag and drop an image file onto the canvas, or use the upload button in the toolbar
- The image appears behind the monitors with 70% opacity. If you loaded a layout that had a saved image position, the next image you upload is automatically positioned from that layout (with aspect-ratio adaptation); a toast confirms "Image positioned from saved layout"
- **Drag** the image to reposition it
- **Click** the image and use the corner handles to resize it
- Use **Size image to fit** from the canvas menu (top-right ⋮) or from the **⋮** kebab / right-click menu on the source image
- **Right-click** the image for **Bookmark image position**, **Apply bookmarked position**, or **Clear bookmarked position**
- With **Align Assist** enabled, image drag/resize shows green alignment guides against monitor edges/centers
- Check the **recommended image size** banner in the toolbar — green means your image is large enough, yellow/red means it may appear pixelated

### 4. Virtual Layout (optional)

The **Virtual Layout** tab (next to Physical Layout) lets you match how your OS sees your displays. The OS arrangement defines the *virtual desktop*: where the cursor and windows move between monitors (e.g. one display above the other means the cursor crosses at the shared top edge; side-by-side at the vertical edge). Use the Virtual Layout tab if your display order or positions don't match a simple left-to-right layout. This concept applies on all platforms — Windows, macOS, and Linux all maintain their own display arrangement.

The output image has the same bounding box. The OS paints the wallpaper from the top-left; each monitor only displays the rectangle of the image at its position. So any empty area in the image (gaps from different resolutions or offsets) lies outside every monitor's rectangle and is never shown on any screen.

#### Windows
Open **Settings > System > Display** to see how Windows arranges your monitors. If the order matches a simple left-to-right layout, you can skip this step.

> **Warning:** Changing Windows Display Settings (position, order, resolution) can get messy. For best results, keep all monitors **top-aligned or bottom-aligned** in Windows; other alignments may produce unwanted visible empty area in the spanned wallpaper.

#### macOS
Open **System Settings > Displays > Arrange** to see your display arrangement. Drag the display rectangles to match your physical layout.

> **Note:** Retina/HiDPI displays report logical pixels (e.g. "looks like 1440×900"), not the actual hardware resolution (e.g. 2880×1800). When adding monitors in Spanright, always use the **actual pixel resolution** — otherwise the output will be undersized and blurry on Retina screens.

#### Linux
Display arrangement depends on your desktop environment:
- **GNOME:** Settings > Displays
- **KDE Plasma:** System Settings > Display and Monitor > Display Configuration
- **Command line:** `xrandr --query` (X11) or `wlr-randr` (Wayland/wlroots)

### 5. Preview & Export

- The bottom panel shows a live preview of the final stitched wallpaper
- When the output has empty area (e.g. vertical offsets or different strip heights), use **Empty area options** to choose how to fill it: **Solid color** (with color picker and eyedropper to sample from the source image), **Blurred edge extension**, or **Transparent** (PNG only)
- Click **Download** to save as PNG or JPEG (transparent fill forces PNG)
- The output dimensions are displayed (e.g., "7280 x 1440")

### 6. Set Your Wallpaper

#### Windows
1. Download the generated image
2. Open **Settings > Personalization > Background**
3. Set "Choose a fit" to **Span**
4. Select the downloaded image

> **Important:** Make sure your Windows display arrangement (Settings > Display) matches the physical layout you configured in Spanright.

#### macOS
macOS has no native "Span" wallpaper mode. To use the Spanright output:
1. Download the generated image
2. Open it in **Preview** or an image editor and crop each monitor's region individually
3. Open **System Settings > Wallpaper** (or right-click desktop > **Change Wallpaper**)
4. Set each monitor's wallpaper individually using its cropped portion

> **Tip:** Third-party tools like **Multi Monitor Wallpaper** can automate spanning a single image across all displays.

#### Linux
Linux wallpaper handling varies by desktop environment:
- **GNOME:** Settings > Background, then select the image. Use `gsettings set org.gnome.desktop.background picture-options 'spanned'` to span across monitors.
- **KDE Plasma:** Right-click desktop > Configure Desktop > Wallpaper. Some versions support spanning directly.
- **feh (X11):** `feh --bg-scale /path/to/wallpaper.png`
- **nitrogen (X11):** Select the image and choose "Scaled" or "Zoomed" fitting.
- **swaybg (Wayland/Sway):** `swaybg -i /path/to/wallpaper.png -m fill`
- **Hyprpaper (Hyprland):** Configure in `~/.config/hypr/hyprpaper.conf`

> **Note:** Exact steps vary by distribution and desktop environment. If your tool doesn't support spanning, crop per-monitor regions from the output (like macOS) and set each individually.

## Platform Support

| Platform | Span Mode | Display Settings | Notes |
|----------|-----------|------------------|-------|
| **Windows** | Built-in (**Span** or **Tile** fit mode) | Settings > System > Display | Best native support — Span mode applies one image across all monitors automatically |
| **macOS** | No native span mode | System Settings > Displays > Arrange | Crop per-monitor from the Spanright output and set each individually. Retina displays report logical pixels — use actual hardware resolution in Spanright |
| **Linux** | Varies by DE | GNOME Settings, KDE System Settings, `xrandr`, etc. | GNOME supports `spanned` picture option. Other DEs/WMs may require per-monitor cropping or tools like `feh`, `nitrogen`, or `swaybg` |

## Canvas Controls

| Action | Control |
|--------|---------|
| Pan | Scroll wheel / Right-click drag |
| Horizontal pan | Shift + Scroll |
| Zoom | Ctrl + Scroll (up to 400%) |
| Fit view | Press **F** / click **Fit** button |
| Select monitor | Click on it |
| Monitor context menu | **Right-click** monitor or select + **⋮** kebab → Set Bezels, Rename, Rotate 90°, Duplicate, Delete |
| Delete monitor | Select + **Delete** or **Backspace**, or right-click → Delete |
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

Output matches the virtual desktop bounding box of your virtual layout. For each monitor:

1. **Physical layout** determines what portion of the source image that monitor sees.
2. **Virtual layout** (pixel positions) determines where the monitor sits in the output image.
3. The source image is cropped and scaled to the monitor's native resolution (PPI-correct).
4. Each monitor is drawn at its `(pixelX, pixelY)` position in the output. This supports side-by-side, stacked vertical, and mixed layouts.
5. Output dimensions = bounding box of all monitors (`maxX − minX` × `maxY − minY`). Any unfilled area uses the chosen fill mode: solid color (default black), blurred edge extension, or transparent (PNG only).

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
├── canvasConstants.ts         # Canvas bounds (inches) and center for preloaded layouts
├── urlLayout.ts               # Encode/decode layout for share URL
├── preloadedLayouts.ts       # Optional quick-layout presets (centered at canvas center)
├── icons.tsx                  # Shared SVG icon components
├── generateOutput.ts          # Wallpaper stitching logic
├── index.css                  # Tailwind imports
└── components/
    ├── EditorCanvas.tsx           # Physical layout canvas
    ├── WindowsArrangementCanvas.tsx  # Virtual layout canvas
    ├── MonitorPresetsSidebar.tsx   # Preset list + custom form
    ├── Toolbar.tsx                 # Top toolbar controls
    ├── PreviewPanel.tsx            # Output preview + download
    ├── ImageUpload.tsx             # File upload component
    ├── ConfigManager.tsx            # Saved layouts + quick layouts (save/load)
    ├── ShareButton.tsx             # Copy share link to clipboard
    ├── InfoDialog.tsx              # App info / keyboard shortcuts
    └── TroubleshootingGuide.tsx     # Wallpaper troubleshooting

scripts/
└── center-preloaded-layouts.mjs   # Dev script: center layout strings at canvas center (run when adding preloaded layouts)
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
