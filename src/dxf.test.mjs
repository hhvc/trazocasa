import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = s => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const modelUrl = url(compile(await readFile(new URL('./model.ts', import.meta.url), 'utf8')));
const { emptyPlan, sample, buildingFromPlan, validateBuilding, furnitureCorners, furnitureCatalog } = await import(modelUrl);
const { createFloorDxf, cadPoint, dxfLayers, dxfNotices } = await import(url(compile(await readFile(new URL('./dxf.ts', import.meta.url), 'utf8')).replace("'./model'", JSON.stringify(modelUrl))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const tags = content => { const lines = content.trimEnd().split(/\r?\n/); assert.equal(lines.length % 2, 0); return Array.from({ length: lines.length / 2 }, (_, i) => [Number(lines[i * 2]), lines[i * 2 + 1]]); };
const entities = content => {
  const result = []; let entity;
  for (const [code, value] of tags(content)) { if (code === 0) { entity = { type: value, data: [] }; result.push(entity); } else entity?.data.push([code, value]); }
  return result;
};
const get = (e, code) => e.data.find(t => t[0] === code)?.[1];
const identity = e => { const start = e.data.findIndex(([c, v]) => c === 1001 && v === 'TRAZOCASA'); return start < 0 ? null : JSON.parse(e.data.slice(start + 1).filter(([c]) => c === 1000).map(([, v]) => v).join('')); };
const of = (content, type, id) => entities(content).filter(e => e.type === type && (id === undefined || identity(e)?.id === id));
const vertices = e => e.data.flatMap(([code, x], i) => code === 10 ? [{ x: Number(x), y: Number(e.data[i + 1][1]) }] : []);
const base = () => ({ ...emptyPlan(), walls: [{ id: 'wall', a: { x: 2, y: 3 }, b: { x: 8, y: 3 }, thickness: .2 }], openings: [{ id: 'door', wallId: 'wall', kind: 'door', t: .25, width: 1 }, { id: 'window', wallId: 'wall', kind: 'window', t: .75, width: 1 }] });
function fixture() {
  const plan = base();
  plan.dimensions = [{ id: 'dim', a: { x: 2, y: 3 }, b: { x: 8, y: 3 }, offset: 1.2 }];
  plan.labels = [{ id: 'label', x: 3, y: 2, text: 'Baño – Á ñ {\\} %%d\nsegunda línea' }];
  plan.furniture = [
    { id: 'bed', kind: 'bed', x: 4, y: 5, width: 2, depth: 1, rotation: 30, groupId: 'group' },
    { id: 'stairs', kind: 'stairs', x: 6, y: 5, width: 1, depth: 3, rotation: 90, groupId: 'group' },
    { id: 'round', kind: 'roundCoffeeTable', x: 8, y: 6, width: .8, depth: .8, rotation: 0 },
  ];
  plan.surfaces = [{ id: 'surface', name: 'Salón', points: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 8 }, { x: 1, y: 8 }], slab: { thickness: .2 }, roof: { thickness: .2, height: 3 }, holes: [{ id: 'hole', name: 'Patio', target: 'both', points: [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 6 }, { x: 2, y: 6 }] }] }];
  plan.projections = [{ id: 'aux', name: 'Guía', closed: false, points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }];
  return validateBuilding({ format: 'trazocasa', version: 7, name: 'Casa Ñ', activeFloorId: 'ground', floors: [{ id: 'ground', name: 'Planta baja', elevation: -2, plan }, { id: 'upper', name: 'Planta alta', elevation: 4.2, plan: emptyPlan() }], views: [{ id: 'front', name: 'Frente', plan: emptyPlan() }] });
}
const exportPlan = p => { const b = buildingFromPlan(p); return createFloorDxf(b, b.activeFloorId).content; };

test('DXF uses metres and a single explicit XY reflection without recentering', () => {
  const b = fixture(), result = createFloorDxf(b, 'ground'), pairs = tags(result.content);
  for (const [key, expected] of [['$ACADVER', 'AC1021'], ['$INSUNITS', '6'], ['$MEASUREMENT', '1'], ['$ELEVATION', '0']]) assert.equal(pairs[pairs.findIndex(t => t[1] === key) + 1][1], expected);
  assert.deepEqual(cadPoint({ x: -17, y: 4 }), { x: -17, y: -4 });
  assert.equal(result.elevation, -2);
  assert.ok(result.filename.endsWith('-01-Planta baja.dxf'));
  const e = of(result.content, 'LWPOLYLINE', 'wall')[0];
  assert.deepEqual(vertices(e), [{ x: 2, y: -2.9 }, { x: 3, y: -2.9 }, { x: 3, y: -3.1 }, { x: 2, y: -3.1 }]);
  assert.equal(identity(e).floorId, 'ground'); assert.equal(identity(e).elevation, -2);
});
test('DXF contains the declared layers and cuts wall thickness at every opening', () => {
  const content = exportPlan(base());
  const layers = of(content, 'LAYER').map(e => get(e, 2));
  for (const name of Object.keys(dxfLayers)) assert.ok(layers.includes(name));
  const walls = of(content, 'LWPOLYLINE', 'wall'); assert.equal(walls.length, 3);
  assert.deepEqual(walls.map(e => [vertices(e)[0].x, vertices(e)[1].x]), [[2, 3], [4, 6], [7, 8]]);
  assert.ok(walls.every(e => get(e, 70) === '1' && get(e, 8) === 'MUROS'));
  assert.equal(of(content, 'LWPOLYLINE', 'window').length, 1);
  assert.equal(of(content, 'LINE', 'window').length, 2);
});
test('default wall thickness and oblique walls preserve metric geometry', () => {
  const p = base(); p.walls[0] = { ...p.walls[0], a: { x: -3, y: -4 }, b: { x: 3, y: 4 }, thickness: undefined }; p.openings = [];
  const v = vertices(of(exportPlan(p), 'LWPOLYLINE', 'wall')[0]);
  near(Math.hypot(v[1].x-v[0].x,v[1].y-v[0].y), 10);
  near(Math.hypot(v[2].x-v[1].x,v[2].y-v[1].y), .105);
});
test('door leaves and 90 degree arcs preserve all hinges and swing sides on rotated walls', () => {
  for (const degrees of [0, 90, 180, 37, 270]) for (const hinge of ['start', 'end']) for (const swing of ['negative', 'positive']) {
    const r = degrees * Math.PI/180, p = base();
    p.walls[0].b = { x: 2 + 6*Math.cos(r), y: 3 + 6*Math.sin(r) };
    p.openings = [{ ...p.openings[0], hinge, swing }];
    const content = exportPlan(p), arc = of(content, 'ARC', 'door')[0], line = of(content, 'LINE', 'door')[0];
    const cx = Number(get(arc,10)), cy = Number(get(arc,20));
    const along = 1.5 + (hinge === 'end' ? .5 : -.5), direction = swing === 'positive' ? 1 : -1;
    near(cx, 2+along*Math.cos(r)); near(cy, -(3+along*Math.sin(r)));
    near(Number(get(line,11)), cx-direction*Math.sin(r)); near(Number(get(line,21)), cy-direction*Math.cos(r));
    near((Number(get(arc,51))-Number(get(arc,50))+360)%360, 90);
    const endpoints = [50,51].map(code=>({x:cx+Math.cos(Number(get(arc,code))*Math.PI/180),y:cy+Math.sin(Number(get(arc,code))*Math.PI/180)}));
    assert.ok(endpoints.some(p=>Math.hypot(p.x-Number(get(line,11)),p.y-Number(get(line,21)))<1e-8));
  }
});
test('aligned dimensions retain definition points, offsets, true length and a display block', () => {
  for (const b of [{ x: 5, y: 7 }, { x: -1, y: -1 }, { x: 2, y: 8 }]) for (const offset of [-1.2, 0, 1.2]) {
    const p = emptyPlan(), a = { x: 2, y: 3 }, length = Math.hypot(b.x-a.x,b.y-a.y);
    p.dimensions = [{ id: 'dim', a, b, offset }];
    const content = exportPlan(p), dim = of(content, 'DIMENSION', 'dim')[0];
    near(Number(get(dim,13)), a.x); near(Number(get(dim,23)), -a.y);
    near(Number(get(dim,14)), b.x); near(Number(get(dim,24)), -b.y);
    near(Number(get(dim,10)), b.x-(b.y-a.y)/length*offset);
    near(Number(get(dim,20)), -b.y-(b.x-a.x)/length*offset);
    near(Number(get(dim,42)), length); assert.equal(get(dim,1), '<>'); assert.equal(get(dim,70), '161');
    assert.ok(of(content,'BLOCK').some(e=>get(e,2)===get(dim,2)));
  }
});
test('furniture blocks preserve size, position, rotation and source group', () => {
  const b = fixture(), content = createFloorDxf(b, 'ground').content;
  const insert = of(content,'INSERT','bed')[0];
  assert.equal(get(insert,10),'4'); assert.equal(get(insert,20),'-5'); assert.equal(get(insert,50),'330');
  assert.equal(identity(insert).groupId,'group');
  const es = entities(content), start = es.findIndex(e=>e.type==='BLOCK'&&get(e,2)===get(insert,2));
  const v = vertices(es[start+1]), r = Number(get(insert,50))*Math.PI/180;
  const placed = v.map(p=>({x:4+p.x*Math.cos(r)-p.y*Math.sin(r),y:-5+p.x*Math.sin(r)+p.y*Math.cos(r)}));
  for (const p of furnitureCorners(b.floors[0].plan.furniture[0]).map(cadPoint)) assert.ok(placed.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-8));
  assert.equal(of(content,'CIRCLE').length,1);
});
test('every furniture kind exports a block, including grouped staircase pieces', () => {
  const p = emptyPlan(); p.furniture = furnitureCatalog.map((f,i)=>({...f,id:`f${i}`,x:i*2,y:1,rotation:45}));
  assert.equal(of(exportPlan(p),'INSERT').length,furnitureCatalog.length);
});
test('surfaces, slab/roof holes and auxiliary projections remain distinguishable', () => {
  const b=fixture(), content=createFloorDxf(b,'ground').content;
  assert.equal(get(of(content,'LWPOLYLINE','surface')[0],70),'1');
  assert.deepEqual(of(content,'LWPOLYLINE','hole').map(e=>get(e,8)),['HUECOS_LOSA','HUECOS_CUBIERTA']);
  assert.equal(get(of(content,'LWPOLYLINE','aux')[0],70),'0');
  assert.equal(get(of(content,'LWPOLYLINE','aux')[0],8),'AUX_PROYECCIONES');
  assert.ok(of(content,'MTEXT','surface')[0].data.some(([,v])=>v.includes('56.00')));
});
test('text escapes preserve accents and literal CAD control sequences without tag injection', () => {
  const b=fixture(), p=b.floors[0].plan;
  p.labels[0].text='Baño {\\P} %%d\n0\nENDSEC';
  const content=createFloorDxf(b,'ground').content, text=of(content,'MTEXT','label')[0];
  const value=text.data.filter(([c])=>c===1||c===3).map(([,v])=>v).join('');
  assert.ok(value.includes('Baño')); assert.ok(value.includes('\\{\\\\P\\}')); assert.ok(value.includes('%{}%{}d'));
  assert.ok(value.includes('\\P0\\PENDSEC')); assert.equal(of(content,'EOF').length,1);
});
test('long and Unicode source identifiers survive bounded XDATA strings', () => {
  const p=base(); p.walls[0].id='ñ'.repeat(400)+'\n0\nEOF'; p.openings=[];
  const content=exportPlan(p), e=of(content,'LWPOLYLINE')[0];
  assert.equal(identity(e).id,p.walls[0].id);
  assert.ok(e.data.filter(([code])=>code===1000).every(([,v])=>Buffer.byteLength(v)<=255));
});
test('floor selection isolates geometry, carries levels and rejects auxiliary view IDs', () => {
  const b=fixture(), result=createFloorDxf(b,'upper');
  assert.equal(result.elevation,4.2); assert.equal(of(result.content,'LWPOLYLINE').length,0);
  assert.throws(()=>createFloorDxf(b,'missing')); assert.throws(()=>createFloorDxf(b,'front'));
  b.floors[1].elevation=undefined; near(createFloorDxf(b,'upper').elevation,1);
});
test('export is deterministic and never changes project, active floor or source identities', () => {
  const b=fixture(), before=JSON.stringify(b);
  const a=createFloorDxf(b,'upper'); assert.equal(a.content,createFloorDxf(b,'upper').content);
  createFloorDxf(b,'ground'); assert.equal(JSON.stringify(b),before);
  const e=buildingFromPlan(emptyPlan()); assert.ok(createFloorDxf(e,e.activeFloorId).content.endsWith('0\r\nEOF\r\n'));
});
test('unsupported content is reported and corrupt geometry cannot create a DXF', () => {
  const b=fixture(), notices=dxfNotices(b,'ground').join(' ');
  for(const term of ['simplificadas','bruta','volúmenes','AUX_PROYECCIONES','complementarias']) assert.ok(notices.includes(term));
  b.floors[0].plan.reference={}; assert.ok(dxfNotices(b,'ground').some(s=>s.includes('imagen de referencia')));
  b.floors[0].plan.walls[0].a.x=NaN; assert.throws(()=>createFloorDxf(b,'ground'));
});
test('DXF handles are unique and all entity owners and dimension styles resolve', () => {
  const content=createFloorDxf(fixture(),'ground').content, all=entities(content), handles=all.flatMap(e=>e.data.filter(([c])=>c===5||c===105).map(([,v])=>v));
  assert.equal(new Set(handles).size,handles.length);
  for (const e of all) for(const [c,v] of e.data) if((c===330||c===340)&&v!=='0') assert.ok(handles.includes(v),`Missing handle ${v}`);
});
// Optional reproducible fixtures for the independent ezdxf audit (see docs/dxf.md).
if (process.env.TRAZOCASA_DXF_FIXTURES) {
  const dir=process.env.TRAZOCASA_DXF_FIXTURES; await mkdir(dir,{recursive:true});
  const b=fixture(), s=buildingFromPlan(sample());
  for (const [name,project,id] of [['complete',b,'ground'],['empty-upper',b,'upper'],['example',s,s.activeFloorId]]) {
    await writeFile(`${dir}/${name}.dxf`,createFloorDxf(project,id).content);
    await writeFile(`${dir}/${name}.trazocasa`,JSON.stringify(project,null,2));
  }
  for (const hinge of ['start','end']) for(const swing of ['negative','positive']) {
    const p=base(); p.openings=[{...p.openings[0],hinge,swing}];
    await writeFile(`${dir}/door-${hinge}-${swing}.dxf`,exportPlan(p));
  }
}
