import { HoleControls } from './HoleControls';
import type { SurfaceHole } from './model';
import { SlabControls } from './LevelControls';
import { ModelLoader } from './ModelLoader';
import { WallHeightControls, OpeningHeightControls } from './HeightControls';
import { ProjectionShape } from './Projection';
import { ReferencePanel } from './ReferencePanel';
import { SelectionActions } from './SelectionActions';
import { SurfaceSummaryPanel } from './SurfaceSummaryPanel';
import { StartPanel, QuickGuide } from './StartPanel';
import { createTemplate } from './templates';
import { LibraryPanel } from './LibraryPanel';
import { readLibrary, storeProject } from './library';
import { DrivePanel } from './DrivePanel';
import type { DriveBinding } from './driveApi';
import { StaircaseControls } from './StaircaseControls';
import { defaultStaircase, parseStaircase, staircasePieces, addStaircase } from './stairs';
import type { StaircaseFields } from './stairs';
import { GroupControls } from './GroupControls';
import { expandFurnitureSelection, selectionBounds, groupFurniture, ungroupFurniture, translateFurnitureSelection, rotateFurnitureSelection, duplicateFurnitureSelection, removeFurnitureSelection } from './groups';
import { alignFurniture } from './alignment';
import type { AlignmentGuide } from './alignment';
import { FloorManager } from './Floors';
import { ProjectHeader } from './ProjectHeader';
import { SurfaceFill, SurfaceAnnotation, SurfacePreview, SurfaceControls, HoleShapes } from './Surface';
import { DimensionShape, DimensionControls } from './Dimension';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Armchair, CornerUpRight, ArrowDownToLine, Check, DoorOpen, Grid2X2, Hand, House, Leaf, Maximize, Minus, MousePointer2, Pencil, Plus, Redo2, RotateCcw, Ruler, Scan, Square, Trash2, Type, Undo2, X } from 'lucide-react';
import { buildingFromPlan, validateBuilding, activeFloorPlan, replaceFloorPlan, addFloor, renameFloor, removeFloor, addSurface, addSurfaceHole, editSurfaceGeometry, addDimension, dimensionOffset, addRectangle, distance, emptyPlan, fitOpening, furnitureCatalog, planBounds, project, sample, snap, uid, validatePlan, moveWallEndpoint, translateWall, splitWall, wallThickness } from './model';
import type { Building, Furniture, FurnitureKind, Opening, Plan, Point, Wall } from './model';
import { FurnitureCatalog, FurnitureProperties, FurnitureShape } from './Furniture';
import { WallControls } from './WallControls';
import { printPlan } from './print';
import { createExport, renderPng } from './export';
import { OpeningShape, DoorControls } from './Opening';
import { RoomTool, RoomPreview, roomEnd } from './RoomTool';
import type { RoomOptions } from './RoomTool';

type Tool = 'hole' | 'projection' | 'stairs' | 'surface' | 'dimension' | 'select' | 'room' | 'wall' | 'door' | 'window' | 'label' | 'furniture' | 'pan';
type History = { past: Building[]; present: Building; future: Building[] };
type Drag = { holeId?:string; furnitureIds?: string[]; pointer: number; start: Point; original: Plan; id: string; kind: 'hole' | 'holeVertex' | 'projection' | 'projectionVertex' | 'surface' | 'surfaceVertex' | 'dimension' | 'dimensionEndpoint' | 'endpoint' | 'wall' | 'label' | 'opening' | 'furniture' | 'pan'; center: Point; end?: 'a' | 'b'; vertex?: number };
const KEY = 'trazocasa.project.v1';
const tools = [{id:'projection',icon:Ruler,label:'Proyección',key:'P'},{ id: 'select', icon: MousePointer2, label: 'Seleccionar', key: 'V' }, { id: 'room', icon: Scan, label: 'Habitación', key: 'R' }, { id: 'wall', icon: Pencil, label: 'Pared', key: 'W' }, { id: 'door', icon: DoorOpen, label: 'Puerta', key: 'D' }, { id: 'window', icon: Square, label: 'Ventana', key: 'N' }, { id: 'surface', icon: Scan, label: 'Superficie', key: 'S' }, { id: 'dimension', icon: Ruler, label: 'Cota', key: 'C' }, { id: 'label', icon: Type, label: 'Texto', key: 'T' }, { id: 'furniture', icon: Armchair, label: 'Muebles', key: 'F' }, { id: 'stairs', icon: CornerUpRight, label: 'Escaleras', key: 'E' }, { id: 'pan', icon: Hand, label: 'Mover lienzo', key: 'H' }] as const;
const hints: Record<Tool, string> = { hole:'Marcá el hueco dentro del contorno. Enter o Cerrar hueco confirma; Esc cancela.', projection:'Marcá los puntos del contorno y elegí Terminar abierta o Cerrar contorno. Esc cancela.', stairs: 'Elegí forma y medidas; tocá el plano para colocar la escalera agrupada. Esc cancela.', surface: 'Marcá el contorno y tocá el primer punto para cerrarlo. Esc cancela.', dimension: 'Marcá dos puntos y luego ubicá la cota. Esc para cancelar.', select: 'Seleccioná y arrastrá para mover. Shift + clic o Selección múltiple permite sumar piezas.', room: 'Creá una habitación con dos esquinas o con medidas exactas.', wall: 'Tocá el inicio y luego el final de la pared. Esc para cancelar.', door: 'Tocá una pared para colocar una puerta de 80 cm.', window: 'Tocá una pared para colocar una ventana de 120 cm.', label: 'Tocá el plano para agregar el nombre de un ambiente.', furniture: 'Elegí un mueble y tocá el plano para colocarlo. Esc para cancelar.', pan: 'Arrastrá para recorrer tu plano.' };
function load(): { plan: Building; message: string } {
  try { const value = localStorage.getItem(KEY); return { plan: value ? validateBuilding(JSON.parse(value)) : buildingFromPlan(sample()), message: value ? 'Recuperamos tu último bosquejo.' : '' }; }
  catch { return { plan: buildingFromPlan(sample()), message: 'No pudimos recuperar el guardado local. Podés abrir una copia descargada.' }; }
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export default function App() {
  const [initial] = useState(load);
  const [history, setHistory] = useState<History>({ past: [], present: initial.plan, future: [] });
  const building=history.present;
  const projectKeys=useRef(new WeakMap<Building,string>());
  const [libraryDialog,setLibraryDialog]=useState(false);
  const [modelDialog,setModelDialog]=useState(false);
  const [summaryDialog,setSummaryDialog]=useState(false);
  const [referenceDialog,setReferenceDialog]=useState(false);
  const [startDialog,setStartDialog]=useState(()=>{try{return localStorage.getItem('trazocasa.welcome.v1')!=='seen';}catch{return true;}});
  const [quickGuide,setQuickGuide]=useState(false);
  function closeStart(){setStartDialog(false);try{localStorage.setItem('trazocasa.welcome.v1','seen');}catch{}}
  function closeGuide(){setQuickGuide(false);try{localStorage.setItem('trazocasa.guide.v1','done');}catch{}}
  const [initialProjectId]=useState(()=>{try{return readLibrary().find(p=>!p.deleted&&JSON.stringify(p.building)===JSON.stringify(initial.plan))?.id??uid();}catch{return uid();}});
  if(building===initial.plan&&!projectKeys.current.has(building))projectKeys.current.set(building,initialProjectId);
  if(!projectKeys.current.has(building))projectKeys.current.set(building,uid());
  const projectKey=projectKeys.current.get(building)!;
  const [driveDialog,setDriveDialog]=useState(false);
  const [initialDrive,setInitialDrive]=useState<{key:string;binding:DriveBinding}>();
  function trackProject(next:Building,previous:Building,replace=false){projectKeys.current.set(next,replace?(projectKeys.current.get(next)??uid()):projectKeys.current.get(previous)!);return next;}
 const plan=useMemo(()=>activeFloorPlan(building),[building]);
 const activeFloor=building.floors.find(f=>f.id===building.activeFloorId)!;
 const floorIndex=building.floors.findIndex(f=>f.id===building.activeFloorId);
 const belowFloor=floorIndex>0?building.floors[floorIndex-1]:undefined;
 const [floorDialog,setFloorDialog]=useState(false);
 const [showBelow,setShowBelow]=useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [mobilePanel,setMobilePanel]=useState<'canvas'|'tools'|'details'>('canvas');
  const [roomOptions, setRoomOptions] = useState<RoomOptions>({ mode: 'corners', width: '4', depth: '3', name: 'Ambiente' });
  const [staircaseFields, setStaircaseFields] = useState<StaircaseFields>(defaultStaircase);
  const staircase = useMemo(()=>{try {const options=parseStaircase(staircaseFields);let i=0;const items=staircasePieces(options,{x:0,y:0},()=>`stair-preview-${i++}`);return {options,items,bounds:selectionBounds(items),error:''};}catch(error){return {options:null,items:[],bounds:null,error:error instanceof Error?error.message:'Revisá las medidas.'};}},[staircaseFields]);
  const [furnitureKind, setFurnitureKind] = useState<FurnitureKind>('bed');
  const [exporting, setExporting] = useState(false);
  const [selection, setPrimarySelection] = useState<string | null>(null);
  const [selectedHoleId,setSelectedHoleId]=useState<string|null>(null);
  const [holeTarget,setHoleTarget]=useState<{surfaceId:string;target:SurfaceHole['target']}|null>(null);
  useEffect(()=>{if(tool!=='hole')setHoleTarget(null);},[tool]);
  const [multipleIds, setMultipleIds] = useState<string[]>([]);
  const [multipleMode, setMultipleMode] = useState(false);
  function setSelection(id: string | null) { setSelectedHoleId(null);setPrimarySelection(id); setMultipleIds([]); }
  function selectFurniture(ids: string[]) { setPrimarySelection(ids[0] ?? null); setMultipleIds(ids); }
  const [surfacePoints, setSurfacePoints] = useState<Point[]>([]);
  const [start, setStart] = useState<Point | null>(null);
  const [dimensionEnd, setDimensionEnd] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<Plan | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<Point>({ x: 4, y: 3 });
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [alignment, setAlignment] = useState(true);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [grid, setGrid] = useState(true);
  const [projectionPoints,setProjectionPoints]=useState<Point[]>([]);
  const [projectionsVisible,setProjectionsVisible]=useState(true);
  useEffect(()=>{setProjectionPoints([]);},[building.activeFloorId]);
  useEffect(()=>{if(tool==='projection')setProjectionsVisible(true);},[tool]);
  const [measures, setMeasures] = useState(true);
  const [manualMeasures,setManualMeasures]=useState(true);
  useEffect(()=>{if(tool==='dimension')setManualMeasures(true);},[tool]);
  const [saved, setSaved] = useState(true);
  const [message, setMessage] = useState(initial.message);
  const [help, setHelp] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [dimension, setDimension] = useState('');
  const [name, setName] = useState(plan.name);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIssue = useRef<string | null>(null);
  const initiallyFitted = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = draft ?? plan;
  const projectionItem=shown.projections?.find(p=>p.id===selection);
  const surface = shown.surfaces.find(s=>s.id===selection);
  const selectedHole=surface?.holes?.find(h=>h.id===selectedHoleId);
  const manualDimension = shown.dimensions.find(d => d.id === selection);
  const wall = shown.walls.find(w => w.id === selection);
  const opening = shown.openings.find(o => o.id === selection);
  const label = shown.labels.find(l => l.id === selection);
  const furniture = shown.furniture.find(f => f.id === selection);
  const selectedIds = expandFurnitureSelection(shown, multipleIds.length ? multipleIds : selection ? [selection] : []);
  const selectedItems = shown.furniture.filter(f=>selectedIds.includes(f.id));
  const multiple = selectedItems.length > 1;
  const grouped = multiple && !!selectedItems[0].groupId && selectedItems.every(f=>f.groupId===selectedItems[0].groupId);
  const selectedBounds = multiple ? selectionBounds(selectedItems) : null;
  const activeCatalogItem = furnitureCatalog.find(f => f.kind === furnitureKind)!;
  const roomPreviewStart = tool === 'room' ? roomOptions.mode === 'dimensions' ? cursor : start : null;
  const roomPreviewEnd = roomPreviewStart ? roomOptions.mode === 'dimensions' ? roomEnd(roomPreviewStart, roomOptions) : cursor : null;
  const viewW = size.width / (75 * zoom), viewH = size.height / (75 * zoom);
  const commitBuilding=(next:Building,replace=false)=>setHistory(h=>({past:[...h.past.slice(-79),h.present],present:trackProject(next,h.present,replace),future:[]}));
 const commit=(next:Plan)=>setHistory(h=>({past:[...h.past.slice(-79),h.present],present:trackProject(replaceFloorPlan(h.present,next),h.present),future:[]}));
 function resetInteraction(){setProjectionPoints([]);setMultipleMode(false);setDraft(null);setDrag(null); setGuides([]);setSelection(null);setSurfacePoints([]);setStart(null);setDimensionEnd(null);setCursor(null);setTool('select');}
 function changeFloor(id:string){resetInteraction();setHistory(h=>({...h,present:trackProject({...h.present,activeFloorId:id},h.present)}));}
 function changeFloors(action:()=>Building){try{commitBuilding(action());resetInteraction();setFloorDialog(false);}catch(error){setMessage(error instanceof Error?error.message:'No se pudo modificar la planta.');}}
 useEffect(()=>{resetInteraction();},[building.activeFloorId]);
  const undo = () => { setDraft(null); setDrag(null); setGuides([]); setSurfacePoints([]); setStart(null); setDimensionEnd(null); setSelection(null); setHistory(h => h.past.length ? ({ past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }) : h); };
  const redo = () => { setDraft(null); setDrag(null); setGuides([]); setSurfacePoints([]); setStart(null); setDimensionEnd(null); setSelection(null); setHistory(h => h.future.length ? ({ past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }) : h); };
  function remove() { if (drag) return; if(surface&&selectedHole){commit(validatePlan({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,holes:s.holes?.filter(h=>h.id!==selectedHole.id)}:s)}));setSelectedHoleId(null);return;} if (selectedIds.length) { runSelectionAction(()=>removeFurnitureSelection(plan,selectedIds)); setSelection(null); return; } if (!selection) return; commit({ ...plan, projections:plan.projections?.filter(p=>p.id!==selection), surfaces: plan.surfaces.filter(s=>s.id!==selection), dimensions: plan.dimensions.filter(d=>d.id!==selection), walls: plan.walls.filter(w => w.id !== selection), openings: plan.openings.filter(o => o.id !== selection && o.wallId !== selection), labels: plan.labels.filter(l => l.id !== selection), furniture: plan.furniture.filter(f => f.id !== selection) }); setSelection(null); }
  function runSelectionAction(action:()=>Plan) {
    if(drag)return;
    try { commit(action()); } catch(error) { setMessage(error instanceof Error?error.message:'No se pudo modificar la selección.'); }
  }
  function duplicateSelection() {
    if(drag)return;
    try { const next=duplicateFurnitureSelection(plan,selectedIds); commit(next.plan); selectFurniture(next.ids); setMultipleMode(false); }
    catch(error) { setMessage(error instanceof Error?error.message:'No se pudo duplicar la selección.'); }
  }
  function saveFile() { download(new Blob([JSON.stringify(building, null, 2)], { type: 'application/json' }), `${plan.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Mi plano'}.trazocasa`); setMessage('Copia descargada. Podés volver a abrirla con “Abrir”.'); }
  function fit(p = plan, viewport = size) {
    const b = planBounds(p, 1);
    setCenter({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    setZoom(Math.max(.003, Math.min(2.5, viewport.width / (b.width * 75), viewport.height / (b.height * 75))));
  }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[0].contentRect;
      const viewport = { width: box.width, height: box.height };
      setSize(viewport);
      if (!initiallyFitted.current && box.width > 0 && box.height > 0) { initiallyFitted.current = true; fit(activeFloorPlan(initial.plan), viewport); }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { try { storeProject(projectKey,building); localStorage.setItem(KEY, JSON.stringify(building)); setSaved(true); } catch { setSaved(false); setMessage('No pudimos guardar en este dispositivo. Descargá una copia antes de salir.'); } }, [building,projectKey]);
  useEffect(() => { setName(plan.name); }, [plan.name]);
  useEffect(() => { setDimension(wall ? distance(wall.a, wall.b).toFixed(2) : opening ? opening.width.toFixed(2) : ''); }, [selection, plan]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 6500); return () => clearTimeout(timer); }, [message]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input, textarea, select') || help || newDialog || floorDialog || driveDialog || libraryDialog || startDialog || summaryDialog || referenceDialog || modelDialog) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; } if (e.key === 'Escape') { setProjectionPoints([]); setMultipleMode(false); setTool('select'); setSurfacePoints([]); setStart(null); setDimensionEnd(null); setDrag(null); setGuides([]); setDraft(null); setSelection(null); } if(tool==='projection'&&e.key==='Enter'&&!(e.target as HTMLElement).closest('button')){e.preventDefault();finishProjection(e.shiftKey);return;}if(tool==='projection'&&(e.key==='Backspace'||e.key==='Delete')){e.preventDefault();setProjectionPoints(p=>p.slice(0,-1));return;} if((tool==='surface'||tool==='hole') && e.key==='Enter' && !(e.target as HTMLElement).closest('button')){e.preventDefault();finishSurface();return;} if((tool==='surface'||tool==='hole') && (e.key==='Backspace'||e.key==='Delete')){e.preventDefault();setSurfacePoints(p=>p.slice(0,-1));return;} if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); } if (!e.ctrlKey && !e.metaKey) { const t = tools.find(t => t.key.toLowerCase() === e.key.toLowerCase()); if (t) { setTool(t.id); setSurfacePoints([]); setStart(null); setDimensionEnd(null); } } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  function finishSurface() {
    try {const target=tool==='hole'?holeTarget:null;if(tool==='hole'&&!target)throw new Error('Seleccioná un contorno para dibujar el hueco.');const next=target?addSurfaceHole(plan,target.surfaceId,surfacePoints,target.target):addSurface(plan,surfacePoints);commit(next);setSelection(target?.surfaceId??next.surfaces[next.surfaces.length-1].id);if(target)setSelectedHoleId(next.surfaces.find(s=>s.id===target.surfaceId)!.holes!.at(-1)!.id);setSurfacePoints([]);setCursor(null);setTool('select');}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo cerrar la superficie.');}
  }
  function startHole(surfaceId:string,target:SurfaceHole['target']){resetInteraction();setModelDialog(false);setQuickGuide(false);setSelection(surfaceId);setHoleTarget({surfaceId,target});setTool('hole');setMobilePanel('canvas');}
  function coords(e: ReactPointerEvent<SVGSVGElement>): Point { const matrix = svgRef.current!.getScreenCTM()!; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); return { x: p.x, y: p.y }; }
  function snapped(p: Point) { const nearest = plan.walls.flatMap(w => [w.a, w.b]).find(n => distance(n, p) < .18 / zoom); return nearest ?? { x: snap(p.x), y: snap(p.y) }; }
  function staircaseAt(p: Point, free: boolean) {
    if (!staircase.bounds) return null;
    return alignFurniture(plan,{id:'staircase-preview',kind:'stairLanding',rotation:0,...staircase.bounds,x:p.x,y:p.y},8/(75*zoom),alignment,free);
  }
  function furnitureAt(p: Point, free: boolean) {
    return alignFurniture(plan, {id:'preview',kind:furnitureKind,...p,width:activeCatalogItem.width,depth:activeCatalogItem.depth,rotation:0},8/(75*zoom),alignment,free);
  }
  function finishProjection(closed:boolean){try{const id=uid();const next=validatePlan({...plan,projections:[...(plan.projections??[]),{id,name:'',points:projectionPoints,closed}]});commit(next);setProjectionPoints([]);setCursor(null);setTool('select');setSelection(id);setMessage('Proyección guardada en esta planta.');}catch(error){setMessage((error as Error).message);}}
  function onDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (!e.isPrimary || (e.button !== 0 && e.button !== 1)) return;
    if (drag) return;
    dragIssue.current = null;
    const p = coords(e), q = snapped(p);
    if(tool==='projection'){if(projectionPoints.length>=3&&distance(p,projectionPoints[0])*75*zoom<14){finishProjection(true);return;}if(projectionPoints.length&&distance(q,projectionPoints[projectionPoints.length-1])<.1-1e-9)return;if(projectionPoints.length>=200){setMessage('Máximo 200 puntos por proyección.');return;}setProjectionPoints(points=>[...points,q]);return;}
    if (tool === 'pan' || e.button === 1) { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ pointer: e.pointerId, start: { x: e.clientX, y: e.clientY }, original: plan, center, id: '', kind: 'pan' }); return; }
    if (tool === 'surface'||tool === 'hole') {
      if(surfacePoints.length>=3 && distance(p,surfacePoints[0])<.2/zoom){finishSurface();return;}
      if(surfacePoints.length>=100){setMessage('El contorno admite hasta 100 puntos. Cerralo o quitá el último punto.');return;}
      if(surfacePoints.length && distance(q,surfacePoints[surfacePoints.length-1])<.1-1e-9){setMessage('Cada lado debe medir al menos 10 cm.');return;}
      setSurfacePoints([...surfacePoints,q]);setCursor(q);return;
    }
    if (tool === 'dimension') {
 if (!start) {setStart(q);setCursor(q);return;}
 if (!dimensionEnd) {if(distance(start,q)<.1-1e-9){setMessage('La cota debe medir al menos 10 cm.');return;}setDimensionEnd(q);return;}
 try {const next=addDimension(plan,start,dimensionEnd,q);commit(next);setSelection(next.dimensions[next.dimensions.length-1].id);setSurfacePoints([]); setStart(null);setDimensionEnd(null);setCursor(null);setTool('select');}
 catch(error){setMessage(error instanceof Error?error.message:'No se pudo crear la cota.');}return;
 }
 if (tool === 'room') {
      if (roomOptions.mode === 'corners' && !start) { setStart(q); setCursor(q); return; }
      const from = roomOptions.mode === 'corners' ? start! : q;
      const end = roomOptions.mode === 'corners' ? q : roomEnd(from, roomOptions);
      if (!end) { setMessage('Ingresá ancho y fondo entre 0,50 y 100 metros.'); return; }
      try { const next = addRectangle(plan, from, end, roomOptions.name); commit(next); setSurfacePoints([]); setStart(null); setDimensionEnd(null); setCursor(null); setSelection(null); setTool('select'); setMessage('Habitación creada. Podés editar cada pared y agregar puertas.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear la habitación.'); }
      return;
    }
    if (tool === 'wall') { if (!start) setStart(q); else { const end = e.shiftKey ? (Math.abs(q.x - start.x) > Math.abs(q.y - start.y) ? { x: q.x, y: start.y } : { x: start.x, y: q.y }) : q; if (distance(start, end) < .2) { setMessage('La pared debe medir al menos 20 cm.'); return; } commit({ ...plan, walls: [...plan.walls, { id: uid(), a: start, b: end, thickness: .15 }] }); setSurfacePoints([]); setStart(null); setDimensionEnd(null); } return; }
    if (tool === 'door' || tool === 'window') { const nearest = plan.walls.map(w => ({ w, ...project(p, w) })).sort((a, b) => a.distance - b.distance)[0]; if (!nearest || nearest.distance > .3 / zoom) { setMessage('Elegí una pared para colocar la abertura.'); return; } const width = tool === 'door' ? .8 : 1.2; const t = fitOpening(plan, nearest.w, nearest.t, width); if (t === null) { setMessage('No hay espacio suficiente en ese lugar de la pared.'); return; } const id = uid(); commit({ ...plan, openings: [...plan.openings, { id, wallId: nearest.w.id, t, width, kind: tool }] }); setSelection(id); return; }
    if (tool === 'stairs') {
      if (!staircase.options) {setMessage(staircase.error);return;}
      const aligned=staircaseAt(p,e.altKey)!;
      try {const next=addStaircase(plan,staircase.options,aligned.item);commit(next.plan);selectFurniture(next.ids);setTool('select');setMultipleMode(false);setCursor(null);setGuides([]);setMessage(`Escalera en ${staircase.options.shape} colocada como grupo de tres piezas.`);}
      catch(error){setMessage(error instanceof Error?error.message:'No se pudo colocar la escalera.');}
      return;
    }
    if (tool === 'furniture') {
      if (plan.furniture.length >= 500) { setMessage('Podés colocar hasta 500 muebles por proyecto.'); return; }
      const item: Furniture = { ...furnitureAt(p, e.altKey).item, id: uid() };
      setGuides([]);
      try { commit(validatePlan({ ...plan, furniture: [...plan.furniture, item] })); setSelection(item.id); setTool('select'); }
      catch { setMessage('Colocá el mueble dentro de los límites del plano.'); }
      return;
    }
    if (tool === 'label') { const id = uid(); commit({ ...plan, labels: [...plan.labels, { id, ...q, text: 'Ambiente' }] }); setSelection(id); setTool('select'); return; }
    const target = (e.target as Element).closest('[data-id]'); const id = target?.getAttribute('data-id');
    if (id && plan.furniture.some(f=>f.id===id)) {
      const clicked = expandFurnitureSelection(plan,[id]);
      if (e.shiftKey || multipleMode) {
        const next = clicked.every(key=>selectedIds.includes(key)) ? selectedIds.filter(key=>!clicked.includes(key)) : [...new Set([...selectedIds,...clicked])];
        selectFurniture(next); setGuides([]); return;
      }
      const ids = selectedIds.includes(id) ? selectedIds : clicked;
      selectFurniture(ids);
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({pointer:e.pointerId,start:p,original:plan,id,kind:'furniture',center,furnitureIds:ids});
      return;
    }
    setSelection(id ?? null); if (!id) return;
    const end = (e.target as Element).closest('[data-endpoint]')?.getAttribute('data-endpoint') as 'a' | 'b' | undefined;
    const vertexValue=(e.target as Element).closest('[data-vertex]')?.getAttribute('data-vertex');
    const vertex=vertexValue==null?undefined:Number(vertexValue);
    const holeId=(e.target as Element).closest('[data-hole]')?.getAttribute('data-hole')??undefined;setSelectedHoleId(holeId??null);
    const kind = holeId?vertex===undefined?'hole':'holeVertex':plan.projections?.some(r=>r.id===id)?vertex===undefined?'projection':'projectionVertex': plan.surfaces.some(s=>s.id===id) ? vertex===undefined?'surface':'surfaceVertex' : plan.dimensions.some(d=>d.id===id) ? end ? 'dimensionEndpoint' : 'dimension' : end ? 'endpoint' : plan.walls.some(w => w.id === id) ? 'wall' : plan.labels.some(l => l.id === id) ? 'label' : plan.furniture.some(f => f.id === id) ? 'furniture' : 'opening';
    e.currentTarget.setPointerCapture(e.pointerId); setDrag({ pointer: e.pointerId, start: kind === 'furniture' ? p : q, original: plan, id, kind, center, end, vertex, holeId });
  }
  function onMove(e: ReactPointerEvent<SVGSVGElement>) { const p = coords(e), q = snapped(p); if (drag && e.pointerId !== drag.pointer) return;
    if (tool === 'stairs' && !drag) {const aligned=staircaseAt(p,e.altKey);setCursor(aligned?aligned.item:null);setGuides(aligned?.guides??[]);return;}
    if (tool === 'furniture' && !drag) { const aligned=furnitureAt(p,e.altKey); setCursor(aligned.item); setGuides(aligned.guides); return; }
    setCursor(tool === 'wall' && start && e.shiftKey ? Math.abs(q.x - start.x) > Math.abs(q.y - start.y) ? { x: q.x, y: start.y } : { x: start.x, y: q.y } : q); if (!drag || e.pointerId !== drag.pointer) return;
    if (drag.kind === 'pan') { setCenter({ x: drag.center.x - (e.clientX - drag.start.x) / (75 * zoom), y: drag.center.y - (e.clientY - drag.start.y) / (75 * zoom) }); return; }
    const dx = snap(q.x - drag.start.x), dy = snap(q.y - drag.start.y); const original = drag.original;
    if(drag.kind==='projection'||drag.kind==='projectionVertex'){
      const item=original.projections!.find(r=>r.id===drag.id)!;
      const points=item.points.map((p,i)=>drag.kind==='projection'?{x:p.x+dx,y:p.y+dy}:i===drag.vertex?q:p);
      try{setDraft(validatePlan({...original,projections:original.projections!.map(r=>r.id===item.id?{...r,points}:r)}));dragIssue.current=null;}catch(error){setDraft(null);dragIssue.current=(error as Error).message;}
    }
    if(['surface','surfaceVertex','hole','holeVertex'].includes(drag.kind)) {
      try{setDraft(editSurfaceGeometry(original,drag.id,drag.kind==='surface'||drag.kind==='hole'?{delta:{x:dx,y:dy}}:{vertex:drag.vertex!,point:q},drag.holeId));dragIssue.current=null;}
      catch(error){setDraft(null);dragIssue.current=error instanceof Error?error.message:'No se pudo mover el contorno.';}
    }
    if (drag.kind === 'dimension' || drag.kind === 'dimensionEndpoint') {
 const item=original.dimensions.find(d=>d.id===drag.id)!;
 try {const next=drag.kind==='dimensionEndpoint'?{...item,[drag.end!]:q}:{...item,offset:item.offset+dimensionOffset(item.a,item.b,q)-dimensionOffset(item.a,item.b,drag.start)};
 setDraft(validatePlan({...original,dimensions:original.dimensions.map(d=>d.id===item.id?next:d)}));dragIssue.current=null;}
 catch {setDraft(null);dragIssue.current='Revisá los puntos y la separación de la cota (máximo 100 m).';}
 }
 if (drag.kind === 'label') setDraft({ ...original, labels: original.labels.map(l => l.id === drag.id ? { ...l, x: l.x + dx, y: l.y + dy } : l) });
    if (drag.kind === 'furniture') {
      const ids=drag.furnitureIds ?? [drag.id];
      const items=original.furniture.filter(f=>ids.includes(f.id));
      // A click must not move an off-grid piece or create a history entry.
      if (Math.hypot(p.x-drag.start.x,p.y-drag.start.y)*75*zoom<3) {setDraft(null);setGuides([]);return;}
      const source: Furniture = items.length===1 ? items[0] : {id:'selection-proxy',kind:'stairLanding',rotation:0,...selectionBounds(items)};
      const targets={...original,furniture:original.furniture.filter(f=>!ids.includes(f.id))};
      const aligned=alignFurniture(targets,{...source,x:source.x+p.x-drag.start.x,y:source.y+p.y-drag.start.y},8/(75*zoom),alignment,e.altKey);
      try {
        setDraft(translateFurnitureSelection(original,ids,{x:aligned.item.x-source.x,y:aligned.item.y-source.y}));
        setGuides(aligned.guides); dragIssue.current=null;
      } catch(error) {setGuides([]);dragIssue.current=error instanceof Error?error.message:'No se pudo mover la selección.';}
    }
    if (drag.kind === 'endpoint' || drag.kind === 'wall') {
      try {
        let next: Plan;
        if (drag.kind === 'endpoint') {
          const source = original.walls.find(w => w.id === drag.id)![drag.end!];
          const nearby = original.walls.flatMap(w => [w.a,w.b]).filter(n => distance(n,source)>1e-6 && distance(n,p)<.18/zoom).sort((a,b)=>distance(a,p)-distance(b,p))[0];
          next = moveWallEndpoint(original,drag.id,drag.end!,nearby ?? {x:snap(p.x),y:snap(p.y)});
        } else next = translateWall(original,drag.id,{x:dx,y:dy});
        setDraft(next); dragIssue.current=null;
      } catch(error) { setDraft(null); dragIssue.current=error instanceof Error?error.message:'No se pudo mover la pared.'; }
    }
    if (drag.kind === 'opening') { const o = original.openings.find(o => o.id === drag.id)!; const w = original.walls.find(w => w.id === o.wallId)!; const t = fitOpening(original, w, project(p, w).t, o.width, o.id); if (t !== null) setDraft({ ...original, openings: original.openings.map(item => item.id === o.id ? { ...o, t } : item) }); }
  }
  function onUp(e: ReactPointerEvent<SVGSVGElement>) { if (!drag || e.pointerId !== drag.pointer) return; if (dragIssue.current) setMessage(dragIssue.current); if (draft && JSON.stringify(draft) !== JSON.stringify(plan)) commit(draft); setDraft(null); setDrag(null); setGuides([]); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }
  function applyDimension() { const value = Number(dimension.replace(',', '.')); if (!Number.isFinite(value) || value < .3 || value > 100) { setMessage('Ingresá una medida entre 0,30 y 100 metros.'); return; } let next = plan;
    if (wall) {
      const length=distance(wall.a,wall.b), endpoint={x:wall.a.x+(wall.b.x-wall.a.x)*value/length,y:wall.a.y+(wall.b.y-wall.a.y)*value/length};
      try { commit(moveWallEndpoint(plan,wall.id,'b',endpoint)); } catch(error) { setMessage(error instanceof Error?error.message:'No se pudo cambiar la medida.'); }
      return;
    }
    if (opening) { const w = plan.walls.find(w => w.id === opening.wallId)!; const t = fitOpening(plan, w, opening.t, value, opening.id); if (t === null) { setMessage('La abertura no cabe o se superpone con otra.'); return; } next = { ...plan, openings: plan.openings.map(o => o.id === opening.id ? { ...o, width: value, t } : o) }; }
    try { commit(validatePlan(next)); } catch { setMessage('Esa medida deja una pared o abertura sin espacio suficiente.'); }
  }
  async function openFile(file?: File) { if (!file) return; try { if (file.size > 20_000_000) throw new Error('El archivo supera el límite de 20 MB.'); const next = validateBuilding(JSON.parse(await file.text())); commitBuilding(next,true); resetInteraction(); setSelection(null); setSurfacePoints([]); setStart(null); setDimensionEnd(null); setTool('select'); fit(activeFloorPlan(next)); setMessage('Proyecto abierto. Podés deshacer para recuperar el anterior.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos abrir el archivo.'); } finally { if (fileRef.current) fileRef.current.value = ''; } }
  function exportSvg() {
    download(createExport(svgRef.current!, plan).blob, `TrazoCasa-${activeFloor.name.replace(/[^\p{L}\p{N} _-]/gu,'') || 'planta'}.svg`);
    setMessage('Imagen SVG descargada. Conserva la calidad al ampliarla.');
  }
  async function exportPng() {
    setExporting(true);
    try { download(await renderPng(svgRef.current!, plan), `TrazoCasa-${activeFloor.name.replace(/[^\p{L}\p{N} _-]/gu,'') || 'planta'}.png`); setMessage('Imagen PNG descargada y lista para compartir.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos exportar la imagen.'); }
    finally { setExporting(false); }
  }
  function changeWallThickness(value:number) {
    if (!wall) return;
    try { commit(validatePlan({...plan,walls:plan.walls.map(w=>w.id===wall.id?{...w,thickness:value}:w)})); }
    catch { setMessage('El espesor debe estar entre 5 y 60 cm.'); }
  }
  function cutWall(at:number) {
    if (!wall) return;
    try { commit(splitWall(plan,wall.id,at)); setMessage('Pared dividida. Las aberturas conservan su posición.'); }
    catch(error) { setMessage(error instanceof Error?error.message:'No se pudo dividir la pared.'); }
  }
  function updateOpening(item: Opening) {
    try { commit(validatePlan({ ...plan, openings: plan.openings.map(o => o.id === item.id ? item : o) })); }
    catch { setMessage('No se pudo modificar esa abertura.'); }
  }
  function updateFurniture(item: Furniture) {
    try { commit(validatePlan({ ...plan, furniture: plan.furniture.map(f => f.id === item.id ? item : f) })); }
    catch { setMessage('Revisá las medidas y la posición del mueble.'); }
  }
  const rename = () => { const next = name.trim() || 'Mi proyecto'; setName(next); if (next !== plan.name) commit({ ...plan, name: next }); };
  function renderWall(w: Wall) { const length = distance(w.a, w.b), angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI; const flip = angle > 90 || angle < -90; return <g key={w.id} data-id={w.id}>
    <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="#3f4b44" strokeWidth={wallThickness(w)} strokeLinecap="round"/>
    <line x1={w.a.x + .025} y1={w.a.y + .025} x2={w.b.x + .018} y2={w.b.y + .018} stroke="#faf9f5" strokeWidth=".018" opacity=".65"/>
    <line data-editor="true" x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={selection === w.id ? '#b97c49' : 'transparent'} strokeWidth={Math.max(wallThickness(w),.24/zoom)} opacity={selection === w.id ? .35 : 1} />
    {measures && <g transform={`translate(${(w.a.x + w.b.x) / 2} ${(w.a.y + w.b.y) / 2}) rotate(${flip ? angle + 180 : angle})`} pointerEvents="none"><rect x="-.38" y="-.38" width=".76" height=".25" rx=".06" fill="#faf9f5"/><text y="-.2" textAnchor="middle" fontSize=".155" fill="#7c8279" fontFamily="Arial,sans-serif">{length.toFixed(2)} m</text></g>}

  </g>; }
  return <div className="app"><div className="editor-shell" inert={modelDialog||driveDialog||libraryDialog||startDialog||summaryDialog||referenceDialog?true:undefined}>
    <ProjectHeader onReference={()=>setReferenceDialog(true)} onSummary={()=>setSummaryDialog(true)} onStart={()=>setStartDialog(true)} onLibrary={()=>{try{storeProject(projectKey,building);setLibraryDialog(true);}catch{setMessage("No pudimos guardar el proyecto actual. Descargá una copia antes de cambiar de trabajo.");}}} name={name} saved={saved} onName={setName} onRename={rename} onNew={()=>setStartDialog(true)} onOpen={()=>fileRef.current?.click()} onSave={saveFile} onDrive={()=>setDriveDialog(true)} onPrint={()=>{if(svgRef.current)void printPlan(svgRef.current,plan,activeFloor.name).catch(error=>setMessage(error instanceof Error?error.message:'No se pudo preparar la impresión.'));}} onHelp={()=>setHelp(true)} onSvg={exportSvg} onPng={()=>void exportPng()} exporting={exporting} dragging={!!drag}/>
    <input ref={fileRef} type="file" hidden accept=".trazocasa,.json" onChange={e=>void openFile(e.target.files?.[0])}/>
    <nav className="mobile-editor-nav" aria-label="Paneles del editor"><button aria-pressed={mobilePanel==='canvas'} onClick={()=>setMobilePanel('canvas')}>Plano</button><button aria-pressed={mobilePanel==='tools'} onClick={()=>setMobilePanel(v=>v==='tools'?'canvas':'tools')}>Herramientas</button><button aria-pressed={mobilePanel==='details'} onClick={()=>setMobilePanel(v=>v==='details'?'canvas':'details')}>Detalles{selection?' •':''}</button><button aria-label="Mover plano" aria-pressed={tool==='pan'} onClick={()=>{resetInteraction();setTool('pan');setMobilePanel('canvas');}}>Mover</button></nav>
      <main className={`workspace mobile-panel-${mobilePanel}`}><aside className="sidebar"><button className="mobile-panel-close" onClick={()=>setMobilePanel("canvas")}>Volver al plano</button><div className="sidebar-top"><span className="eyebrow">TU CAJA DE HERRAMIENTAS</span><h2>De la idea al trazo.</h2><p>Un espacio, mil posibilidades.</p></div>{tool==='surface' && <div className="room-tool surface-tool"><strong>Contorno del ambiente</strong><p>Marcá las esquinas en orden. Tocá el primer punto o cerrá con el botón.</p><p>{surfacePoints.length} puntos marcados</p><button className="apply" disabled={surfacePoints.length<3} onClick={finishSurface}>Cerrar superficie</button><button className="room-cancel" disabled={!surfacePoints.length} onClick={()=>setSurfacePoints(p=>p.slice(0,-1))}>Quitar último punto</button><button className="room-cancel" onClick={()=>{setSurfacePoints([]);setCursor(null);setTool('select');}}>Cancelar superficie</button><small>El área corresponde al contorno marcado. No descuenta muros ni sigue sus cambios.</small></div>}
      {tool==='projection'&&<div className="room-tool"><strong>Contorno de proyección</strong><p>{projectionPoints.length} puntos. Usá la planta inferior como referencia.</p><button disabled={projectionPoints.length<2} onClick={()=>finishProjection(false)}>Terminar abierta</button><button disabled={projectionPoints.length<3} onClick={()=>finishProjection(true)}>Cerrar contorno</button><button disabled={!projectionPoints.length} onClick={()=>setProjectionPoints(p=>p.slice(0,-1))}>Quitar último punto</button><button onClick={()=>{setProjectionPoints([]);setTool('select');}}>Cancelar proyección</button></div>}<div className="tool-list">{tools.map(t => <button key={t.id} className={`tool ${tool === t.id ? 'active' : ''}`} onClick={() => { setTool(t.id); setSurfacePoints([]); setStart(null); setDimensionEnd(null); }} title={`${t.label} (${t.key})`} aria-pressed={tool === t.id}><t.icon size={19}/><span>{t.label}</span><kbd>{t.key}</kbd></button>)}</div>{tool === 'room' && <RoomTool options={roomOptions} onChange={setRoomOptions} started={!!start} onCancel={() => { setSurfacePoints([]); setStart(null); setDimensionEnd(null); setCursor(null); }}/>}
      {tool === 'select' && <div className="selection-tools"><button aria-pressed={multipleMode} onClick={()=>setMultipleMode(v=>!v)}>Selección múltiple</button><button disabled={!selection&&!selectedIds.length} onClick={()=>setSelection(null)}>Limpiar selección</button><small>{multipleMode?'Tocá muebles o escaleras para agregar o quitar. Desactivá para mover.':'Shift + clic para sumar muebles y piezas de escalera.'}</small></div>}
      {tool === 'stairs' && <StaircaseControls value={staircaseFields} onChange={value=>{setStaircaseFields(value);setCursor(null);setGuides([]);}} error={staircase.error} width={staircase.bounds?.width} depth={staircase.bounds?.depth}/>}
      {tool === 'furniture' && <FurnitureCatalog selected={furnitureKind} onChoose={setFurnitureKind}/>}<div className="sidebar-section"><span className="eyebrow">VISTA DEL PLANO</span><button className="toggle-row" onClick={() => { setAlignment(!alignment); setGuides([]); }} aria-pressed={alignment} title="Alinea muebles y escaleras. Alt permite mover libremente."><Scan size={16}/>Ajuste a elementos<span className={`switch ${alignment ? 'on' : ''}`}/></button><button className="toggle-row" onClick={() => setGrid(!grid)} aria-pressed={grid}><Grid2X2 size={16}/>Cuadrícula<span className={`switch ${grid ? 'on' : ''}`}/></button><button className="toggle-row" onClick={() => setMeasures(!measures)} aria-pressed={measures}><Ruler size={16}/>Medidas<span className={`switch ${measures ? 'on' : ''}`}/></button></div><div className="tip-card"><Leaf size={22}/><strong>Las grandes ideas<br/>empiezan en pequeño.</strong><p>Probá, cambiá, volvé a empezar. Este bosquejo es tuyo.</p><span>HECHO PARA IMAGINAR ↗</span></div><div className="sidebar-footer">TRAZOCASA <span>v0.13</span></div></aside>
      <section className="canvas-section" aria-label="Editor de planos"><div className="canvas-top"><div className="floor-switch"><button disabled={!!drag||projectionPoints.length>0||surfacePoints.length>0||!!start} onClick={()=>{resetInteraction();setQuickGuide(false);setModelDialog(true);}}>Ver 3D</button><select aria-label="Planta activa" value={building.activeFloorId} onChange={e=>changeFloor(e.target.value)}>{building.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><button aria-label="Administrar plantas" title="Administrar plantas" onClick={()=>setFloorDialog(true)}><Plus size={15}/></button>{belowFloor&&<button className="below-toggle" aria-label="Mostrar planta inferior" aria-pressed={showBelow} title={'Referencia: '+belowFloor.name} onClick={()=>setShowBelow(v=>!v)}>Inferior</button>}</div><span className="canvas-label">BOSQUEJO 2D</span><div className="history"><button title="Deshacer (Ctrl Z)" aria-label="Deshacer" disabled={!history.past.length} onClick={undo}><Undo2 size={17}/></button><button title="Rehacer (Ctrl Shift Z)" aria-label="Rehacer" disabled={!history.future.length} onClick={redo}><Redo2 size={17}/></button></div></div>
      <div className="canvas-visibility" role="group" aria-label="Visibilidad del plano"><button className="reference-visibility" aria-pressed={measures} aria-label="Mostrar medidas automáticas" title="Solo afecta las medidas automáticas de las paredes; conserva las cotas manuales" onClick={()=>setMeasures(v=>!v)}>{measures?'Ocultar medidas':'Mostrar medidas'}</button><button className="reference-visibility" disabled={!!drag} aria-pressed={manualMeasures} aria-label="Mostrar cotas manuales" onClick={()=>{if(manualMeasures){if(tool==='dimension')resetInteraction();else if(manualDimension)setSelection(null);}setManualMeasures(v=>!v);}}>{manualMeasures?'Ocultar cotas':'Mostrar cotas'}</button><button className="reference-visibility" disabled={!!drag} aria-pressed={projectionsVisible} onClick={()=>{if(projectionItem)setSelection(null);if(tool==='projection')setTool('select');setProjectionsVisible(v=>!v);}}>{projectionsVisible?'Ocultar proyecciones':'Mostrar proyecciones'}</button>{plan.reference&&<button className="reference-visibility" disabled={!!drag} aria-pressed={plan.reference.visible} aria-label="Mostrar imagen de referencia" onClick={()=>{if(plan.reference)commit({...plan,reference:{...plan.reference,visible:!plan.reference.visible}});}}>{plan.reference.visible?'Ocultar referencia':'Mostrar referencia'}</button>}</div>
      {projectionPoints.length>0&&<div className="projection-finish" role="group" aria-label="Finalizar proyección"><strong>{projectionPoints.length} puntos · Proyección sin guardar</strong><div><button disabled={projectionPoints.length<2} onClick={()=>finishProjection(false)}>Guardar abierta</button><button disabled={projectionPoints.length<3} onClick={()=>finishProjection(true)}>Guardar cerrada</button><button onClick={()=>setProjectionPoints(p=>p.slice(0,-1))}>Quitar punto</button>{tool!=='projection'&&<button onClick={()=>setTool('projection')}>Seguir dibujando</button>}<button onClick={()=>{setProjectionPoints([]);setCursor(null);setTool('select');}}>Descartar</button></div><small>Enter: guardar abierta · Shift + Enter: cerrada. También podés tocar el primer punto para cerrar.</small></div>}
      {tool==='hole'&&holeTarget&&<div className="projection-finish" role="group" aria-label="Dibujar hueco"><strong>Hueco sin guardar · {surfacePoints.length} puntos</strong><div><button disabled={surfacePoints.length<3} onClick={finishSurface}>Cerrar hueco</button><button disabled={!surfacePoints.length} onClick={()=>setSurfacePoints(p=>p.slice(0,-1))}>Quitar punto</button><button onClick={resetInteraction}>Cancelar hueco</button></div><small>Dentro de {plan.surfaces.find(s=>s.id===holeTarget.surfaceId)?.name} · Recorta {holeTarget.target==='both'?'losa y cubierta':holeTarget.target==='slab'?'losa':'cubierta'}. Enter confirma · Escape cancela.</small></div>}
      <svg ref={svgRef} className={`drawing tool-${tool}`} viewBox={`${center.x - viewW / 2} ${center.y - viewH / 2} ${viewW} ${viewH}`} onPointerDown={onDown} onPointerMove={onMove} onPointerLeave={() => { if (!drag) { setCursor(null); setGuides([]); } }} onPointerUp={onUp} onPointerCancel={() => { setDrag(null); setGuides([]); setDraft(null); }} onWheel={e => { if (e.ctrlKey) return; setZoom(z => Math.max(.003, Math.min(3, z * (e.deltaY > 0 ? .92 : 1.08)))); }} aria-label="Lienzo: dibujá paredes y seleccioná elementos con las herramientas">
        <defs><pattern id="grid" width=".5" height=".5" patternUnits="userSpaceOnUse"><circle cx=".025" cy=".025" r=".012" fill="#d1d4c9"/></pattern></defs><rect data-editor="true" x={center.x - viewW / 2} y={center.y - viewH / 2} width={viewW} height={viewH} fill={grid ? 'url(#grid)' : '#faf9f5'}/>

        {shown.reference?.visible&&<image data-editor="true" href={shown.reference.data} x={shown.reference.x} y={shown.reference.y} width={shown.reference.width} height={shown.reference.height} opacity={shown.reference.opacity} pointerEvents="none"/>}{projectionsVisible&&(shown.projections??[]).map(r=><ProjectionShape key={r.id} item={r} selected={selection===r.id&&tool==='select'} zoom={zoom}/>)}{projectionPoints.length>0&&<polyline data-editor="true" points={[...projectionPoints,...(tool==='projection'&&cursor?[cursor]:[])].map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#b97c49" strokeWidth=".035" strokeDasharray=".18 .12"/>}
        {showBelow&&belowFloor&&<g data-editor="true" pointerEvents="none" opacity=".25">{belowFloor.plan.walls.map(w=><line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="#7a8ea5" strokeWidth={wallThickness(w)} strokeDasharray=".12 .08"/>)}{belowFloor.plan.furniture.filter(f=>f.kind==='stairs'||f.kind==='stairLanding').map(f=><FurnitureShape key={f.id} item={f} ghost/>)}</g>}
 {shown.surfaces.map(s=><SurfaceFill key={s.id} item={s}/>)}
        {shown.furniture.map(item => <FurnitureShape key={item.id} item={item} selected={selectedIds.includes(item.id)}/>)}
        {shown.walls.map(renderWall)}
        {shown.openings.map(o => <OpeningShape key={o.id} opening={o} wall={shown.walls.find(w => w.id === o.wallId)!} selected={selection === o.id}/>)}
        {shown.labels.map(l => <g key={l.id} data-id={l.id} transform={`translate(${l.x} ${l.y})`}><rect x={-Math.max(.8, l.text.length * .053)} y="-.25" width={Math.max(1.6, l.text.length * .106)} height=".5" rx=".12" fill="#edf0e6" data-selection-stroke="true" stroke={selection === l.id ? '#b97c49' : 'none'} strokeWidth=".02"/><text textAnchor="middle" dominantBaseline="central" fontFamily="Georgia,serif" fontSize=".22" fill="#54634c">{l.text}</text></g>)}
        {manualMeasures&&shown.dimensions.map(d=><DimensionShape key={d.id} item={d} selected={selection===d.id && tool==='select'} zoom={zoom}/>)}
 {tool === 'dimension' && start && cursor && distance(start,dimensionEnd??cursor)>=.1 && <g data-editor="true" pointerEvents="none"><DimensionShape item={{id:'preview-dimension',a:start,b:dimensionEnd??cursor,offset:dimensionEnd?dimensionOffset(start,dimensionEnd,cursor):0}} zoom={zoom}/></g>}
 {tool === 'select' && wall && <g data-editor="true" data-id={wall.id}>{(['a','b'] as const).map(end=><g key={end} data-endpoint={end} style={{cursor:'crosshair'}}><title>Extremo {end.toUpperCase()}</title><circle cx={wall[end].x} cy={wall[end].y} r={.2/zoom} fill="transparent"/><circle cx={wall[end].x} cy={wall[end].y} r={.075/zoom} fill="white" stroke="#b97c49" strokeWidth={.025/zoom}/><text x={wall[end].x} y={wall[end].y-.18/zoom} textAnchor="middle" fontSize={.15/zoom} fill="#9b663b" pointerEvents="none">{end.toUpperCase()}</text></g>)}</g>}
        {shown.surfaces.map(s=><SurfaceAnnotation key={s.id} item={s} selected={selection===s.id && tool==='select'&&!selectedHole} zoom={zoom}/>)}
        {shown.surfaces.map(s=><HoleShapes key={s.id} item={s} selectedId={selection===s.id&&tool==='select'?selectedHoleId:null} zoom={zoom}/>)}
        {(tool==='surface'||tool==='hole')&&surfacePoints.length>0&&<SurfacePreview points={surfacePoints} cursor={cursor}/>}
        {selectedBounds && tool==='select' && <rect data-editor="true" pointerEvents="none" x={selectedBounds.x-selectedBounds.width/2-.04} y={selectedBounds.y-selectedBounds.depth/2-.04} width={selectedBounds.width+.08} height={selectedBounds.depth+.08} fill="none" stroke="#b97c49" strokeWidth={1.5/(75*zoom)} strokeDasharray={[6/(75*zoom),4/(75*zoom)].join(' ')}/>}
        {alignment && (drag?.kind === 'furniture' || ((tool === 'furniture'||tool === 'stairs') && cursor)) && <g data-editor="true" pointerEvents="none" stroke="#227c91" strokeWidth={1.5/(75*zoom)} strokeDasharray={[5/(75*zoom),3/(75*zoom)].join(' ')}>{guides.map(g=><line key={g.axis} x1={g.axis==='x'?g.value:g.from} y1={g.axis==='x'?g.from:g.value} x2={g.axis==='x'?g.value:g.to} y2={g.axis==='x'?g.to:g.value}/>)}</g>}
        {tool === 'stairs' && cursor && staircase.options && <g data-editor="true" pointerEvents="none">{staircase.items.map(item=><FurnitureShape key={item.id} ghost item={{...item,x:item.x+cursor.x,y:item.y+cursor.y}}/>)}</g>}
        {tool === 'furniture' && cursor && <g data-editor="true"><FurnitureShape ghost item={{ id: 'preview', kind: furnitureKind, x: cursor.x, y: cursor.y, width: activeCatalogItem.width, depth: activeCatalogItem.depth, rotation: 0 }}/></g>}
        {roomPreviewStart && roomPreviewEnd && <RoomPreview a={roomPreviewStart} b={roomPreviewEnd}/>}
        {tool === 'wall' && start && cursor && <g data-editor="true" pointerEvents="none"><line x1={start.x} y1={start.y} x2={cursor.x} y2={cursor.y} stroke="#b97c49" strokeWidth=".06" strokeDasharray=".12 .08"/><circle cx={start.x} cy={start.y} r=".07" fill="#b97c49"/><text x={(start.x + cursor.x) / 2} y={(start.y + cursor.y) / 2 - .2} fontSize=".2" fill="#9b663b" textAnchor="middle">{distance(start, cursor).toFixed(2)} m</text></g>}
      </svg>{tool==='select'&&selection&&!drag&&!quickGuide&&!projectionPoints.length&&<SelectionActions name={multiple?`${selectedItems.length} elementos`:furniture?furnitureCatalog.find(f=>f.kind===furniture.kind)!.name:wall?'Pared':opening?opening.kind==='door'?'Puerta':'Ventana':projectionItem?'Proyección':surface?selectedHole?'Hueco':'Superficie':manualDimension?'Cota':'Texto'} canTransform={selectedItems.length>0} onDuplicate={duplicateSelection} onRotate={()=>runSelectionAction(()=>rotateFurnitureSelection(plan,selectedIds))} onRemove={()=>{remove();setMessage('Selección eliminada. Podés recuperarla con Deshacer.');}} onClear={()=>{setSelection(null);setMultipleMode(false);}}/>}<div className="canvas-bottom"><div className="scale"><span style={{ width: 75 * zoom }}/>1 metro</div><div className="zoom-controls"><button aria-label="Alejar" onClick={() => setZoom(z => Math.max(.003, z / 1.2))}><Minus size={16}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Acercar" onClick={() => setZoom(z => Math.min(3, z * 1.2))}><Plus size={16}/></button><i/><button aria-label="Encuadrar plano" title="Encuadrar plano" onClick={() => fit()}><Maximize size={16}/></button></div></div></section>
      <aside className="inspector"><button className="mobile-panel-close" onClick={()=>setMobilePanel("canvas")}>Volver al plano</button><div className="inspector-heading"><span className="eyebrow">CADA DETALLE CUENTA</span><h2>{multiple ? grouped ? 'Grupo de elementos' : 'Selección múltiple' : projectionItem?'Proyección': surface ? selectedHole?'Hueco de losa / cubierta':'Superficie' : manualDimension ? 'Cota' : wall ? 'Pared' : opening ? opening.kind === 'door' ? 'Puerta' : 'Ventana' : label ? 'Ambiente' : furniture ? furnitureCatalog.find(f => f.kind === furniture.kind)!.name : 'Tu bosquejo'}</h2></div>{multiple ? <GroupControls count={selectedItems.length} grouped={grouped} hasGroups={selectedItems.some(f=>!!f.groupId)} disabled={!!drag} onGroup={()=>{runSelectionAction(()=>groupFurniture(plan,selectedIds));setMultipleMode(false);}} onUngroup={()=>runSelectionAction(()=>ungroupFurniture(plan,selectedIds))} onRotate={()=>runSelectionAction(()=>rotateFurnitureSelection(plan,selectedIds))} onDuplicate={duplicateSelection} onRemove={remove}/> : projectionItem || surface || manualDimension || wall || opening || label || furniture ? <div className="properties"><span className="selection-tag"><span/> ELEMENTO SELECCIONADO</span>{projectionItem&&<><label>Nombre de la proyección<input key={projectionItem.id+'-'+projectionItem.name} maxLength={80} defaultValue={projectionItem.name} onBlur={e=>{if(e.target.value!==projectionItem.name)runSelectionAction(()=>validatePlan({...plan,projections:plan.projections!.map(r=>r.id===projectionItem.id?{...r,name:e.target.value}:r)}));}}/></label><p>{projectionItem.closed?'Contorno cerrado':'Línea abierta'} · {projectionItem.points.length} vértices</p><button disabled={projectionItem.points.length<3} onClick={()=>runSelectionAction(()=>validatePlan({...plan,projections:plan.projections!.map(r=>r.id===projectionItem.id?{...r,closed:!r.closed}:r)}))}>{projectionItem.closed?'Abrir contorno':'Cerrar contorno'}</button></>}{surface && <SurfaceControls key={surface.id+'-'+surface.name} item={surface} onRename={name=>{try{commit(validatePlan({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,name}:s)}));}catch{setMessage('Revisá el nombre de la superficie.');}}}/>}{surface&&<SlabControls key={surface.id+JSON.stringify([surface.slab,surface.roof])} surface={surface} plan={plan} onChange={(slab,roof)=>runSelectionAction(()=>validatePlan({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,slab,roof}:s)}))}/>} {surface&&<HoleControls key={surface.id} surface={surface} selectedId={selectedHoleId} onSelect={setSelectedHoleId} onChange={holes=>runSelectionAction(()=>validatePlan({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,holes}:s)}))} onDraw={target=>startHole(surface.id,target)}/>} {manualDimension && <DimensionControls key={manualDimension.id+'-'+manualDimension.offset} item={manualDimension} onChange={offset=>{try{commit(validatePlan({...plan,dimensions:plan.dimensions.map(d=>d.id===manualDimension.id?{...d,offset}:d)}));}catch{setMessage('Ingresá una separación entre -100 y 100 m.');}}}/>}{(wall || opening) && <form onSubmit={e => { e.preventDefault(); applyDimension(); }}><label htmlFor="dimension">{wall ? 'Largo de la pared' : 'Ancho de la abertura'}</label><div className="measure-input"><input id="dimension" inputMode="decimal" value={dimension} onChange={e => setDimension(e.target.value)}/><span>m</span></div><button className="apply" type="submit">Aplicar medida <Check size={15}/></button></form>}{wall&&<WallHeightControls key={wall.id+'-'+wall.height+'-'+plan.wallHeight} plan={plan} wall={wall} onChange={height=>runSelectionAction(()=>validatePlan({...plan,walls:plan.walls.map(w=>w.id===wall.id?{...w,height}:w)}))}/>} {opening&&<OpeningHeightControls key={opening.id+'-'+opening.height+'-'+opening.sill} opening={opening} onChange={(height,sill)=>runSelectionAction(()=>validatePlan({...plan,openings:plan.openings.map(o=>o.id===opening.id?{...o,height,sill}:o)}))}/>} {wall && <WallControls key={`${wall.id}-${distance(wall.a,wall.b)}-${wallThickness(wall)}`} wall={wall} onThickness={changeWallThickness} onSplit={cutWall} onError={setMessage}/>}
        {opening?.kind === 'door' && <DoorControls opening={opening} onChange={updateOpening}/>}
        {furniture && <FurnitureProperties key={`${furniture.id}-${furniture.width}-${furniture.depth}-${furniture.rotation}`} item={furniture} onChange={updateFurniture} onDuplicate={duplicateSelection} onError={setMessage}/>}
        {label && <label className="label-field">Nombre del ambiente<input key={label.id + label.text} aria-label="Nombre del ambiente" maxLength={80} defaultValue={label.text} onBlur={e => { const text = e.target.value.trim() || 'Ambiente'; if (text !== label.text) commit({ ...plan, labels: plan.labels.map(l => l.id === label.id ? { ...l, text } : l) }); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>}<p className="property-help">{projectionItem?'Arrastrá la línea para moverla o los círculos para editar sus vértices. No sigue automáticamente las paredes de otra planta.':surface ? 'Arrastrá el contorno o su nombre para moverlo; los círculos editan sus vértices. El área corresponde al contorno y no sigue los cambios de paredes.' : manualDimension ? 'Cota independiente: no sigue las paredes. Arrastrá A o B para cambiar los puntos; arrastrá la línea para separar la medida.' : wall ? 'Arrastrá la pared para moverla. Los extremos unidos y sus paredes se ajustan juntos. Las aberturas mantienen su distancia al extremo fijo.' : opening ? 'Arrastrá la abertura a lo largo de su pared para cambiar su posición.' : furniture ? 'Arrastrá para alinear bordes y centros con elementos cercanos. Alt permite mover libremente. Las medidas corresponden a su huella en el piso.' : 'Arrastrá el nombre para ubicarlo en el ambiente.'}</p><button className="delete" onClick={remove}><Trash2 size={15}/>Eliminar {projectionItem?'proyección':surface ? selectedHole?'hueco':'superficie' : manualDimension ? 'cota' : wall ? 'pared' : opening ? 'abertura' : furniture ? 'mueble' : 'texto'}</button></div> : <div className="empty-selection"><div className="mini-plan"><House size={43} strokeWidth={1}/><span/></div><h3>Hacé lugar a tus ideas.</h3><p>Seleccioná una pared, una abertura, una cota, una superficie, un mueble o un texto para ajustar sus detalles.</p><div className="stats"><div><strong>{plan.walls.length}</strong><span>paredes</span></div><div><strong>{plan.openings.length}</strong><span>aberturas</span></div><div><strong>{plan.furniture.length}</strong><span>muebles</span></div></div></div>}<div className="export-card"><div><ArrowDownToLine size={18}/><strong>Llevá tu idea con vos</strong></div><p>Exportá una imagen de la planta activa para compartirla.</p><button disabled={exporting || !!drag} onClick={() => void exportPng()}>{exporting ? 'Preparando imagen…' : 'Exportar imagen PNG'} <span>↗</span></button><button disabled={!!drag} onClick={exportSvg}>Exportar imagen SVG <span>↗</span></button></div><div className="privacy-note"><span className="dot"/><p>El autoguardado es local.<br/><span>Descargá una copia editable para conservar tu trabajo.</span></p></div></aside></main>
    <footer className="statusbar"><span><span className="status-dot"/>{tool==='dimension'? !start?'Marcá el inicio de la cota.':!dimensionEnd?'Marcá el final de la cota.':'Tocá para ubicar la línea de medida.':hints[tool]}</span><span>Metros · ajuste 10 cm <span className="footer-divider">|</span> Hecho para tu próxima idea</span></footer>
    </div>{modelDialog&&<ModelLoader building={building} plan={plan} onChange={next=>commit(validatePlan(next))} onLevel={elevation=>commitBuilding(validateBuilding({...building,floors:building.floors.map(f=>f.id===building.activeFloorId?{...f,elevation}:f)}))} onHole={startHole} onSurface={()=>{setModelDialog(false);resetInteraction();setTool('surface');setMobilePanel('tools');}} onFloor={changeFloor} onClose={()=>setModelDialog(false)} onUndo={undo} onRedo={redo} canUndo={!!history.past.length} canRedo={!!history.future.length} onSave={saveFile} saved={saved}/>}{referenceDialog&&<ReferencePanel initial={plan.reference} onClose={()=>setReferenceDialog(false)} onApply={reference=>{const next=validatePlan({...plan,reference});commit(next);setReferenceDialog(false);if(reference){setCenter({x:reference.x+reference.width/2,y:reference.y+reference.height/2});setZoom(Math.max(.003,Math.min(2.5,size.width/((reference.width+2)*75),size.height/((reference.height+2)*75))));}}}/>}{summaryDialog&&<SurfaceSummaryPanel building={building} onClose={()=>setSummaryDialog(false)} onLocate={(floor,id)=>{changeFloor(floor);setSelection(id??null);setTool(id?'select':'surface');setMobilePanel('canvas');const target=building.floors.find(f=>f.id===floor);if(target)fit(target.plan);setSummaryDialog(false);}}/>}{startDialog&&<StartPanel onClose={closeStart} onLibrary={()=>{try{storeProject(projectKey,building);closeStart();setLibraryDialog(true);}catch{closeStart();setMessage('Descargá una copia: no pudimos guardar el proyecto actual.');}}} onGuide={()=>{closeStart();setQuickGuide(true);}} onCreate={(id,name)=>{try{storeProject(projectKey,building);const next=buildingFromPlan(createTemplate(id,name));const key=uid();storeProject(key,next);projectKeys.current.set(next,key);setHistory({past:[],present:next,future:[]});resetInteraction();fit(activeFloorPlan(next));closeStart();try{if(localStorage.getItem('trazocasa.guide.v1')!=='done')setQuickGuide(true);}catch{setQuickGuide(true);}}catch{closeStart();setMessage('No pudimos crear y guardar el proyecto. Descargá una copia y revisá el espacio del navegador.');}}}/>}{quickGuide&&!projectionPoints.length&&!referenceDialog&&!summaryDialog&&mobilePanel==='canvas'&&!startDialog&&!libraryDialog&&!driveDialog&&<QuickGuide onClose={closeGuide}/>}{libraryDialog&&<LibraryPanel activeId={projectKey} onClose={()=>setLibraryDialog(false)} onNew={()=>{setLibraryDialog(false);setStartDialog(true);}} onOpen={(next,id)=>{projectKeys.current.set(next,id);setHistory({past:[],present:next,future:[]});resetInteraction();fit(activeFloorPlan(next));setLibraryDialog(false);}}/>}<DrivePanel key={projectKey} open={driveDialog} building={building} initialBinding={initialDrive?.key===projectKey?initialDrive.binding:undefined} onClose={()=>setDriveDialog(false)} onDownload={saveFile} onOpen={(next,binding)=>{const key=uid();projectKeys.current.set(next,key);setInitialDrive({key,binding});commitBuilding(next,true);resetInteraction();fit(activeFloorPlan(next));setDriveDialog(false);setMessage('Proyecto abierto desde Drive.');}}/>
    {floorDialog&&<FloorManager key={building.activeFloorId} building={building} onClose={()=>setFloorDialog(false)} onAdd={(name,mode)=>changeFloors(()=>addFloor(building,name,mode))} onRename={name=>changeFloors(()=>renameFloor(building,building.activeFloorId,name))} onRemove={()=>changeFloors(()=>removeFloor(building,building.activeFloorId))}/>}
 {message && <div className="toast" role="status"><Check size={18}/><span>{message}</span><button aria-label="Cerrar aviso" onClick={() => setMessage('')}><X size={16}/></button></div>}
    {(help || newDialog) && <div className="modal-backdrop" onClick={() => { setHelp(false); setNewDialog(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label={help ? 'Cómo empezar' : 'Nuevo bosquejo'} onClick={e => e.stopPropagation()}><button className="modal-close" autoFocus aria-label="Cerrar" onClick={() => { setHelp(false); setNewDialog(false); }}><X size={20}/></button><House size={30}/><h2>{help ? 'Tu casa empieza con un trazo.' : 'Una nueva página en blanco.'}</h2>{help ? <><p>1. Elegí <b>Pared</b> y tocá dos puntos del lienzo. Mantené Shift para trazar en horizontal o vertical.</p><p>También podés usar <b>Habitación (R)</b> para crear cuatro paredes de una vez, marcando esquinas o indicando medidas.</p><p>2. Elegí <b>Puerta</b> o <b>Ventana</b> y tocá una pared. Seleccioná una puerta para cambiar el lado de apertura o la bisagra.</p><p>3. Con <b>Seleccionar</b>, arrastrá los elementos o cambiá sus medidas en el panel de detalles. En una pared, arrastrá A o B para mover un extremo, ajustá el espesor o dividila indicando una distancia desde A.</p><p>4. Elegí <b>Muebles</b>, seleccioná uno del catálogo y tocá el plano. Podés girarlo, duplicarlo y cambiar sus medidas.</p><p>Con <b>Escaleras (E)</b>, elegí L o U, ajustá las medidas, el sentido y el giro, y tocá el plano para insertar tres piezas agrupadas.</p><p>Con <b>Selección múltiple</b> o Shift + clic, sumá muebles y piezas de escalera. Podés agrupar, girar y duplicar el conjunto desde el panel de detalles. Desactivá Selección múltiple para arrastrar; desagrupá para editar piezas individuales.</p><p>Con <b>Cota (C)</b>, marcá inicio, final y posición de la medida. Las cotas son independientes de las paredes y se exportan con el plano.</p><p>Con <b>Superficie (S)</b>, marcá las esquinas de un ambiente y cerrá el contorno para calcular sus m². Seleccionalo para cambiar el nombre o mover sus vértices.</p><p>Usá el selector de <b>plantas</b> para cambiar de piso y el botón + para crear, renombrar o eliminar plantas. En <b>Muebles</b> encontrás la escalera recta; la flecha indica la subida. Guardar archivo incluye todas las plantas; las imágenes exportan solo la activa.</p><p>5. Usá <b>Guardar archivo</b> para descargar una copia editable. El guardado del navegador no sincroniza dispositivos y puede borrarse.</p><p className="modal-note">Bosquejos para explorar distribuciones. El prototipo no genera documentación técnica de obra. En pantallas pequeñas, los detalles aparecen debajo del lienzo.</p><button className="primary" onClick={() => setHelp(false)}>Empezar a imaginar</button></> : <><p>Podés descargar tu proyecto antes de empezar. También podrás recuperarlo con Deshacer.</p><div className="modal-actions"><button onClick={saveFile}><ArrowDownToLine size={17}/>Guardar actual</button><button className="primary" onClick={() => { const next = emptyPlan(); commitBuilding(buildingFromPlan(next),true); setSelection(null); setSurfacePoints([]); setStart(null); setDimensionEnd(null); setTool('room'); fit(next); setNewDialog(false); }}>Crear en blanco</button></div><button className="example" onClick={() => { const next = sample(); commitBuilding(buildingFromPlan(next),true); setSelection(null); setSurfacePoints([]); setStart(null); setDimensionEnd(null); fit(next); setNewDialog(false); }}><RotateCcw size={14}/>Cargar casa de ejemplo</button></>}</section></div>}
  </div>;
}
