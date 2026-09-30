const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'mirror-runtime.js'), 'utf8');
const motion = fs.readFileSync(path.join(__dirname, '..', 'motion-runtime.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('glass samples only the real page, never its own clones', () => {
  assert.match(source, /document\.querySelector\('body > \.app'\)/);
  assert.match(source, /document\.querySelector\('#accountTicker'\)/);
  assert.doesNotMatch(source, /document\.querySelector\('\.app'\)/);
});

test('glass blurs the zoomed source without refraction', () => {
  assert.match(source, /copy\.style\.transform=transform/);
  assert.match(source, /record\.content\.style\.filter=blur>0\?`blur/);
  assert.match(source, /const localX=contentRect\.width\/Math\.max\(1,record\.content\.offsetWidth\)/);
  assert.match(source, /const x=\(box\.left-contentRect\.left\)\/localX/);
  assert.doesNotMatch(source, /feDisplacementMap|setDirection\(/);
  assert.match(source, /addEventListener\('scroll',align/);
});

test('blur is clipped to the same liquid silhouette and rounded rim', () => {
  assert.match(motion, /renderDockLiquid\(visible\).*updateDockZoom\(visible\)/);
  assert.match(motion, /<feComposite in="feather" in2="mass" operator="in"\/>/);
  assert.match(motion, /clip-path="url\(#contour\)"/);
  assert.match(motion, /inset=depth\*\(1-blur\.edgeStart\/100\),inner=\[inset,inset\],outer=inner/);
  assert.match(motion, /const visible=liquid\(s\);renderDockLiquid\(visible\)/);
  assert.match(motion, /scale=Math\.max\(\.5,Math\.min\(1\.5,1\+z\.value\/39\)\)/);
  assert.match(html, /#bottomZone \.dock-indicator::before\{[^}]*backdrop-filter:none/);
  assert.match(html, /\.dock-zoom-surfaces\{position:absolute;z-index:0/);
  assert.match(html, /\.quick-entry-shell::before\{[^}]*--dock-entry-tint/);
});
