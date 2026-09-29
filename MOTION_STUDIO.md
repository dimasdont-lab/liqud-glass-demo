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

The current lens control is a brightness/saturation approximation, not optical background refraction. Glass color is dock-wide. Popup style is shared by all sheets; drawer has its own style. Original engine remains unchanged until a preset is applied. iPhone hardware frame rate is not guaranteed by a desktop preview.

Storage keys: `vf-liquid-motion-v1` (applied) and `vf-liquid-motion-v1-draft` (draft). Financial storage is never modified by these controls.
