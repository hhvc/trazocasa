import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./model.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { addDimension, dimensionGeometry, dimensionOffset, validatePlan, sample, fitOpening, project, distance, emptyPlan, furnitureCorners, planBounds, addRectangle, doorTransform, moveWallEndpoint, translateWall, splitWall, wallThickness } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('example survives file round trip', () => { const p = sample(); assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))), p); });
test('reject incompatible and malformed files', () => { for (const p of [null, {}, { ...sample(), version: 99 }, { ...sample(), walls: [{ id: 'x', a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }] }]) assert.throws(() => validatePlan(p)); });
test('reject nonfinite geometry and duplicated identifiers', () => { const p = sample(); p.walls[0].a.x = Infinity; assert.throws(() => validatePlan(p)); const q = sample(); q.labels[0].id = q.walls[0].id; assert.throws(() => validatePlan(q)); });
test('openings stay inside walls and cannot overlap', () => { const p = sample(), w = p.walls[0]; assert.equal(fitOpening(p, w, .28, 1), null); assert.equal(fitOpening(p, w, .5, 9), null); const t = fitOpening({ ...p, openings: [] }, w, 0, 1); assert.ok(t > 0); assert.ok(t * distance(w.a, w.b) >= .5); const q = sample(); q.openings.push({ ...q.openings[0], id: 'duplicate-opening' }); assert.throws(() => validatePlan(q)); });
test('reject missing wall references and out of range openings', () => { const p = sample(); p.openings[0].wallId = 'missing'; assert.throws(() => validatePlan(p)); const q = sample(); q.openings[0].t = 2; assert.throws(() => validatePlan(q)); });
test('project onto horizontal, vertical, diagonal segments', () => { assert.equal(project({ x: 2, y: 3 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }).t, .5); assert.equal(project({ x: 3, y: 2 }, { a: { x: 0, y: 0 }, b: { x: 0, y: 4 } }).t, .5); assert.equal(project({ x: 2, y: 2 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 4 } }).t, .5); assert.equal(project({ x: 9, y: 0 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }).t, 1); });


test('legacy v1 plans migrate without changing their walls or openings', () => {
  const { furniture, ...legacy } = sample(); legacy.version = 1;
  const migrated = validatePlan(JSON.parse(JSON.stringify(legacy)));
  assert.equal(migrated.version, 5); assert.deepEqual(migrated.furniture, []);
  assert.deepEqual(migrated.walls, legacy.walls); assert.deepEqual(migrated.openings, legacy.openings);
  assert.deepEqual(migrated.labels, legacy.labels);
});
test('modern files require an explicit furniture collection', () => {
  const p = sample(); delete p.furniture; assert.throws(() => validatePlan(p));
  for (const furniture of [null, {}, 'bed']) assert.throws(() => validatePlan({ ...sample(), furniture }));
});
test('furniture rejects invalid dimensions, positions, angles and types', () => {
  for (const patch of [{width: 0}, {depth: -1}, {width: 10.1}, {depth: NaN}, {x: Infinity}, {y: 1001}, {rotation: -1}, {rotation: 360}, {rotation: '90'}, {kind: 'unknown'}]) {
    const p = sample(); Object.assign(p.furniture[0], patch); assert.throws(() => validatePlan(p));
  }
  const p = sample(); p.furniture[0].id = p.walls[0].id; assert.throws(() => validatePlan(p));
});
test('furniture limits prevent unbounded imports', () => {
  const p = sample(); p.furniture = Array.from({length: 501}, (_, n) => ({ ...p.furniture[0], id: `f-${n}` }));
  assert.throws(() => validatePlan(p));
});
test('rotated furniture keeps its footprint around its center', () => {
  const f = { ...sample().furniture[0], x: 0, y: 0, width: 2, depth: 1, rotation: 90 };
  const points = furnitureCorners(f);
  assert.ok(Math.abs(Math.max(...points.map(p => p.x)) - .5) < 1e-9);
  assert.ok(Math.abs(Math.max(...points.map(p => p.y)) - 1) < 1e-9);
  f.rotation = 45;
  const diagonal = furnitureCorners(f);
  assert.ok(Math.abs(Math.max(...diagonal.map(p => p.x)) - 1.5 / Math.sqrt(2)) < 1e-9);
});
test('framing includes furniture outside walls, long labels and door swing', () => {
  const p = sample(); p.furniture[0] = { ...p.furniture[0], x: 15, y: -12, rotation: 45 };
  p.labels.push({ id: 'far-label', text: 'Un nombre de ambiente bastante largo', x: -20, y: 10 });
  const b = planBounds(p);
  for (const pt of furnitureCorners(p.furniture[0])) { assert.ok(pt.x >= b.x && pt.x <= b.x + b.width); assert.ok(pt.y >= b.y && pt.y <= b.y + b.height); }
  assert.ok(b.x < -22); assert.ok(b.y + b.height > 10);
  const doorBounds = planBounds(sample(), 0); assert.ok(doorBounds.y + doorBounds.height > 6);
});
test('a furniture-only project frames tightly and round-trips', () => {
  const p = emptyPlan(); p.furniture.push({ ...sample().furniture[0], x: 40, y: 30, rotation: 90 });
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))), p);
  const b = planBounds(p, 0); assert.ok(Math.abs(b.width - 2) < 1e-9); assert.ok(Math.abs(b.height - 1.6) < 1e-9);
  assert.ok(b.x > 30); assert.ok(b.y > 20);
});
test('empty plans have a usable default viewport', () => {
  const b = planBounds(emptyPlan()); assert.ok(b.width > 0 && b.height > 0);
});


test('v2 plans migrate with furniture and the original door appearance', () => {
  const old = { ...sample(), version: 2 };
  const next = validatePlan(old); assert.equal(next.version, 5);
  assert.deepEqual(next.furniture, old.furniture); assert.deepEqual(next.openings, old.openings);
  assert.deepEqual(doorTransform(next.openings[0]), { x: 1, y: 1 });
});
test('doors retain all four orientations through file round trips', () => {
  for (const hinge of ['start', 'end']) for (const swing of ['negative', 'positive']) {
    const p = sample(); Object.assign(p.openings[0], {hinge, swing});
    const next = validatePlan(JSON.parse(JSON.stringify(p)));
    assert.equal(next.openings[0].hinge, hinge); assert.equal(next.openings[0].swing, swing);
    assert.deepEqual(doorTransform(next.openings[0]), { x: hinge === 'end' ? -1 : 1, y: swing === 'positive' ? -1 : 1 });
  }
});
test('invalid door orientation is rejected without changing the source', () => {
  for (const change of [{hinge:'unknown'}, {swing:1}, {hinge:null}, {swing:null}]) {
    const p = sample(); Object.assign(p.openings[0], change); assert.throws(() => validatePlan(p));
  }
});
test('rectangle creates four connected walls and one centered name', () => {
  const before = emptyPlan(); const p = addRectangle(before, {x:0,y:0}, {x:4,y:3}, ' Cocina ');
  assert.equal(before.walls.length, 0); assert.equal(p.walls.length, 4); assert.equal(p.labels.length, 1);
  for(let i=0;i<4;i++) assert.deepEqual(p.walls[i].b,p.walls[(i+1)%4].a);
  assert.deepEqual(p.walls.map(w=>distance(w.a,w.b)),[4,3,4,3]);
  assert.equal(p.labels[0].text,'Cocina'); assert.equal(p.labels[0].x,2); assert.equal(p.labels[0].y,1.5);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);
});
test('rectangle accepts all corner directions with identical geometry', () => {
  for (const [a,b] of [[{x:4,y:3},{x:0,y:0}],[{x:0,y:3},{x:4,y:0}],[{x:4,y:0},{x:0,y:3}]]) {
    const p = addRectangle(emptyPlan(),a,b);
    assert.deepEqual(p.walls[0].a,{x:0,y:0}); assert.deepEqual(p.walls[2].a,{x:4,y:3});
  }
});
test('adjacent rooms reuse the shared wall and retain its opening', () => {
  const p = addRectangle(emptyPlan(),{x:0,y:0},{x:4,y:3});
  const shared = p.walls[1]; p.openings.push({id:'shared-door',wallId:shared.id,t:.5,width:.8,kind:'door',hinge:'end',swing:'positive'});
  const next = addRectangle(p,{x:4,y:0},{x:8,y:3},'Dormitorio');
  assert.equal(next.walls.length,7); assert.equal(next.labels.length,2);
  assert.deepEqual(next.openings,p.openings); assert.deepEqual(next.walls.find(w=>w.id===shared.id),shared);
});
test('partial wall overlaps and duplicate rectangles fail atomically', () => {
  const p = addRectangle(emptyPlan(),{x:0,y:0},{x:4,y:3}); const snapshot=JSON.stringify(p);
  assert.throws(()=>addRectangle(p,{x:4,y:1},{x:7,y:4}),/superpone parcialmente/);
  assert.throws(()=>addRectangle(p,{x:0,y:0},{x:4,y:3}),/ya existen/);
  assert.equal(JSON.stringify(p),snapshot);
});
test('invalid rectangle sizes and coordinates do not mutate the plan', () => {
  const p = emptyPlan();
  for (const b of [{x:0,y:2},{x:.4,y:3},{x:101,y:3},{x:Infinity,y:3},{x:2,y:NaN}]) assert.throws(()=>addRectangle(p,{x:0,y:0},b));
  assert.throws(()=>addRectangle(p,{x:999,y:999},{x:1002,y:1002}));
  assert.equal(p.walls.length,0); assert.equal(p.labels.length,0);
});


function simpleWall() {
  return { ...emptyPlan(), walls:[{id:'wall',a:{x:0,y:0},b:{x:6,y:0},thickness:.2}],openings:[{id:'left',wallId:'wall',t:1/6,width:.8,kind:'door',hinge:'end',swing:'positive'},{id:'right',wallId:'wall',t:5/6,width:1,kind:'window'}] };
}
function openingPosition(p,o) { const w=p.walls.find(w=>w.id===o.wallId);return {x:w.a.x+(w.b.x-w.a.x)*o.t,y:w.a.y+(w.b.y-w.a.y)*o.t}; }
test('v3 migrates with legacy thickness and accepts explicit thickness',()=>{
  const p={...sample(),version:3};const next=validatePlan(p);assert.equal(next.version,5);assert.equal(wallThickness(next.walls[0]),.105);
  const explicit=simpleWall();assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(explicit))),explicit);
  for(const thickness of [0,.049,.601,NaN,'15',null]){const bad=simpleWall();bad.walls[0].thickness=thickness;assert.throws(()=>validatePlan(bad));}
});
test('moving B retains opening distances from stationary A',()=>{
  const p=simpleWall();const next=moveWallEndpoint(p,'wall','b',{x:8,y:0});
  assert.deepEqual(next.openings.map(o=>openingPosition(next,o)),[{x:1,y:0},{x:5,y:0}]);
  const diagonal=moveWallEndpoint(p,'wall','b',{x:6,y:8});
  assert.ok(Math.abs(distance(diagonal.walls[0].a,openingPosition(diagonal,diagonal.openings[1]))-5)<1e-9);
  assert.equal(diagonal.openings[0].hinge,'end');assert.equal(diagonal.openings[0].swing,'positive');
});
test('moving A retains opening distances from stationary B',()=>{
  const p=simpleWall();const next=moveWallEndpoint(p,'wall','a',{x:-2,y:0});
  assert.deepEqual(next.openings.map(o=>openingPosition(next,o)),[{x:1,y:0},{x:5,y:0}]);
});
test('shared endpoints move together without moving the other ends',()=>{
  const p=simpleWall();p.walls.push({id:'neighbor',a:{x:6,y:0},b:{x:6,y:4}});
  const next=moveWallEndpoint(p,'wall','b',{x:8,y:0});
  assert.deepEqual(next.walls[1].a,{x:8,y:0});assert.deepEqual(next.walls[1].b,{x:6,y:4});assert.equal(p.walls[1].a.x,6);
});
test('wall translation moves its openings by the same displacement',()=>{
  const p=simpleWall();const next=translateWall(p,'wall',{x:2,y:3});
  assert.deepEqual(next.openings.map(o=>openingPosition(next,o)),[{x:3,y:3},{x:7,y:3}]);
});
test('impossible shortening and overlapping wall movements are atomic',()=>{
  const p=simpleWall();const before=JSON.stringify(p);
  assert.throws(()=>moveWallEndpoint(p,'wall','b',{x:4,y:0}));assert.equal(JSON.stringify(p),before);
  assert.throws(()=>moveWallEndpoint(p,'wall','b',{x:0,y:0}));
  const q=emptyPlan();q.walls=[{id:'a',a:{x:0,y:0},b:{x:2,y:0}},{id:'b',a:{x:3,y:0},b:{x:5,y:0}}];
  assert.throws(()=>moveWallEndpoint(q,'a','b',{x:4,y:0}),/superpone/);
});
test('splitting preserves opening world coordinates, orientation and wall thickness',()=>{
  const p=simpleWall();const next=splitWall(p,'wall',3);
  assert.equal(next.walls.length,2);assert.equal(next.walls[0].id,'wall');assert.deepEqual(next.walls[0].b,next.walls[1].a);
  assert.deepEqual(next.openings.map(o=>openingPosition(next,o)),p.openings.map(o=>openingPosition(p,o)));
  assert.notEqual(next.openings[0].wallId,next.openings[1].wallId);assert.ok(next.walls.every(w=>w.thickness===.2));
  assert.equal(next.openings[0].hinge,'end');assert.equal(next.openings[0].swing,'positive');
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(next))),next);
});
test('splitting diagonal and reverse-directed walls keeps opening positions',()=>{
  for(const [a,b] of [[{x:6,y:8},{x:0,y:0}],[{x:0,y:0},{x:6,y:8}]]){
    const p=simpleWall();p.walls[0].a=a;p.walls[0].b=b;const next=splitWall(p,'wall',5);
    for(let i=0;i<p.openings.length;i++)assert.ok(distance(openingPosition(p,p.openings[i]),openingPosition(next,next.openings[i]))<1e-9);
  }
});
test('cuts through openings, invalid distances and tiny fragments are rejected',()=>{
  const p=simpleWall();const before=JSON.stringify(p);
  for(const at of [NaN,Infinity,-1,0,.19,5.81,6,1,1.41,5])assert.throws(()=>splitWall(p,'wall',at));
  assert.equal(JSON.stringify(p),before);
});
test('bounds account for thick wall strokes',()=>{
  const p=emptyPlan();p.walls=[{id:'w',a:{x:0,y:0},b:{x:4,y:0},thickness:.6}];const b=planBounds(p,0);
  assert.equal(b.x,-.3);assert.equal(b.y,-.3);assert.ok(Math.abs(b.width-4.6)<1e-9);assert.equal(b.height,.6);
});

test('T junction follows a tilted supporting wall',()=>{
  const p=emptyPlan();p.walls=[{id:'main',a:{x:0,y:0},b:{x:6,y:0}},{id:'branch',a:{x:3,y:0},b:{x:3,y:4}}];
  const next=moveWallEndpoint(p,'main','b',{x:6,y:2});
  assert.ok(project(next.walls[1].a,next.walls[0]).distance<1e-9);
  assert.ok(Math.abs(distance(next.walls[0].a,next.walls[1].a)-3)<1e-9);
  assert.deepEqual(next.walls[1].b,{x:3,y:4});
});
test('sample bathroom remains attached when the exterior wall tilts',()=>{
  const next=moveWallEndpoint(sample(),'w1','b',{x:9,y:0});
  assert.ok(project(next.walls.find(w=>w.id==='w6').b,next.walls.find(w=>w.id==='w2')).distance<1e-9);
});
test('T junction may slide along its parent but cannot detach silently',()=>{
  const p=emptyPlan();p.walls=[{id:'main',a:{x:0,y:0},b:{x:6,y:0}},{id:'branch',a:{x:3,y:0},b:{x:3,y:4}}];
  assert.throws(()=>moveWallEndpoint(p,'branch','a',{x:3,y:1}),/unión en T/);
  assert.deepEqual(moveWallEndpoint(p,'branch','a',{x:4,y:0}).walls[1].a,{x:4,y:0});
});

test('manual dimensions measure diagonal distances and preserve signed offsets',()=>{
 const p=addDimension(emptyPlan(),{x:0,y:0},{x:3,y:4},{x:-4,y:3});const g=dimensionGeometry(p.dimensions[0]);
 assert.equal(g.length,5);assert.equal(p.dimensions[0].offset,5);assert.deepEqual(g.a,{x:-4,y:3});
 assert.equal(dimensionOffset({x:0,y:0},{x:4,y:0},{x:2,y:-2}),-2);
 assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);
});
test('v4 migrates to empty dimensions; v5 requires a valid collection',()=>{
 const p=sample();delete p.dimensions;p.version=4;assert.deepEqual(validatePlan(p).dimensions,[]);
 p.version=5;assert.throws(()=>validatePlan(p));
});
test('invalid dimensions reject atomically and ids share the global namespace',()=>{
 const base=emptyPlan();assert.throws(()=>addDimension(base,{x:0,y:0},{x:0,y:0},{x:1,y:1}));assert.equal(base.dimensions.length,0);
 const p=addDimension(sample(),{x:0,y:0},{x:2,y:0},{x:0,y:1});
 for(const patch of [{offset:NaN},{offset:101},{a:{x:1001,y:0}},{b:{x:0,y:0}},{id:'w1'}])assert.throws(()=>validatePlan({...p,dimensions:[{...p.dimensions[0],...patch}]}));
 assert.throws(()=>validatePlan({...p,dimensions:Array.from({length:501},(_,i)=>({...p.dimensions[0],id:'dim'+i}))}));
});
test('framing includes detached dimension lines and endpoints',()=>{
 const p=addDimension(emptyPlan(),{x:0,y:0},{x:4,y:0},{x:0,y:-8});const b=planBounds(p,0);
 assert.ok(b.y<=-9);assert.ok(b.y+b.height>=0);assert.ok(b.x+b.width>=4);
});
test('manual dimensions stay independent when walls change',()=>{
 const p=addDimension(sample(),{x:0,y:0},{x:8,y:0},{x:0,y:-1});
 assert.deepEqual(moveWallEndpoint(p,'w1','b',{x:9,y:0}).dimensions,p.dimensions);
});
