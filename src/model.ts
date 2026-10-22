export type Point = { x: number; y: number };
export type Projection = {id:string;name:string;points:Point[];closed:boolean};
export type Surface = { id: string; name: string; points: Point[] };
export type Dimension = { id: string; a: Point; b: Point; offset: number };
export type Wall = { id: string; a: Point; b: Point; thickness?: number };
export type Opening = { id: string; wallId: string; t: number; width: number; kind: 'door' | 'window'; hinge?: 'start' | 'end'; swing?: 'negative' | 'positive' };
export type Label = { id: string; x: number; y: number; text: string };
export type FurnitureKind = 'argentineGrill' | 'firePit' | 'tree' | 'palm' | 'shrub' | 'pottedPlant' | 'smallCar' | 'mediumCar' | 'pickup' | 'nightstand' | 'bed' | 'sofa' | 'table' | 'desk' | 'wardrobe' | 'toilet' | 'bidet' | 'bathroomSink' | 'kitchenSink' | 'chair' | 'singleBed' | 'sofa3' | 'tv' | 'bathtub' | 'roundCoffeeTable' | 'armchair' | 'fridge' | 'stove' | 'washer' | 'stairs' | 'stairLanding';
export type Furniture = { groupId?: string; id: string; kind: FurnitureKind; x: number; y: number; width: number; depth: number; rotation: number };
export const furnitureCatalog: { kind: FurnitureKind; name: string; width: number; depth: number }[] = [
  { kind: 'argentineGrill', name: 'Parrilla argentina', width: 1.5, depth: .8 },
  { kind: 'firePit', name: 'Fogonero', width: 1, depth: 1 },
  { kind: 'tree', name: 'Árbol de copa', width: 3, depth: 3 },
  { kind: 'palm', name: 'Palmera', width: 2.5, depth: 2.5 },
  { kind: 'shrub', name: 'Arbusto', width: 1, depth: .8 },
  { kind: 'pottedPlant', name: 'Planta en maceta', width: .5, depth: .5 },
  { kind: 'smallCar', name: 'Auto chico', width: 1.7, depth: 3.8 },
  { kind: 'mediumCar', name: 'Auto mediano', width: 1.8, depth: 4.5 },
  { kind: 'pickup', name: 'Camioneta', width: 2, depth: 5.3 },
  { kind: 'nightstand', name: 'Mesa de luz', width: .5, depth: .4 },
  { kind: 'stairs', name: 'Escalera recta', width: 1, depth: 3 },
  { kind: 'stairLanding', name: 'Descanso de escalera', width: 1, depth: 1 },
  { kind: 'tv', name: 'Televisor', width: 1.2, depth: .3 },
  { kind: 'bathtub', name: 'Bañera', width: .7, depth: 1.7 },
  { kind: 'roundCoffeeTable', name: 'Mesa ratona redonda', width: .8, depth: .8 },
  { kind: 'armchair', name: 'Sillón individual', width: .85, depth: .85 },
  { kind: 'fridge', name: 'Heladera', width: .7, depth: .7 },
  { kind: 'stove', name: 'Cocina', width: .6, depth: .6 },
  { kind: 'washer', name: 'Lavarropas', width: .6, depth: .65 },
  { kind: 'singleBed', name: 'Cama simple', width: .9, depth: 1.9 },
  { kind: 'bed', name: 'Cama doble', width: 1.6, depth: 2 },
  { kind: 'sofa', name: 'Sofá', width: 2.1, depth: .9 },
  { kind: 'sofa3', name: 'Sofá de 3 cuerpos', width: 2.4, depth: .95 },
  { kind: 'chair', name: 'Silla', width: .45, depth: .5 },
  { kind: 'table', name: 'Mesa', width: 1.6, depth: .9 },
  { kind: 'desk', name: 'Escritorio', width: 1.2, depth: .6 },
  { kind: 'wardrobe', name: 'Placard', width: 1.8, depth: .6 },
  { kind: 'bidet', name: 'Bidet', width: .36, depth: .55 },
  { kind: 'bathroomSink', name: 'Bacha de baño', width: .6, depth: .45 },
  { kind: 'kitchenSink', name: 'Bacha de cocina', width: .8, depth: .5 },
  { kind: 'toilet', name: 'Inodoro', width: .4, depth: .7 },
];
export type ReferenceImage = {data:string;name:string;x:number;y:number;width:number;height:number;opacity:number;visible:boolean};
export type Plan = { projections?:Projection[]; reference?:ReferenceImage; format: 'trazocasa'; version: 6; surfaces: Surface[]; dimensions: Dimension[]; name: string; walls: Wall[]; openings: Opening[]; labels: Label[]; furniture: Furniture[] };
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
  const surfaces = p.version < 6 ? [] : p.surfaces;
  const dimensions = p.version < 5 ? [] : p.dimensions;
  const furniture = p.version === 1 ? [] : p.furniture;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000;
  const point = (v: Point) => v && finite(v.x) && finite(v.y);
  if (p.format !== 'trazocasa' || ![1, 2, 3, 4, 5, 6].includes(p.version) || typeof p.name !== 'string' || p.name.length > 100 || !Array.isArray(p.walls) || !Array.isArray(p.openings) || !Array.isArray(p.labels) || p.walls.length > 2000 || p.openings.length > 2000 || p.labels.length > 500 || !Array.isArray(furniture) || furniture.length > 500 || !Array.isArray(dimensions) || dimensions.length > 500 || !Array.isArray(surfaces) || surfaces.length > 200) throw new Error('Formato incompatible. Elegí un archivo .trazocasa de versión 1, 2, 3, 4, 5 o 6.');
  const projections=p.projections??[];
  if(!Array.isArray(projections)||projections.length>200)throw new Error('Las proyecciones no son válidas.');
  for(const r of projections){if(!r||typeof r.name!=='string'||r.name.length>80||typeof r.closed!=='boolean'||!Array.isArray(r.points)||r.points.length<(r.closed?3:2)||r.points.length>200||!r.points.every(point)||r.points.some((v,i)=>i>0&&distance(v,r.points[i-1])<.1-1e-9)||(r.closed&&distance(r.points[0],r.points[r.points.length-1])<.1-1e-9))throw new Error('Revisá los vértices de la proyección (mínimo 10 cm entre puntos).');}
  const ids = new Set<string>();
  for (const o of [...p.walls, ...p.openings, ...p.labels, ...furniture, ...dimensions, ...surfaces, ...projections]) {
    if (!o || typeof o.id !== 'string' || !o.id || ids.has(o.id)) throw new Error('El proyecto contiene identificadores inválidos.');
    ids.add(o.id);
  }
  for (const w of p.walls) if (!point(w.a) || !point(w.b) || distance(w.a, w.b) < .2 - 1e-9 || (w.thickness !== undefined && (!finite(w.thickness) || w.thickness < .05 || w.thickness > .6))) throw new Error('El proyecto contiene paredes inválidas.');
  for (const d of dimensions) if (!point(d.a) || !point(d.b) || distance(d.a,d.b) < .1 - 1e-9 || !finite(d.offset) || Math.abs(d.offset) > 100) throw new Error("El proyecto contiene cotas inválidas.");
  for (const s of surfaces) {
    if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80) throw new Error('El nombre de la superficie no es válido.');
    validateSurface(s.points);
  }
  if(p.reference!==undefined){const r=p.reference;if(!r||typeof r.data!=='string'||r.data.length>400_000||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.data)||typeof r.name!=='string'||r.name.length>100||!point(r)||!finite(r.width)||!finite(r.height)||r.width<.1||r.height<.1||r.width>100||r.height>100||!finite(r.opacity)||r.opacity<0||r.opacity>1||typeof r.visible!=='boolean')throw new Error('La imagen de referencia no es válida.');}
  const checked: Plan = { ...p, version: 6, surfaces, dimensions, furniture, openings: [] };
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
    if (f.groupId !== undefined && (typeof f.groupId !== 'string' || !f.groupId.trim() || f.groupId.length > 100)) throw new Error('El grupo de muebles no es válido.');
    if (f.kind === 'roundCoffeeTable' && f.width !== f.depth) throw new Error('La mesa redonda debe tener un único diámetro.');
    if (!point(f) || !furnitureCatalog.some(item => item.kind === f.kind) || !finite(f.width) || !finite(f.depth) || f.width < .2 || f.width > 10 || f.depth < .2 || f.depth > 10 || !finite(f.rotation) || f.rotation < 0 || f.rotation >= 360) throw new Error('El proyecto contiene muebles inválidos.');
  }
  return { ...(p.projections?{projections:projections.map(r=>({...r,points:r.points.map(p=>({...p}))}))}:{}), ...(p.reference?{reference:{data:p.reference.data,name:p.reference.name,x:p.reference.x,y:p.reference.y,width:p.reference.width,height:p.reference.height,opacity:p.reference.opacity,visible:p.reference.visible}}:{}), format: 'trazocasa', version: 6, surfaces: surfaces.map(s=>({id:s.id,name:s.name,points:s.points.map(p=>({x:p.x,y:p.y}))})), dimensions: dimensions.map(d=>({id:d.id,a:{x:d.a.x,y:d.a.y},b:{x:d.b.x,y:d.b.y},offset:d.offset})), furniture: furniture.map(f => ({ id: f.id, kind: f.kind, x: f.x, y: f.y, width: f.width, depth: f.depth, rotation: f.rotation, ...(f.groupId !== undefined ? {groupId:f.groupId} : {}) })), name: p.name, walls: p.walls.map(w => ({ id: w.id, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y }, ...(w.thickness !== undefined ? { thickness: w.thickness } : {}) })), openings: p.openings.map(o => ({ id: o.id, wallId: o.wallId, t: o.t, width: o.width, kind: o.kind, ...(o.kind === 'door' && o.hinge !== undefined ? { hinge: o.hinge } : {}), ...(o.kind === 'door' && o.swing !== undefined ? { swing: o.swing } : {}) })), labels: p.labels.map(l => ({ id: l.id, x: l.x, y: l.y, text: l.text })) };
}
export function sample(): Plan {
  const wall = (id: string, x: number, y: number, x2: number, y2: number): Wall => ({ id, a: { x, y }, b: { x: x2, y: y2 } });
  return { format: 'trazocasa', version: 6, surfaces: [], dimensions: [], name: 'Mi primera casa', furniture: [
    { id: 'f1', kind: 'bed', x: 6.4, y: 1.5, width: 1.6, depth: 2, rotation: 0 },
    { id: 'f2', kind: 'sofa', x: 2.2, y: .75, width: 2.1, depth: .9, rotation: 0 },
    { id: 'f3', kind: 'table', x: 2.4, y: 4.2, width: 1.6, depth: .9, rotation: 0 },
    { id: 'f4', kind: 'toilet', x: 7.3, y: 4.25, width: .4, depth: .7, rotation: 0 },
  ], walls: [wall('w1', 0, 0, 8, 0), wall('w2', 8, 0, 8, 6), wall('w3', 8, 6, 0, 6), wall('w4', 0, 6, 0, 0), wall('w5', 4.8, 0, 4.8, 6), wall('w6', 4.8, 3.6, 8, 3.6)], openings: [{ id: 'd1', wallId: 'w3', t: .72, width: 1, kind: 'door' }, { id: 'd2', wallId: 'w5', t: .35, width: .8, kind: 'door' }, { id: 'd3', wallId: 'w5', t: .78, width: .8, kind: 'door' }, { id: 'v1', wallId: 'w1', t: .28, width: 1.8, kind: 'window' }, { id: 'v2', wallId: 'w1', t: .8, width: 1.4, kind: 'window' }, { id: 'v3', wallId: 'w2', t: .8, width: .9, kind: 'window' }, { id: 'v4', wallId: 'w4', t: .5, width: 1.6, kind: 'window' }], labels: [{ id: 'l1', x: 2.4, y: 3, text: 'Estar · comedor' }, { id: 'l2', x: 6.4, y: 3, text: 'Dormitorio' }, { id: 'l3', x: 6.4, y: 4.8, text: 'Baño' }] };
}
export const emptyPlan = (): Plan => ({ format: 'trazocasa', version: 6, surfaces: [], dimensions: [], name: 'Mi nuevo proyecto', furniture: [], walls: [], openings: [], labels: [] });

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
  p.projections?.forEach(r=>{points.push(...r.points);if(r.name){const a=r.points[0],half=Math.max(.8,r.name.length*.085);points.push({x:a.x-half,y:a.y-.5},{x:a.x+half,y:a.y+.2});}});
  p.labels.forEach(l => { const half = Math.max(.8, l.text.length * .085); points.push({ x: l.x - half, y: l.y - .3 }, { x: l.x + half, y: l.y + .3 }); });
  p.surfaces.forEach(s => { points.push(...s.points); const c=surfaceLabel(s.points), half=Math.max(.8,s.name.length*.085); points.push({x:c.x-half,y:c.y-.4},{x:c.x+half,y:c.y+.4}); });
  p.dimensions.forEach(d => { const g=dimensionGeometry(d); points.push(d.a,d.b); for(const p of [g.a,g.b,g.label]) points.push({x:p.x-1,y:p.y-1},{x:p.x+1,y:p.y+1}); });
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
  // Follow existing T junctions when their supporting wall moves.
  walls = walls.map(w=>({...w,a:{...w.a},b:{...w.b}}));
  const byId = new Map(walls.map(w=>[w.id,w]));
  const explicit: Point[] = [];
  const pending: string[] = [];
  for(const w of walls) {
    const old=originals.get(w.id)!;
    for(const end of ['a','b'] as const) if(!samePoint(w[end],old[end])) explicit.push(old[end]);
    if(!samePoint(w.a,old.a)||!samePoint(w.b,old.b)) pending.push(w.id);
  }
  const visited=new Set<string>();
  while(pending.length) {
    const id=pending.shift()!;
    if(visited.has(id)) continue;
    visited.add(id);
    const old=originals.get(id)!, next=byId.get(id)!;
    const length=distance(next.a,next.b), oldLength=distance(old.a,old.b);
    if(length<.2-1e-9) throw new Error('Cada tramo debe conservar al menos 20 cm.');
    for(const child of plan.walls) for(const end of ['a','b'] as const) {
      const node=child[end];
      if(child.id===id||explicit.some(p=>samePoint(p,node))) continue;
      const connection=project(node,old);
      if(connection.distance>1e-6||connection.t<=1e-6||connection.t>=1-1e-6) continue;
      const aFixed=samePoint(old.a,next.a), bFixed=samePoint(old.b,next.b);
      const t=aFixed&&!bFixed?connection.t*oldLength/length:bFixed&&!aFixed?1-(1-connection.t)*oldLength/length:connection.t;
      if(t<0||t>1) throw new Error('El movimiento dejaría una unión en T fuera de su pared.');
      const point={x:next.a.x+(next.b.x-next.a.x)*t,y:next.a.y+(next.b.y-next.a.y)*t};
      for(const original of plan.walls) {
        const changedWall=byId.get(original.id)!;
        let updated=false;
        for(const edge of ['a','b'] as const) if(samePoint(original[edge],node)&&!samePoint(changedWall[edge],point)){changedWall[edge]={...point};updated=true;}
        if(updated)pending.push(original.id);
      }
    }
  }
  const affected=walls.filter(w=>!samePoint(w.a,originals.get(w.id)!.a)||!samePoint(w.b,originals.get(w.id)!.b));
  for(const child of affected) for(const end of ['a','b'] as const) for(const parent of plan.walls) {
    if(parent.id===child.id)continue;
    const prior=project(originals.get(child.id)![end],parent);
    if(prior.distance>1e-6||prior.t<=1e-6||prior.t>=1-1e-6)continue;
    if(project(child[end],byId.get(parent.id)!).distance>1e-6)throw new Error('Ese extremo pertenece a una unión en T. Deslizalo sobre la pared o dividí la pared principal antes de mover la unión.');
  }
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

/** Manual dimensions are independent of wall geometry. */
export function dimensionOffset(a: Point, b: Point, p: Point) {
 const length=distance(a,b);
 if(length<.1-1e-9) throw new Error('La cota debe medir al menos 10 cm.');
 return ((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))/length;
}
export function dimensionGeometry(d: Dimension) {
 const length=distance(d.a,d.b), nx=-(d.b.y-d.a.y)/length, ny=(d.b.x-d.a.x)/length;
 const a={x:d.a.x+nx*d.offset,y:d.a.y+ny*d.offset}, b={x:d.b.x+nx*d.offset,y:d.b.y+ny*d.offset};
 const raw=Math.atan2(d.b.y-d.a.y,d.b.x-d.a.x)*180/Math.PI, angle=raw>90||raw< -90?raw+180:raw;
 return {a,b,length,angle,label:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
}
export function addDimension(plan: Plan, a: Point, b: Point, position: Point): Plan {
 return validatePlan({...plan,dimensions:[...plan.dimensions,{id:uid(),a,b,offset:dimensionOffset(a,b,position)}]});
}

/** Shoelace formula; vertex order does not change the reported area. */
export function surfaceArea(points: Point[]): number {
  return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
}
export function validateSurface(points: Point[]): void {
  if (!Array.isArray(points) || points.length<3 || points.length>100 || points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x)>1000 || Math.abs(p.y)>1000)) throw new Error('La superficie necesita entre 3 y 100 puntos válidos.');
  const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const on=(a:Point,b:Point,p:Point)=>Math.abs(cross(a,b,p))<1e-8 && p.x>=Math.min(a.x,b.x)-1e-8 && p.x<=Math.max(a.x,b.x)+1e-8 && p.y>=Math.min(a.y,b.y)-1e-8 && p.y<=Math.max(a.y,b.y)+1e-8;
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],c=points[(i+2)%points.length];
    if(distance(a,b)<.1-1e-9) throw new Error('Cada lado debe medir al menos 10 cm.');
    if(Math.abs(cross(a,b,c))<1e-8 && (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)<0) throw new Error('El contorno no puede volver sobre un mismo lado.');
    for(let j=i+1;j<points.length;j++) {
      if(j===i+1 || (i===0 && j===points.length-1)) continue;
      const c=points[j],d=points[(j+1)%points.length];
      if(on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0)) throw new Error('El contorno se cruza o se toca. Revisá sus puntos.');
    }
  }
  if(surfaceArea(points)<.01-1e-9) throw new Error('La superficie debe ser de al menos 0,01 m².');
}
/** Pick an interior scanline interval, including for concave rooms. */
export function surfaceLabel(points: Point[]): Point {
  const ys=[...new Set(points.map(p=>p.y))].sort((a,b)=>a-b);
  let best={x:points[0].x,y:points[0].y}, width=-1;
  for(let k=1;k<ys.length;k++) {
    const y=(ys[k-1]+ys[k])/2, xs:number[]=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      if((a.y>y)!==(b.y>y)) xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
    }
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2) if(xs[i+1]-xs[i]>width) {width=xs[i+1]-xs[i];best={x:(xs[i]+xs[i+1])/2,y};}
  }
  return best;
}
export function addSurface(plan: Plan, points: Point[], name='Ambiente'): Plan {
  return validatePlan({...plan,surfaces:[...plan.surfaces,{id:uid(),name:name.trim()||'Ambiente',points}]});
}

export type Floor = { id: string; name: string; plan: Plan };
export type ViewGuides = { floorId: string; visible: boolean; levels: number[] };
export type DrawingView = { guides?: ViewGuides; id: string; name: string; plan: Plan };
export type Building = { views?: DrawingView[]; format: 'trazocasa'; version: 7; name: string; activeFloorId: string; floors: Floor[] };
export function buildingFromPlan(plan: Plan): Building {
  const id=uid();
  return {format:'trazocasa',version:7,name:plan.name,activeFloorId:id,floors:[{id,name:'Planta baja',plan:validatePlan(plan)}]};
}
/** Older single-floor files become a building without changing geometry. */
export function validateBuilding(value: unknown): Building {
  if(!value || typeof value!=='object')throw new Error('El archivo no contiene un proyecto válido.');
  const b=value as Building;
  if(b.version!==7)return buildingFromPlan(validatePlan(value));
  if(b.format!=='trazocasa'||typeof b.name!=='string'||b.name.length>100||!Array.isArray(b.floors)||b.floors.length<1||b.floors.length>20)throw new Error('El proyecto debe tener entre 1 y 20 plantas.');
  const ids=new Set<string>();
  const floors=b.floors.map(f=>{
    if(!f||typeof f.id!=='string'||!f.id||ids.has(f.id)||typeof f.name!=='string'||!f.name.trim()||f.name.length>60)throw new Error('La lista de plantas no es válida.');
    ids.add(f.id);
    return {id:f.id,name:f.name,plan:validatePlan(f.plan)};
  });
  if(!ids.has(b.activeFloorId))throw new Error('No se encontró la planta activa.');
  let views: DrawingView[] | undefined;
  if(b.views!==undefined){
    if(!Array.isArray(b.views)||b.views.length>30)throw new Error('El proyecto admite hasta 30 vistas 2D.');
    views=b.views.map(v=>{
      if(!v||typeof v.id!=='string'||!v.id||ids.has(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>60)throw new Error('La lista de vistas no es válida.');
      ids.add(v.id);
      const plan=validatePlan(v.plan);
      if(plan.walls.length||plan.openings.length||plan.furniture.length||plan.surfaces.length)throw new Error('Las vistas admiten trazos, cotas y textos.');
      let guides: ViewGuides | undefined;
      if(v.guides!==undefined){
        const g=v.guides;
        if(!g||!floors.some(f=>f.id===g.floorId)||typeof g.visible!=='boolean'||!Array.isArray(g.levels)||g.levels.length>30||g.levels.some(h=>!Number.isFinite(h)||h< -100||h>100))throw new Error('Revisá la planta de referencia y los niveles de la vista.');
        guides={floorId:g.floorId,visible:g.visible,levels:[...new Set(g.levels)].sort((a,b)=>a-b)};
      }
      return {id:v.id,name:v.name,plan,...(guides?{guides}:{})};
    });
  }
  return {format:'trazocasa',version:7,name:b.name,activeFloorId:b.activeFloorId,floors,...(views===undefined?{}:{views})};
}
export function activeFloorPlan(b: Building): Plan {
  const floor=b.floors.find(f=>f.id===b.activeFloorId);
  if(!floor)throw new Error('No se encontró la planta activa.');
  return {...floor.plan,name:b.name};
}
export function replaceFloorPlan(b: Building, plan: Plan): Building {
  const checked=validatePlan(plan);
  return {...b,name:checked.name,floors:b.floors.map(f=>f.id===b.activeFloorId?{...f,plan:checked}:f)};
}
export function addFloor(b: Building, name: string, mode: 'blank'|'walls'|'copy'): Building {
  const source=activeFloorPlan(b), blank=emptyPlan();
  const plan=mode==='copy'?source:mode==='walls'?{...blank,walls:source.walls}:blank;
  const id=uid();
  return validateBuilding({...b,activeFloorId:id,floors:[...b.floors,{id,name:name.trim()||'Planta superior',plan:{...plan,name:b.name}}]});
}
export function renameFloor(b: Building, id: string, name: string): Building {
  if(!b.floors.some(f=>f.id===id))throw new Error('No se encontró la planta.');
  return validateBuilding({...b,floors:b.floors.map(f=>f.id===id?{...f,name:name.trim()}:f)});
}
export function removeFloor(b: Building, id: string): Building {
  if(b.floors.length===1)throw new Error('El proyecto debe conservar al menos una planta.');
  const index=b.floors.findIndex(f=>f.id===id);
  if(index<0)throw new Error('No se encontró la planta.');
  const floors=b.floors.filter(f=>f.id!==id);
  return validateBuilding({...b,views:b.views?.map(v=>v.guides?.floorId===id?{...v,guides:undefined}:v),floors,activeFloorId:b.activeFloorId===id?floors[Math.max(0,index-1)].id:b.activeFloorId});
}

/** Front drafting reference: same X coordinates, plan placed below the elevation. */
export function frontReference(plan: Plan) {
  const walls=plan.walls;
  const minY=walls.length?Math.min(...walls.flatMap(w=>[w.a.y,w.b.y])):0;
  const shift=3-minY;
  const openings=plan.openings.flatMap(o=>{
    const w=walls.find(w=>w.id===o.wallId);if(!w)return [];
    const length=distance(w.a,w.b);
    return [{id:o.id,kind:o.kind,a:{x:w.a.x+(w.b.x-w.a.x)*(o.t-o.width/2/length),y:w.a.y+(w.b.y-w.a.y)*(o.t-o.width/2/length)},b:{x:w.a.x+(w.b.x-w.a.x)*(o.t+o.width/2/length),y:w.a.y+(w.b.y-w.a.y)*(o.t+o.width/2/length)}}];
  });
  const anchors=[...walls.flatMap(w=>[w.a,w.b]),...openings.flatMap(o=>[o.a,o.b])];
  return {walls,openings,shift,anchors,axes:[...new Set(anchors.map(p=>p.x))].sort((a,b)=>a-b)};
}
