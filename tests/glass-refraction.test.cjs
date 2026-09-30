const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'mirror-runtime.js'), 'utf8');

test('glass samples only the real page, never its own clones', () => {
  assert.match(source, /document\.querySelector\('body > \.app'\)/);
  assert.match(source, /document\.querySelector\('#accountTicker'\)/);
  assert.doesNotMatch(source, /document\.querySelector\('\.app'\)/);
});

test('reflection displaces live pixels without rotating the whole page', () => {
  assert.match(source, /feDisplacementMap/);
  assert.match(source, /setDirection\(record,angle\)/);
  assert.doesNotMatch(source, /copy\.style\.transform=`rotate/);
  assert.match(source, /addEventListener\('scroll',align/);
});
