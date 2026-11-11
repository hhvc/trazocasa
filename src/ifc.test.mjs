import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = s => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const modelUrl = url(compile(await readFile(new URL('./model.ts', import.meta.url), 'utf8')));
const { emptyPlan, sample, validateBuilding } = await import(modelUrl);
const { createBuildingIfc, ifcGlobalId, ifcString, ifcSummary } = await import(url(compile(await readFile(new URL('./ifc.ts', import.meta.url), 'utf8')).replace("'./model'", JSON.stringify(modelUrl))));
const options = { projectId: 'test-project', createdAt: new Date('2026-11-10T00:00:00Z') };
const rect = (x,y,w,d) => [{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}];
const building = (plan=emptyPlan()) => ({format:'trazocasa',version:7,name:'Casa de prueba',activeFloorId:'ground',floors:[{id:'ground',name:'Planta baja',elevation:-1.2,plan}]});
function fixture() {
  const p=emptyPlan();
  const points=rect(-2,1,6,4);
  p.walls=points.map((a,i)=>({id:`wall-${i}`,a,b:points[(i+1)%4],thickness:.2,height:3,appearance:{color:'#aabbcc',finish:'paint'}}));
  p.openings=[{id:'door',wallId:'wall-0',kind:'door',t:.25,width:1,height:2,hinge:'end',swing:'positive'}, {id:'window',wallId:'wall-0',kind:'window',t:.7,width:1.2,height:1.2,sill:.8}];
  p.surfaces=[{id:'plate',name:"Salón 'Norte' \\ Ñ",points,slab:{thickness:.25},roof:{height:3,thickness:.2},holes:[{id:'patio',name:'Patio',target:'both',points:rect(0,2,1,1)}]}];
  p.labels=[{id:'label',x:0,y:0,text:'Auxiliar'}];
  p.dimensions=[{id:'dimension',a:{x:0,y:0},b:{x:6,y:0},offset:1}];
  p.projections=[{id:'projection',name:'Auxiliar',closed:false,points:[{x:0,y:0},{x:1,y:1}]}];
  p.furniture=[{id:'stairs',kind:'stairs',x:1,y:3,width:1,depth:3,rotation:90,height:3}];
  const b=building(p);
  b.floors.push({id:'upper',name:'Planta alta',elevation:3.5,plan:{...emptyPlan(),walls:[{id:'wall-0',a:{x:-5,y:-4},b:{x:-1,y:-1},thickness:.3,height:3}],openings:[{id:'door',wallId:'wall-0',kind:'door',t:.5,width:1,height:2}]}});
  b.views=[{id:'view',name:'Frente',plan:emptyPlan()}];
  return validateBuilding(b);
}
function pitched(kind, concave=false) {
  const p=emptyPlan();
  const points=concave?[{x:0,y:0},{x:6,y:0},{x:6,y:2},{x:2,y:2},{x:2,y:6},{x:0,y:6}]:rect(0,0,6,4);
  p.surfaces=[{id:'roof',name:'Cubierta '+kind,points,roof:{height:3,thickness:.2,shape:{kind,slope:25,direction:0},fitWalls:true},holes:[{id:'roof-hole',name:'Lucernario',target:'roof',points:rect(.5,.5,1,1)}]}];
  p.walls=[{id:'under-roof',a:{x:0,y:0},b:{x:6,y:0},thickness:.2,height:2.8}];
  p.openings=[{id:'under-door',wallId:'under-roof',kind:'door',t:.5,width:1,height:2}];
  return validateBuilding(building(p));
}
const rows=(text,type)=>text.split(/\r?\n/).filter(line=>new RegExp(`^#\\d+=${type}\\(`).test(line));
const ids=(text,type)=>rows(text,type).map(line=>line.match(/\('([^']+)'/)[1]).sort();

test('IFC GlobalIds are valid, deterministic and unambiguous for arbitrary source IDs',async()=>{
  const a=await ifcGlobalId('floor','wall','ñ');
  assert.match(a,/^[0-3][0-9A-Za-z_$]{21}$/);
  assert.equal(a,await ifcGlobalId('floor','wall','ñ'));
  assert.notEqual(a,await ifcGlobalId('floor2','wall','ñ'));
  assert.notEqual(await ifcGlobalId('a/b','c'),await ifcGlobalId('a','b/c'));
});
test('STEP strings escape syntax, Unicode, newlines and literal control sequences',()=>{
  assert.equal(ifcString("O'Brien"),"'O''Brien'");
  assert.equal(ifcString('Ñ'),"'\\X2\\00D1\\X0\\'");
  assert.ok(ifcString('\\X2\\\n;ENDSEC;').includes('005C000A'));
  assert.ok(!ifcString('a\nb').includes('\n'));
});
test('IFC4 declares metric units and the full project/site/building/storey hierarchy',async()=>{
  const {content,counts}=await createBuildingIfc(fixture(),options);
  assert.ok(content.includes("FILE_SCHEMA(('IFC4'))"));
  assert.ok(content.includes('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'));
  assert.equal(rows(content,'IFCPROJECT').length,1);assert.equal(rows(content,'IFCSITE').length,1);
  assert.equal(rows(content,'IFCBUILDING').length,1);assert.equal(rows(content,'IFCBUILDINGSTOREY').length,2);
  assert.equal(rows(content,'IFCRELAGGREGATES').length,3);
  assert.deepEqual(counts,{floors:2,walls:5,slabs:1,roofs:1,doors:2,windows:1});
  assert.ok(rows(content,'IFCBUILDINGSTOREY').some(s=>s.endsWith(',-1.2);')));
  assert.ok(rows(content,'IFCBUILDINGSTOREY').some(s=>s.endsWith(',3.5);')));
});
test('construction classes and real void/filling relationships replace proxy meshes',async()=>{
  const {content}=await createBuildingIfc(fixture(),options);
  for(const [type,count] of [['IFCWALL',5],['IFCSLAB',1],['IFCROOF',1],['IFCDOOR',2],['IFCWINDOW',1],['IFCOPENINGELEMENT',5],['IFCRELVOIDSELEMENT',5],['IFCRELFILLSELEMENT',3],['IFCRELCONTAINEDINSPATIALSTRUCTURE',2]]) assert.equal(rows(content,type).length,count,type);
  assert.equal(rows(content,'IFCBUILDINGELEMENTPROXY').length,0);
  assert.equal(rows(content,'IFCTRIANGULATEDFACESET').length,0);
  assert.ok(rows(content,'IFCDOOR').some(s=>s.includes(',2.,1.,.DOOR.,.NOTDEFINED.')));
  assert.ok(rows(content,'IFCPROPERTYSINGLEVALUE').some(s=>s.includes("'Hinge',$,IFCTEXT('end')")));
});
test('IDs survive renaming, reordering, geometry edits and local project reimport',async()=>{
  const b=fixture(),original=(await createBuildingIfc(b,options)).content;
  b.name='Otro nombre';b.floors.reverse();b.activeFloorId='upper';b.floors[0].name='Renombrada';b.floors[0].plan.walls[0].thickness=.4;
  const changed=(await createBuildingIfc(b,options)).content;
  for(const type of ['IFCPROJECT','IFCBUILDING','IFCBUILDINGSTOREY','IFCWALL','IFCSLAB','IFCROOF','IFCDOOR','IFCOPENINGELEMENT']) assert.deepEqual(ids(original,type),ids(changed,type));
  const imported=(await createBuildingIfc(b,{...options,projectId:'new-local-library-id'})).content;
  assert.deepEqual(ids(original,'IFCWALL'),ids(imported,'IFCWALL'));
  assert.notDeepEqual(ids(original,'IFCPROJECT'),ids(imported,'IFCPROJECT'));
});
test('IDs remain stable when adding/removing another floor and differ across element roles',async()=>{
  const b=fixture(), first=(await createBuildingIfc(b,options)).content;
  b.floors.push({id:'empty-new',name:'Nueva',plan:emptyPlan()});
  const added=(await createBuildingIfc(b,options)).content;
  assert.deepEqual(ids(first,'IFCWALL'),ids(added,'IFCWALL'));
  assert.deepEqual(ids(first,'IFCSLAB'),ids(added,'IFCSLAB'));
  assert.notEqual(ids(first,'IFCSLAB')[0],ids(first,'IFCROOF')[0]);
  assert.equal(new Set(ids(first,'IFCWALL')).size,5); // same wall ID on different floors
});
test('pitched roofs and their walls have solid clipping geometry for all supported shapes',async()=>{
  for(const kind of ['shed','gable','halfHip','hip','perimeter']) {
    const {content}=await createBuildingIfc(pitched(kind),options);
    assert.ok(rows(content,'IFCBOOLEANRESULT').some(s=>s.includes('.DIFFERENCE.')));
    assert.ok(rows(content,'IFCBOOLEANCLIPPINGRESULT').length>0);
    assert.ok(rows(content,'IFCSHAPEREPRESENTATION').some(s=>s.includes("'Body','Clipping'")));
    assert.ok(rows(content,'IFCSHAPEREPRESENTATION').some(s=>s.includes("'Body','CSG'")));
    assert.equal(rows(content,'IFCRELVOIDSELEMENT').length,2);
  }
});
test('plain contours never become IfcSpace, slabs or roofs without construction data',async()=>{
  const p=emptyPlan();p.surfaces=[{id:'s',name:'Área manual',points:rect(0,0,4,3)}];
  const b=building(p), {content,notices}=await createBuildingIfc(b,options);
  assert.equal(rows(content,'IFCSPACE').length,0);assert.equal(rows(content,'IFCSLAB').length,0);assert.equal(rows(content,'IFCROOF').length,0);
  assert.ok(notices.some(n=>n.includes('1 contornos')));
});
test('omission report counts furniture, drawing content and unhosted holes',()=>{
  const b=fixture(),p=b.floors[0].plan;
  p.surfaces.push({id:'plain',name:'Manual',points:rect(10,0,4,4),holes:[{id:'unhosted',name:'Sin placa',target:'slab',points:rect(11,1,1,1)}]});
  const notices=ifcSummary(b).notices.join(' ');
  for(const term of ['1 elementos','1 contornos','1 huecos','textos','DXF','resistencia al fuego']) assert.ok(notices.includes(term),term);
});
test('empty and example buildings export without mutating saved data or active floor',async()=>{
  for(const b of [building(),fixture(),building(sample())]) {
    const original=JSON.stringify(b);
    const a=await createBuildingIfc(b,options),c=await createBuildingIfc(b,options);
    assert.equal(a.content,c.content);assert.equal(JSON.stringify(b),original);
    assert.ok(a.content.endsWith('END-ISO-10303-21;\r\n'));
  }
});
test('IFC source references resolve and GlobalIds are unique within a file',async()=>{
  const {content}=await createBuildingIfc(fixture(),options);
  const declared=[...content.matchAll(/^#(\d+)=/gm)].map(m=>m[1]), refs=[...content.matchAll(/#(\d+)/g)].map(m=>m[1]);
  assert.equal(new Set(declared).size,declared.length);
  for(const ref of refs) assert.ok(declared.includes(ref));
  const globalIds=[...content.matchAll(/^#\d+=IFC\w+\('([0-3][0-9A-Za-z_$]{21})'/gm)].map(m=>m[1]);
  assert.equal(new Set(globalIds).size,globalIds.length);
});
test('invalid geometry, identity or dates fail before producing a partial file',async()=>{
  const b=fixture();b.floors[0].plan.walls[0].a.x=NaN;
  await assert.rejects(()=>createBuildingIfc(b,options));
  await assert.rejects(()=>createBuildingIfc(building(),{...options,projectId:''}));
  await assert.rejects(()=>createBuildingIfc(building(),{...options,createdAt:new Date('invalid')}));
});

if(process.env.TRAZOCASA_IFC_FIXTURES) {
  const dir=process.env.TRAZOCASA_IFC_FIXTURES;await mkdir(dir,{recursive:true});
  const fixtures=[['complete',fixture()],['empty',building()],['example',building(sample())],...['shed','gable','halfHip','hip','perimeter'].map(kind=>['roof-'+kind,pitched(kind)]),['concave-gable',pitched('gable',true)]];
  const reversed=fixture();for(const s of reversed.floors[0].plan.surfaces){s.points.reverse();s.holes.forEach(h=>h.points.reverse());}fixtures.push(['reversed',reversed]);
  for(const [name,b] of fixtures) {
    await writeFile(`${dir}/${name}.ifc`,(await createBuildingIfc(b,options)).content);
    await writeFile(`${dir}/${name}.trazocasa`,JSON.stringify(b,null,2));
  }
}
