import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Vector3} from 'three';
async function moduleUrl(file,dependencies={}){
 let source=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [name,url] of Object.entries(dependencies))source=source.replaceAll(`'${name}'`,JSON.stringify(url));
 return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const modelUrl=await moduleUrl('./model.ts');
const {emptyPlan,validatePlan,buildingFromPlan,validateBuilding,addFloor,furnitureCatalog}=await import(modelUrl);
const heightsUrl=await moduleUrl('./furnitureHeights.ts');
const {personView,personDimensions,withoutObserver}=await import(await moduleUrl('./personView.ts',{'./furnitureHeights':heightsUrl}));
const {buildingVolumes}=await import(await moduleUrl('./model3d.ts',{'./model':modelUrl}));
const {createPersonCamera}=await import(await moduleUrl('./PersonCamera.ts',{'three':import.meta.resolve('three')}));
const person=(extra={})=>({id:'person',...furnitureCatalog.find(f=>f.kind==='person'),x:3,y:4,rotation:0,...extra});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function surface(){
 const listeners=new Map(),captured=new Set();
 return {style:{cursor:'default'},focused:false,listeners,captured,
  addEventListener(n,h){listeners.set(n,h);},removeEventListener(n,h){assert.equal(listeners.get(n),h);listeners.delete(n);},
  setPointerCapture(id){captured.add(id);},hasPointerCapture(id){return captured.has(id);},releasePointerCapture(id){captured.delete(id);},focus(){this.focused=true;},
  fire(n,props={}){const event={isPrimary:true,button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){this.prevented=true;},...props};listeners.get(n)?.(event);return event;}
 };
}
test('people persist through local files and floor copies with stature, orientation, elevation and appearance',()=>{
 const item=person({height:1.82,elevation:.2,rotation:215,groupId:'family',appearance:{color:'#7297ab',finish:'paint'}});
 const building=addFloor(buildingFromPlan(validatePlan({...emptyPlan(),furniture:[item]})),'Alta','copy');
 const restored=validateBuilding(JSON.parse(JSON.stringify(building)));
 assert.deepEqual(restored,building);assert.equal(restored.floors[1].plan.furniture[0].height,1.82);
 assert.equal(restored.floors[1].plan.furniture[0].rotation,215);assert.equal(restored.floors[1].plan.furniture[0].groupId,'family');
});
test('stature limits reject corrupt people but do not constrain other furniture',()=>{
 for(const height of [.49,2.51,NaN,Infinity,null,'1.7'])assert.throws(()=>validatePlan({...emptyPlan(),furniture:[person({height})]}));
 for(const height of [.5,1.7,2.5,undefined])assert.equal(validatePlan({...emptyPlan(),furniture:[person({height})]}).furniture.length,1);
 assert.equal(validatePlan({...emptyPlan(),furniture:[person({kind:'tree',height:20})]}).furniture[0].height,20);
 for(const height of [.5,1.7,2.5])assert.ok(Object.values(personDimensions(height)).every(n=>n>=.2&&n<=10));
 close(personDimensions(1.7).width,.6);close(personDimensions(1.7).depth,.4);
});
test('eye position includes floor and elevation; initial direction matches rotated plan arrow',()=>{
 for(const rotation of [0,90,180,270,33]){
  const view=personView(person({height:1.8,elevation:.25,rotation}),3.2),ui=surface(),controller=createPersonCamera(ui,()=>{});
  controller.set(view);assert.deepEqual(controller.camera.position.toArray(),[3,3.2+.25+1.8*.93,4]);
  close(view.eyeHeight,.25+1.8*.93);
  const direction=controller.camera.getWorldDirection(new Vector3());close(direction.x,-Math.sin(rotation*Math.PI/180));close(direction.z,Math.cos(rotation*Math.PI/180));close(direction.y,0);controller.dispose();
 }
 close(personView(person(),0).eyeHeight,1.7*.93);
});
test('only the active observer body is hidden, including projects with repeated IDs across floors',()=>{
 const b=addFloor(buildingFromPlan(validatePlan({...emptyPlan(),furniture:[person(),person({id:'other'})]})),'Alta','copy');
 const model=buildingVolumes(b,{scope:'all',slabs:true,roofs:true}),before=JSON.stringify(model);
 const filtered=withoutObserver(model,{floorId:model[0].id,elementId:'person'});
 assert.deepEqual(filtered[0].furniture.map(f=>f.id),['other']);assert.equal(filtered[1].furniture.length,2);assert.equal(JSON.stringify(model),before);assert.equal(withoutObserver(model,null),model);
});
test('looking stays at a fixed position, clamps pitch/FOV and resets to the person orientation',()=>{
 const ui=surface(),controller=createPersonCamera(ui,()=>{});controller.set(personView(person({rotation:90}),0));const origin=controller.camera.position.clone();
 controller.look(2,100);assert.deepEqual(controller.camera.position,origin);assert.ok(controller.camera.getWorldDirection(new Vector3()).y<.99);
 controller.zoom(100);assert.equal(controller.camera.fov,35);controller.zoom(.001);assert.equal(controller.camera.fov,95);
 controller.resize(2);assert.equal(controller.camera.aspect,2);controller.reset();assert.equal(controller.camera.fov,65);close(controller.camera.getWorldDirection(new Vector3()).x,-1);controller.dispose();
});
test('mouse/touch and keyboard look work only when active and release capture/listeners',()=>{
 const ui=surface();let renders=0;const controller=createPersonCamera(ui,()=>renders++);
 ui.fire('pointerdown');ui.fire('keydown',{key:'ArrowRight'});assert.equal(renders,0);
 controller.set(personView(person(),0));ui.fire('pointerdown');assert.ok(ui.focused);assert.ok(ui.captured.has(1));
 const origin=controller.camera.position.clone();ui.fire('pointermove',{pointerId:2,clientX:150});close(controller.camera.getWorldDirection(new Vector3()).x,0);
 ui.fire('pointermove',{clientX:150});assert.ok(controller.camera.getWorldDirection(new Vector3()).x<0);assert.deepEqual(controller.camera.position,origin);
 ui.fire('pointercancel');assert.equal(ui.captured.size,0);
 assert.ok(ui.fire('keydown',{key:'ArrowUp'}).prevented);assert.ok(controller.camera.getWorldDirection(new Vector3()).y>0);
 assert.equal(ui.fire('keydown',{key:'ArrowUp',ctrlKey:true}).prevented,undefined);
 ui.fire('keydown',{key:'Home'});close(controller.camera.getWorldDirection(new Vector3()).y,0);
 ui.fire('pointerdown');controller.set(null);assert.equal(ui.captured.size,0);assert.equal(ui.style.cursor,'default');const count=renders;ui.fire('keydown',{key:'ArrowRight'});controller.look(1,1);assert.equal(renders,count);
 controller.dispose();assert.equal(ui.listeners.size,0);
});
