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
const api = vm.runInNewContext(`${source}\n({dockLiquidTargets,dockExpansionFrames,dockCollapseFrames,sampleDockExpansion,getDockCanonicalMorph,rejoinDockMorph,liquidEase})`, context);
const compact = api.dockLiquidTargets('compact');
const expanded = api.dockLiquidTargets('expanded');
const frames = api.getDockCanonicalMorph('compact', 'expanded');
const stops = [0, .18, .39, .61, .80, 1];
assert.strictEqual(api.getDockCanonicalMorph('compact', 'expanded'), frames, 'every complete expansion reuses the same keyframes');

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
assert.equal(frames[4].active[0], expanded.active[0], 'left mass stays anchored after joining');
assert.equal(frames[4].active[2], expanded.w, 'left mass covers the whole row before fading');
assert.equal(frames[4].active[5], 1, 'left mass remains visible until the right mass has filled it');
assert.equal(frames[4].nav[0], expanded.nav[0], 'right mass reaches the left edge underneath the left mass');
assert.equal(frames[4].nav[2], expanded.w, 'right mass reaches full width before the handoff');
assert.equal(frames[5].nav[2], expanded.w, 'final lower capsule fills the width');
const interrupted = api.sampleDockExpansion(frames, .47);
const resumed = api.dockExpansionFrames(interrupted, expanded);
assert.deepEqual(resumed[0], interrupted, 'an interrupted animation resumes from its current geometry');
assert.deepEqual(api.sampleDockExpansion(resumed, 0), interrupted);
assert.deepEqual(api.rejoinDockMorph(frames[0], interrupted, frames[0], 1), interrupted, 'interruption starts at the live shape');
assert.strictEqual(api.rejoinDockMorph(frames[2], interrupted, frames[0], 0), frames[2], 'interruption rejoins the fixed path');
for (let i = 0; i < interrupted.buttons.length; i++) {
  const expected = interrupted.buttons[i][0] + (expanded.buttons[i][0] - interrupted.buttons[i][0]) * .22;
  assert.ok(Math.abs(resumed[1].buttons[i][0] - expected) < 1e-6, `resumed button ${i} uses the live position`);
}

let previous = null;
for (let step = 0; step <= 1000; step++) {
  const current = api.sampleDockExpansion(frames, step / 1000);
  for (const key of ['entry', 'nav', 'active', 'neck', 'entryHtml', 'indicator']) {
    assert.ok(current[key].every(Number.isFinite), `${key} has finite values at ${step}`);
    if (previous) assert.ok(Math.abs(current[key][0] - previous[key][0]) < 6, `${key} jumps horizontally at ${step}`);
  }
  if (current.active[5] < .99) {
    assert.ok(Math.abs(current.nav[0] - expanded.nav[0]) < 1e-6, `right mass is anchored before left fades at ${step}`);
    assert.ok(Math.abs(current.nav[2] - expanded.w) < 1e-6, `right mass already fills row before left fades at ${step}`);
  }
  if (previous) {
    assert.ok(current.active[2] >= previous.active[2] - 1e-6, `left mass does not retract before joining at ${step}`);
    assert.ok(current.nav[0] <= previous.nav[0] + 1e-6, `right mass never shoots back right at ${step}`);
  }
  assert.ok(current.buttons.every((button, index) => Math.abs(button[1] - compact.buttons[index][1]) < 1e-6), 'buttons never jump vertically');
  previous = current;
}
console.log('Six dock keyframes and 1,001 interpolated samples passed.');

const collapse = api.getDockCanonicalMorph('expanded', 'compact');
const collapseStops = [0, .2, .4, .62, .82, 1];
assert.strictEqual(api.getDockCanonicalMorph('expanded', 'compact'), collapse, 'every complete collapse reuses the same keyframes');
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
for (let i = 0; i < interruptedCollapse.buttons.length; i++) {
  const expected = interruptedCollapse.buttons[i][0] + (compact.buttons[i][0] - interruptedCollapse.buttons[i][0]) * .16;
  assert.ok(Math.abs(resumedCollapse[1].buttons[i][0] - expected) < 1e-6, `reverse button ${i} uses the live position`);
}
const reversedMidFlight = api.dockCollapseFrames(interrupted, compact);
assert.deepEqual(reversedMidFlight[0], interrupted, 'changing direction keeps the exact current shape');
const expandedAgain = api.dockExpansionFrames(interruptedCollapse, expanded);
assert.deepEqual(expandedAgain[0], interruptedCollapse, 'reverse direction also keeps the current shape');

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
