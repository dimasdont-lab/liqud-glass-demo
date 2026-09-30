const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const buttons=['goals','insights','debts','home','more'].map(screen=>({style:{},dataset:{screen},classList:{contains:()=>screen==='home'}}));
const node={clientWidth:420,attributes:{},setAttribute(k,v){this.attributes[k]=v},style:{setProperty(k,v){this[k]=v}},classList:{remove(){},toggle(){}}};
const context={console,URLSearchParams,location:{search:'?studio=1',origin:'http://localhost'},localStorage:{getItem(){return null}},window:{},parent:{postMessage(){}},document:{body:{classList:{add(){}}},querySelector:()=>node,querySelectorAll:s=>s.includes('button')?buttons:[],documentElement:node},setTimeout(){},addEventListener(){},animateDockLiquid(){},openSheet(){},closeSheet(){}};
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('const liquidMix='),html.indexOf('function animateDockLiquid(mode)')),context);
vm.runInContext(fs.readFileSync('motion-runtime.js','utf8'),context);
const api=context.window.VFMotion,p=api.defaults();api.validate(p);
for(const name of Object.keys(p.transitions)){
 for(let i=0;i<=100;i++){const s=api.sample(name,i/100);for(const a of Object.values(s).filter(Array.isArray)){const nums=a.flat();assert.ok(nums.every(Number.isFinite),name+' finite')}}
 for(const f of p.transitions[name].frames){const s=api.sample(name,f.t);assert.ok(Math.abs(s.entry[3]-f.state.entry[3])<.0001,'key time matches exact geometry')}
}
const round=JSON.parse(JSON.stringify(p));assert.deepEqual(api.validate(round),api.validate(p));
const legacyMaterial=JSON.parse(JSON.stringify(p));legacyMaterial.material.indicator='#202124';delete legacyMaterial.indicatorMaterial;const migrated=api.validate(legacyMaterial);assert.equal(migrated.indicatorMaterial.color,'#202124');assert.equal(Object.hasOwn(migrated.material,'indicator'),false,'indicator material is separate from shared glass');
const oldBorder=JSON.parse(JSON.stringify(p));delete oldBorder.material.borderHorizontal;delete oldBorder.material.borderVertical;oldBorder.material.border=2.5;const borderMigrated=api.validate(oldBorder);assert.equal(borderMigrated.material.borderHorizontal,2.5);assert.equal(borderMigrated.material.borderVertical,2.5);
const directionalBorder=JSON.parse(JSON.stringify(p));directionalBorder.material.borderHorizontal=3;directionalBorder.material.borderVertical=.3;directionalBorder.material.borderFade=.65;directionalBorder.material.borderFadeSpan=20;assert.equal(api.validate(directionalBorder).material.borderVertical,.3,'thin side border remains independently editable');api.set(directionalBorder);assert.equal(node.attributes.radius,'0.3 3','liquid outline uses horizontal/vertical erosion radii');assert.equal(node.style['--dock-glass-border'],'3px');assert.equal(node.style['--dock-glass-border-x'],'0.3px','entry outline uses the same directional thickness');assert.match(node.style.maskImage,/rgba\(0,0,0,0.35\)/,'side fade reaches the outline layer');
const oldBlur=JSON.parse(JSON.stringify(p));delete oldBlur.radialBlur;oldBlur.material.blur=10;const blurMigrated=api.validate(oldBlur);assert.deepEqual(JSON.parse(JSON.stringify(blurMigrated.radialBlur)),{center:10,middle:16,edge:26,innerStop:50,outerStop:90,feather:6});
const oldEnvironment=JSON.parse(JSON.stringify(p));delete oldEnvironment.environment;assert.deepEqual(JSON.parse(JSON.stringify(api.validate(oldEnvironment).environment)),{topHeight:10,topBlur:16,topShade:.2,dockShade:.22,drawerShade:.38,sheetShade:.38});
const invalidEnvironment=JSON.parse(JSON.stringify(p));invalidEnvironment.environment.topShade=1.1;assert.throws(()=>api.validate(invalidEnvironment));
assert.match(html,/\.bottom-zone\{[^}]*background:transparent/,'dock container has no bottom vignette');
const staleMaterial=api.upgradeTracks(JSON.parse(JSON.stringify(p)));staleMaterial.transitions.expand.frames[0].state.material={opacity:.1};staleMaterial.transitions.expand.tracks.entry.frames[0].state.material={blur:99};const normalized=api.validate(staleMaterial);assert.equal(Object.hasOwn(normalized.transitions.expand.frames[0].state,'material'),false,'global material cannot remain in transition keyframes');assert.equal(Object.hasOwn(normalized.transitions.expand.tracks.entry.frames[0].state,'material'),false,'global material cannot remain in element keyframes');
const bad=JSON.parse(JSON.stringify(p));bad.transitions.expand.frames[1].t=0;assert.throws(()=>api.validate(bad));
const invalid=JSON.parse(JSON.stringify(p));invalid.transitions.expand.frames[0].state.nav[0]=null;assert.throws(()=>api.validate(invalid));
for(let i=0;i<=100;i++){const v=api.ease(i/100,[.42,0,.58,1]);assert.ok(v>=0&&v<=1)}
console.log('Motion Studio: five transitions, 505 finite samples, exact key positions, JSON round trip and invalid import checks passed.');
const upgraded=api.upgradeTracks(p);api.validate(upgraded);api.set(upgraded);
const baseline=Array.from({length:101},(_,i)=>api.sample('expand',i/100));
const edit=JSON.parse(JSON.stringify(upgraded));
edit.transitions.expand.tracks.entry.frames[2].state.entry[3]+=25;
edit.transitions.expand.tracks.entry.frames[2].t=.47;
edit.transitions.expand.tracks.entry.duration=600;
edit.transitions.expand.tracks.entry.delay=100;
api.set(edit);
for(let i=0;i<=100;i++){const s=api.sample('expand',i/100);assert.deepEqual(s.buttons,baseline[i].buttons,'entry edit cannot change buttons');assert.deepEqual(s.nav,baseline[i].nav,'entry edit cannot change capsule');assert.deepEqual(s.indicator,baseline[i].indicator,'entry edit cannot change indicator')}
assert.deepEqual(api.sample('expand',0).entry,api.sample('expand',.08).entry,'delay holds starting form');
assert.deepEqual(api.sample('expand',.7).entry,api.sample('expand',1).entry,'finished element holds ending form');
assert.notDeepEqual(api.sample('expand',.35).entry,baseline[35].entry,'entry animation changes');
assert.equal(JSON.stringify(api.upgradeTracks(edit)),JSON.stringify(edit),'migration preserves edited tracks');
const invalidTrack=JSON.parse(JSON.stringify(edit));invalidTrack.transitions.expand.tracks.entry.frames[2].t=0;assert.throws(()=>api.validate(invalidTrack));
console.log('Independent tracks: isolated geometry/timing, delay/end holds, migration and validation passed.');
