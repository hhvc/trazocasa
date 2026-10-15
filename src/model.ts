export type Point = { x: number; y: number };
export type Wall = { id: string; a: Point; b: Point };
export type Opening = { id: string; wallId: string; t: number; width: number; kind: 'door' | 'window' };
export type Label = { id: string; x: number; y: number; text: string };
export type Plan = { format: 'trazocasa'; version: 1; name: string; walls: Wall[]; openings: Opening[]; labels: Label[] };
export const uid = () => crypto.randomUUID();
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export const snap = (n: number) => Math.round(n * 10) / 10;
export function project(p: Point, w: Wall) {
  const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
  const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / (dx * dx + dy * dy)));
  const point = { x: w.a.x + dx * t, y: w.a.y + dy * t };
  return { t, point, distance: distance(p, point) };
}
export function fitOpening(plan: Plan, wall: Wall, t: number, width: number, ignoreId?: string) {
  const length = distance(wall.a, wall.b);
  if (width > length - .1 || width < .3) return null;
  const half = width / length / 2;
  const center = Math.max(half + .025 / length, Math.min(1 - half - .025 / length, t));
  if (plan.openings.some(o => o.wallId === wall.id && o.id !== ignoreId && Math.abs(o.t - center) * length < (o.width + width) / 2 + .05)) return null;
  return center;
}
export function validatePlan(value: unknown): Plan {
  if (!value || typeof value !== 'object') throw new Error('El archivo no contiene un proyecto válido.');
  const p = value as Plan;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000;
  const point = (v: Point) => v && finite(v.x) && finite(v.y);
  if (p.format !== 'trazocasa' || p.version !== 1 || typeof p.name !== 'string' || p.name.length > 100 || !Array.isArray(p.walls) || !Array.isArray(p.openings) || !Array.isArray(p.labels) || p.walls.length > 2000 || p.openings.length > 2000 || p.labels.length > 500) throw new Error('Formato incompatible. Elegí un archivo .trazocasa de versión 1.');
  const ids = new Set<string>();
  for (const o of [...p.walls, ...p.openings, ...p.labels]) {
    if (!o || typeof o.id !== 'string' || !o.id || ids.has(o.id)) throw new Error('El proyecto contiene identificadores inválidos.');
    ids.add(o.id);
  }
  for (const w of p.walls) if (!point(w.a) || !point(w.b) || distance(w.a, w.b) < .2) throw new Error('El proyecto contiene paredes inválidas.');
  const checked: Plan = { ...p, openings: [] };
  for (const o of p.openings) {
    const w = p.walls.find(w => w.id === o.wallId);
    if (!w || !finite(o.t) || !finite(o.width) || !['door', 'window'].includes(o.kind)) throw new Error('El proyecto contiene aberturas inválidas.');
    const t = fitOpening(checked, w, o.t, o.width);
    if (t === null || Math.abs(t - o.t) > .00001) throw new Error('Hay aberturas superpuestas o fuera de una pared.');
    checked.openings.push(o);
  }
  for (const l of p.labels) if (!point(l) || typeof l.text !== 'string' || l.text.length > 80) throw new Error('El proyecto contiene etiquetas inválidas.');
  return { format: 'trazocasa', version: 1, name: p.name, walls: p.walls.map(w => ({ id: w.id, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y } })), openings: p.openings.map(o => ({ id: o.id, wallId: o.wallId, t: o.t, width: o.width, kind: o.kind })), labels: p.labels.map(l => ({ id: l.id, x: l.x, y: l.y, text: l.text })) };
}
export function sample(): Plan {
  const wall = (id: string, x: number, y: number, x2: number, y2: number): Wall => ({ id, a: { x, y }, b: { x: x2, y: y2 } });
  return { format: 'trazocasa', version: 1, name: 'Mi primera casa', walls: [wall('w1', 0, 0, 8, 0), wall('w2', 8, 0, 8, 6), wall('w3', 8, 6, 0, 6), wall('w4', 0, 6, 0, 0), wall('w5', 4.8, 0, 4.8, 6), wall('w6', 4.8, 3.6, 8, 3.6)], openings: [{ id: 'd1', wallId: 'w3', t: .72, width: 1, kind: 'door' }, { id: 'd2', wallId: 'w5', t: .35, width: .8, kind: 'door' }, { id: 'd3', wallId: 'w5', t: .78, width: .8, kind: 'door' }, { id: 'v1', wallId: 'w1', t: .28, width: 1.8, kind: 'window' }, { id: 'v2', wallId: 'w1', t: .8, width: 1.4, kind: 'window' }, { id: 'v3', wallId: 'w2', t: .8, width: .9, kind: 'window' }, { id: 'v4', wallId: 'w4', t: .5, width: 1.6, kind: 'window' }], labels: [{ id: 'l1', x: 2.4, y: 3, text: 'Estar · comedor' }, { id: 'l2', x: 6.4, y: 1.8, text: 'Dormitorio' }, { id: 'l3', x: 6.4, y: 4.8, text: 'Baño' }] };
}
export const emptyPlan = (): Plan => ({ format: 'trazocasa', version: 1, name: 'Mi nuevo proyecto', walls: [], openings: [], labels: [] });
