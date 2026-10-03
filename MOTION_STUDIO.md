# Liquid Studio

Open `motion-editor.html` (also linked in Settings). No paid services or build step.

1. Select Dock or Windows, then a transition and an element's timeline row.
2. Each element has independent diamond keys. Add, move, or delete an interior key on that row without changing other rows.
3. The bottom horizontally scrollable icon strip opens parameter sheets: Shape, Duration, Curve, Glass, Liquid, Project. Duration offers scene length, element length, delay, and selected key time in milliseconds. Changing scene length scales all tracks proportionally; changing element length or delay affects only that row. An element holds its first/last shape outside its active clip.
4. Curve controls apply only to the selected element. Play or loop the actual app preview. Old presets are automatically migrated to independent tracks without deleting edits.
4. Drafts autosave locally. Apply activates the preset in this browser's Demo after reload. Disable restores the existing animation engine without touching financial data.
5. Export JSON for backup or another device; Import validates before replacing the draft. Undo/redo is session-local.

## Transfer contract

Format `voice-finance-motion`, version 1. JSON contains explicit numeric geometry, transition keys, material and liquid controls, and popup keys. X/width scale with the dock width; Y/height remain CSS pixels. Equal viewport widths and the same renderer produce equal geometry. The editor and app share `motion-runtime.js` and the existing dock renderer in `index.html`.

This is not a universal drop-in file for arbitrary historic Voice Finance builds. Port the renderer functions (`dockLiquidTargets`, `dockExpansionFrames`, `dockCollapseFrames`, `sampleDockExpansion`, `rejoinDockMorph`, `renderDockLiquid`, `renderDockChrome`), SVG IDs/DOM contract and CSS with the runtime, or write an adapter. Load the runtime after the app's main script. Never import a preset as executable code.

Studio preview (`index.html?studio=1`) uses the live-DOM WebGL optics from the supplied example: independent HTML blocks are rasterized once into GPU textures, changed blocks are refreshed with `texSubImage2D`, and native scrolling/animated transforms reposition those textures. The shader samples and refracts those pixels along the glass edge; the sliding indicator samples the parent bar's optical result. Existing keyframes, geometry, animated SVG masks, shared glass material, separate indicator material and popup controls remain the owners of their settings. The regular Demo and the primary Voice Finance are not switched to this renderer.

DOM snapshots are not direct access to the browser's framebuffer. Unsupported html2canvas content and images without suitable CORS permission cannot be read into the texture. Changes to captured content refresh after 150 ms of motion idle; scroll and panel transforms themselves require no new snapshot. Diagnostics expose capture/upload/allocation counts, texture memory, GPU passes and errors. A device's actual frame rate and visual shader output must be checked in Safari; Node tests validate resource/order/state behavior, not pixels or 60 FPS.

### v110 verification status

The incremental cache and GPU integration have behavioral tests, including pending-capture races, scrolling without full-viewport texture uploads, mask/RGB invalidation, parent-indicator optics and panel order. The supplied reference's refraction/specular equations are retained. Browser/device visual verification is pending because no browser is currently connected to this Codex session. Do not treat these automated tests as an iPhone visual pass.

Storage keys: `vf-liquid-motion-v1` (applied) and `vf-liquid-motion-v1-draft` (draft). Financial storage is never modified by these controls.
