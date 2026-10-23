import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const modelUrl=url(compile(await readFile(new URL('./model.ts',import.meta.url),'utf8')));
const {emptyPlan,sample,validatePlan,validateBuilding,buildingFromPlan,wallHeight,openingHeight,openingSill,addFloor,moveWallEndpoint,splitWall}=await import(modelUrl);
const source=await readFile(new URL('./model3d.ts',import.meta.url),'utf8');
const {wallVolumes}=await import(url(compile(source).replace("'./model'",JSON.stringify(modelUrl))));
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
