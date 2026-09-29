const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const buttons=['goals','insights','debts','home','more'].map(screen=>({style:{},dataset:{screen},classList:{contains:()=>screen==='home'}}));
const node={clientWidth:420,setAttribute(){},style:{setProperty(){}},classList:{remove(){},toggle(){}}};
const context={console,URLSearchParams,location:{search:'?studio=1',origin:'http://localhost'},localStorage:{getItem(){return null}},window:{},parent:{postMessage(){}},document:{querySelector:()=>node,querySelectorAll:s=>s.includes('button')?buttons:[],documentElement:node},setTimeout(){},addEventListener(){},animateDockLiquid(){},openSheet(){},closeSheet(){}};
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('const liquidMix='),html.indexOf('function animateDockLiquid(mode)')),context);
vm.runInContext(fs.readFileSync('motion-runtime.js','utf8'),context);
const api=context.window.VFMotion,p=api.defaults();api.validate(p);
for(const name of Object.keys(p.transitions)){
 for(let i=0;i<=100;i++){const s=api.sample(name,i/100);for(const a of Object.values(s).filter(Array.isArray)){const nums=a.flat();assert.ok(nums.every(Number.isFinite),name+' finite')}}
 for(const f of p.transitions[name].frames){const s=api.sample(name,f.t);assert.ok(Math.abs(s.entry[3]-f.state.entry[3])<.0001,'key time matches exact geometry')}
}
const round=JSON.parse(JSON.stringify(p));assert.deepEqual(api.validate(round),api.validate(p));
const bad=JSON.parse(JSON.stringify(p));bad.transitions.expand.frames[1].t=0;assert.throws(()=>api.validate(bad));
const invalid=JSON.parse(JSON.stringify(p));invalid.transitions.expand.frames[0].state.nav[0]=null;assert.throws(()=>api.validate(invalid));
for(let i=0;i<=100;i++){const v=api.ease(i/100,[.42,0,.58,1]);assert.ok(v>=0&&v<=1)}
console.log('Motion Studio: five transitions, 505 finite samples, exact key positions, JSON round trip and invalid import checks passed.');
