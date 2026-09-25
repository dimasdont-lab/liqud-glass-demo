const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.slice(html.indexOf('const liquidMix='), html.indexOf('function animateDockLiquid(mode)'));
assert.ok(source.startsWith('const liquidMix='));

const buttons = ['goals', 'insights', 'debts', 'home', 'more'].map(name => ({
  dataset: { screen: name },
  classList: { contains: value => value === 'active' && name === 'home' }
}));
const context = {
  document: {
    querySelector: selector => selector === '.dock-layout' ? { clientWidth: 420 } : { setAttribute() {} },
    querySelectorAll: () => buttons
  }
};
const api = vm.runInNewContext(`${source}\n({dockLiquidTargets,dockExpansionFrames,dockCollapseFrames,sampleDockExpansion,liquidEase})`, context);
const compact = api.dockLiquidTargets('compact');
const expanded = api.dockLiquidTargets('expanded');
const frames = api.dockExpansionFrames(compact, expanded);
const stops = [0, .18, .39, .61, .80, 1];

assert.equal(frames.length, 6);
for (let i = 0; i < 6; i++) {
  const sampled = api.sampleDockExpansion(frames, stops[i]);
  for (const key of ['entry', 'nav', 'active', 'neck']) {
    for (let j = 0; j < frames[i][key].length; j++) {
      assert.ok(Math.abs(sampled[key][j] - frames[i][key][j]) < 1e-6, `frame ${i + 1}, ${key}[${j}]`);
    }
  }
}
assert.ok(frames[1].entry[3] > frames[0].entry[3], 'input rises into a tall drop');
assert.ok(frames[2].entry[2] > frames[1].entry[2], 'input stretches into upper pill');
assert.ok(frames[2].active[2] > frames[1].active[2], 'left lower mass grows to the right');
assert.ok(frames[3].neck[4] > 0, 'two lower shapes join through a narrow neck');
assert.ok(frames[4].neck[3] > frames[3].neck[3], 'the neck swells before settling');
assert.equal(frames[5].nav[2], expanded.w, 'final lower capsule fills the width');
const interrupted = api.sampleDockExpansion(frames, .47);
const resumed = api.dockExpansionFrames(interrupted, expanded);
assert.deepEqual(resumed[0], interrupted, 'an interrupted animation resumes from its current geometry');
assert.deepEqual(api.sampleDockExpansion(resumed, 0), interrupted);

let previous = null;
for (let step = 0; step <= 1000; step++) {
  const current = api.sampleDockExpansion(frames, step / 1000);
  for (const key of ['entry', 'nav', 'active', 'neck', 'entryHtml', 'indicator']) {
    assert.ok(current[key].every(Number.isFinite), `${key} has finite values at ${step}`);
    if (previous) assert.ok(Math.abs(current[key][0] - previous[key][0]) < 6, `${key} jumps horizontally at ${step}`);
  }
  assert.ok(current.buttons.every((button, index) => Math.abs(button[1] - compact.buttons[index][1]) < 1e-6), 'buttons never jump vertically');
  previous = current;
}
console.log('Six dock keyframes and 1,001 interpolated samples passed.');

const collapse = api.dockCollapseFrames(expanded, compact);
const collapseStops = [0, .2, .4, .62, .82, 1];
assert.equal(collapse.length, 6);
for (let i = 0; i < 6; i++) {
  const sampled = api.sampleDockExpansion(collapse, collapseStops[i], collapseStops);
  for (const key of ['entry', 'nav', 'active', 'neck']) {
    for (let j = 0; j < collapse[i][key].length; j++) {
      assert.ok(Math.abs(sampled[key][j] - collapse[i][key][j]) < 1e-6, `collapse frame ${i + 1}, ${key}[${j}]`);
    }
  }
}
assert.ok(collapse[1].active[3] > expanded.active[3], 'lower left mass swells');
assert.ok(collapse[3].neck[4] > 0, 'lower masses retain a thin connection');
assert.equal(collapse[4].neck[4], 0, 'the connection then tears');
assert.ok(collapse[4].entry[0] > collapse[3].entry[0], 'input shifts right while descending');
assert.equal(collapse[5].nav[2], 124, 'final right two-button pill has compact width');
for (let i = 0; i <= 3; i++) {
  const leftEdge = collapse[i].active[0] + collapse[i].active[2];
  const rightEdge = collapse[i].nav[0];
  const bridge = collapse[i].neck;
  assert.ok(rightEdge <= leftEdge || (bridge[4] > 0 && bridge[0] - bridge[2] / 2 < leftEdge && bridge[0] + bridge[2] / 2 > rightEdge), `reverse frame ${i + 1} keeps the lower mass connected`);
}
const interruptedCollapse = api.sampleDockExpansion(collapse, .53, collapseStops);
const resumedCollapse = api.dockCollapseFrames(interruptedCollapse, compact);
assert.deepEqual(resumedCollapse[0], interruptedCollapse, 'reverse animation resumes from the interrupted shape');

previous = null;
for (let step = 0; step <= 1000; step++) {
  const current = api.sampleDockExpansion(collapse, step / 1000, collapseStops);
  for (const key of ['entry', 'nav', 'active', 'neck', 'entryHtml', 'indicator']) {
    assert.ok(current[key].every(Number.isFinite), `collapse ${key} has finite values at ${step}`);
    if (previous) assert.ok(Math.abs(current[key][0] - previous[key][0]) < 6, `collapse ${key} jumps horizontally at ${step}`);
  }
  assert.ok(current.buttons.every((button, index) => Math.abs(button[1] - expanded.buttons[index][1]) < 1e-6), 'collapse buttons never jump vertically');
  previous = current;
}
console.log('Six reverse keyframes and 1,001 interpolated samples passed.');
