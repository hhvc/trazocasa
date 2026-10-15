import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./model.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validatePlan, sample, fitOpening, project, distance, emptyPlan, furnitureCorners, planBounds } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('example survives file round trip', () => { const p = sample(); assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))), p); });
test('reject incompatible and malformed files', () => { for (const p of [null, {}, { ...sample(), version: 99 }, { ...sample(), walls: [{ id: 'x', a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }] }]) assert.throws(() => validatePlan(p)); });
test('reject nonfinite geometry and duplicated identifiers', () => { const p = sample(); p.walls[0].a.x = Infinity; assert.throws(() => validatePlan(p)); const q = sample(); q.labels[0].id = q.walls[0].id; assert.throws(() => validatePlan(q)); });
test('openings stay inside walls and cannot overlap', () => { const p = sample(), w = p.walls[0]; assert.equal(fitOpening(p, w, .28, 1), null); assert.equal(fitOpening(p, w, .5, 9), null); const t = fitOpening({ ...p, openings: [] }, w, 0, 1); assert.ok(t > 0); assert.ok(t * distance(w.a, w.b) >= .5); const q = sample(); q.openings.push({ ...q.openings[0], id: 'duplicate-opening' }); assert.throws(() => validatePlan(q)); });
test('reject missing wall references and out of range openings', () => { const p = sample(); p.openings[0].wallId = 'missing'; assert.throws(() => validatePlan(p)); const q = sample(); q.openings[0].t = 2; assert.throws(() => validatePlan(q)); });
test('project onto horizontal, vertical, diagonal segments', () => { assert.equal(project({ x: 2, y: 3 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }).t, .5); assert.equal(project({ x: 3, y: 2 }, { a: { x: 0, y: 0 }, b: { x: 0, y: 4 } }).t, .5); assert.equal(project({ x: 2, y: 2 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 4 } }).t, .5); assert.equal(project({ x: 9, y: 0 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }).t, 1); });


test('legacy v1 plans migrate without changing their walls or openings', () => {
  const { furniture, ...legacy } = sample(); legacy.version = 1;
  const migrated = validatePlan(JSON.parse(JSON.stringify(legacy)));
  assert.equal(migrated.version, 2); assert.deepEqual(migrated.furniture, []);
  assert.deepEqual(migrated.walls, legacy.walls); assert.deepEqual(migrated.openings, legacy.openings);
  assert.deepEqual(migrated.labels, legacy.labels);
});
test('v2 files require an explicit furniture collection', () => {
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
