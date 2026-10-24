import {Mesh,MeshBasicMaterial,Raycaster,Vector3,DoubleSide} from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const modelUrl=url(compile(await readFile(new URL('./model.ts',import.meta.url),'utf8')));
const {emptyPlan,sample,validatePlan,validateBuilding,buildingFromPlan,wallHeight,openingHeight,openingSill,addFloor,removeFloor,replaceFloorPlan,moveWallEndpoint,splitWall,floorLevels,addSurfaceHole,editSurfaceGeometry,resizeSurfaceHole,plateArea,plateHoles,surfaceLabel,pointInsideContour}=await import(modelUrl);
const source=await readFile(new URL('./model3d.ts',import.meta.url),'utf8');
const {wallVolumes,buildingVolumes,modelSelectionKey}=await import(url(compile(source).replace("'./model'",JSON.stringify(modelUrl))));
const base=()=>({...emptyPlan(),walls:[{id:'w',a:{x:0,y:0},b:{x:8,y:0},thickness:.2}],openings:[{id:'d',wallId:'w',kind:'door',t:.25,width:1},{id:'v',wallId:'w',kind:'window',t:.7,width:1.2}]});
test('legacy projects retain geometry and default vertical dimensions',()=>{
 const p=sample(),checked=validatePlan(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(checked,p);assert.equal(wallHeight(p,p.walls[0]),2.8);
 assert.equal(openingHeight(p.openings[0]),2.1);assert.equal(openingSill(p.openings[0]),0);
 assert.equal(openingHeight(p.openings[3]),1.2);assert.equal(openingSill(p.openings[3]),.9);
 const b=buildingFromPlan(p);assert.deepEqual(validateBuilding(JSON.parse(JSON.stringify(b))),b);
});
test('custom heights survive projects, copying walls, geometry editing and splitting',()=>{
 const p=base();p.wallHeight=3;p.walls[0].height=3.5;p.openings[0].height=2.4;p.openings[1].height=1.5;p.openings[1].sill=1;
 const checked=validatePlan(p),b=buildingFromPlan(checked);
 assert.deepEqual(validateBuilding(JSON.parse(JSON.stringify(b))).floors[0].plan,checked);
 const copy=addFloor(b,'Alta','walls');assert.equal(copy.floors[1].plan.wallHeight,3);assert.equal(copy.floors[1].plan.walls[0].height,3.5);
 const moved=moveWallEndpoint(checked,'w','b',{x:9,y:0});assert.equal(moved.walls[0].height,3.5);assert.equal(moved.openings[0].height,2.4);
 const split=splitWall(checked,'w',4);assert.equal(split.walls[1].height,3.5);assert.equal(split.openings[1].sill,1);
});
test('invalid heights, sill levels and openings above wall tops are rejected atomically',()=>{
 const p=base(),before=JSON.stringify(p);
 for(const height of [null,NaN,Infinity,.49,21,'3']){
  assert.throws(()=>validatePlan({...p,wallHeight:height}));
  assert.throws(()=>validatePlan({...p,walls:[{...p.walls[0],height}]}));
 }
 for(const opening of [{...p.openings[0],height:0},{...p.openings[0],sill:.2},{...p.openings[1],sill:-1},{...p.openings[1],height:3},{...p.openings[1],sill:2}])assert.throws(()=>validatePlan({...p,openings:[opening]}));
 assert.throws(()=>validatePlan({...p,wallHeight:2}));assert.equal(JSON.stringify(p),before);
});
test('wall solid volumes exclude complete door and window holes',()=>{
 const p=validatePlan(base()),[wall]=wallVolumes(p);
 const actual=wall.solids.reduce((sum,s)=>sum+(s.to-s.from)*(s.top-s.bottom)*wall.thickness,0);
 const expected=(8*2.8-1*2.1-1.2*1.2)*.2;
 assert.ok(Math.abs(actual-expected)<1e-9);
 for(const s of wall.solids)for(const o of wall.openings){const x=Math.min(s.to,o.to)-Math.max(s.from,o.from),y=Math.min(s.top,o.top)-Math.max(s.bottom,o.bottom);assert.ok(x<=1e-9||y<=1e-9);}
 assert.equal(wall.openings[0].bottom,0);assert.equal(wall.openings[1].bottom,.9);
 assert.ok(wall.solids.some(s=>s.from===wall.openings[1].from&&s.bottom===0&&s.top===.9));
});
test('diagonal and reversed walls preserve opening placement and thickness',()=>{
 for(const b of [{x:6,y:8},{x:-6,y:-8}]){
  const p=base();p.walls[0].b=b;const [wall]=wallVolumes(validatePlan(p));
  assert.equal(wall.length,10);assert.equal(wall.thickness,.2);assert.equal(wall.openings[0].from,2);assert.equal(wall.openings[0].to,3);
  const from=wall.openings[0].from;
  assert.ok(Math.abs(Math.cos(wall.angle)*from-b.x*.2)<1e-9);assert.ok(Math.abs(Math.sin(wall.angle)*from-b.y*.2)<1e-9);
 }
});
test('full-height opening does not create a zero-height lintel; no walls gives empty model',()=>{
 const p=base();p.openings=[{...p.openings[0],height:2.8}];const [wall]=wallVolumes(validatePlan(p));
 assert.equal(wall.solids.length,2);assert.ok(wall.solids.every(s=>s.top>s.bottom));assert.deepEqual(wallVolumes(emptyPlan()),[]);
});

const rectangle=[{x:0,y:0},{x:8,y:0},{x:8,y:6},{x:0,y:6}];
const options={scope:'all',slabs:true,roofs:true};
test('legacy floors stack automatically; custom levels, taller walls and floor slab thickness are respected',()=>{
 let b=buildingFromPlan(base());b=addFloor(b,'Alta','copy');
 assert.deepEqual(floorLevels(b),[0,3]);
 b.floors[0].plan.walls[0].height=3.5;
 b.floors[1].plan.surfaces=[{id:'s',name:'Entrepiso',points:rectangle,slab:{thickness:.3}}];
 assert.deepEqual(floorLevels(b),[0,3.8]);
 b.floors[1].elevation=4; b=addFloor(b,'Segundo piso','blank');
 assert.deepEqual(floorLevels(b),[0,4,7]);
 b.floors[0].elevation=-3;assert.deepEqual(floorLevels(b),[-3,4,7]);
 const data=JSON.stringify(b);assert.deepEqual(validateBuilding(JSON.parse(data)),b);
 assert.equal(floorLevels(removeFloor(b,b.floors[0].id))[0],4);
});
test('levels and plate metadata survive floor duplication, geometry edits, save and reopen without aliasing',()=>{
 let b=buildingFromPlan(base());b.floors[0].elevation=1;
 b.floors[0].plan.surfaces=[{id:'s',name:'Losa',points:rectangle,slab:{thickness:.2},roof:{thickness:.15,height:2.8}}];
 b=validateBuilding(b);const copy=addFloor(b,'Alta','copy');
 assert.equal(copy.floors[1].elevation,undefined);assert.deepEqual(copy.floors[1].plan.surfaces,b.floors[0].plan.surfaces);
 assert.notEqual(copy.floors[0].plan.surfaces[0].slab,copy.floors[1].plan.surfaces[0].slab);
 const moved={...copy.floors[1].plan,surfaces:copy.floors[1].plan.surfaces.map(s=>({...s,points:s.points.map(p=>({x:p.x+2,y:p.y+1}))}))};
 const saved=validateBuilding(JSON.parse(JSON.stringify(replaceFloorPlan(copy,moved))));
 assert.equal(saved.floors[0].elevation,1);assert.equal(saved.floors[1].plan.surfaces[0].roof.height,2.8);
 assert.deepEqual(saved.floors[0].plan.surfaces[0].points,rectangle);
 assert.equal(addFloor(b,'Solo muros','walls').floors[1].plan.surfaces.length,0);
});
test('invalid levels and plate metadata are rejected without changing original data',()=>{
 const b=buildingFromPlan(base()),before=JSON.stringify(b);
 for(const elevation of [null,NaN,Infinity,-101,501,'3'])assert.throws(()=>validateBuilding({...b,floors:[{...b.floors[0],elevation}]}));
 const p={...base(),surfaces:[{id:'s',name:'Losa',points:rectangle}]};
 for(const slab of [null,{}, {thickness:.049},{thickness:1.01},{thickness:NaN},{thickness:'0.2'}])assert.throws(()=>validatePlan({...p,surfaces:[{...p.surfaces[0],slab}]}));
 for(const height of [undefined,null,NaN,Infinity,-1,.49,20.01,'2.8'])assert.throws(()=>validatePlan({...p,surfaces:[{...p.surfaces[0],roof:{height,thickness:.2}}]}));
 assert.equal(JSON.stringify(b),before);
});
test('multi-floor scene maintains levels, opening offsets and independent selection for copied ids',()=>{
 let b=buildingFromPlan(base());b=addFloor(b,'Alta','copy');
 const result=buildingVolumes(b,options);
 assert.equal(result.length,2);assert.equal(result[1].elevation,3);
 assert.deepEqual(result[0].walls,result[1].walls);
 assert.equal(result[1].elevation+result[1].walls[0].openings[1].bottom,3.9);
 assert.notEqual(modelSelectionKey({floorId:result[0].id,elementId:'w'}),modelSelectionKey({floorId:result[1].id,elementId:'w'}));
 const active=buildingVolumes(b,{...options,scope:'active'});assert.equal(active.length,1);assert.equal(active[0].id,b.activeFloorId);assert.equal(active[0].elevation,3);
});
test('floor slabs end at the floor; flat roofs start at their own height; visibility never mutates data',()=>{
 const p=base();p.surfaces=[{id:'s',name:'Losa',points:rectangle,slab:{thickness:.25},roof:{thickness:.2,height:3}}];
 const b=buildingFromPlan(p);b.floors[0].elevation=4;const before=JSON.stringify(b);
 const [floor]=buildingVolumes(b,options);assert.equal(floor.plates.length,2);
 assert.equal(floor.elevation+floor.plates[0].bottom,3.75);assert.equal(floor.elevation+floor.plates[0].top,4);
 assert.equal(floor.elevation+floor.plates[1].bottom,7);assert.equal(floor.elevation+floor.plates[1].top,7.2);
 assert.deepEqual(floor.plates[0].points,rectangle);
 assert.equal(buildingVolumes(b,{...options,roofs:false})[0].plates.length,1);
 assert.equal(buildingVolumes(b,{...options,slabs:false})[0].plates[0].kind,'roof');
 assert.equal(buildingVolumes(b,{...options,slabs:false,roofs:false})[0].plates.length,0);
 assert.equal(JSON.stringify(b),before);
});
const geometrySource=await readFile(new URL('./plateGeometry.ts',import.meta.url),'utf8');
const {plateGeometry}=await import(url(compile(geometrySource).replace("'three'",JSON.stringify(import.meta.resolve('three')))));
test('concave slabs keep their notch and correct XYZ mapping in either winding direction',()=>{
 const points=[{x:2,y:3},{x:6,y:3},{x:6,y:4},{x:3,y:4},{x:3,y:6},{x:2,y:6}];
 for(const path of [points,[...points].reverse()]){
  const geometry=plateGeometry(path,.25);geometry.computeBoundingBox();const box=geometry.boundingBox;
  assert.ok(Math.abs(box.min.x-2)<1e-6&&Math.abs(box.max.x-6)<1e-6);
  assert.ok(Math.abs(box.min.z-3)<1e-6&&Math.abs(box.max.z-6)<1e-6);
  assert.ok(Math.abs(box.min.y)<1e-6&&Math.abs(box.max.y-.25)<1e-6);
  const pos=geometry.getAttribute('position');let topArea=0;
  for(let i=0;i<pos.count;i+=3){
   if([i,i+1,i+2].every(j=>Math.abs(pos.getY(j)-.25)<1e-6)){
    const x=[i,i+1,i+2].map(j=>pos.getX(j)),z=[i,i+1,i+2].map(j=>pos.getZ(j));
    topArea+=Math.abs((x[1]-x[0])*(z[2]-z[0])-(x[2]-x[0])*(z[1]-z[0]))/2;
    assert.ok(!((x[0]+x[1]+x[2])/3>3+1e-6&&(z[0]+z[1]+z[2])/3>4+1e-6));
   }
  }
  assert.ok(Math.abs(topArea-6)<1e-6);geometry.dispose();
 }
});

test('automatic levels use actual wall heights even when all walls override the general height downward',()=>{
 const p=base();p.walls[0].height=2.5;
 const b=addFloor(buildingFromPlan(p),'Alta','blank');
 assert.deepEqual(floorLevels(b),[0,2.7]);
});

const holeRect=(x,y,w,d)=>[{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}];
const platePlan=()=>({...base(),surfaces:[{id:'surface',name:'Entrepiso',points:rectangle,slab:{thickness:.2},roof:{height:2.8,thickness:.15}}]});
test('hole targets survive building, duplication and save; legacy surfaces remain unchanged',()=>{
 const legacy=platePlan();assert.deepEqual(validatePlan(legacy),legacy);
 let p=addSurfaceHole(legacy,'surface',holeRect(1,1,1,2),'slab');
 p=addSurfaceHole(p,'surface',holeRect(3,1,1,1),'roof');
 p=addSurfaceHole(p,'surface',holeRect(5,1,1,1),'both');
 const b=addFloor(buildingFromPlan(p),'Alta','copy'),copy=validateBuilding(JSON.parse(JSON.stringify(b)));
 assert.deepEqual(copy.floors[1].plan.surfaces,p.surfaces);
 assert.notEqual(copy.floors[0].plan.surfaces[0].holes[0].points,copy.floors[1].plan.surfaces[0].holes[0].points);
 const surface=p.surfaces[0];assert.equal(plateHoles(surface,'slab').length,2);assert.equal(plateHoles(surface,'roof').length,2);
 assert.equal(plateArea(surface,'slab'),45);assert.equal(plateArea(surface,'roof'),46);
 const plates=buildingVolumes(b,options)[0].plates;assert.deepEqual(plates[0].holes,plateHoles(surface,'slab'));assert.deepEqual(plates[1].holes,plateHoles(surface,'roof'));
 assert.equal(legacy.surfaces[0].holes,undefined);
});
test('holes reject malformed metadata, crossing edges, outside points and boundary contact',()=>{
 const p=platePlan(),before=JSON.stringify(p);
 for(const points of [holeRect(-1,1,2,1),holeRect(0,1,1,1),holeRect(7,1,2,1),[{x:1,y:1},{x:3,y:3},{x:1,y:3},{x:3,y:1}]])assert.throws(()=>addSurfaceHole(p,'surface',points,'slab'));
 const valid=addSurfaceHole(p,'surface',holeRect(1,1,1,1),'slab'),surface=valid.surfaces[0],h=surface.holes[0];
 for(const patch of [{target:'wall'},{name:''},{id:'surface'},{id:'w'},{points:null}])assert.throws(()=>validatePlan({...valid,surfaces:[{...surface,holes:[{...h,...patch}]}]}));
 assert.throws(()=>validatePlan({...p,surfaces:[{...p.surfaces[0],holes:null}]}));
 assert.throws(()=>validatePlan({...valid,surfaces:[{...surface,holes:Array.from({length:21},(_,i)=>({...h,id:'h'+i}))}]}));
 assert.equal(JSON.stringify(p),before);
});
test('a hole cannot bridge the outside of a concave contour even if all vertices are inside',()=>{
 const p=platePlan();p.surfaces[0].points=[{x:0,y:0},{x:6,y:0},{x:6,y:6},{x:4,y:6},{x:4,y:2},{x:2,y:2},{x:2,y:6},{x:0,y:6}];
 const bridge=holeRect(1,3,4,1);assert.ok(bridge.every(v=>pointInsideContour(v,p.surfaces[0].points)));
 assert.throws(()=>addSurfaceHole(p,'surface',bridge,'both'),/dentro/);
});
test('holes cannot touch, overlap or nest, including holes with different targets',()=>{
 const p=addSurfaceHole(platePlan(),'surface',holeRect(1,1,2,2),'slab');
 for(const points of [holeRect(3,1,1,1),holeRect(2,2,2,2),holeRect(1.2,1.2,.5,.5),holeRect(.5,.5,3,3)])assert.throws(()=>addSurfaceHole(p,'surface',points,'roof'));
 assert.equal(addSurfaceHole(p,'surface',holeRect(4,1,1,1),'roof').surfaces[0].holes.length,2);
});
test('moving the parent translates its holes; hole editing and deletion leave parent untouched',()=>{
 const p=addSurfaceHole(platePlan(),'surface',holeRect(1,1,1,2),'slab'),h=p.surfaces[0].holes[0],before=JSON.stringify(p);
 const moved=editSurfaceGeometry(p,'surface',{delta:{x:3,y:4}});
 assert.deepEqual(moved.surfaces[0].holes[0].points,holeRect(4,5,1,2));assert.deepEqual(moved.surfaces[0].points,holeRect(3,4,8,6));
 const only=editSurfaceGeometry(p,'surface',{delta:{x:2,y:0}},h.id);assert.deepEqual(only.surfaces[0].points,rectangle);assert.deepEqual(only.surfaces[0].holes[0].points,holeRect(3,1,1,2));
 assert.throws(()=>editSurfaceGeometry(p,'surface',{delta:{x:8,y:0}},h.id));
 assert.throws(()=>editSurfaceGeometry(p,'surface',{vertex:0,point:{x:3,y:3}}));
 const resized=resizeSurfaceHole(h,2,3);assert.deepEqual(resized.points,holeRect(1,1,2,3));assert.throws(()=>resizeSurfaceHole(h,NaN,2));
 const removed=validatePlan({...p,surfaces:[{...p.surfaces[0],holes:[]}]});assert.deepEqual(removed.surfaces[0].slab,p.surfaces[0].slab);assert.equal(plateArea(removed.surfaces[0],'slab'),48);
 const label=surfaceLabel(rectangle,[h.points]);assert.ok(pointInsideContour(label,rectangle)&&!pointInsideContour(label,h.points));
 assert.equal(JSON.stringify(p),before);
});
test('extruded plates have actual through holes and correct net area in all winding combinations',()=>{
 const outer=holeRect(0,0,8,6),hole=holeRect(2,2,2,2),small=holeRect(5,1,1,1);
 for(const reverseOuter of [false,true])for(const reverseHole of [false,true]){
  const geometry=plateGeometry(reverseOuter?[...outer].reverse():outer,.3,[reverseHole?[...hole].reverse():hole,small]);
  const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld();
  const ray=new Raycaster(new Vector3(3,5,3),new Vector3(0,-1,0));assert.equal(ray.intersectObject(mesh).length,0);
  ray.set(new Vector3(5.5,5,1.5),new Vector3(0,-1,0));assert.equal(ray.intersectObject(mesh).length,0);
  ray.set(new Vector3(1,5,1),new Vector3(0,-1,0));assert.ok(ray.intersectObject(mesh).length>0);
  const pos=geometry.getAttribute('position');let area=0;
  for(let i=0;i<pos.count;i+=3)if([i,i+1,i+2].every(j=>Math.abs(pos.getY(j)-.3)<1e-6)){
   const x=[i,i+1,i+2].map(j=>pos.getX(j)),z=[i,i+1,i+2].map(j=>pos.getZ(j));area+=Math.abs((x[1]-x[0])*(z[2]-z[0])-(x[2]-x[0])*(z[1]-z[0]))/2;
  }
  assert.ok(Math.abs(area-43)<1e-6);geometry.dispose();mesh.material.dispose();
 }
});
