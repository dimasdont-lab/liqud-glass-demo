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
assert.deepEqual(profile.transitions.collapse,source.transitions.collapse);
fs.writeFileSync('motion-preset.js','/* User-exported profile. Expand exactly reverses the unchanged collapse. */\nwindow.VF_BUNDLED_MOTION_PROFILE='+JSON.stringify(profile)+';\n');
console.log('Imported profile; collapse preserved; expand reversed across all '+Object.keys(expand.tracks).length+' tracks, '+expand.duration+' ms.');
