# Liquid Studio

Open `motion-editor.html` (also linked in Settings). No paid services or build step.

1. Select Dock or Windows, then a transition and element.
2. Select a diamond keyframe to edit its geometry. Scrub to a new time and use Add Key to insert a shape.
3. Set duration and Bézier control points. Play or loop the actual app preview.
4. Drafts autosave locally. Apply activates the preset in this browser's Demo after reload. Disable restores the existing animation engine without touching financial data.
5. Export JSON for backup or another device; Import validates before replacing the draft. Undo/redo is session-local.

## Transfer contract

Format `voice-finance-motion`, version 1. JSON contains explicit numeric geometry, transition keys, material and liquid controls, and popup keys. X/width scale with the dock width; Y/height remain CSS pixels. Equal viewport widths and the same renderer produce equal geometry. The editor and app share `motion-runtime.js` and the existing dock renderer in `index.html`.

This is not a universal drop-in file for arbitrary historic Voice Finance builds. Port the renderer functions (`dockLiquidTargets`, `dockExpansionFrames`, `dockCollapseFrames`, `sampleDockExpansion`, `rejoinDockMorph`, `renderDockLiquid`, `renderDockChrome`), SVG IDs/DOM contract and CSS with the runtime, or write an adapter. Load the runtime after the app's main script. Never import a preset as executable code.

The current lens control is a brightness/saturation approximation, not optical background refraction. Glass color is dock-wide. Popup style is shared by all sheets; drawer has its own style. Original engine remains unchanged until a preset is applied. iPhone hardware frame rate is not guaranteed by a desktop preview.

Storage keys: `vf-liquid-motion-v1` (applied) and `vf-liquid-motion-v1-draft` (draft). Financial storage is never modified by these controls.
