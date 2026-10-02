const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('device diagnostics neither writes presets nor exports finance storage',()=>{
 const source=fs.readFileSync('diagnostics.js','utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|send\('save'|send\('preset'/);
 assert.match(source,/e.origin!==location.origin/);assert.match(source,/e.source!==preview.contentWindow/);
 assert.match(source,/navigator.canShare\?\.\(\{files:\[file\]\}\)/);
 assert.match(source,/earlyErrors/);assert.match(fs.readFileSync('diagnostics.html','utf8'),/value="unverified"/);
});
test('early device error recorder is bounded and inactive outside diagnostics',()=>{
 const source=fs.readFileSync('diagnostic-errors.js','utf8');
 function context(search){const handlers={},scope={location:{search},URLSearchParams,window:{},addEventListener:(name,fn)=>handlers[name]=fn};vm.runInNewContext(source,scope);return {scope,handlers}}
 assert.equal(context('').scope.window.VFDiagnosticErrors,undefined);
 const {scope,handlers}=context('?diagnostic=1');for(let i=0;i<100;i++)handlers.error({message:'Test error'});
 assert.equal(scope.window.VFDiagnosticErrors.length,80);assert.equal(scope.window.VFDiagnosticErrors[0].message,'Test error');
});
test('diagnostic iframe bypasses draft migration and provides a visible entry point',()=>{
 assert.match(fs.readFileSync('motion-runtime.js','utf8'),/if\(studio&&!new URLSearchParams\(location.search\).has\('diagnostic'\)/);
 assert.match(fs.readFileSync('motion-editor.html','utf8'),/diagnostics.html\?v=107/);
 assert.match(fs.readFileSync('index.html','utf8'),/diagnostic-trace.js\?v=108/);
 assert.match(fs.readFileSync('diagnostics.html','utf8'),/studio=1&amp;diagnostic=1/);
});
test('transition trace captures intermediate rendered states, blur children, and bounds memory',()=>{
 const source=fs.readFileSync('diagnostic-trace.js','utf8');let time=0;
 const scope={URLSearchParams,location:{search:'?diagnostic=1'},window:{},performance:{now:()=>++time},setTimeout:fn=>fn(),document:{body:{className:'test'},querySelectorAll:()=>[]}};
 vm.runInNewContext(source,scope);const trace=scope.window.VFDiagnosticTrace;
 trace.start({mode:'playback',transition:'collapse'});
 for(let i=0;i<=150;i++)scope.window.VFDiagnosticCapture({progress:i/150});
 const session=trace.snapshot().sessions[0];assert.equal(session.frames.length,120);assert.equal(session.frames[0].progress,0);assert.equal(session.frames.at(-1).progress,1);assert.equal(session.droppedFrames,31);assert.ok(session.frames.some(f=>f.progress>0&&f.progress<1));
 for(let i=0;i<10;i++)trace.start({mode:'live'});assert.equal(trace.snapshot().sessions.length,6);
 assert.match(source,/\.vf-mirror-content/);assert.match(source,/\.vf-mirror-copy/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|textContent|innerHTML/);
 const inactive={...scope,location:{search:''},window:{}};vm.runInNewContext(source,inactive);assert.equal(inactive.window.VFDiagnosticCapture,undefined);
 const runtime=fs.readFileSync('motion-runtime.js','utf8');assert.match(runtime,/transition:popup\|\|name,progress:t/);assert.match(runtime,/transition:kind,progress:p,closing/);assert.match(runtime,/transition:name,progress:t,mode:'live'/);
});
