import { dimensionGeometry, distance, doorTransform, floorLevels, furnitureCatalog, surfaceArea, surfaceLabel, validateBuilding, wallThickness } from './model';
import type { Building, Dimension, Point } from './model';

type Tags = (string | number)[];
type Identity = { kind: string; id: string; [key: string]: unknown };
type Block = { name: string; handle: string; entities: Tags };
export const dxfLayers = {
  MUROS: 7, ABERTURAS: 4, COTAS: 3, TEXTOS: 7, SUPERFICIES: 3,
  MOBILIARIO: 8, HUECOS_LOSA: 1, HUECOS_CUBIERTA: 6, AUX_PROYECCIONES: 8,
} as const;
type Layer = keyof typeof dxfLayers | '0';

/** Metres, right-handed CAD XY: the editor's downwards Y becomes upwards -Y. */
export const cadPoint = (p: Point): Point => ({ x: p.x, y: -p.y });
const angle = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 360) % 360;
const position = (code: number, p: Point): Tags => [code, p.x, code + 10, p.y, code + 20, 0];
const json = (value: unknown) => JSON.stringify(value).replace(/[^\x20-\x7e]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const chunks = (s: string) => {
  const result: string[] = []; let part = '', size = 0;
  for (const char of s) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > 240) { result.push(part); part = ''; size = 0; }
    part += char; size += bytes;
  }
  result.push(part); return result;
};
// DXF 2007 stores Unicode in UTF-8. Empty formatting groups keep literal %%d etc.
// from being interpreted as CAD symbol codes, while preserving visible percent signs.
const plainText = (s: string) => s.replace(/\r\n?/g, '\n').replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ').replace(/\\/g, '\\\\').replace(/[{}]/g, '\\$&').replace(/%/g, '%{}').replace(/\n/g, '\\P');

/** Small, deterministic DXF 2007 writer; no DOM, SVG, scene or project mutations. */
class DxfWriter {
  private next = 1;
  private handle = () => (this.next++).toString(16).toUpperCase();
  private blocks: Block[] = [];
  private model = this.block('*Model_Space');
  private paper = this.block('*Paper_Space');
  private current = this.model;
  private style = this.handle();
  constructor(private floorId: string, private elevation: number) {}

  block(name: string): Block {
    const block = { name, handle: this.handle(), entities: [] };
    this.blocks.push(block);
    return block;
  }
  inBlock(block: Block, draw: () => void) {
    const previous = this.current;
    this.current = block;
    try { draw(); } finally { this.current = previous; }
  }
  entity(type: string, layer: Layer, tags: Tags, identity?: Identity) {
    const data: Tags = [0, type, 5, this.handle(), 330, this.current.handle, 100, 'AcDbEntity', 8, layer, ...tags];
    if (identity) data.push(1001, 'TRAZOCASA', ...chunks(json({ schema: 1, floorId: this.floorId, elevation: this.elevation, ...identity })).flatMap(s => [1000, s]));
    this.current.entities.push(...data);
  }
  line(a: Point, b: Point, layer: Layer, identity?: Identity) {
    this.entity('LINE', layer, [100, 'AcDbLine', ...position(10, a), ...position(11, b)], identity);
  }
  polyline(points: Point[], closed: boolean, layer: Layer, identity?: Identity) {
    this.entity('LWPOLYLINE', layer, [100, 'AcDbPolyline', 90, points.length, 70, closed ? 1 : 0, ...points.flatMap(p => [10, p.x, 20, p.y])], identity);
  }
  text(text: string, p: Point, height: number, layer: Layer, identity?: Identity, rotation = 0) {
    const parts = chunks(plainText(text));
    this.entity('MTEXT', layer, [100, 'AcDbMText', ...position(10, p), 40, height, 41, 0, 71, 5, 7, 'Standard', 50, rotation * Math.PI / 180,
      ...parts.flatMap((part, i) => [i === parts.length - 1 ? 1 : 3, part])], identity);
  }
  arc(center: Point, radius: number, start: number, end: number, layer: Layer, identity?: Identity) {
    this.entity('ARC', layer, [100, 'AcDbCircle', ...position(10, center), 40, radius, 100, 'AcDbArc', 50, start, 51, end], identity);
  }
  insert(block: Block, p: Point, rotation: number, identity: Identity) {
    this.entity('INSERT', 'MOBILIARIO', [100, 'AcDbBlockReference', 2, block.name, ...position(10, p), 41, 1, 42, 1, 43, 1, 50, rotation], identity);
  }
  dimension(d: Dimension, index: number) {
    const g = dimensionGeometry(d), a = cadPoint(d.a), b = cadPoint(d.b), da = cadPoint(g.a), db = cadPoint(g.b);
    const textAngle = ((-g.angle + 90) % 180 + 180) % 180 - 90;
    const r = textAngle * Math.PI / 180;
    const label = { x: (da.x + db.x) / 2 - Math.sin(r) * .22, y: (da.y + db.y) / 2 + Math.cos(r) * .22 };
    const block = this.block(`*D${index + 1}`);
    this.inBlock(block, () => {
      this.line(a, da, '0'); this.line(b, db, '0'); this.line(da, db, '0');
      for (const p of [da, db]) {
        const dx = .07 * Math.cos(r) - .1 * Math.sin(r), dy = .07 * Math.sin(r) + .1 * Math.cos(r);
        this.line({ x: p.x - dx, y: p.y - dy }, { x: p.x + dx, y: p.y + dy }, '0');
      }
      this.text(`${g.length.toFixed(2)} m`, label, .2, '0', undefined, textAngle);
    });
    // 1 = aligned, 32 = exclusively owned anonymous block, 128 = user text position.
    this.entity('DIMENSION', 'COTAS', [100, 'AcDbDimension', 2, block.name, ...position(10, db), ...position(11, label), 70, 161, 71, 5, 42, g.length, 1, '<>', 3, 'TRAZOCASA', 100, 'AcDbAlignedDimension', ...position(13, a), ...position(14, b)], { kind: 'dimension', id: d.id });
  }
  finish(metadata: object): string {
    const tables: Tags = [], blockTags: Tags = [];
    const table = (name: string, entries: { name: string; subclass: string; tags: Tags; handle?: string }[]) => {
      const owner = this.handle();
      tables.push(0, 'TABLE', 2, name, 5, owner, 330, '0', 100, 'AcDbSymbolTable', 70, entries.length);
      if (name === 'DIMSTYLE') tables.push(100, 'AcDbDimStyleTable', 71, 0);
      for (const entry of entries) tables.push(0, name, name === 'DIMSTYLE' ? 105 : 5, entry.handle ?? this.handle(), 330, owner, 100, 'AcDbSymbolTableRecord', 100, entry.subclass, 2, entry.name, 70, 0, ...entry.tags);
      tables.push(0, 'ENDTAB');
    };
    table('LTYPE', ['ByBlock', 'ByLayer', 'Continuous'].map(name => ({ name, subclass: 'AcDbLinetypeTableRecord', tags: [3, '', 72, 65, 73, 0, 40, 0] })));
    table('LAYER', Object.entries({ '0': 7, ...dxfLayers }).map(([name, color]) => ({ name, subclass: 'AcDbLayerTableRecord', tags: [62, color, 6, 'Continuous'] })));
    table('STYLE', [{ name: 'Standard', handle: this.style, subclass: 'AcDbTextStyleTableRecord', tags: [40, 0, 41, 1, 50, 0, 71, 0, 42, .2, 3, 'Arial.ttf', 4, ''] }]);
    table('APPID', ['ACAD', 'TRAZOCASA'].map(name => ({ name, subclass: 'AcDbRegAppTableRecord', tags: [] })));
    table('DIMSTYLE', [{ name: 'TRAZOCASA', subclass: 'AcDbDimStyleTableRecord', tags: [3, '<> m', 40, 1, 41, .1, 42, 0, 44, 0, 140, .2, 142, .1, 144, 1, 147, .12, 77, 1, 271, 2, 277, 2, 278, 46, 340, this.style] }]);
    table('BLOCK_RECORD', this.blocks.map(b => ({ name: b.name, handle: b.handle, subclass: 'AcDbBlockTableRecord', tags: [280, 1, 281, 0] })));
    for (const b of this.blocks) {
      blockTags.push(0, 'BLOCK', 5, this.handle(), 330, b.handle, 100, 'AcDbEntity', 8, '0', 100, 'AcDbBlockBegin', 2, b.name, 70, b.name.startsWith('*D') ? 1 : 0, ...position(10, { x: 0, y: 0 }), 3, b.name, 1, '');
      if (b !== this.model && b !== this.paper) blockTags.push(...b.entities);
      blockTags.push(0, 'ENDBLK', 5, this.handle(), 330, b.handle, 100, 'AcDbEntity', 8, '0', 100, 'AcDbBlockEnd');
    }
    const tags: Tags = [999, `TrazoCasa DXF ${json(metadata)}`, 0, 'SECTION', 2, 'HEADER',
      9, '$ACADVER', 1, 'AC1021', 9, '$DWGCODEPAGE', 3, 'ANSI_1252', 9, '$HANDSEED', 5, this.handle(),
      9, '$INSUNITS', 70, 6, 9, '$MEASUREMENT', 70, 1, 9, '$LUNITS', 70, 2, 9, '$LUPREC', 70, 4,
      9, '$INSBASE', ...position(10, { x: 0, y: 0 }), 9, '$ELEVATION', 40, 0, 9, '$DIMASSOC', 280, 1,
      0, 'ENDSEC', 0, 'SECTION', 2, 'TABLES', ...tables, 0, 'ENDSEC',
      0, 'SECTION', 2, 'BLOCKS', ...blockTags, 0, 'ENDSEC',
      0, 'SECTION', 2, 'ENTITIES', ...this.model.entities, 0, 'ENDSEC', 0, 'EOF'];
    return tags.map(value => {
      if (typeof value !== 'number') return value;
      if (!Number.isFinite(value)) throw new Error('La geometría contiene un valor no válido.');
      return String(Number(value.toFixed(10)));
    }).join('\r\n') + '\r\n';
  }
}

export function dxfNotices(building: Building, floorId: string): string[] {
  const floor = building.floors.find(f => f.id === floorId);
  if (!floor) throw new Error('Elegí una planta del proyecto para exportar.');
  const p = floor.plan;
  const notices = ['Plano 2D en metros: una unidad CAD equivale a un metro. Las cotas son editables e independientes de los muros.'];
  if (p.furniture.length) notices.push('Mobiliario: bloques con huellas simplificadas, nombre, medidas y giro; las escaleras incluyen peldaños y sentido de subida. Se omiten los detalles gráficos del catálogo.');
  if (p.surfaces.length) notices.push('Superficies: contornos manuales y área bruta, sin descontar huecos ni superposiciones. No representan ambientes BIM ni superficie útil.');
  if (p.surfaces.some(s => s.slab || s.roof)) notices.push('Losas y cubiertas: solo sus contornos y huecos en planta. Se omiten volúmenes, pendientes, espesores y acabados 3D.');
  if (p.reference) notices.push('La imagen de referencia no se incluye.');
  if (p.projections?.length) notices.push('Las proyecciones se incluyen como dibujo auxiliar en AUX_PROYECCIONES.');
  if (building.views?.length) notices.push('Las vistas de dibujo complementarias no se incluyen en el DXF de la planta.');
  return notices;
}

/** A floor is exported at Z=0, without translation/recentering; its level is metadata. */
export function createFloorDxf(value: Building, floorId: string) {
  const building = validateBuilding(value);
  const index = building.floors.findIndex(f => f.id === floorId);
  if (index < 0) throw new Error('Elegí una planta del proyecto para exportar.');
  const floor = building.floors[index], p = floor.plan, elevation = floorLevels(building)[index];
  const writer = new DxfWriter(floor.id, elevation);
  for (const wall of p.walls) {
    const length = distance(wall.a, wall.b), ux = (wall.b.x - wall.a.x) / length, uy = (wall.b.y - wall.a.y) / length, half = wallThickness(wall) / 2;
    const local = (x: number, y: number) => cadPoint({ x: wall.a.x + ux * x - uy * y, y: wall.a.y + uy * x + ux * y });
    const openings = p.openings.filter(o => o.wallId === wall.id).sort((a, b) => a.t - b.t);
    let from = 0;
    const segment = (to: number) => {
      if (to > from + 1e-9) writer.polyline([local(from, -half), local(to, -half), local(to, half), local(from, half)], true, 'MUROS', { kind: 'wall', id: wall.id });
    };
    for (const opening of openings) {
      const start = opening.t * length - opening.width / 2, end = start + opening.width;
      segment(start); from = end;
      const identity = { kind: opening.kind, id: opening.id, wallId: wall.id };
      if (opening.kind === 'window') {
        writer.polyline([local(start, -half), local(end, -half), local(end, half), local(start, half)], true, 'ABERTURAS', identity);
        writer.line(local(start, 0), local(end, 0), 'ABERTURAS', identity);
        writer.line(local((start + end) / 2, -half), local((start + end) / 2, half), 'ABERTURAS', identity);
      } else {
        const mirror = doorTransform(opening), hinge = mirror.x === 1 ? start : end, closed = mirror.x === 1 ? end : start;
        const pivot = local(hinge, 0), leaf = local(hinge, -opening.width * mirror.y), shut = local(closed, 0);
        writer.line(pivot, leaf, 'ABERTURAS', identity);
        // Reflection Y -> -Y changes the sweep; DXF ARC is always counterclockwise.
        const a = angle(pivot, shut), b = angle(pivot, leaf);
        writer.arc(pivot, opening.width, mirror.x * mirror.y > 0 ? a : b, mirror.x * mirror.y > 0 ? b : a, 'ABERTURAS', identity);
      }
    }
    segment(length);
  }
  p.dimensions.forEach((d, i) => writer.dimension(d, i));
  for (const label of p.labels) writer.text(label.text, cadPoint(label), .22, 'TEXTOS', { kind: 'label', id: label.id });
  for (const surface of p.surfaces) {
    const identity = { kind: 'surface', id: surface.id };
    writer.polyline(surface.points.map(cadPoint), true, 'SUPERFICIES', identity);
    writer.text(`${surface.name}\n${surfaceArea(surface.points).toFixed(2)} m² (bruta)`, cadPoint(surfaceLabel(surface.points, (surface.holes ?? []).map(h => h.points))), .2, 'SUPERFICIES', identity);
    for (const hole of surface.holes ?? []) {
      for (const target of ['slab', 'roof'] as const) if (hole.target === target || hole.target === 'both') {
        writer.polyline(hole.points.map(cadPoint), true, target === 'slab' ? 'HUECOS_LOSA' : 'HUECOS_CUBIERTA', { kind: 'hole', id: hole.id, surfaceId: surface.id, target });
      }
    }
  }
  for (const [i, f] of p.furniture.entries()) {
    const block = writer.block(`TC_MUEBLE_${i + 1}`), w = f.width / 2, d = f.depth / 2;
    writer.inBlock(block, () => {
      if (f.kind === 'roundCoffeeTable') {
        writer.entity('CIRCLE', '0', [100, 'AcDbCircle', ...position(10, { x: 0, y: 0 }), 40, w]);
      } else writer.polyline([{ x: -w, y: -d }, { x: w, y: -d }, { x: w, y: d }, { x: -w, y: d }], true, '0');
      if (f.kind === 'stairs') {
        for (let step = 1; step < 12; step++) writer.line({ x: -w, y: -d + step * f.depth / 12 }, { x: w, y: -d + step * f.depth / 12 }, '0');
        writer.polyline([{ x: 0, y: -d * .8 }, { x: 0, y: d * .8 }, { x: -w * .25, y: d * .6 }, { x: 0, y: d * .8 }, { x: w * .25, y: d * .6 }], false, '0');
      } else {
        writer.text(furnitureCatalog.find(c => c.kind === f.kind)?.name ?? f.kind, { x: 0, y: 0 }, Math.min(.16, f.width / 16), '0');
        if (f.kind !== 'roundCoffeeTable') writer.line({ x: 0, y: d * .65 }, { x: 0, y: d }, '0');
      }
    });
    writer.insert(block, cadPoint(f), (360 - f.rotation) % 360, { kind: 'furniture', id: f.id, furnitureKind: f.kind, ...(f.groupId ? { groupId: f.groupId } : {}) });
  }
  for (const projection of p.projections ?? []) writer.polyline(projection.points.map(cadPoint), projection.closed, 'AUX_PROYECCIONES', { kind: 'projection', id: projection.id });
  const safeName = (s: string) => s.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 70) || 'planta';
  const notices = dxfNotices(building, floorId);
  return {
    content: writer.finish({ project: building.name, floor: floor.name, floorId, elevation, units: 'm', axes: '(x,y)->(x,-y,0)', notices }),
    filename: `TrazoCasa-${safeName(building.name)}-${String(index + 1).padStart(2, '0')}-${safeName(floor.name)}.dxf`,
    notices, elevation,
  };
}
