import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Armchair, ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, CircleHelp, DoorOpen, FilePlus2, Grid2X2, Hand, House, Leaf, Maximize, Minus, MousePointer2, Pencil, Plus, Redo2, RotateCcw, Ruler, Square, Trash2, Type, Undo2, X } from 'lucide-react';
import { distance, emptyPlan, fitOpening, furnitureCatalog, planBounds, project, sample, snap, uid, validatePlan } from './model';
import type { Furniture, FurnitureKind, Plan, Point, Wall } from './model';
import { FurnitureCatalog, FurnitureProperties, FurnitureShape } from './Furniture';
import { createExport, renderPng } from './export';

type Tool = 'select' | 'wall' | 'door' | 'window' | 'label' | 'furniture' | 'pan';
type History = { past: Plan[]; present: Plan; future: Plan[] };
type Drag = { pointer: number; start: Point; original: Plan; id: string; kind: 'wall' | 'label' | 'opening' | 'furniture' | 'pan'; center: Point; end?: Point };
const KEY = 'trazocasa.project.v1';
const tools = [{ id: 'select', icon: MousePointer2, label: 'Seleccionar', key: 'V' }, { id: 'wall', icon: Pencil, label: 'Pared', key: 'W' }, { id: 'door', icon: DoorOpen, label: 'Puerta', key: 'D' }, { id: 'window', icon: Square, label: 'Ventana', key: 'N' }, { id: 'label', icon: Type, label: 'Texto', key: 'T' }, { id: 'furniture', icon: Armchair, label: 'Muebles', key: 'F' }, { id: 'pan', icon: Hand, label: 'Mover lienzo', key: 'H' }] as const;
const hints: Record<Tool, string> = { select: 'Seleccioná un elemento para editarlo. Arrastrá para moverlo.', wall: 'Tocá el inicio y luego el final de la pared. Esc para cancelar.', door: 'Tocá una pared para colocar una puerta de 80 cm.', window: 'Tocá una pared para colocar una ventana de 120 cm.', label: 'Tocá el plano para agregar el nombre de un ambiente.', furniture: 'Elegí un mueble y tocá el plano para colocarlo. Esc para cancelar.', pan: 'Arrastrá para recorrer tu plano.' };
function load(): { plan: Plan; message: string } {
  try { const value = localStorage.getItem(KEY); return { plan: value ? validatePlan(JSON.parse(value)) : sample(), message: value ? 'Recuperamos tu último bosquejo.' : '' }; }
  catch { return { plan: sample(), message: 'No pudimos recuperar el guardado local. Podés abrir una copia descargada.' }; }
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export default function App() {
  const [initial] = useState(load);
  const [history, setHistory] = useState<History>({ past: [], present: initial.plan, future: [] });
  const plan = history.present;
  const [tool, setTool] = useState<Tool>('select');
  const [furnitureKind, setFurnitureKind] = useState<FurnitureKind>('bed');
  const [exporting, setExporting] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<Plan | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<Point>({ x: 4, y: 3 });
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [grid, setGrid] = useState(true);
  const [measures, setMeasures] = useState(true);
  const [saved, setSaved] = useState(true);
  const [message, setMessage] = useState(initial.message);
  const [help, setHelp] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [dimension, setDimension] = useState('');
  const [name, setName] = useState(plan.name);
  const svgRef = useRef<SVGSVGElement>(null);
  const initiallyFitted = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = draft ?? plan;
  const wall = shown.walls.find(w => w.id === selection);
  const opening = shown.openings.find(o => o.id === selection);
  const label = shown.labels.find(l => l.id === selection);
  const furniture = shown.furniture.find(f => f.id === selection);
  const activeCatalogItem = furnitureCatalog.find(f => f.kind === furnitureKind)!;
  const viewW = size.width / (75 * zoom), viewH = size.height / (75 * zoom);
  const commit = (next: Plan) => { setHistory(h => ({ past: [...h.past.slice(-79), h.present], present: next, future: [] })); };
  const undo = () => { setDraft(null); setDrag(null); setStart(null); setHistory(h => h.past.length ? ({ past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }) : h); };
  const redo = () => { setDraft(null); setDrag(null); setStart(null); setHistory(h => h.future.length ? ({ past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }) : h); };
  function remove() { if (!selection) return; commit({ ...plan, walls: plan.walls.filter(w => w.id !== selection), openings: plan.openings.filter(o => o.id !== selection && o.wallId !== selection), labels: plan.labels.filter(l => l.id !== selection), furniture: plan.furniture.filter(f => f.id !== selection) }); setSelection(null); }
  function saveFile() { download(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }), `${plan.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Mi plano'}.trazocasa`); setMessage('Copia descargada. Podés volver a abrirla con “Abrir”.'); }
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
      if (!initiallyFitted.current && box.width > 0 && box.height > 0) { initiallyFitted.current = true; fit(initial.plan, viewport); }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setSaved(false); const timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(plan)); setSaved(true); } catch { setSaved(false); setMessage('El navegador no permite guardar. Descargá una copia de tu plano.'); } }, 350); return () => clearTimeout(timer); }, [plan]);
  useEffect(() => { setName(plan.name); }, [plan.name]);
  useEffect(() => { setDimension(wall ? distance(wall.a, wall.b).toFixed(2) : opening ? opening.width.toFixed(2) : ''); }, [selection, plan]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 6500); return () => clearTimeout(timer); }, [message]);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input, textarea, select') || help || newDialog) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; } if (e.key === 'Escape') { setTool('select'); setStart(null); setDrag(null); setDraft(null); setSelection(null); } if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); } if (!e.ctrlKey && !e.metaKey) { const t = tools.find(t => t.key.toLowerCase() === e.key.toLowerCase()); if (t) { setTool(t.id); setStart(null); } } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  function coords(e: ReactPointerEvent<SVGSVGElement>): Point { const matrix = svgRef.current!.getScreenCTM()!; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); return { x: p.x, y: p.y }; }
  function snapped(p: Point) { const nearest = plan.walls.flatMap(w => [w.a, w.b]).find(n => distance(n, p) < .18 / zoom); return nearest ?? { x: snap(p.x), y: snap(p.y) }; }
  function onDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    if (drag) return;
    const p = coords(e), q = snapped(p);
    if (tool === 'pan' || e.button === 1) { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ pointer: e.pointerId, start: { x: e.clientX, y: e.clientY }, original: plan, center, id: '', kind: 'pan' }); return; }
    if (tool === 'wall') { if (!start) setStart(q); else { const end = e.shiftKey ? (Math.abs(q.x - start.x) > Math.abs(q.y - start.y) ? { x: q.x, y: start.y } : { x: start.x, y: q.y }) : q; if (distance(start, end) < .2) { setMessage('La pared debe medir al menos 20 cm.'); return; } commit({ ...plan, walls: [...plan.walls, { id: uid(), a: start, b: end }] }); setStart(null); } return; }
    if (tool === 'door' || tool === 'window') { const nearest = plan.walls.map(w => ({ w, ...project(p, w) })).sort((a, b) => a.distance - b.distance)[0]; if (!nearest || nearest.distance > .3 / zoom) { setMessage('Elegí una pared para colocar la abertura.'); return; } const width = tool === 'door' ? .8 : 1.2; const t = fitOpening(plan, nearest.w, nearest.t, width); if (t === null) { setMessage('No hay espacio suficiente en ese lugar de la pared.'); return; } const id = uid(); commit({ ...plan, openings: [...plan.openings, { id, wallId: nearest.w.id, t, width, kind: tool }] }); setSelection(id); return; }
    if (tool === 'furniture') {
      if (plan.furniture.length >= 500) { setMessage('Podés colocar hasta 500 muebles por proyecto.'); return; }
      const item: Furniture = { id: uid(), kind: furnitureKind, x: q.x, y: q.y, width: activeCatalogItem.width, depth: activeCatalogItem.depth, rotation: 0 };
      try { commit(validatePlan({ ...plan, furniture: [...plan.furniture, item] })); setSelection(item.id); setTool('select'); }
      catch { setMessage('Colocá el mueble dentro de los límites del plano.'); }
      return;
    }
    if (tool === 'label') { const id = uid(); commit({ ...plan, labels: [...plan.labels, { id, ...q, text: 'Ambiente' }] }); setSelection(id); setTool('select'); return; }
    const target = (e.target as Element).closest('[data-id]'); const id = target?.getAttribute('data-id'); setSelection(id ?? null); if (!id) return;
    const kind = plan.walls.some(w => w.id === id) ? 'wall' : plan.labels.some(l => l.id === id) ? 'label' : plan.furniture.some(f => f.id === id) ? 'furniture' : 'opening';
    e.currentTarget.setPointerCapture(e.pointerId); setDrag({ pointer: e.pointerId, start: q, original: plan, id, kind, center });
  }
  function onMove(e: ReactPointerEvent<SVGSVGElement>) { const p = coords(e), q = snapped(p); setCursor(start && e.shiftKey ? Math.abs(q.x - start.x) > Math.abs(q.y - start.y) ? { x: q.x, y: start.y } : { x: start.x, y: q.y } : q); if (!drag || e.pointerId !== drag.pointer) return;
    if (drag.kind === 'pan') { setCenter({ x: drag.center.x - (e.clientX - drag.start.x) / (75 * zoom), y: drag.center.y - (e.clientY - drag.start.y) / (75 * zoom) }); return; }
    const dx = snap(q.x - drag.start.x), dy = snap(q.y - drag.start.y); const original = drag.original;
    if (drag.kind === 'label') setDraft({ ...original, labels: original.labels.map(l => l.id === drag.id ? { ...l, x: l.x + dx, y: l.y + dy } : l) });
    if (drag.kind === 'furniture') {
      const next = { ...original, furniture: original.furniture.map(f => f.id === drag.id ? { ...f, x: f.x + dx, y: f.y + dy } : f) };
      try { setDraft(validatePlan(next)); } catch { /* Retain the last valid position. */ }
    }
    if (drag.kind === 'wall') { const moved = original.walls.find(w => w.id === drag.id)!; const shift = (p: Point) => distance(p, moved.a) < .001 || distance(p, moved.b) < .001 ? { x: p.x + dx, y: p.y + dy } : p; const next = { ...original, walls: original.walls.map(w => ({ ...w, a: shift(w.a), b: shift(w.b) })) }; try { setDraft(validatePlan(next)); } catch { /* Keep the last valid geometry. */ } }
    if (drag.kind === 'opening') { const o = original.openings.find(o => o.id === drag.id)!; const w = original.walls.find(w => w.id === o.wallId)!; const t = fitOpening(original, w, project(p, w).t, o.width, o.id); if (t !== null) setDraft({ ...original, openings: original.openings.map(item => item.id === o.id ? { ...o, t } : item) }); }
  }
  function onUp(e: ReactPointerEvent<SVGSVGElement>) { if (!drag || e.pointerId !== drag.pointer) return; if (draft && JSON.stringify(draft) !== JSON.stringify(plan)) commit(draft); setDraft(null); setDrag(null); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }
  function applyDimension() { const value = Number(dimension.replace(',', '.')); if (!Number.isFinite(value) || value < .3 || value > 100) { setMessage('Ingresá una medida entre 0,30 y 100 metros.'); return; } let next = plan;
    if (wall) { const length = distance(wall.a, wall.b); const endpoint = { x: wall.a.x + (wall.b.x - wall.a.x) * value / length, y: wall.a.y + (wall.b.y - wall.a.y) * value / length }; next = { ...plan, walls: plan.walls.map(w => ({ ...w, a: distance(w.a, wall.b) < .001 ? endpoint : w.a, b: distance(w.b, wall.b) < .001 ? endpoint : w.b })) }; }
    if (opening) { const w = plan.walls.find(w => w.id === opening.wallId)!; const t = fitOpening(plan, w, opening.t, value, opening.id); if (t === null) { setMessage('La abertura no cabe o se superpone con otra.'); return; } next = { ...plan, openings: plan.openings.map(o => o.id === opening.id ? { ...o, width: value, t } : o) }; }
    try { commit(validatePlan(next)); } catch { setMessage('Esa medida deja una pared o abertura sin espacio suficiente.'); }
  }
  async function openFile(file?: File) { if (!file) return; try { if (file.size > 2_000_000) throw new Error('El archivo supera el límite de 2 MB.'); const next = validatePlan(JSON.parse(await file.text())); commit(next); setSelection(null); setStart(null); setTool('select'); fit(next); setMessage('Proyecto abierto. Podés deshacer para recuperar el anterior.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos abrir el archivo.'); } finally { if (fileRef.current) fileRef.current.value = ''; } }
  function exportSvg() {
    download(createExport(svgRef.current!, plan).blob, 'TrazoCasa-bosquejo.svg');
    setMessage('Imagen SVG descargada. Conserva la calidad al ampliarla.');
  }
  async function exportPng() {
    setExporting(true);
    try { download(await renderPng(svgRef.current!, plan), 'TrazoCasa-bosquejo.png'); setMessage('Imagen PNG descargada y lista para compartir.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos exportar la imagen.'); }
    finally { setExporting(false); }
  }
  function updateFurniture(item: Furniture) {
    try { commit(validatePlan({ ...plan, furniture: plan.furniture.map(f => f.id === item.id ? item : f) })); }
    catch { setMessage('Revisá las medidas y la posición del mueble.'); }
  }
  function duplicateFurniture() {
    if (!furniture) return;
    const item = { ...furniture, id: uid(), x: snap(furniture.x + .3), y: snap(furniture.y + .3) };
    try { commit(validatePlan({ ...plan, furniture: [...plan.furniture, item] })); setSelection(item.id); }
    catch { setMessage('No se pudo duplicar: revisá los límites del plano o la cantidad de muebles.'); }
  }
  const rename = () => { const next = name.trim() || 'Mi proyecto'; setName(next); if (next !== plan.name) commit({ ...plan, name: next }); };
  function renderWall(w: Wall) { const length = distance(w.a, w.b), angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI; const flip = angle > 90 || angle < -90; return <g key={w.id} data-id={w.id}>
    <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="#3f4b44" strokeWidth=".105" strokeLinecap="round"/>
    <line x1={w.a.x + .025} y1={w.a.y + .025} x2={w.b.x + .018} y2={w.b.y + .018} stroke="#faf9f5" strokeWidth=".018" opacity=".65"/>
    <line data-editor="true" x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={selection === w.id ? '#b97c49' : 'transparent'} strokeWidth={selection === w.id ? '.045' : '.3'} />
    {measures && <g transform={`translate(${(w.a.x + w.b.x) / 2} ${(w.a.y + w.b.y) / 2}) rotate(${flip ? angle + 180 : angle})`} pointerEvents="none"><rect x="-.38" y="-.38" width=".76" height=".25" rx=".06" fill="#faf9f5"/><text y="-.2" textAnchor="middle" fontSize=".155" fill="#7c8279" fontFamily="Arial,sans-serif">{length.toFixed(2)} m</text></g>}
    {selection === w.id && [w.a, w.b].map((p, i) => <circle data-editor="true" key={i} cx={p.x} cy={p.y} r=".07" fill="white" stroke="#b97c49" strokeWidth=".025"/>)}
  </g>; }
  return <div className="app">
    <header className="header"><a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="TrazoCasa inicio"><span className="brand-symbol"><House size={23}/></span><span>Trazo<span className="brand-light">Casa</span><small>UN ESPACIO PARA IMAGINAR</small></span></a><span className="prototype">ESTUDIO · PROTOTIPO</span><div className="header-actions"><button className="quiet" aria-label="Cómo empezar" onClick={() => setHelp(true)}><CircleHelp size={17}/><span>Cómo empezar</span></button><span className="local-badge"><span/> En tu dispositivo</span></div></header>
    <div className="project-bar"><div className="project-title"><input aria-label="Nombre del proyecto" value={name} maxLength={100} onChange={e => setName(e.target.value)} onBlur={rename} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/><Pencil size={13}/><span className="saved"><Check size={13}/>{saved ? 'Guardado en este navegador' : 'Guardado pendiente'}</span></div><div className="project-actions"><button onClick={() => setNewDialog(true)}><FilePlus2 size={16}/><span>Nuevo</span></button><button onClick={() => fileRef.current?.click()}><ArrowUpFromLine size={16}/><span>Abrir</span></button><button className="primary" onClick={saveFile}><ArrowDownToLine size={16}/><span>Guardar archivo</span></button></div><input ref={fileRef} type="file" hidden accept=".trazocasa,.json" onChange={e => void openFile(e.target.files?.[0])}/></div>
    <main className="workspace"><aside className="sidebar"><div className="sidebar-top"><span className="eyebrow">TU CAJA DE HERRAMIENTAS</span><h2>De la idea al trazo.</h2><p>Un espacio, mil posibilidades.</p></div><div className="tool-list">{tools.map(t => <button key={t.id} className={`tool ${tool === t.id ? 'active' : ''}`} onClick={() => { setTool(t.id); setStart(null); }} title={`${t.label} (${t.key})`} aria-pressed={tool === t.id}><t.icon size={19}/><span>{t.label}</span><kbd>{t.key}</kbd></button>)}</div>{tool === 'furniture' && <FurnitureCatalog selected={furnitureKind} onChoose={setFurnitureKind}/>}<div className="sidebar-section"><span className="eyebrow">VISTA DEL PLANO</span><button className="toggle-row" onClick={() => setGrid(!grid)} aria-pressed={grid}><Grid2X2 size={16}/>Cuadrícula<span className={`switch ${grid ? 'on' : ''}`}/></button><button className="toggle-row" onClick={() => setMeasures(!measures)} aria-pressed={measures}><Ruler size={16}/>Medidas<span className={`switch ${measures ? 'on' : ''}`}/></button></div><div className="tip-card"><Leaf size={22}/><strong>Las grandes ideas<br/>empiezan en pequeño.</strong><p>Probá, cambiá, volvé a empezar. Este bosquejo es tuyo.</p><span>HECHO PARA IMAGINAR ↗</span></div><div className="sidebar-footer">TRAZOCASA <span>v0.2</span></div></aside>
      <section className="canvas-section" aria-label="Editor de planos"><div className="canvas-top"><span className="floor"><span/> Planta baja <ChevronDown size={13}/></span><span className="canvas-label">BOSQUEJO 2D</span><div className="history"><button title="Deshacer (Ctrl Z)" aria-label="Deshacer" disabled={!history.past.length} onClick={undo}><Undo2 size={17}/></button><button title="Rehacer (Ctrl Shift Z)" aria-label="Rehacer" disabled={!history.future.length} onClick={redo}><Redo2 size={17}/></button></div></div>
      <svg ref={svgRef} className={`drawing tool-${tool}`} viewBox={`${center.x - viewW / 2} ${center.y - viewH / 2} ${viewW} ${viewH}`} onPointerDown={onDown} onPointerMove={onMove} onPointerLeave={() => { if (!drag) setCursor(null); }} onPointerUp={onUp} onPointerCancel={() => { setDrag(null); setDraft(null); }} onWheel={e => { if (e.ctrlKey) return; setZoom(z => Math.max(.003, Math.min(3, z * (e.deltaY > 0 ? .92 : 1.08)))); }} aria-label="Lienzo: dibujá paredes y seleccioná elementos con las herramientas">
        <defs><pattern id="grid" width=".5" height=".5" patternUnits="userSpaceOnUse"><circle cx=".025" cy=".025" r=".012" fill="#d1d4c9"/></pattern></defs><rect data-editor="true" x={center.x - viewW / 2} y={center.y - viewH / 2} width={viewW} height={viewH} fill={grid ? 'url(#grid)' : '#faf9f5'}/>
        {shown.furniture.map(item => <FurnitureShape key={item.id} item={item} selected={item.id === selection}/>)}
        {shown.walls.map(renderWall)}
        {shown.openings.map(o => { const w = shown.walls.find(w => w.id === o.wallId)!; const angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI; return <g key={o.id} data-id={o.id} transform={`translate(${w.a.x + (w.b.x - w.a.x) * o.t} ${w.a.y + (w.b.y - w.a.y) * o.t}) rotate(${angle})`}><line x1={-o.width / 2} x2={o.width / 2} stroke="#faf9f5" strokeWidth=".15"/>{o.kind === 'door' ? <g fill="none" stroke="#8c957f" strokeWidth=".025"><path d={`M ${-o.width / 2} 0 L ${-o.width / 2} ${-o.width} A ${o.width} ${o.width} 0 0 1 ${o.width / 2} 0`} strokeDasharray=".045 .025"/><path d={`M ${-o.width / 2} 0 V ${-o.width}`} stroke="#5c6d5d" strokeWidth=".045"/></g> : <g stroke="#70999b" strokeWidth=".025"><rect x={-o.width / 2} y="-.065" width={o.width} height=".13" fill="#eaf1ef"/><line x1={-o.width / 2} x2={o.width / 2}/><line y1="-.065" y2=".065"/></g>}<rect data-editor="true" x={-o.width / 2} y={o.kind === 'door' ? -o.width : -.16} width={o.width} height={o.kind === 'door' ? o.width + .1 : .32} fill={selection === o.id ? '#b97c4920' : 'transparent'} stroke={selection === o.id ? '#b97c49' : 'none'} strokeWidth=".02"/></g>; })}
        {shown.labels.map(l => <g key={l.id} data-id={l.id} transform={`translate(${l.x} ${l.y})`}><rect x={-Math.max(.8, l.text.length * .053)} y="-.25" width={Math.max(1.6, l.text.length * .106)} height=".5" rx=".12" fill="#edf0e6" data-selection-stroke="true" stroke={selection === l.id ? '#b97c49' : 'none'} strokeWidth=".02"/><text textAnchor="middle" dominantBaseline="central" fontFamily="Georgia,serif" fontSize=".22" fill="#54634c">{l.text}</text></g>)}
        {tool === 'furniture' && cursor && <g data-editor="true"><FurnitureShape ghost item={{ id: 'preview', kind: furnitureKind, x: cursor.x, y: cursor.y, width: activeCatalogItem.width, depth: activeCatalogItem.depth, rotation: 0 }}/></g>}
        {start && cursor && <g data-editor="true" pointerEvents="none"><line x1={start.x} y1={start.y} x2={cursor.x} y2={cursor.y} stroke="#b97c49" strokeWidth=".06" strokeDasharray=".12 .08"/><circle cx={start.x} cy={start.y} r=".07" fill="#b97c49"/><text x={(start.x + cursor.x) / 2} y={(start.y + cursor.y) / 2 - .2} fontSize=".2" fill="#9b663b" textAnchor="middle">{distance(start, cursor).toFixed(2)} m</text></g>}
      </svg><div className="canvas-bottom"><div className="scale"><span style={{ width: 75 * zoom }}/>1 metro</div><div className="zoom-controls"><button aria-label="Alejar" onClick={() => setZoom(z => Math.max(.003, z / 1.2))}><Minus size={16}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Acercar" onClick={() => setZoom(z => Math.min(3, z * 1.2))}><Plus size={16}/></button><i/><button aria-label="Encuadrar plano" title="Encuadrar plano" onClick={() => fit()}><Maximize size={16}/></button></div></div></section>
      <aside className="inspector"><div className="inspector-heading"><span className="eyebrow">CADA DETALLE CUENTA</span><h2>{wall ? 'Pared' : opening ? opening.kind === 'door' ? 'Puerta' : 'Ventana' : label ? 'Ambiente' : furniture ? furnitureCatalog.find(f => f.kind === furniture.kind)!.name : 'Tu bosquejo'}</h2></div>{wall || opening || label || furniture ? <div className="properties"><span className="selection-tag"><span/> ELEMENTO SELECCIONADO</span>{(wall || opening) && <form onSubmit={e => { e.preventDefault(); applyDimension(); }}><label htmlFor="dimension">{wall ? 'Largo de la pared' : 'Ancho de la abertura'}</label><div className="measure-input"><input id="dimension" inputMode="decimal" value={dimension} onChange={e => setDimension(e.target.value)}/><span>m</span></div><button className="apply" type="submit">Aplicar medida <Check size={15}/></button></form>}{furniture && <FurnitureProperties key={`${furniture.id}-${furniture.width}-${furniture.depth}-${furniture.rotation}`} item={furniture} onChange={updateFurniture} onDuplicate={duplicateFurniture} onError={setMessage}/>}
        {label && <label className="label-field">Nombre del ambiente<input key={label.id + label.text} aria-label="Nombre del ambiente" maxLength={80} defaultValue={label.text} onBlur={e => { const text = e.target.value.trim() || 'Ambiente'; if (text !== label.text) commit({ ...plan, labels: plan.labels.map(l => l.id === label.id ? { ...l, text } : l) }); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>}<p className="property-help">{wall ? 'Arrastrá la pared para moverla. Los extremos unidos y sus paredes se ajustan juntos.' : opening ? 'Arrastrá la abertura a lo largo de su pared para cambiar su posición.' : furniture ? 'Arrastrá el mueble para ubicarlo. Las medidas corresponden a su huella en el piso.' : 'Arrastrá el nombre para ubicarlo en el ambiente.'}</p><button className="delete" onClick={remove}><Trash2 size={15}/>Eliminar {wall ? 'pared' : opening ? 'abertura' : furniture ? 'mueble' : 'texto'}</button></div> : <div className="empty-selection"><div className="mini-plan"><House size={43} strokeWidth={1}/><span/></div><h3>Hacé lugar a tus ideas.</h3><p>Seleccioná una pared, una abertura, un mueble o un texto para ajustar sus detalles.</p><div className="stats"><div><strong>{plan.walls.length}</strong><span>paredes</span></div><div><strong>{plan.openings.length}</strong><span>aberturas</span></div><div><strong>{plan.furniture.length}</strong><span>muebles</span></div></div></div>}<div className="export-card"><div><ArrowDownToLine size={18}/><strong>Llevá tu idea con vos</strong></div><p>Descargá una imagen de tu bosquejo para compartirla.</p><button disabled={exporting || !!drag} onClick={() => void exportPng()}>{exporting ? 'Preparando imagen…' : 'Exportar imagen PNG'} <span>↗</span></button><button disabled={!!drag} onClick={exportSvg}>Exportar imagen SVG <span>↗</span></button></div><div className="privacy-note"><span className="dot"/><p>Tu plano se queda acá.<br/><span>Descargá una copia para conservarlo o abrirlo en otro dispositivo.</span></p></div></aside></main>
    <footer className="statusbar"><span><span className="status-dot"/>{hints[tool]}</span><span>Metros · ajuste 10 cm <span className="footer-divider">|</span> Hecho para tu próxima idea</span></footer>
    {message && <div className="toast" role="status"><Check size={18}/><span>{message}</span><button aria-label="Cerrar aviso" onClick={() => setMessage('')}><X size={16}/></button></div>}
    {(help || newDialog) && <div className="modal-backdrop" onClick={() => { setHelp(false); setNewDialog(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label={help ? 'Cómo empezar' : 'Nuevo bosquejo'} onClick={e => e.stopPropagation()}><button className="modal-close" autoFocus aria-label="Cerrar" onClick={() => { setHelp(false); setNewDialog(false); }}><X size={20}/></button><House size={30}/><h2>{help ? 'Tu casa empieza con un trazo.' : 'Una nueva página en blanco.'}</h2>{help ? <><p>1. Elegí <b>Pared</b> y tocá dos puntos del lienzo. Mantené Shift para trazar en horizontal o vertical.</p><p>2. Elegí <b>Puerta</b> o <b>Ventana</b> y tocá una pared.</p><p>3. Con <b>Seleccionar</b>, arrastrá los elementos o cambiá sus medidas en el panel de detalles.</p><p>4. Elegí <b>Muebles</b>, seleccioná uno del catálogo y tocá el plano. Podés girarlo, duplicarlo y cambiar sus medidas.</p><p>5. Usá <b>Guardar archivo</b> para descargar una copia editable. El guardado del navegador no sincroniza dispositivos y puede borrarse.</p><p className="modal-note">Bosquejos para explorar distribuciones. El prototipo no genera documentación técnica de obra. En pantallas pequeñas, los detalles aparecen debajo del lienzo.</p><button className="primary" onClick={() => setHelp(false)}>Empezar a imaginar</button></> : <><p>Podés descargar tu proyecto antes de empezar. También podrás recuperarlo con Deshacer.</p><div className="modal-actions"><button onClick={saveFile}><ArrowDownToLine size={17}/>Guardar actual</button><button className="primary" onClick={() => { const next = emptyPlan(); commit(next); setSelection(null); setStart(null); setTool('wall'); fit(next); setNewDialog(false); }}>Crear en blanco</button></div><button className="example" onClick={() => { const next = sample(); commit(next); setSelection(null); setStart(null); fit(next); setNewDialog(false); }}><RotateCcw size={14}/>Cargar casa de ejemplo</button></>}</section></div>}
  </div>;
}

