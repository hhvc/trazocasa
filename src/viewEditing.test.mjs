import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const modelUrl=url(compile(await readFile(new URL('./model.ts',import.meta.url),'utf8')));
const {emptyPlan,validatePlan}=await import(modelUrl);
const source=await readFile(new URL('./viewEditing.ts',import.meta.url),'utf8');
const {editView,resizeViewLine,moveViewVertex,splitViewLine,snapViewVertex}=await import(url(compile(source).replace("'./model'",JSON.stringify(modelUrl))));
const line=(id,a,b)=>({id,name:'',points:[a,b],closed:false});
const sample=()=>({...emptyPlan(),projections:[line('one',{x:0,y:0},{x:3,y:-4}),line('two',{x:3,y:-4},{x:6,y:-4}),line('other',{x:9,y:0},{x:9,y:-2})],dimensions:[{id:'dim',a:{x:0,y:0},b:{x:3,y:0},offset:1}],labels:[{id:'text',text:'Nivel',x:1,y:-1}]});
test('resizing keeps A, direction and coincident vertices; does not mutate original',()=>{
 const p=sample(),saved=JSON.stringify(p),next=resizeViewLine(p,'one',10);
 assert.deepEqual(next.projections[0].points,[{x:0,y:0},{x:6,y:-8}]);
 assert.deepEqual(next.projections[1].points[0],{x:6,y:-8});
 assert.deepEqual(next.projections[2],p.projections[2]);assert.equal(JSON.stringify(p),saved);
 assert.deepEqual(next.dimensions,p.dimensions);
});
test('moving an endpoint and moving an entire trace preserve joined vertices',()=>{
 const p=sample(),moved=moveViewVertex(p,'one',1,{x:2,y:-2});
 assert.deepEqual(moved.projections[1].points[0],{x:2,y:-2});
 const next=editView(p,{id:'one',kind:'trace'},{x:0,y:0},{x:1,y:2});
 assert.deepEqual(next.projections[0].points,[{x:1,y:2},{x:4,y:-2}]);
 assert.deepEqual(next.projections[1].points,[{x:4,y:-2},{x:6,y:-4}]);
 assert.deepEqual(next.projections[2],p.projections[2]);
});
test('invalid resize or collapsed connected edge fails atomically',()=>{
 const p=sample(),saved=JSON.stringify(p);
 for(const n of [NaN,Infinity,0,.09,101])assert.throws(()=>resizeViewLine(p,'one',n));
 assert.throws(()=>moveViewVertex(p,'one',1,{x:6,y:-4}));
 assert.throws(()=>moveViewVertex(p,'one',0,{x:1001,y:0}));
 assert.equal(JSON.stringify(p),saved);
});
test('split keeps total geometry and produces editable joined segments',()=>{
 const p=sample(),next=splitViewLine(p,'one',2);
 assert.equal(next.projections.length,4);
 assert.deepEqual(next.projections[0].points,[{x:0,y:0},{x:1.2,y:-1.6}]);
 assert.deepEqual(next.projections[1].points,[{x:1.2,y:-1.6},{x:3,y:-4}]);
 assert.notEqual(next.projections[0].id,next.projections[1].id);
 const moved=moveViewVertex(next,'one',1,{x:1,y:-2});
 assert.deepEqual(moved.projections[1].points[0],{x:1,y:-2});
 assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(moved))),moved);
 for(const at of [NaN,0,.05,4.95,5,6])assert.throws(()=>splitViewLine(p,'one',at));
});
test('closed contours move as a whole and individual vertices can be edited',()=>{
 const p={...emptyPlan(),projections:[{id:'rect',name:'',closed:true,points:[{x:0,y:0},{x:4,y:0},{x:4,y:-3},{x:0,y:-3}]}]};
 const next=editView(p,{id:'rect',kind:'trace'},{x:2,y:-2},{x:3,y:-1});
 assert.deepEqual(next.projections[0].points,p.projections[0].points.map(q=>({x:q.x+1,y:q.y+1})));
 const vertex=editView(p,{id:'rect',kind:'vertex',vertex:2},{x:4,y:-3},{x:5,y:-4});
 assert.deepEqual(vertex.projections[0].points[2],{x:5,y:-4});
 assert.throws(()=>resizeViewLine(p,'rect',2));assert.throws(()=>splitViewLine(p,'rect',2));
});
test('dimension dragging changes only offset, endpoint dragging only chosen end',()=>{
 const p=sample(),next=editView(p,{id:'dim',kind:'dimension'},{x:1,y:1},{x:2,y:3});
 assert.equal(next.dimensions[0].offset,3);
 assert.deepEqual(next.dimensions[0].a,p.dimensions[0].a);assert.deepEqual(next.dimensions[0].b,p.dimensions[0].b);
 const endpoint=editView(p,{id:'dim',kind:'dimensionEndpoint',end:'b'},{x:3,y:0},{x:4,y:2});
 assert.deepEqual(endpoint.dimensions[0].b,{x:4,y:2});assert.equal(endpoint.dimensions[0].offset,1);
 assert.throws(()=>editView(p,{id:'dim',kind:'dimensionEndpoint',end:'b'},{x:3,y:0},{x:0,y:0}));
});
test('text moves without changing its content; snapping excludes moving vertices',()=>{
 const p=sample(),next=editView(p,{id:'text',kind:'label'},{x:1,y:-1},{x:4,y:2});
 assert.deepEqual(next.labels[0],{id:'text',text:'Nivel',x:4,y:2});
 assert.deepEqual(snapViewVertex(p,{x:3.03,y:-4.02},.2),{x:3,y:-4});
 assert.equal(snapViewVertex(p,{x:3.03,y:-4.02},.2,[{x:3,y:-4}]),undefined);
});
