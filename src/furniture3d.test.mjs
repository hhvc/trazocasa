import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Group,Matrix4,Vector3,Box3,Color,Raycaster} from 'three';
const urls=new Map();
async function moduleUrl(file,dependencies={}){
 let source=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [name,url] of Object.entries(dependencies))source=source.replaceAll(`'${name}'`,JSON.stringify(url));
 const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;urls.set(file,url);return url;
}
const modelUrl=await moduleUrl('./model.ts');
const {emptyPlan,validatePlan,validateBuilding,buildingFromPlan,addFloor,floorLevels,furnitureCatalog,furnitureCorners}=await import(modelUrl);
const heightsUrl=await moduleUrl('./furnitureHeights.ts');
const {isFurniture3D,furnitureHeight}=await import(heightsUrl);
const partsUrl=await moduleUrl('./furniture3d.ts');
const {furnitureParts}=await import(partsUrl);
const volumesUrl=await moduleUrl('./model3d.ts',{'./model':modelUrl});
const {buildingVolumes}=await import(volumesUrl);
const appearanceUrl=await moduleUrl('./appearance.ts'),finishesUrl=await moduleUrl('./finishMaterials.ts',{'three':import.meta.resolve('three')});
const sceneUrl=await moduleUrl('./FurnitureScene.ts',{'three':import.meta.resolve('three'),'./furniture3d':partsUrl,'./furnitureHeights':heightsUrl,'./model3d':volumesUrl,'./appearance':appearanceUrl,'./finishMaterials':finishesUrl});
const {addFurnitureScene,furnitureMatrix,selectionFromIntersection}=await import(sceneUrl);
const options={scope:'all',slabs:true,roofs:true};
const item=(kind='bed',extra={})=>({id:'item',...furnitureCatalog.find(i=>i.kind===kind),x:0,y:0,rotation:0,...extra});
const project=(items)=>buildingFromPlan(validatePlan({...emptyPlan(),furniture:items}));
function scene(building,opts=options){const group=new Group(),api=addFurnitureScene(group,buildingVolumes(building,opts));group.updateMatrixWorld(true);return {group,...api};}
function dispose(group){const geometry=new Set(),materials=new Set();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} ≠ ${b}`);

test('all supported catalog objects produce finite geometry within their 2D footprints and total heights',()=>{
 assert.equal(furnitureCatalog.filter(f=>isFurniture3D(f.kind)).length,30);
 for(const f of furnitureCatalog.filter(f=>isFurniture3D(f.kind))){
  const source=item(f.kind,{width:1,depth:1,height:1});
  assert.deepEqual(furnitureParts(f.kind),furnitureParts(f.kind));
  const s=scene(project([source]));assert.ok(s.selectable.length>0,f.kind);
  // Test actual vertices, not a transformed box (which overestimates rotated round parts).
  const bounds=new Box3(),m=new Matrix4(),v=new Vector3();
  for(const mesh of s.selectable){const pos=mesh.geometry.getAttribute('position');for(let n=0;n<mesh.count;n++){mesh.getMatrixAt(n,m);for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);assert.ok(v.toArray().every(Number.isFinite),f.kind);bounds.expandByPoint(v);}}}
  assert.ok(bounds.min.x>=-.50001&&bounds.max.x<=.50001&&bounds.min.z>=-.50001&&bounds.max.z<=.50001,`${f.kind} footprint ${bounds.min.toArray()} / ${bounds.max.toArray()}`);
  assert.ok(bounds.min.y>=-.00001&&bounds.max.y<=1.00001,`${f.kind} height ${bounds.min.y} / ${bounds.max.y}`);
  dispose(s.group);
 }
});
test('furniture transforms agree with plan rotation, dimensions and elevated upper floors',()=>{
 for(const rotation of [0,30,90,180,270,359]){
  const f=item('table',{x:7,y:-4,width:2,depth:1,height:1.1,elevation:.65,rotation});
  const m=furnitureMatrix(f,3.2),corners=furnitureCorners(f),local=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  for(let i=0;i<local.length;i++){const p=new Vector3(local[i][0],0,local[i][1]).applyMatrix4(m);close(p.x,corners[i].x);close(p.z,corners[i].y);close(p.y,3.85);}
  close(new Vector3(0,1,0).applyMatrix4(m).y,4.95);
 }
});
test('height and base elevation persist through local JSON and copying floors without changing level calculation',()=>{
 const original=project([item('tv',{height:.9,elevation:1.2,groupId:'living'})]);
 const copy=addFloor(original,'Alta','copy');
 const checked=validateBuilding(JSON.parse(JSON.stringify(copy)));
 assert.deepEqual(checked,copy);assert.deepEqual(checked.floors[1].plan.furniture,original.floors[0].plan.furniture);
 const tall=project([item('tree',{height:20,elevation:20})]);
 assert.deepEqual(floorLevels(addFloor(tall,'Alta','copy')),floorLevels(addFloor(project([]),'Alta','copy')));
 const legacy=project([item()]);assert.equal(Object.hasOwn(legacy.floors[0].plan.furniture[0],'height'),false);assert.equal(furnitureHeight(legacy.floors[0].plan.furniture[0]),.9);
});
test('invalid furniture heights and elevations are rejected without altering the project',()=>{
 const p=project([item()]).floors[0].plan,before=JSON.stringify(p);
 for(const height of [null,NaN,Infinity,'1',0,.099,20.01])assert.throws(()=>validatePlan({...p,furniture:[{...p.furniture[0],height}]}));
 for(const elevation of [null,NaN,Infinity,'1',-.01,20.01])assert.throws(()=>validatePlan({...p,furniture:[{...p.furniture[0],elevation}]}));
 assert.equal(JSON.stringify(p),before);
});
test('visibility, active-floor scope and 2D-only stairs exclude furniture from geometry and picking',()=>{
 let b=project([item(),item('stairs',{id:'stairs'}),item('stairLanding',{id:'landing'})]);b=addFloor(b,'Alta','copy');
 const all=buildingVolumes(b,options);assert.deepEqual(all.map(f=>f.furniture.length),[1,1]);
 const active=buildingVolumes(b,{...options,scope:'active'});assert.equal(active.length,1);assert.equal(active[0].id,b.activeFloorId);
 const hidden=scene(b,{...options,furniture:false});assert.equal(hidden.selectable.length,0);assert.equal(hidden.group.children.length,0);
});
test('raycasting and highlight distinguish repeated IDs on separate floors, then restore original colors',()=>{
 let b=addFloor(project([item('table')]),'Alta','copy');b={...b,floors:b.floors.map((f,i)=>({...f,elevation:i*4}))};
 const s=scene(b),ray=new Raycaster(new Vector3(0,10,0),new Vector3(0,-1,0));
 const selected={floorId:b.activeFloorId,elementId:'item'};
 assert.deepEqual(selectionFromIntersection(ray.intersectObjects(s.selectable,false)[0]),selected);
 const mesh=s.selectable.find(m=>m.userData.selections.some(p=>p.floorId===b.activeFloorId));
 const low=mesh.userData.selections.findIndex(p=>p.floorId===b.floors[0].id),high=mesh.userData.selections.findIndex(p=>p.floorId===b.activeFloorId);
 const original=mesh.getColorAt(high,new Color()).clone(),other=mesh.getColorAt(low,new Color()).clone();
 s.setSelected(selected);assert.notDeepEqual(mesh.getColorAt(high,new Color()),original);assert.deepEqual(mesh.getColorAt(low,new Color()),other);
 s.setSelected(null);assert.deepEqual(mesh.getColorAt(high,new Color()),original);assert.equal(selectionFromIntersection(undefined),null);dispose(s.group);
});
test('500 items share a bounded number of render batches',()=>{
 const supported=furnitureCatalog.filter(f=>isFurniture3D(f.kind));
 const s=scene(project(Array.from({length:500},(_,i)=>item(supported[i%supported.length].kind,{id:'f'+i,x:(i%25)*6,y:Math.floor(i/25)*6}))));
 assert.ok(s.selectable.length<=4);assert.ok(s.group.children.length<=5);assert.equal(new Set(s.selectable.map(m=>m.material)).size,1);
 assert.ok(s.selectable.reduce((n,m)=>n+m.count,0)>500);dispose(s.group);
});

const walkingUrl=await moduleUrl('./WalkingPerson.ts',{'three':import.meta.resolve('three'),'./furniture3d':partsUrl,'./furnitureHeights':heightsUrl,'./FurnitureScene':sceneUrl,'./finishMaterials':finishesUrl});
const {createWalkingPerson}=await import(walkingUrl),{createFinishLibrary}=await import(finishesUrl);
test('articulated crouching matches collision height, keeps feet above the floor and reuses resources',()=>{
 const finishes=createFinishLibrary(),actor=createWalkingPerson(item('person',{height:1.7}),finishes),geometries=new Set(),materials=new Set();actor.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
 for(const crouched of [false,true])for(const distance of [0,.12,.45,1]){actor.pose(distance,true,crouched,false);actor.root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(actor.root);assert.ok(bounds.min.y>=-.00001);close(bounds.max.y,1.7*(crouched?.7:1));}
 actor.pose(0,false,false,true);actor.root.updateMatrixWorld(true);assert.ok(new Box3().setFromObject(actor.root).min.y>=0);
 const again=new Set();actor.root.traverse(o=>{if(o.geometry)again.add(o.geometry);});assert.deepEqual(again,geometries);
 let disposed=0;for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>disposed++);actor.dispose();assert.equal(disposed,geometries.size+materials.size);finishes.dispose();
});
