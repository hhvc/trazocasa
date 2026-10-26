import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Group,Color,Box3} from 'three';
async function moduleUrl(file,dependencies={}){
 let source=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [name,url] of Object.entries(dependencies))source=source.replaceAll(`'${name}'`,JSON.stringify(url));
 return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const three=import.meta.resolve('three'),modelUrl=await moduleUrl('./model.ts');
const {emptyPlan,validatePlan,validateBuilding,buildingFromPlan,addFloor,splitWall,moveWallEndpoint,roofPlanes}=await import(modelUrl);
const appearanceUrl=await moduleUrl('./appearance.ts'),finishesUrl=await moduleUrl('./finishMaterials.ts',{'three':three});
const {withAppearance,targetAppearance,furnitureFinishColors}=await import(appearanceUrl);
const {finishPixels,createFinishLibrary,finishMaterial,finishUV}=await import(finishesUrl);
const volumesUrl=await moduleUrl('./model3d.ts',{'./model':modelUrl}),{buildingVolumes}=await import(volumesUrl);
const heightsUrl=await moduleUrl('./furnitureHeights.ts'),partsUrl=await moduleUrl('./furniture3d.ts');
const sceneUrl=await moduleUrl('./FurnitureScene.ts',{'three':three,'./model3d':volumesUrl,'./furnitureHeights':heightsUrl,'./furniture3d':partsUrl,'./appearance':appearanceUrl,'./finishMaterials':finishesUrl});
const {addFurnitureScene}=await import(sceneUrl);
const geometryUrl=await moduleUrl('./plateGeometry.ts',{'three':three}),{plateGeometry,roofGeometry,wallSolidGeometry}=await import(geometryUrl);
const paint={color:'#8eac9b',finish:'paint'},wood={color:'#bda789',finish:'wood'},tile={color:'#e3dfd3',finish:'tile'},concrete={color:'#bcbdb6',finish:'concrete'};
const targets=[{kind:'wall',id:'wall'},{kind:'slab',id:'surface'},{kind:'roof',id:'surface'},{kind:'furniture',id:'chair'}];
const base=()=>({...emptyPlan(),walls:[{id:'wall',a:{x:0,y:0},b:{x:6,y:0}}],furniture:[{id:'chair',kind:'chair',x:2,y:2,width:.45,depth:.5,rotation:30}],surfaces:[{id:'surface',name:'Casa',points:[{x:0,y:0},{x:6,y:0},{x:6,y:4},{x:0,y:4}],slab:{thickness:.2},roof:{height:2.8,thickness:.2,shape:{kind:'gable',slope:30,direction:0}}}]});
test('independent finishes persist in files and complete floor copies while old files stay unchanged',()=>{
 let p=base();assert.deepEqual(validatePlan(p),p);
 for(let i=0;i<targets.length;i++)p=withAppearance(p,targets[i],[paint,wood,tile,concrete][i]);
 const b=addFloor(buildingFromPlan(validatePlan(p)),'Alta','copy'),roundTrip=validateBuilding(JSON.parse(JSON.stringify(b)));
 assert.deepEqual(roundTrip,b);assert.deepEqual(roundTrip.floors[1].plan,p);
 const [floor]=buildingVolumes(b,{scope:'all',slabs:true,roofs:true});assert.deepEqual(floor.walls[0].appearance,paint);assert.deepEqual(floor.plates.map(p=>p.appearance),[wood,tile]);assert.deepEqual(floor.furniture[0].appearance,concrete);
});
test('appearance previews and resets never mutate geometry or other targets',()=>{
 const original=base(),before=JSON.stringify(original);let preview=withAppearance(original,targets[1],wood);preview=withAppearance(preview,targets[2],tile);
 assert.equal(JSON.stringify(original),before);assert.deepEqual(targetAppearance(preview,targets[1]),wood);assert.deepEqual(targetAppearance(preview,targets[2]),tile);
 const reset=withAppearance(preview,targets[1]);assert.equal(Object.hasOwn(reset.surfaces[0].slab,'appearance'),false);assert.deepEqual(reset.surfaces[0].roof.appearance,tile);assert.deepEqual(reset.walls,original.walls);assert.deepEqual(reset.surfaces[0].points,original.surfaces[0].points);
});
test('wall edits, splits and copies preserve finishes',()=>{
 const p=withAppearance(base(),targets[0],wood);const moved=moveWallEndpoint(p,'wall','b',{x:7,y:0}),split=splitWall(moved,'wall',3);
 assert.deepEqual(split.walls.map(w=>w.appearance),[wood,wood]);assert.deepEqual(addFloor(buildingFromPlan(p),'Alta','walls').floors[1].plan.walls[0].appearance,wood);
});
test('invalid finishes are rejected and normalized copies contain only supported fields',()=>{
 for(const target of targets)for(const value of [null,[],{},'wood',{color:'red',finish:'paint'},{color:'#abc',finish:'tile'},{color:'#ffffff',finish:'image'},{color:'url(https://example.com)',finish:'paint'}]){
  const p=withAppearance(base(),target,paint);
  const element=target.kind==='wall'?p.walls[0]:target.kind==='furniture'?p.furniture[0]:p.surfaces[0][target.kind];element.appearance=value;
  assert.throws(()=>validatePlan(p),target.kind+' '+JSON.stringify(value));
 }
 const p=withAppearance(base(),targets[0],{color:'#ABCDEF',finish:'wood',url:'unused'}),checked=validatePlan(p);assert.deepEqual(checked.walls[0].appearance,{color:'#abcdef',finish:'wood'});assert.notEqual(checked.walls[0].appearance,p.walls[0].appearance);
});
test('procedural textures are deterministic, opaque, cached by finish, and released',()=>{
 const library=createFinishLibrary();assert.equal(library.texture('paint'),null);
 for(const finish of ['wood','tile','concrete']){const pixels=finishPixels(finish);assert.deepEqual(pixels,finishPixels(finish));assert.equal(pixels.length,128*128*4);assert.ok(new Set(pixels.filter((_,i)=>i%4===0)).size>2);for(let i=3;i<pixels.length;i+=4)assert.equal(pixels[i],255);
  const texture=library.texture(finish);assert.equal(texture,library.texture(finish));let disposed=0;texture.addEventListener('dispose',()=>disposed++);library.dispose();assert.equal(disposed,1);
 }
});
test('texturing inclined roofs, perforated plates and wall solids preserves actual geometry',()=>{
 const p=base(),b=buildingFromPlan(p),[w]=buildingVolumes(b,{scope:'all',slabs:true,roofs:true})[0].walls;
 const geometries=[plateGeometry(p.surfaces[0].points,.2,[[{x:1,y:1},{x:2,y:1},{x:2,y:2},{x:1,y:2}]]),roofGeometry(p.surfaces[0].points,.2,[],roofPlanes(p.surfaces[0]),2.8),wallSolidGeometry(w,w.solids[0])];
 for(const g of geometries){const original=Array.from(g.getAttribute('position').array);for(const finish of ['wood','tile','concrete']){finishUV(g,finish);assert.deepEqual(Array.from(g.getAttribute('position').array),original);assert.equal(g.getAttribute('uv').count,g.getAttribute('position').count);assert.ok(Array.from(g.getAttribute('uv').array).every(Number.isFinite));}g.dispose();}
});
test('furniture finishes preserve glass and tires and remain independent on repeated floor IDs',()=>{
 const p={...emptyPlan(),furniture:[{id:'car',kind:'smallCar',x:0,y:0,width:1.7,depth:3.8,rotation:0,appearance:paint}]};let b=addFloor(buildingFromPlan(p),'Alta','copy');b.floors[1].plan.furniture[0].appearance=tile;
 const library=createFinishLibrary(),group=new Group(),s=addFurnitureScene(group,buildingVolumes(b,{scope:'all',slabs:true,roofs:true}),library);group.updateMatrixWorld(true);const bounds=new Box3().setFromObject(group);
 const colors=[];for(const mesh of s.selectable)for(let i=0;i<mesh.count;i++)colors.push(mesh.getColorAt(i,new Color()).getHexString());
 assert.ok(colors.includes('8eac9b'));assert.ok(colors.includes('e3dfd3'));assert.ok(colors.includes('45554e'));assert.ok(colors.includes('9fbdb9'));assert.ok(!furnitureFinishColors('smallCar').includes('#9fbdb9'));
 const original=s.selectable.map(m=>Array.from(m.instanceColor.array));s.setSelected({floorId:b.activeFloorId,elementId:'car'});s.setSelected(null);assert.deepEqual(s.selectable.map(m=>Array.from(m.instanceColor.array)),original);assert.deepEqual(new Box3().setFromObject(group),bounds);
 group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});library.dispose();
});
test('500 individually colored objects share geometry and a bounded number of texture batches',()=>{
 const p={...emptyPlan(),furniture:Array.from({length:500},(_,i)=>({id:'c'+i,kind:'chair',x:i%25,y:Math.floor(i/25),width:.45,depth:.5,rotation:i%360,appearance:{color:'#'+(i+1000).toString(16).padStart(6,'0'),finish:['paint','wood','tile','concrete'][i%4]}}))};
 const group=new Group(),s=addFurnitureScene(group,buildingVolumes(buildingFromPlan(p),{scope:'all',slabs:true,roofs:true}));assert.ok(s.selectable.length<=16);assert.ok(new Set(s.selectable.map(m=>m.geometry)).size<=4);assert.ok(new Set(s.selectable.map(m=>m.material)).size<=4);
 group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});s.disposeTextures();
});
test('different element colors do not share mutable materials, but do share texture storage',()=>{
 const library=createFinishLibrary(),a=finishMaterial(library,wood,'#ffffff'),b=finishMaterial(library,{...wood,color:'#123456'},'#ffffff');assert.notEqual(a,b);assert.equal(a.map,b.map);a.color.set('#ff0000');assert.equal(b.color.getHexString(),'123456');a.dispose();b.dispose();library.dispose();
});
