# Liquid Studio WebGL glass (v109)

Enabled only in the `studio=1` preview, including the diagnostic preview.
Ordinary Liquid Glass Demo retains the previous renderer. Main Voice Finance
is not involved. No presets, keys, finance storage, or geometry are migrated.

## Pipeline

1. Local, pinned MIT html2canvas 1.4.1 rasterizes actual HTML sources. There is
   no hand-maintained second set of finance cards or hard-coded amounts.
2. Cache the complete page, and visible portions of scrollable panels.
   DOM/data/input changes invalidate these caches. Scroll and live transforms
   reposition cached sources at frame cadence; panel scrolling invalidates its
   visible capture. Capture is serial and old textures remain until replacement.
3. Composite page/ticker, then lower panels in layer order. Exclude optical
   canvases and legacy mirrors so no surface recursively samples itself.
4. Apply two-pass Gaussian blur (radius compensated for source scale) and sample
   the texture with the reference rounded-shape distance gradient, edge
   refraction, and directional specular highlights. Use the existing center/edge
   masks and original animation geometry. The indicator additionally samples
   the rendered lower button capsule.
5. One WebGL context renders all surfaces; inert 2D canvases present the results.
   At most ten Gaussian target pairs and bounded HTML texture dimensions.

`VFMirror` keeps the existing update/remove/refresh/flush API. The old mirror
observer is suspended in Studio. WebGL failures before initialization retain
the previous renderer. Context loss and capture errors are reported, not hidden.

## Validation and known limits

Desktop Chromium: shader initialization, playback, live page changes, panel over
panel, and captures checked. Diagnostics include renderer/capture/frame counters,
source versions, costs, and errors during transitions. No physical iPhone result
is claimed. Local capture times were roughly 400–600 ms; changing page contents
can therefore lag before a new texture is ready. Scrolling a cached main page
does not require re-capturing it. This is not a browser compositor screenshot:
html2canvas has CSS/cross-origin limitations. Cross-origin/tainted content is not
bypassed. A very long page is downsampled to bound memory.

Optical normals currently use rounded primitives, while the original CSS masks
retain liquid silhouettes/neck shapes. This does not claim exact optical normals
on every liquid neck. RGB channel splitting is not part of this new renderer;
the user explicitly removed RGB and capsule splitting from this task's priority.

Dependency license is retained in `vendor/html2canvas-1.4.1.min.js`.
