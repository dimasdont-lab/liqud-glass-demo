const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('webgl-glass.js','utf8');
test('WebGL backend is confined to Studio and does not overwrite presets',()=>{
 const scope={URLSearchParams,location:{search:''},window:{}};vm.runInNewContext(source,scope);assert.equal(scope.window.VFMirror,undefined);
 assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB/);
 assert.match(source,/getContext\('webgl'/);assert.equal((source.match(/getContext\('webgl'/g)||[]).length,1);
 assert.match(source,/legacy.suspend\?\.\(\)/);
});
test('reference refraction samples a refreshed HTML texture, not copied DOM glass',()=>{
 assert.match(source,/html2canvas\(node/);assert.match(source,/pending.canvas=canvas/);assert.match(source,/getBoundingClientRect\(\)/);
 assert.match(source,/pow\(1\.-t,2\.2\)\*\.6\*m/);assert.match(source,/sdRB/);
 assert.match(source,/ignoreElements:ignored/);assert.match(source,/\.vf-webgl-glass/);
 assert.match(source,/characterData:true/);assert.match(source,/node.addEventListener\('input'/);assert.match(source,/node.addEventListener\('scroll'/);
 assert.match(source,/panelRank\(node\)\?node.offsetHeight/);
});
test('Gaussian blur, surface clipping, and panel ordering share the existing pipeline',()=>{
 assert.match(source,/for\(let i=0;i<2;i\+\+\)/);assert.match(source,/blurTargets.size>=10/);assert.match(source,/gl.deleteFramebuffer/);
 assert.match(source,/refracted-mass.xy\)\/u_scale/);assert.match(source,/record.blur\*dpr\/record.scale/);
 assert.match(source,/a.rank-b.rank\|\|a.order-b.order/);assert.match(source,/compositeDock\(dockSurface\)/);
 const runtime=fs.readFileSync('motion-runtime.js','utf8');assert.match(runtime,/shapes:\[s.active,s.nav\],zone/);
 assert.match(runtime,/shapes:\[\[0,0,w,h,Math.max\(\.\.\.corners\),1\]\],zone/);
 const html=fs.readFileSync('index.html','utf8');assert.ok(html.indexOf('mirror-runtime.js')<html.indexOf('webgl-glass.js'));assert.ok(html.indexOf('webgl-glass.js')<html.indexOf('motion-runtime.js'));
});
