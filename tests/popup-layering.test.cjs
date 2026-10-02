const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('overlapping panel animations have one background owner and keep transitions disabled until both finish',()=>{
 const source=fs.readFileSync('motion-runtime.js','utf8'),frames=new Map(),classes=new Set();let id=0,now=0,sheetOpen=false;
 const app={style:{}},dock={style:{}},drawer={style:{}},sheet={style:{}};
 const profile={popups:{drawer:{duration:1000,curve:[0,0,1,1]},sheet:{duration:200,curve:[0,0,1,1]}},backdropMotion:{drawer:{pageX:10,pageY:0,pageScale:1,dockScale:1},sheet:{pageX:40,pageY:0,pageScale:.9,dockScale:1,drawerX:-20,drawerScale:.95}}};
 const context={profile,window:{},performance:{now:()=>now},ease:t=>t,popupStyle:(el,kind,t)=>el.progress=t,requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:key=>frames.delete(key),document:{body:{classList:{contains:()=>true}},documentElement:{classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}},querySelector:s=>s==='.sheet-backdrop.open'?(sheetOpen?sheet:null):s==='.profile-drawer'?drawer:s==='.bottom-zone'?dock:app}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function backdropStyle('),source.indexOf('openSheet=function'))+';this.api={popupRun,cancelPopupPlayback};',context);
 const tick=t=>{now=t;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t))};
 context.api.popupRun(drawer,'drawer',false);tick(500);assert.match(app.style.transform,/translate3d\(5px/);
 sheetOpen=true;context.api.popupRun(sheet,'sheet',false);tick(700);
 assert.match(app.style.transform,/40px/);assert.equal(classes.has('vf-popup-motion'),true,'drawer is still animating');
 tick(900);assert.match(app.style.transform,/40px/,'drawer cannot steal the sheet background');
 tick(1000);assert.equal(classes.has('vf-popup-motion'),false);assert.equal(frames.size,0);
 assert.equal(drawer.style.translate,'-20px 0px');assert.equal(drawer.style.scale,'0.95');
});
