export type Point = { x: number; y: number };
export type Wall = { id: string; a: Point; b: Point; thickness?: number };
export type Opening = { id: string; wallId: string; t: number; width: number; kind: 'door' | 'window'; hinge?: 'start' | 'end'; swing?: 'negative' | 'positive' };
export type Label = { id: string; x: number; y: number; text: string };
export type FurnitureKind = 'bed' | 'sofa' | 'table' | 'desk' | 'wardrobe' | 'toilet';
export type Furniture = { id: string; kind: FurnitureKind; x: number; y: number; width: number; depth: number; rotation: number };
export const furnitureCatalog: { kind: FurnitureKind; name: string; width: number; depth: number }[] = [
  { kind: 'bed', name: 'Cama doble', width: 1.6, depth: 2 },
  { kind: 'sofa', name: 'Sofá', width: 2.1, depth: .9 },
  { kind: 'table', name: 'Mesa', width: 1.6, depth: .9 },
  { kind: 'desk', name: 'Escritorio', width: 1.2, depth: .6 },
  { kind: 'wardrobe', name: 'Placard', width: 1.8, depth: .6 },
  { kind: 'toilet', name: 'Inodoro', width: .4, depth: .7 },
];
export type Plan = { format: 'trazocasa'; version: 4; name: string; walls: Wall[]; openings: Opening[]; labels: Label[]; furniture: Furniture[] };
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
  const p = value as Omit<Plan, 'version'> & { version: number };
  const furniture = p.version === 1 ? [] : p.furniture;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000;
  const point = (v: Point) => v && finite(v.x) && finite(v.y);
  if (p.format !== 'trazocasa' || ![1, 2, 3, 4].includes(p.version) || typeof p.name !== 'string' || p.name.length > 100 || !Array.isArray(p.walls) || !Array.isArray(p.openings) || !Array.isArray(p.labels) || p.walls.length > 2000 || p.openings.length > 2000 || p.labels.length > 500 || !Array.isArray(furniture) || furniture.length > 500) throw new Error('Formato incompatible. Elegí un archivo .trazocasa de versión 1, 2, 3 o 4.');
  const ids = new Set<string>();
  for (const o of [...p.walls, ...p.openings, ...p.labels, ...furniture]) {
    if (!o || typeof o.id !== 'string' || !o.id || ids.has(o.id)) throw new Error('El proyecto contiene identificadores inválidos.');
    ids.add(o.id);
  }
  for (const w of p.walls) if (!point(w.a) || !point(w.b) || distance(w.a, w.b) < .2 - 1e-9 || (w.thickness !== undefined && (!finite(w.thickness) || w.thickness < .05 || w.thickness > .6))) throw new Error('El proyecto contiene paredes inválidas.');
  const checked: Plan = { ...p, version: 4, furniture, openings: [] };
  for (const o of p.openings) {
    const w = p.walls.find(w => w.id === o.wallId);
    if (!w || !finite(o.t) || !finite(o.width) || !['door', 'window'].includes(o.kind)) throw new Error('El proyecto contiene aberturas inválidas.');
    if (o.kind === 'door' && ((o.hinge !== undefined && !['start', 'end'].includes(o.hinge)) || (o.swing !== undefined && !['negative', 'positive'].includes(o.swing)))) throw new Error('El sentido de apertura de una puerta no es válido.');
    const t = fitOpening(checked, w, o.t, o.width);
    if (t === null || Math.abs(t - o.t) > .00001) throw new Error('Hay aberturas superpuestas o fuera de una pared.');
    checked.openings.push(o);
  }
  for (const l of p.labels) if (!point(l) || typeof l.text !== 'string' || l.text.length > 80) throw new Error('El proyecto contiene etiquetas inválidas.');
  for (const f of furniture) {
    if (!point(f) || !furnitureCatalog.some(item => item.kind === f.kind) || !finite(f.width) || !finite(f.depth) || f.width < .2 || f.width > 10 || f.depth < .2 || f.depth > 10 || !finite(f.rotation) || f.rotation < 0 || f.rotation >= 360) throw new Error('El proyecto contiene muebles inválidos.');
  }
  return { format: 'trazocasa', version: 4, furniture: furniture.map(f => ({ id: f.id, kind: f.kind, x: f.x, y: f.y, width: f.width, depth: f.depth, rotation: f.rotation })), name: p.name, walls: p.walls.map(w => ({ id: w.id, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y }, ...(w.thickness !== undefined ? { thickness: w.thickness } : {}) })), openings: p.openings.map(o => ({ id: o.id, wallId: o.wallId, t: o.t, width: o.width, kind: o.kind, ...(o.kind === 'door' && o.hinge !== undefined ? { hinge: o.hinge } : {}), ...(o.kind === 'door' && o.swing !== undefined ? { swing: o.swing } : {}) })), labels: p.labels.map(l => ({ id: l.id, x: l.x, y: l.y, text: l.text })) };
}
export function sample(): Plan {
  const wall = (id: string, x: number, y: number, x2: number, y2: number): Wall => ({ id, a: { x, y }, b: { x: x2, y: y2 } });
  return { format: 'trazocasa', version: 4, name: 'Mi primera casa', furniture: [
    { id: 'f1', kind: 'bed', x: 6.4, y: 1.5, width: 1.6, depth: 2, rotation: 0 },
    { id: 'f2', kind: 'sofa', x: 2.2, y: .75, width: 2.1, depth: .9, rotation: 0 },
    { id: 'f3', kind: 'table', x: 2.4, y: 4.2, width: 1.6, depth: .9, rotation: 0 },
    { id: 'f4', kind: 'toilet', x: 7.3, y: 4.25, width: .4, depth: .7, rotation: 0 },
  ], walls: [wall('w1', 0, 0, 8, 0), wall('w2', 8, 0, 8, 6), wall('w3', 8, 6, 0, 6), wall('w4', 0, 6, 0, 0), wall('w5', 4.8, 0, 4.8, 6), wall('w6', 4.8, 3.6, 8, 3.6)], openings: [{ id: 'd1', wallId: 'w3', t: .72, width: 1, kind: 'door' }, { id: 'd2', wallId: 'w5', t: .35, width: .8, kind: 'door' }, { id: 'd3', wallId: 'w5', t: .78, width: .8, kind: 'door' }, { id: 'v1', wallId: 'w1', t: .28, width: 1.8, kind: 'window' }, { id: 'v2', wallId: 'w1', t: .8, width: 1.4, kind: 'window' }, { id: 'v3', wallId: 'w2', t: .8, width: .9, kind: 'window' }, { id: 'v4', wallId: 'w4', t: .5, width: 1.6, kind: 'window' }], labels: [{ id: 'l1', x: 2.4, y: 3, text: 'Estar · comedor' }, { id: 'l2', x: 6.4, y: 3, text: 'Dormitorio' }, { id: 'l3', x: 6.4, y: 4.8, text: 'Baño' }] };
}
export const emptyPlan = (): Plan => ({ format: 'trazocasa', version: 4, name: 'Mi nuevo proyecto', furniture: [], walls: [], openings: [], labels: [] });

/** The four corners of a rotated furniture footprint, in metres. */
export function furnitureCorners(f: Furniture): Point[] {
  const r = f.rotation * Math.PI / 180;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const x = sx * f.width / 2, y = sy * f.depth / 2;
    return { x: f.x + x * Math.cos(r) - y * Math.sin(r), y: f.y + x * Math.sin(r) + y * Math.cos(r) };
  });
}
/** Shared framing for the editor and exports, including objects outside walls. */
export function planBounds(p: Plan, padding = .7) {
  const points = p.walls.flatMap(w => { const r = wallThickness(w) / 2; return [w.a, w.b].flatMap(p => [{ x: p.x - r, y: p.y - r }, { x: p.x + r, y: p.y + r }]); });
  p.labels.forEach(l => { const half = Math.max(.8, l.text.length * .085); points.push({ x: l.x - half, y: l.y - .3 }, { x: l.x + half, y: l.y + .3 }); });
  p.furniture.forEach(f => points.push(...furnitureCorners(f)));
  p.openings.filter(o => o.kind === 'door').forEach(o => {
    const w = p.walls.find(w => w.id === o.wallId)!;
    const x = w.a.x + (w.b.x - w.a.x) * o.t, y = w.a.y + (w.b.y - w.a.y) * o.t;
    // Door leaf plus swing arc can extend beyond the wall footprint.
    const radius = o.width * 1.2;
    points.push({ x: x - radius, y: y - radius }, { x: x + radius, y: y + radius });
  });
  if (!points.length) return { x: -1, y: -1, width: 10, height: 8 };
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x = Math.min(...xs) - padding, y = Math.min(...ys) - padding;
  return { x, y, width: Math.max(...xs) + padding - x, height: Math.max(...ys) + padding - y };
}

/** Create a rectangle atomically, reusing identical walls (including reversed ones). */
export function addRectangle(plan: Plan, a: Point, b: Point, name = 'Ambiente'): Plan {
  const width = Math.abs(b.x - a.x), depth = Math.abs(b.y - a.y);
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite) || width < .5 - 1e-9 || depth < .5 - 1e-9 || width > 100 || depth > 100) throw new Error('La habitación debe medir entre 0,50 y 100 metros por lado.');
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const corners = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + depth }, { x, y: y + depth }];
  const walls = [...plan.walls];
  for (let i = 0; i < 4; i++) {
    const from = corners[i], to = corners[(i + 1) % 4];
    if (walls.some(w => (distance(w.a, from) < 1e-6 && distance(w.b, to) < 1e-6) || (distance(w.b, from) < 1e-6 && distance(w.a, to) < 1e-6))) continue;
    // Partial collinear overlaps would leave doubled walls and ambiguous openings.
    const horizontal = Math.abs(from.y - to.y) < 1e-6;
    const overlaps = walls.some(w => {
      const collinear = horizontal ? Math.abs(w.a.y - from.y) < 1e-6 && Math.abs(w.b.y - from.y) < 1e-6 : Math.abs(w.a.x - from.x) < 1e-6 && Math.abs(w.b.x - from.x) < 1e-6;
      if (!collinear) return false;
      const axis = horizontal ? 'x' : 'y';
      return Math.min(Math.max(from[axis], to[axis]), Math.max(w.a[axis], w.b[axis])) - Math.max(Math.min(from[axis], to[axis]), Math.min(w.a[axis], w.b[axis])) > 1e-6;
    });
    if (overlaps) throw new Error('Un lado se superpone parcialmente con una pared. Hacé coincidir sus extremos o dibujá ese sector con Pared.');
    walls.push({ id: uid(), a: { ...from }, b: { ...to }, thickness: .15 });
  }
  if (walls.length === plan.walls.length) throw new Error('Las cuatro paredes de esa habitación ya existen.');
  return validatePlan({ ...plan, walls, labels: [...plan.labels, { id: uid(), x: x + width / 2, y: y + depth / 2, text: name.trim() || 'Ambiente' }] });
}

/** Mirrors the baseline swing around the wall axis and around the opening center. */
export function doorTransform(opening: Opening) {
  return { x: opening.hinge === 'end' ? -1 : 1, y: opening.swing === 'positive' ? -1 : 1 };
}

export const wallThickness = (wall: Wall) => wall.thickness ?? .105;
const samePoint = (a: Point, b: Point) => distance(a, b) < 1e-6;

/** Preserve opening offsets from the stationary endpoint; translation retains t. */
function applyWallGeometry(plan: Plan, walls: Wall[]): Plan {
  const originals = new Map(plan.walls.map(w => [w.id, w]));
  const changed = walls.filter(w => !samePoint(w.a, originals.get(w.id)!.a) || !samePoint(w.b, originals.get(w.id)!.b));
  for (const w of changed) {
    const length = distance(w.a, w.b);
    if (length < .2 - 1e-9) throw new Error('Cada tramo debe conservar al menos 20 cm.');
    for (const other of walls) {
      if (other.id === w.id) continue;
      const dx = w.b.x-w.a.x, dy=w.b.y-w.a.y;
      const cross = (p: Point) => Math.abs(dx*(p.y-w.a.y)-dy*(p.x-w.a.x))/length;
      if (cross(other.a)>1e-6 || cross(other.b)>1e-6) continue;
      const along = (p: Point) => ((p.x-w.a.x)*dx+(p.y-w.a.y)*dy)/length;
      if (Math.min(length,Math.max(along(other.a),along(other.b)))-Math.max(0,Math.min(along(other.a),along(other.b)))>1e-6) throw new Error('El movimiento superpone paredes. Elegí otro punto.');
    }
  }
  const nextById = new Map(walls.map(w=>[w.id,w]));
  const openings = plan.openings.map(o => {
    const old = originals.get(o.wallId)!, next=nextById.get(o.wallId)!;
    const aFixed=samePoint(old.a,next.a), bFixed=samePoint(old.b,next.b);
    if (aFixed===bFixed) return o;
    const oldLength=distance(old.a,old.b), newLength=distance(next.a,next.b);
    return { ...o, t: aFixed ? o.t*oldLength/newLength : 1-(1-o.t)*oldLength/newLength };
  });
  try { return validatePlan({ ...plan, walls, openings }); }
  catch { throw new Error('El cambio no deja espacio para una abertura o excede los límites del plano.'); }
}
export function moveWallEndpoint(plan: Plan, wallId: string, end: 'a' | 'b', point: Point): Plan {
  const wall=plan.walls.find(w=>w.id===wallId);
  if (!wall) throw new Error('No se encontró la pared.');
  const original=wall[end];
  return applyWallGeometry(plan,plan.walls.map(w=>({ ...w, a:samePoint(w.a,original)?{...point}:w.a, b:samePoint(w.b,original)?{...point}:w.b })));
}
export function translateWall(plan: Plan, wallId: string, delta: Point): Plan {
  const wall=plan.walls.find(w=>w.id===wallId);
  if (!wall) throw new Error('No se encontró la pared.');
  const shift=(p:Point)=>samePoint(p,wall.a)||samePoint(p,wall.b)?{x:p.x+delta.x,y:p.y+delta.y}:p;
  return applyWallGeometry(plan,plan.walls.map(w=>({...w,a:shift(w.a),b:shift(w.b)})));
}
export function splitWall(plan: Plan, wallId: string, at: number): Plan {
  const wall=plan.walls.find(w=>w.id===wallId);
  if (!wall) throw new Error('No se encontró la pared.');
  const length=distance(wall.a,wall.b);
  if (!Number.isFinite(at) || at < .2-1e-9 || length-at < .2-1e-9) throw new Error('Dejá al menos 20 cm a cada lado del corte.');
  for (const o of plan.openings.filter(o=>o.wallId===wallId)) {
    if (Math.abs(o.t*length-at) < o.width/2+.025-1e-9) throw new Error('No se puede cortar una puerta o ventana. Dejá 2,5 cm de separación.');
  }
  const t=at/length, middle={x:wall.a.x+(wall.b.x-wall.a.x)*t,y:wall.a.y+(wall.b.y-wall.a.y)*t};
  const secondId=uid();
  const walls=plan.walls.flatMap(w=>w.id!==wallId?[w]:[{...w,b:middle},{...w,id:secondId,a:middle}]);
  const openings=plan.openings.map(o=>o.wallId!==wallId?o:o.t<t?{...o,t:o.t*length/at}:{...o,wallId:secondId,t:(o.t*length-at)/(length-at)});
  return validatePlan({...plan,walls,openings});
}
