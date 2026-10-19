import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const modelUrl=url(compile(await readFile(new URL('./model.ts',import.meta.url),'utf8')));
const {buildingFromPlan,emptyPlan}=await import(modelUrl);
const lib=await import(url(compile(await readFile(new URL('./library.ts',import.meta.url),'utf8')).replace("'./model'",JSON.stringify(modelUrl))));
function storage(){let raw=null;return {getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};}
const record=()=>({id:'project-a',updated:new Date().toISOString(),deleted:false,building:buildingFromPlan(emptyPlan())});
test('library round trip preserves complete project and trash status',()=>{const item=record();item.deleted=true;const store=storage();lib.writeLibrary([item],store);assert.deepEqual(lib.readLibrary(store),[item]);});
test('invalid backups and duplicate project IDs are rejected',()=>{assert.throws(()=>lib.parseLibrary({format:'wrong',projects:[]}));const item=record();assert.throws(()=>lib.parseLibrary({format:'trazocasa-library-1',projects:[item,item]}));assert.throws(()=>lib.parseLibrary({format:'trazocasa-library-1',projects:[{...item,building:{}}]}));});
test('failed persistence does not report success or replace prior data',()=>{const store=storage();const item=record();lib.writeLibrary([item],store);const before=store.getItem();assert.throws(()=>lib.writeLibrary([],{setItem(){throw new Error('QuotaExceededError');}}));assert.equal(store.getItem(),before);});
test('updates preserve other projects and never revive a trashed project',()=>{globalThis.localStorage=storage();const item=record();lib.writeLibrary([item,{...item,id:'trash',deleted:true}]);lib.storeProject('new',item.building);lib.storeProject('trash',item.building);assert.equal(lib.readLibrary().length,3);assert.equal(lib.readLibrary().find(p=>p.id==='trash').deleted,true);lib.storeProject(item.id,{...item.building,name:'Changed'});assert.equal(lib.readLibrary().find(p=>p.id===item.id).building.name,'Changed');delete globalThis.localStorage;});

const templates=await import(url(compile(await readFile(new URL('./templates.ts',import.meta.url),'utf8')).replace("'./model'",JSON.stringify(modelUrl))));
test('all starter templates validate and create independent editable projects',()=>{
 for(const id of ['blank','studio','one','two']){
  const first=templates.createTemplate(id,'Mi casa');const second=templates.createTemplate(id,'Otra casa');
  assert.equal(first.name,'Mi casa');assert.equal(second.name,'Otra casa');
  if(id!=='blank'){assert.ok(first.walls.length);assert.ok(first.openings.some(o=>o.kind==='door'));assert.ok(first.furniture.length);}
  first.labels.push({id:'test',x:0,y:0,text:'Only first'});assert.ok(!second.labels.some(l=>l.id==='test'));
 }
});
const printModule=await import(url(compile(await readFile(new URL('./printLayout.ts',import.meta.url),'utf8'))));
test('print scale converts metres to physical millimetres without shrinking',()=>{
 const a=printModule.printLayout(8,6,{paper:'A4',orientation:'landscape',scale:'50'});
 assert.equal(a.drawingWidth,160);assert.equal(a.drawingHeight,120);assert.equal(a.mmPerMetre,20);assert.equal(a.fits,true);
 const b=printModule.printLayout(20,10,{paper:'A4',orientation:'landscape',scale:'50'});
 assert.equal(b.drawingWidth,400);assert.equal(b.fits,false);
 const c=printModule.printLayout(20,10,{paper:'A4',orientation:'landscape',scale:'100'});
 assert.equal(c.drawingWidth,200);assert.equal(c.fits,true);
});
test('fit respects printable bounds and orientation for both paper sizes',()=>{
 for(const paper of ['A4','A3'])for(const orientation of ['portrait','landscape']){
  const x=printModule.printLayout(30,20,{paper,orientation,scale:'fit'});
  assert.equal(x.fits,true);assert.ok(x.drawingWidth<=x.availableWidth+.001);assert.ok(x.drawingHeight<=x.availableHeight+.001);
  assert.ok(Math.abs(x.drawingWidth/x.drawingHeight-1.5)<1e-8);
 }
 assert.throws(()=>printModule.printLayout(0,1,{paper:'A4',orientation:'portrait',scale:'fit'}));
});
