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
