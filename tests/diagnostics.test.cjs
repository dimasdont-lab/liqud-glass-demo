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
 assert.match(fs.readFileSync('diagnostics.html','utf8'),/studio=1&amp;diagnostic=1/);
});
