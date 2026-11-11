import { distance, effectiveWallHeight, floorLevels, openingHeight, openingSill, planeHeight, roofHeightRange, roofPlanes, validateBuilding, wallHeight, wallRoofProfile, wallThickness } from './model';
import type { Appearance, Building, Point, RoofPlane } from './model';

type Ref = { ref: number };
type Value = null | string | number | boolean | Ref | { enum: string } | { integer: number } | { guid: string } | { type: string; value: Value } | Value[];
type Body = { items: Ref[]; type: 'SweptSolid' | 'Clipping' | 'CSG' };
type Property = string | number | boolean | { length: number };
type XYZ = [number, number, number];
const enumeration = (value: string): Value => ({ enum: value });
const integer = (value: number): Value => ({ integer: value });
const measure = (value: number) => ({ length: value });
const cad = (p: Point): Point => ({ x: p.x, y: -p.y });
const rectangle = (start: number, end: number, half: number): Point[] => [{ x: start, y: -half }, { x: end, y: -half }, { x: end, y: half }, { x: start, y: half }];

/** ISO 10303-21 strings: literal apostrophes, backslashes, controls and Unicode. */
export function ifcString(text: string): string {
  return "'" + text.replace(/'/g, "''").replace(/[\\\x00-\x1f\x7f-\uffff]+/g, value => '\\X2\\' + Array.from({ length: value.length }, (_, i) => value.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join('') + '\\X0\\') + "'";
}

/** Deterministic 128-bit IFC GlobalId; never uses coordinates, names or list indexes. */
export async function ifcGlobalId(...parts: string[]): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['TrazoCasa-IFC-v1', ...parts]))));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 128; // UUID custom (v8), RFC variant.
  bytes[8] = (bytes[8] & 63) | 128;
  let value = BigInt('0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''));
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let result = '';
  for (let i = 0; i < 22; i++) { result = alphabet[Number(value & 63n)] + result; value >>= 6n; }
  return result;
}

class IfcWriter {
  private rows: { type: string; args: Value[] }[] = [];
  private guidKeys = new Map<string, string[]>();
  private styles = new Map<string, Ref>();
  readonly origin: Ref;
  readonly z: Ref;
  readonly owner: Ref;
  readonly context: Ref;
  readonly units: Ref;
  constructor(private created: Date) {
    this.z = this.direction([0, 0, 1]);
    this.origin = this.axis([0, 0, 0]);
    const person = this.add('IFCPERSON', null, null, 'TrazoCasa', null, null, null, null, null);
    const organization = this.add('IFCORGANIZATION', null, 'TrazoCasa', null, null, null);
    const user = this.add('IFCPERSONANDORGANIZATION', person, organization, null);
    const application = this.add('IFCAPPLICATION', organization, '1.0', 'TrazoCasa IFC exporter', 'TrazoCasa');
    const timestamp = integer(Math.floor(created.getTime() / 1000));
    this.owner = this.add('IFCOWNERHISTORY', user, application, null, enumeration('ADDED'), timestamp, user, application, timestamp);
    this.context = this.add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', integer(3), 1e-7, this.origin, null);
    this.units = this.add('IFCUNITASSIGNMENT', ['LENGTHUNIT', 'AREAUNIT', 'VOLUMEUNIT', 'PLANEANGLEUNIT'].map((kind, i) => this.add('IFCSIUNIT', { enum: '*' }, enumeration(kind), null, enumeration(['METRE', 'SQUARE_METRE', 'CUBIC_METRE', 'RADIAN'][i]))));
  }
  add(type: string, ...args: Value[]): Ref {
    this.rows.push({ type, args }); return { ref: this.rows.length };
  }
  guid(key: string[]): Value {
    const id = JSON.stringify(key); this.guidKeys.set(id, key); return { guid: id };
  }
  root(type: string, key: string[], name: string | null, ...args: Value[]): Ref {
    return this.add(type, this.guid(key), this.owner, name, null, ...args);
  }
  point(coords: number[]): Ref { return this.add('IFCCARTESIANPOINT', coords); }
  direction(coords: XYZ): Ref { return this.add('IFCDIRECTION', coords); }
  axis(at: XYZ, z?: XYZ, x?: XYZ): Ref {
    // IFC requires Axis and RefDirection to be either both present or both absent.
    return this.add('IFCAXIS2PLACEMENT3D', this.point(at), z || x ? this.direction(z ?? [0, 0, 1]) : null, z || x ? this.direction(x ?? [1, 0, 0]) : null);
  }
  placement(parent: Ref | null, at: XYZ = [0, 0, 0], x?: XYZ): Ref {
    return this.add('IFCLOCALPLACEMENT', parent, this.axis(at, undefined, x));
  }
  extrude(points: Point[], height: number, bottom = 0): Ref {
    if (height <= 0) throw new Error('Un sólido IFC tiene altura no válida.');
    // Normalize XY winding; it is independent from the editor contour orientation.
    const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
    const contour = area < 0 ? [...points].reverse() : points;
    const vertices = contour.map(p => this.point([p.x, p.y]));
    const curve = this.add('IFCPOLYLINE', [...vertices, vertices[0]]);
    const profile = this.add('IFCARBITRARYCLOSEDPROFILEDEF', enumeration('AREA'), null, curve);
    return this.add('IFCEXTRUDEDAREASOLID', profile, bottom ? this.axis([0, 0, bottom]) : this.origin, this.z, height);
  }
  /** Remove z > a*x+b*y+c from the gross extrusion. */
  clipTop(solid: Ref, plane: RoofPlane): Ref {
    const surface = this.add('IFCPLANE', this.axis([0, 0, plane.c], [-plane.a, -plane.b, 1], [1, 0, plane.a]));
    const halfspace = this.add('IFCHALFSPACESOLID', surface, false);
    return this.add('IFCBOOLEANCLIPPINGRESULT', enumeration('DIFFERENCE'), solid, halfspace);
  }
  shape(body: Body, appearance?: Appearance, transparency = 0): Ref {
    if (appearance) {
      const key = appearance.color + '/' + transparency;
      let style = this.styles.get(key);
      if (!style) {
        const rgb = [1, 3, 5].map(i => parseInt(appearance.color.slice(i, i + 2), 16) / 255);
        const color = this.add('IFCCOLOURRGB', null, ...rgb);
        const shading = this.add('IFCSURFACESTYLESHADING', color, transparency);
        style = this.add('IFCSURFACESTYLE', null, enumeration('BOTH'), [shading]); this.styles.set(key, style);
      }
      for (const item of body.items) this.add('IFCSTYLEDITEM', item, [style], null);
    }
    const representation = this.add('IFCSHAPEREPRESENTATION', this.context, 'Body', body.type, body.items);
    return this.add('IFCPRODUCTDEFINITIONSHAPE', null, null, [representation]);
  }
  properties(product: Ref, key: string[], name: string, values: Record<string, Property>) {
    const properties = Object.entries(values).map(([name, value]) => {
      const typed: Value = typeof value === 'object' ? { type: 'IFCLENGTHMEASURE', value: value.length } :
        { type: typeof value === 'boolean' ? 'IFCBOOLEAN' : typeof value === 'number' ? 'IFCREAL' : 'IFCTEXT', value };
      return this.add('IFCPROPERTYSINGLEVALUE', name, null, typed, null);
    });
    const set = this.root('IFCPROPERTYSET', [...key, 'properties', name], name, properties);
    this.root('IFCRELDEFINESBYPROPERTIES', [...key, 'property-relation', name], null, [product], set);
  }
  async finish(filename: string): Promise<string> {
    const guids = new Map(await Promise.all([...this.guidKeys].map(async ([id, key]) => [id, await ifcGlobalId(...key)] as const)));
    if (new Set(guids.values()).size !== guids.size) throw new Error('No se pudieron crear identificadores IFC únicos.');
    const serialize = (value: Value): string => {
      if (value === null) return '$';
      if (typeof value === 'string') return ifcString(value);
      if (typeof value === 'boolean') return value ? '.T.' : '.F.';
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('La geometría IFC contiene valores no válidos.');
        const n = Number(value.toFixed(10)); return Number.isInteger(n) ? `${n}.` : String(n).replace(/e/i, 'E');
      }
      if (Array.isArray(value)) return '(' + value.map(serialize).join(',') + ')';
      if ('ref' in value) return '#' + value.ref;
      if ('guid' in value) return ifcString(guids.get(value.guid)!);
      if ('integer' in value) return String(value.integer);
      if ('enum' in value) return value.enum === '*' ? '*' : `.${value.enum}.`;
      return value.type + '(' + serialize(value.value) + ')';
    };
    return [
      'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('TrazoCasa IFC4 export'),'2;1');",
      `FILE_NAME(${ifcString(filename)},${ifcString(this.created.toISOString())},('TrazoCasa'),('TrazoCasa'),'TrazoCasa IFC 1.0','TrazoCasa','');`,
      "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;',
      ...this.rows.map((row, i) => `#${i + 1}=${row.type}(${row.args.map(serialize).join(',')});`),
      'ENDSEC;', 'END-ISO-10303-21;', '',
    ].join('\r\n');
  }
}

export function ifcSummary(building: Building) {
  const plans = building.floors.map(f => f.plan), surfaces = plans.flatMap(p => p.surfaces), openings = plans.flatMap(p => p.openings);
  const counts = {
    floors: plans.length, walls: plans.reduce((n, p) => n + p.walls.length, 0),
    slabs: surfaces.filter(s => s.slab).length, roofs: surfaces.filter(s => s.roof).length,
    doors: openings.filter(o => o.kind === 'door').length, windows: openings.filter(o => o.kind === 'window').length,
  };
  const notices = ['Exporta el edificio completo en metros, organizado por plantas y con sus niveles reales. Puertas y ventanas se representan cerradas con geometría simplificada; conservan sus medidas y relación con el muro.'];
  const furniture = plans.reduce((n, p) => n + p.furniture.length, 0);
  if (furniture) notices.push(`No se incluyen ${furniture} elementos de mobiliario, vegetación, personas, vehículos o escaleras del catálogo.`);
  const contours = surfaces.filter(s => !s.slab && !s.roof).length;
  if (contours) notices.push(`${contours} contornos de superficie sin losa ni cubierta se omiten. No se crean ambientes BIM ni superficies útiles automáticamente.`);
  const unusedHoles = surfaces.reduce((n, s) => n + (s.holes ?? []).filter(h => !((s.slab && h.target !== 'roof') || (s.roof && h.target !== 'slab'))).length, 0);
  if (unusedHoles) notices.push(`${unusedHoles} huecos sin losa o cubierta de destino se omiten.`);
  if (plans.some(p => p.labels.length || p.dimensions.length || p.projections?.length || p.reference) || building.views?.length) notices.push('Los textos, cotas, proyecciones, imágenes de referencia y vistas de dibujo auxiliares no forman parte del modelo IFC. Para el dibujo 2D usá DXF.');
  notices.push('Colores y acabados declarados se conservan como datos; no se infieren capas de materiales, estructura, resistencia al fuego ni propiedades térmicas.');
  return { counts, notices };
}

/** IFC4, (editor x,y,height) -> (x,-y,height). No project data or history mutations. */
export async function createBuildingIfc(value: Building, options: { projectId: string; createdAt?: Date }) {
  const building = validateBuilding(value);
  if (!options.projectId) throw new Error('El proyecto necesita un identificador para exportar IFC.');
  const created = options.createdAt ?? new Date();
  if (!Number.isFinite(created.getTime())) throw new Error('La fecha de exportación IFC no es válida.');
  const writer = new IfcWriter(created), levels = floorLevels(building), summary = ifcSummary(building);
  const rootKey = ['project', options.projectId];
  const project = writer.root('IFCPROJECT', rootKey, building.name, null, null, null, [writer.context], writer.units);
  const sitePlacement = writer.placement(null), buildingPlacement = writer.placement(sitePlacement);
  const site = writer.root('IFCSITE', [...rootKey, 'site'], 'Sitio sin georreferenciar', null, sitePlacement, null, null, enumeration('ELEMENT'), null, null, null, null, null);
  const structure = writer.root('IFCBUILDING', [...rootKey, 'building'], building.name, null, buildingPlacement, null, null, enumeration('ELEMENT'), null, null, null);
  writer.root('IFCRELAGGREGATES', [...rootKey, 'project-site'], null, project, [site]);
  writer.root('IFCRELAGGREGATES', [...rootKey, 'site-building'], null, site, [structure]);
  writer.properties(project, rootKey, 'TrazoCasa_Export', { ExporterVersion: '1.0', SourceFormat: 'Building v7 / Plan v6', LocalProjectId: options.projectId, Axes: '(x,y,height) -> (x,-y,height)', LengthUnit: 'metre', Georeferenced: false, Limitations: summary.notices.join('\n') });
  const storeys: Ref[] = [];
  for (const [floorIndex, floor] of building.floors.entries()) {
    const plan = floor.plan, floorKey = ['floor', floor.id], placement = writer.placement(buildingPlacement, [0, 0, levels[floorIndex]]);
    const storey = writer.root('IFCBUILDINGSTOREY', floorKey, floor.name, null, placement, null, null, enumeration('ELEMENT'), levels[floorIndex]);
    storeys.push(storey);
    writer.properties(storey, floorKey, 'TrazoCasa_Source', { FloorId: floor.id, Elevation: measure(levels[floorIndex]) });
    const contained: Ref[] = [];
    const source = (product: Ref, key: string[], kind: string, id: string, extra: Record<string, Property> = {}) => writer.properties(product, key, 'TrazoCasa_Source', { FloorId: floor.id, SourceId: id, Kind: kind, ...extra });
    const appearanceProperties = (appearance?: Appearance): Record<string, Property> => appearance ? { Color: appearance.color, Finish: appearance.finish } : {};
    for (const wall of plan.walls) {
      const key = [...floorKey, 'wall', wall.id], length = distance(wall.a, wall.b), thickness = wallThickness(wall), height = effectiveWallHeight(plan, wall);
      const ux = (wall.b.x - wall.a.x) / length, uy = (wall.b.y - wall.a.y) / length;
      const wallPlacement = writer.placement(placement, [wall.a.x, -wall.a.y, 0], [ux, -uy, 0]);
      const profile = wallRoofProfile(plan, wall), clipped = profile.some(s => s.planes);
      const body: Body = { type: clipped ? 'Clipping' : 'SweptSolid', items: profile.map(segment => {
        const outline = rectangle(segment.from, segment.to, thickness / 2);
        if (!clipped) return writer.extrude(outline, segment.plane.c);
        let solid = writer.extrude(outline, height + .1);
        for (const p of segment.planes ?? [segment.plane]) solid = writer.clipTop(solid, { a: p.a * ux + p.b * uy, b: p.a * uy - p.b * ux, c: planeHeight(p, wall.a) });
        return solid;
      }) };
      const product = writer.root('IFCWALL', key, 'Muro', null, wallPlacement, writer.shape(body, wall.appearance), wall.id, enumeration('NOTDEFINED'));
      contained.push(product); source(product, key, 'wall', wall.id);
      writer.properties(product, key, 'TrazoCasa_Geometry', { Length: measure(length), Thickness: measure(thickness), NominalHeight: measure(wallHeight(plan, wall)), MaximumHeight: measure(height), RoofAdjusted: clipped, ...appearanceProperties(wall.appearance) });
      for (const o of plan.openings.filter(o => o.wallId === wall.id)) {
        const voidKey = [...floorKey, 'wall-opening', o.id], elementKey = [...floorKey, o.kind, o.id], h = openingHeight(o), sill = openingSill(o);
        const openingPlacement = writer.placement(wallPlacement, [o.t * length - o.width / 2, 0, sill]);
        const voidBody: Body = { type: 'SweptSolid', items: [writer.extrude(rectangle(0, o.width, thickness / 2 + .01), h)] };
        const opening = writer.root('IFCOPENINGELEMENT', voidKey, o.kind === 'door' ? 'Hueco de puerta' : 'Hueco de ventana', null, openingPlacement, writer.shape(voidBody), o.id, enumeration('OPENING'));
        writer.root('IFCRELVOIDSELEMENT', [...voidKey, 'voids'], null, product, opening);
        source(opening, voidKey, 'wall-opening', o.id, { WallId: wall.id });
        const fillPlacement = writer.placement(openingPlacement);
        const body: Body = { type: 'SweptSolid', items: [writer.extrude(rectangle(0, o.width, Math.min(thickness, o.kind === 'door' ? .04 : .025) / 2), h)] };
        const fill = writer.root(o.kind === 'door' ? 'IFCDOOR' : 'IFCWINDOW', elementKey, o.kind === 'door' ? 'Puerta' : 'Ventana', null, fillPlacement,
          writer.shape(body, { color: o.kind === 'door' ? '#ad8b62' : '#b4d8df', finish: o.kind === 'door' ? 'wood' : 'paint' }, o.kind === 'window' ? .65 : 0),
          o.id, h, o.width, enumeration(o.kind === 'door' ? 'DOOR' : 'WINDOW'), enumeration('NOTDEFINED'), null);
        writer.root('IFCRELFILLSELEMENT', [...elementKey, 'fills'], null, opening, fill);
        contained.push(fill); source(fill, elementKey, o.kind, o.id, { WallId: wall.id });
        writer.properties(fill, elementKey, 'TrazoCasa_Geometry', { Width: measure(o.width), Height: measure(h), Sill: measure(sill), Representation: 'Simplified closed panel', ...(o.kind === 'door' ? { Hinge: o.hinge ?? 'start', Swing: o.swing ?? 'negative' } : {}) });
      }
    }
    for (const surface of plan.surfaces) for (const kind of ['slab', 'roof'] as const) {
      const plate = surface[kind]; if (!plate) continue;
      const key = [...floorKey, kind, surface.id], footprint = surface.points.map(cad);
      const platePlacement = writer.placement(placement, [0, 0, kind === 'slab' ? -plate.thickness : 0]);
      let body: Body, bottom: number, top: number;
      if (kind === 'roof' && surface.roof) {
        const roof = surface.roof, planes = roofPlanes(surface).map(p => ({ a: p.a, b: -p.b, c: p.c }));
        const range = roofHeightRange(surface); bottom = range[0]; top = range[1] + roof.thickness;
        if (!roof.shape) body = { type: 'SweptSolid', items: [writer.extrude(footprint, roof.thickness, roof.height)] };
        else {
          let outer = writer.extrude(footprint, top + .1), inner = writer.extrude(footprint, top + .1);
          for (const p of planes) { outer = writer.clipTop(outer, { ...p, c: p.c + roof.thickness }); inner = writer.clipTop(inner, p); }
          body = { type: 'CSG', items: [writer.add('IFCBOOLEANRESULT', enumeration('DIFFERENCE'), outer, inner)] };
        }
      } else { bottom = 0; top = plate.thickness; body = { type: 'SweptSolid', items: [writer.extrude(footprint, plate.thickness)] }; }
      const roofType = !surface.roof?.shape ? 'FLAT_ROOF' : ({ shed: 'SHED_ROOF', gable: 'GABLE_ROOF', halfHip: 'HIPPED_GABLE_ROOF', hip: 'HIP_ROOF', perimeter: 'FREEFORM' } as const)[surface.roof.shape.kind];
      const product = writer.root(kind === 'slab' ? 'IFCSLAB' : 'IFCROOF', key, surface.name, null, platePlacement, writer.shape(body, plate.appearance), surface.id, enumeration(kind === 'slab' ? 'FLOOR' : roofType));
      contained.push(product); source(product, key, kind, surface.id);
      writer.properties(product, key, 'TrazoCasa_Geometry', { VerticalThickness: measure(plate.thickness), ...appearanceProperties(plate.appearance), ...(kind === 'roof' && surface.roof ? { EaveHeight: measure(surface.roof.height), Shape: surface.roof.shape?.kind ?? 'flat', SlopePercent: surface.roof.shape?.slope ?? 0, DirectionDegrees: surface.roof.shape?.direction ?? 0 } : {}) });
      for (const hole of surface.holes ?? []) if (hole.target === kind || hole.target === 'both') {
        const holeKey = [...floorKey, kind + '-opening', hole.id];
        const holePlacement = writer.placement(platePlacement, [0, 0, bottom - .01]);
        const representation = writer.shape({ type: 'SweptSolid', items: [writer.extrude(hole.points.map(cad), top - bottom + .02)] });
        const opening = writer.root('IFCOPENINGELEMENT', holeKey, hole.name, null, holePlacement, representation, hole.id, enumeration('OPENING'));
        writer.root('IFCRELVOIDSELEMENT', [...holeKey, 'voids'], null, product, opening);
        source(opening, holeKey, kind + '-opening', hole.id, { SurfaceId: surface.id, Target: kind });
      }
    }
    if (contained.length) writer.root('IFCRELCONTAINEDINSPATIALSTRUCTURE', [...floorKey, 'contains'], null, contained, storey);
  }
  writer.root('IFCRELAGGREGATES', [...rootKey, 'building-storeys'], null, structure, storeys);
  const safe = building.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 80) || 'proyecto';
  const filename = `TrazoCasa-${safe}.ifc`;
  return { content: await writer.finish(filename), filename, ...summary };
}
