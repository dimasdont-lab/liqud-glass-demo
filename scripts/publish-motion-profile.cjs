// Mechanical import of the user's exported Studio profile. Collapse is immutable.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const profile=structuredClone(source),collapse=profile.transitions.collapse;
const reverseCurve=([x1,y1,x2,y2])=>[1-x2,1-y2,1-x1,1-y1];
function reverse(part,total){
 const out=structuredClone(part);
 out.curve=reverseCurve(part.curve);
 out.frames=part.frames.slice().reverse().map(f=>({...structuredClone(f),t:1-f.t}));
 if(total!==undefined)out.delay=total-(part.delay||0)-part.duration;
 return out;
}
const expand=reverse(collapse);
expand.tracks=Object.fromEntries(Object.entries(collapse.tracks).map(([key,part])=>[key,reverse(part,collapse.duration)]));
profile.transitions.expand=expand;
// Resolve independent tracks first: their endpoint sizes override scene frames.
const parts={entry:['entry','entryRim','entryHtml','entryBulge','shine'],active:['active','activeRim'],nav:['nav','navRim'],indicator:['indicator'],neck:['neck','drop','drop2','drop3']};
const expanded=structuredClone(collapse.frames[0].state);
for(const [key,part] of Object.entries(collapse.tracks)){
 for(const field of parts[key]||[])expanded[field]=structuredClone(part.frames[0].state[field]);
 if(key.startsWith('button'))expanded.buttons[+key.slice(6)]=structuredClone(part.frames[0].state.buttons[+key.slice(6)]);
}
for(const name of ['press','more','back']){
 const tr=profile.transitions[name],end=name==='back';
 const fields=Object.keys(expanded).filter(key=>Array.isArray(expanded[key])&&key!=='buttons');
 for(const part of [tr,...Object.values(tr.tracks||{})]){const old=structuredClone(part.frames[end?part.frames.length-1:0].state);for(const f of part.frames){
  const weight=name==='press'?1:end?f.t:1-f.t;
  for(const field of fields)f.state[field]=f.state[field].map((v,i)=>v+(expanded[field][i]-old[field][i])*weight);
  f.state.buttons=f.state.buttons.map((b,j)=>b.map((v,i)=>v+(expanded.buttons[j][i]-old.buttons[j][i])*weight));
  if(name==='press'){for(const field of fields)f.state[field]=structuredClone(expanded[field]);f.state.buttons=structuredClone(expanded.buttons)}
 }}
}
// The single Back drop uses the same thin-row diameter and baseline too.
const compactNav=collapse.tracks.nav.frames.at(-1).state.nav;
for(const name of ['more','back'])for(const part of [profile.transitions[name],...Object.values(profile.transitions[name].tracks||{})]){
 const end=name==='more',old=structuredClone(part.frames[end?part.frames.length-1:0].state),target=structuredClone(old),diameter=expanded.active[3],right=compactNav[0]+compactNav[2];
 for(const field of ['nav','navRim','active','activeRim'])target[field]=[right-diameter,compactNav[1],diameter,diameter,diameter/2,old[field][5]];
 for(const field of ['entryHtml','indicator'])target[field].splice(0,5,right-diameter-14,field==='entryHtml'?compactNav[1]-14:compactNav[1]-64,diameter,diameter,diameter/2);
 target.buttons=target.buttons.map(b=>[right-diameter-14,compactNav[1]-64,diameter,diameter,diameter/2,...b.slice(5)]);
 for(const f of part.frames){const weight=end?f.t:1-f.t;for(const field of ['nav','navRim','active','activeRim','entryHtml','indicator'])f.state[field]=f.state[field].map((v,i)=>v+(target[field][i]-old[field][i])*weight);f.state.buttons=f.state.buttons.map((b,j)=>b.map((v,i)=>v+(target.buttons[j][i]-old.buttons[j][i])*weight))}
}
assert.deepEqual(profile.transitions.collapse,source.transitions.collapse);
fs.writeFileSync('motion-preset.js','/* User-exported profile. Expand exactly reverses the unchanged collapse. */\nwindow.VF_BUNDLED_MOTION_PROFILE='+JSON.stringify(profile)+';\n');
console.log('Imported profile; collapse preserved; expand reversed across all '+Object.keys(expand.tracks).length+' tracks, '+expand.duration+' ms.');
