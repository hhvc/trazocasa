import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Group,Matrix4,Vector3,Box3,Color,Raycaster,Mesh,MeshBasicMaterial} from 'three';
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
const partsUrl=await moduleUrl('./furniture3d.ts',{'./stairGeometry':await moduleUrl('./stairGeometry.ts')});
const {furnitureParts}=await import(partsUrl);
const volumesUrl=await moduleUrl('./model3d.ts',{'./model':modelUrl});
const {buildingVolumes}=await import(volumesUrl);
const appearanceUrl=await moduleUrl('./appearance.ts'),finishesUrl=await moduleUrl('./finishMaterials.ts',{'three':import.meta.resolve('three')});
const vehicleUrl=await moduleUrl('./vehicle.ts'),{driverSeat}=await import(vehicleUrl);
const sceneUrl=await moduleUrl('./FurnitureScene.ts',{'./vehicle':vehicleUrl,'three':import.meta.resolve('three'),'./furniture3d':partsUrl,'./furnitureHeights':heightsUrl,'./model3d':volumesUrl,'./appearance':appearanceUrl,'./finishMaterials':finishesUrl});
const {addFurnitureScene,furnitureMatrix,wheelPartMatrix,unitGeometry,selectionFromIntersection}=await import(sceneUrl);
const options={scope:'all',slabs:true,roofs:true};
const item=(kind='bed',extra={})=>({id:'item',...furnitureCatalog.find(i=>i.kind===kind),x:0,y:0,rotation:0,...extra});
const project=(items)=>buildingFromPlan(validatePlan({...emptyPlan(),furniture:items}));
function scene(building,opts=options){const group=new Group(),api=addFurnitureScene(group,buildingVolumes(building,opts));group.updateMatrixWorld(true);return {group,...api};}
function dispose(group){const geometry=new Set(),materials=new Set();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} ≠ ${b}`);

test('all supported catalog objects produce finite geometry within their 2D footprints and total heights',()=>{
 assert.equal(furnitureCatalog.filter(f=>isFurniture3D(f.kind)).length,32);
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
 assert.ok(s.selectable.length<=5);assert.ok(s.group.children.length<=6);assert.equal(new Set(s.selectable.map(m=>m.material)).size,2);
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

test('configured stairs use actual rise for treads, retain direction and remain selectable on upper floors',()=>{
 for(const height of [.4,1.5,3.2]){
  const source=item('stairs',{height,elevation:.7,rotation:90,width:1.2,depth:4}),s=scene(project([source]));
  const mesh=s.selectable[0],n=Math.ceil(height/.18),matrix=new Matrix4(),p=new Vector3();assert.equal(mesh.count,n);
  for(let i=0;i<n;i++){mesh.getMatrixAt(i,matrix);p.set(0,.5,0).applyMatrix4(matrix);close(p.y,.7+height*(i+1)/n);close(p.x,-2+(i+.5)*4/n);close(p.z,0);assert.equal(mesh.userData.selections[i].elementId,source.id);}
  dispose(s.group);
 }
});
test('stairs and landing heights round trip and old symbols remain opt-in',()=>{
 const items=[item('stairs',{height:1.5,elevation:0}),item('stairLanding',{id:'rest',height:.2,elevation:1.3}),item('stairs',{id:'second',height:1.5,elevation:1.5})],b=project(items);
 assert.deepEqual(validateBuilding(JSON.parse(JSON.stringify(b))),b);assert.equal(buildingVolumes(b,options)[0].furniture.length,3);
 assert.equal(buildingVolumes(project([item('stairs')]),options)[0].furniture.length,0);
});

test('climbing bends knees and raises arms without exceeding the standing head clearance',()=>{
 const finishes=createFinishLibrary(),actor=createWalkingPerson(item('person',{height:1.7}),finishes);
 for(const phase of [0,.1,.3,.5,.8,1]){actor.pose(0,false,false,false,phase);actor.root.updateMatrixWorld(true);const box=new Box3().setFromObject(actor.root);assert.ok(box.min.y>=-.00001);assert.ok(box.max.y<=1.70001);}
 actor.dispose();finishes.dispose();
});

test('temporary car transforms update instances, outlines, picking and restore without mutating the project',()=>{
 const car=item('smallCar'),b=project([car]),before=JSON.stringify(b),s=scene(b),selection={floorId:b.floors[0].id,elementId:car.id};
 const original=s.selectable.map(mesh=>Array.from(mesh.instanceMatrix.array));
 s.move(selection,{...car,x:8,y:3,rotation:90},0);s.group.updateMatrixWorld(true);
 const bounds=new Box3().setFromObject(s.group);assert.ok(bounds.min.x>5);assert.ok(bounds.max.x<11);
 const ray=new Raycaster(new Vector3(8,10,3),new Vector3(0,-1,0));assert.deepEqual(selectionFromIntersection(ray.intersectObjects(s.selectable,false)[0]),selection);
 s.move(selection,car,0);s.selectable.forEach((mesh,i)=>assert.deepEqual(Array.from(mesh.instanceMatrix.array),original[i]));assert.equal(JSON.stringify(b),before);dispose(s.group);s.disposeTextures();
});

test('seated posture rests pelvis on cushion, keeps feet on floor and restores standing without new resources',()=>{
 const finishes=createFinishLibrary(),actor=createWalkingPerson(item('person',{height:1.7}),finishes),resources=new Set();actor.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
 for(const height of [.34,.4845,.522,.646]){
  actor.pose(0,false,false,false,0,height);actor.root.updateMatrixWorld(true);const box=new Box3().setFromObject(actor.root);close(box.min.y,0);close(box.max.y,height+.56*1.7);
  const [body,...legs]=actor.root.children,pelvis=body.children.find(o=>o.isMesh&&Math.abs(o.position.y-.5*1.7)<.00001);close(new Box3().setFromObject(pelvis).min.y,height);
  for(const hip of legs){const knee=hip.children.find(o=>o.isGroup),foot=knee.children.find(o=>o.isGroup);close(new Box3().setFromObject(foot).min.y,0);assert.ok(knee.getWorldPosition(new Vector3()).z>hip.position.z);}
 }
 actor.pose(0,false);actor.root.updateMatrixWorld(true);const standing=new Box3().setFromObject(actor.root);close(standing.min.y,0);close(standing.max.y,1.7);actor.root.traverse(o=>{if(o.geometry)assert.ok(resources.has(o.geometry));if(o.material)assert.ok(resources.has(o.material));});actor.dispose();finishes.dispose();
});

test('compact cabin has transparent windows isolated from opaque materials and fits a seated driver',()=>{
 const car=item('smallCar'),s=scene(project([car])),glass=s.selectable.filter(m=>m.material.transparent);assert.equal(glass.length,1);assert.equal(glass[0].count,4);assert.equal(glass[0].material.depthWrite,false);assert.ok(glass[0].material.opacity>0&&glass[0].material.opacity<.4);
 assert.ok(s.selectable.filter(m=>m!==glass[0]).every(m=>m.material.opacity===1&&m.material.depthWrite));
 const finishes=createFinishLibrary(),p=item('person'),actor=createWalkingPerson(p,finishes),seat=driverSeat(car,p);actor.pose(0,false,false,false,0,seat.seatHeight);actor.root.position.set(seat.x,seat.floor,seat.z);actor.root.rotation.y=Math.PI;actor.root.updateMatrixWorld(true);const box=new Box3().setFromObject(actor.root);
 assert.ok(box.max.y<.96*1.45);close(box.min.y,seat.floor);assert.ok(box.min.x>-.315*car.width&&box.max.x<.315*car.width);assert.ok(box.min.z>-.19*car.depth&&box.max.z<.315*car.depth);
 actor.dispose();finishes.dispose();dispose(s.group);s.disposeTextures();
});
test('wheel joints stay round, within the car footprint and above ground across rotation and resizing',()=>{
 const parts=furnitureParts('smallCar').filter(p=>p.wheel),geometry=unitGeometry('cylinder');
 for(const car of [item('smallCar'),item('smallCar',{width:1,depth:2.2,height:.9}),item('smallCar',{width:10,depth:.2,height:3}),item('smallCar',{width:.2,depth:10,height:3})])for(const steer of [-.5,0,.5])for(const roll of [0,.7,2]){
  for(const p of parts){const matrix=furnitureMatrix(car,0).multiply(wheelPartMatrix(p,car,{roll,steer})),g=p.shape==='cylinder'?geometry:unitGeometry(p.shape),mesh=new Mesh(g,new MeshBasicMaterial());mesh.matrixAutoUpdate=false;mesh.matrix.copy(matrix);mesh.updateMatrixWorld(true);const box=new Box3().setFromObject(mesh,true);
   assert.ok(box.min.y>=-.00001);assert.ok(box.min.x>=-car.width/2-.00001&&box.max.x<=car.width/2+.00001);assert.ok(box.min.z>=-car.depth/2-.00001&&box.max.z<=car.depth/2+.00001);
   if(p.wheel.component==='tire'){const e=matrix.elements;close(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[8],e[9],e[10]));}
   mesh.material.dispose();if(g!==geometry)g.dispose();
  }
 }
 geometry.dispose();
});
test('only front wheels steer, all spokes roll, and moving batches restore matrices and outlines exactly',()=>{
 const car=item('smallCar'),parts=furnitureParts('smallCar').filter(p=>p.wheel);
 for(const p of parts){const base=wheelPartMatrix(p,car),steered=wheelPartMatrix(p,car,{steer:.5,roll:0});if(p.wheel.front)assert.notDeepEqual(steered.elements,base.elements);else assert.deepEqual(steered.elements,base.elements);if(p.wheel.component==='spoke')assert.notDeepEqual(wheelPartMatrix(p,car,{steer:0,roll:.7}).elements,base.elements);}
 for(const p of parts.filter(p=>p.wheel.component==='spoke')){const tire=parts.find(t=>t.wheel.component==='tire'&&t.wheel.center===p.wheel.center),tm=furnitureMatrix(car,0).multiply(wheelPartMatrix(tire,car)),sm=furnitureMatrix(car,0).multiply(wheelPartMatrix(p,car));assert.ok(Math.abs(sm.elements[12]-tm.elements[12])>Math.hypot(tm.elements[4],tm.elements[5],tm.elements[6])/2,'Spokes must be visible outside the tire cap');}
 const b=project([car,item('smallCar',{id:'other',x:8})]),before=JSON.stringify(b),s=scene(b),key={floorId:b.floors[0].id,elementId:car.id},matrices=s.selectable.map(m=>Array.from(m.instanceMatrix.array)),outline=s.group.children.find(m=>m.isLineSegments),original=Array.from(outline.geometry.getAttribute('position').array),resources=s.group.children.map(m=>[m.geometry,m.material]);
 s.move(key,{...car,x:2,y:3,rotation:45},0,{steer:.5,roll:1});s.group.updateMatrixWorld(true);
 s.selectable.forEach((mesh,n)=>mesh.userData.selections.forEach((p,i)=>{if(p.elementId==='other')assert.deepEqual(Array.from(mesh.instanceMatrix.array.slice(i*16,(i+1)*16)),matrices[n].slice(i*16,(i+1)*16));}));
 s.move(key,car,0);s.selectable.forEach((m,i)=>assert.deepEqual(Array.from(m.instanceMatrix.array),matrices[i]));assert.deepEqual(Array.from(outline.geometry.getAttribute('position').array),original);assert.deepEqual(s.group.children.map(m=>[m.geometry,m.material]),resources);assert.equal(JSON.stringify(b),before);dispose(s.group);s.disposeTextures();
});
