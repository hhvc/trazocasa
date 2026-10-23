import { ViewTrace, ViewLineControls } from './ViewTrace';
import { editView, moveViewVertex, resizeViewLine, splitViewLine, snapViewVertex } from './viewEditing';
import type { ViewEdit } from './viewEditing';
import { FrontGuideControls, FrontGuideDrawing, draftingBounds, snapToGuides } from './FrontGuides';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { addDimension, emptyPlan, planBounds, uid, validatePlan } from './model';
import type { Building, Plan, Point } from './model';
import { DimensionShape, DimensionControls } from './Dimension';
import { ReferencePanel } from './ReferencePanel';
import { createExport, renderPng } from './export';
import { printPlan } from './print';
import './views.css';

type Tool = 'select'|'line'|'rectangle'|'dimension'|'text'|'pan';
const names = ['Frente','Contrafrente','Lateral izquierdo','Lateral derecho','Corte A–A','Corte B–B'];
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function ViewsPanel({building,onChange,onClose,onUndo,onRedo,canUndo,canRedo,onSave,saved}:{building:Building;onChange:(b:Building)=>void;onClose:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;onSave:()=>void;saved:boolean}){
 const views=building.views??[];
 const [settings,setSettings]=useState(views.length===0);
 const [active,setActive]=useState(views[0]?.id??'');
 const view=views.find(v=>v.id===active)??views[0];
 const plan=view?.plan??emptyPlan();
 const source=view?.guides?.visible?building.floors.find(f=>f.id===view.guides!.floorId):undefined;
 const levels=view?.guides?.levels??[];
 const [tool,setTool]=useState<Tool>('select'),[points,setPoints]=useState<Point[]>([]),[selected,setSelected]=useState('');
 const [text,setText]=useState('Texto'),[newName,setNewName]=useState('Frente'),[error,setError]=useState(''),[reference,setReference]=useState(false),[confirmDelete,setConfirmDelete]=useState(false),[busy,setBusy]=useState(false);
 const [box,setBox]=useState(()=>view?planBounds(view.plan):{x:-1,y:-6,width:14,height:9});
 const svg=useRef<SVGSVGElement>(null);
 const pan=useRef<{id:number;client:Point;box:typeof box}|null>(null);
 const [draft,setDraft]=useState<Plan|null>(null),[moving,setMoving]=useState(false);
 const drag=useRef<{pointer:number;edit:ViewEdit;original:Plan;start:Point;client:Point;preview:Plan|null;issue:string}|null>(null);
 const [canvasSize,setCanvasSize]=useState({width:900,height:600});
 useEffect(()=>{const node=svg.current;if(!node)return;const observer=new ResizeObserver(()=>{const r=node.getBoundingClientRect();setCanvasSize({width:r.width,height:r.height});});observer.observe(node);return ()=>observer.disconnect();},[view?.id]);
 const zoom=Math.max(.001,Math.min(canvasSize.width/box.width,canvasSize.height/box.height)/75);
 const shown=draft??plan;
 const trace=shown.projections?.find(p=>p.id===selected),label=shown.labels.find(l=>l.id===selected),dimension=shown.dimensions.find(d=>d.id===selected);
 function cancelDrag(){drag.current=null;pan.current=null;setDraft(null);setMoving(false);}
 function run(action:()=>void){if(drag.current)return;try{action();setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el cambio.');}}
 function commit(next:Plan){if(view)onChange({...building,views:views.map(v=>v.id===view.id?{...v,plan:validatePlan(next)}:v)});}
 function reset(){cancelDrag();setPoints([]);setSelected('');setConfirmDelete(false);}
 function fit(p:Plan){setBox(draftingBounds(p,source?.plan,levels));}
 useEffect(()=>{setBox(draftingBounds(plan,source?.plan,levels));},[view?.id,source?.id,view?.guides?.visible,JSON.stringify(levels)]);
 function rawPoint(e:PointerEvent<SVGSVGElement>):Point{const matrix=svg.current!.getScreenCTM();if(!matrix)throw new Error('El lienzo no está disponible.');const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return {x:p.x,y:p.y};}
 function snapped(p:Point,alt:boolean,excluded:Point[]=[]):Point{
  const tolerance=Math.min(.25,8/(75*zoom));
  if(!alt){const vertex=snapViewVertex(plan,p,tolerance,excluded);if(vertex)return {...vertex};if(source)return snapToGuides(p,source.plan,levels,tolerance);}
  return {x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10};
 }
 function point(e:PointerEvent<SVGSVGElement>){return snapped(rawPoint(e),e.altKey);}
 function move(e:PointerEvent<SVGSVGElement>){
  const panStart=pan.current;if(panStart?.id===e.pointerId){const m=e.currentTarget.getScreenCTM();if(m)setBox({...panStart.box,x:panStart.box.x-(e.clientX-panStart.client.x)/m.a,y:panStart.box.y-(e.clientY-panStart.client.y)/m.d});return;}
  const d=drag.current;if(!d||d.pointer!==e.pointerId)return;
  if(Math.hypot(e.clientX-d.client.x,e.clientY-d.client.y)<3&&!d.preview)return;
  try{
   const raw=rawPoint(e),trace=d.original.projections?.find(t=>t.id===d.edit.id);
   let start=d.start,target:Point;
   if(d.edit.kind==='trace'||d.edit.kind==='label'){
    const label=d.original.labels.find(l=>l.id===d.edit.id);
    start=trace?.points[0]??label!;
    target=snapped({x:start.x+raw.x-d.start.x,y:start.y+raw.y-d.start.y},e.altKey,trace?.points??[]);
   }else target=snapped(raw,e.altKey,d.edit.kind==='vertex'?[trace!.points[d.edit.vertex!]]:[]);
   const next=editView(d.original,d.edit,start,target);d.preview=next;d.issue='';setDraft(next);
  }catch(err){d.preview=null;d.issue=err instanceof Error?err.message:'No se pudo mover el elemento.';setDraft(null);}
 }
 function up(e:PointerEvent<SVGSVGElement>){
  const d=drag.current;if(d&&d.pointer!==e.pointerId)return;
  if(d){const next=d.preview,issue=d.issue;cancelDrag();if(issue)setError(issue);else if(next&&JSON.stringify(next)!==JSON.stringify(d.original))run(()=>commit(next));}
  if(pan.current?.id===e.pointerId)cancelDrag();
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 }
 function addTrace(ps:Point[],closed=false){const id=uid();commit({...plan,projections:[...(plan.projections??[]),{id,name:'',points:ps,closed}]});setSelected(id);setPoints([]);}
 function down(e:PointerEvent<SVGSVGElement>){if(!e.isPrimary||e.button!==0||!view||drag.current||pan.current)return;
  if(tool==='pan'){e.currentTarget.setPointerCapture(e.pointerId);pan.current={id:e.pointerId,client:{x:e.clientX,y:e.clientY},box};setMoving(true);return;}
  run(()=>{const p=point(e);
   if(tool==='select'){
    const target=e.target as Element,id=target.closest('[data-id]')?.getAttribute('data-id')??'';setSelected(id);if(!id)return;
    const vertex=target.closest('[data-vertex]')?.getAttribute('data-vertex'),end=target.closest('[data-endpoint]')?.getAttribute('data-endpoint') as 'a'|'b'|null;
    const kind:ViewEdit['kind']=plan.projections?.some(t=>t.id===id)?vertex==null?'trace':'vertex':plan.labels.some(l=>l.id===id)?'label':end?'dimensionEndpoint':'dimension';
    drag.current={pointer:e.pointerId,edit:{id,kind,vertex:vertex==null?undefined:Number(vertex),end:end??undefined},original:plan,start:rawPoint(e),client:{x:e.clientX,y:e.clientY},preview:null,issue:''};
    e.currentTarget.setPointerCapture(e.pointerId);setMoving(true);setError('');return;
   }
   if(tool==='text'){if(!text.trim())throw new Error('Escribí el texto antes de colocarlo.');commit({...plan,labels:[...plan.labels,{id:uid(),x:p.x,y:p.y,text:text.trim()}]});return;}
   if(!points.length){setPoints([p]);return;}
   if(tool==='line'){addTrace([points[0],p]);return;}
   if(tool==='rectangle'){const a=points[0];addTrace([a,{x:p.x,y:a.y},p,{x:a.x,y:p.y}],true);return;}
   if(points.length===1){if(Math.hypot(p.x-points[0].x,p.y-points[0].y)<.1)throw new Error('La cota necesita dos puntos separados.');setPoints([...points,p]);return;}
   commit(addDimension(plan,points[0],points[1],p));setPoints([]);
  });
 }
 function remove(){run(()=>{commit({...plan,projections:plan.projections?.filter(p=>p.id!==selected),labels:plan.labels.filter(l=>l.id!==selected),dimensions:plan.dimensions.filter(d=>d.id!==selected)});setSelected('');});}
 async function exportView(kind:'svg'|'png'|'print'){if(!svg.current||!view)return;setBusy(true);try{const p={...plan,name:building.name};if(kind==='print')await printPlan(svg.current,p,view.name);else download(kind==='svg'?createExport(svg.current,p).blob:await renderPng(svg.current,p),`TrazoCasa-${view.name.replace(/[^\p{L}\p{N} _-]/gu,'')}.${kind}`);setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const pending=points.length>0||moving;
 return <div className="views-backdrop"><section className="views-panel" role="dialog" aria-modal="true" aria-label="Vistas 2D" onKeyDown={e=>{if(reference)return;if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')).filter(node=>node.getClientRects().length>0);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}if((e.target as HTMLElement).closest('input,select'))return;if(e.key==='Escape'){e.stopPropagation();reset();setTool('select');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();reset();e.shiftKey?onRedo():onUndo();return;}if(!e.ctrlKey&&!e.metaKey&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();if(points.length)setPoints([]);else if(!moving)remove();return;}if(!pending&&!e.ctrlKey&&!e.metaKey){const shortcuts:Record<string,Tool>={v:'select',w:'line',l:'line',r:'rectangle',c:'dimension',t:'text',h:'pan'};const t=shortcuts[e.key.toLowerCase()];if(t){setTool(t);reset();}}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(pending)setError('Terminá o cancelá el trazo antes de descargar.');else onSave();}}}>
 <div className={`views-content ${settings?"settings-open":""}`} inert={reference?true:undefined}>
 <header><strong>Vistas 2D</strong><span>{saved?'Guardado local':'Guardado pendiente · descargá una copia'}</span><button aria-expanded={settings} onClick={()=>setSettings(v=>!v)}>Menú de vista</button><button autoFocus disabled={pending} onClick={onClose}>Volver a plantas</button></header>
 <div className="views-bar views-switch"><label>Vista<select disabled={pending} value={view?.id??''} onChange={e=>{setActive(e.target.value);reset();const v=views.find(v=>v.id===e.target.value);if(v)fit(v.plan);}}>{!views.length&&<option value="">Creá tu primera vista</option>}{views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
 <form className="view-create" onSubmit={e=>{e.preventDefault();run(()=>{const id=uid();onChange({...building,views:[...views,{id,name:newName.trim(),plan:emptyPlan(),...(newName.trim()==='Frente'?{guides:{floorId:building.activeFloorId,visible:true,levels:[0,.9,2.1,2.8]}}:{})}]});setActive(id);setSettings(false);reset();setBox({x:-1,y:-6,width:14,height:9});});}}><label>Nueva vista<input list="view-names" value={newName} maxLength={60} required onChange={e=>setNewName(e.target.value)}/></label><datalist id="view-names">{names.map(n=><option key={n}>{n}</option>)}</datalist><button disabled={pending||views.length>=30}>Crear vista</button></form></div>
 {!view?<p className="views-help">Creá un frente, lateral o corte. Cada vista tiene su propio dibujo y se guarda dentro del archivo del proyecto.</p>:<>
 <div className="views-bar view-settings"><label>Nombre<input key={view.id+'-'+view.name} defaultValue={view.name} maxLength={60} onBlur={e=>{const name=e.target.value.trim();if(name!==view.name)run(()=>onChange({...building,views:views.map(v=>v.id===view.id?{...v,name}:v)}));}}/></label>
 <button disabled={pending} onClick={()=>setReference(true)}>Imagen de referencia</button>
 <button disabled={pending} onClick={()=>setConfirmDelete(v=>!v)}>Eliminar vista</button></div>
 {confirmDelete&&<div className="views-bar"><span>¿Eliminar «{view.name}» y su dibujo? Podés deshacer.</span><button onClick={()=>run(()=>{onChange({...building,views:views.filter(v=>v.id!==view.id)});reset();})}>Confirmar eliminación</button><button onClick={()=>setConfirmDelete(false)}>Cancelar</button></div>}
 <FrontGuideControls key={view.id} building={building} view={view} disabled={pending} onChange={guides=>run(()=>onChange({...building,views:views.map(v=>v.id===view.id?{...v,guides}:v)}))}/><div className="views-bar view-navigation"> <button disabled={pending||!canUndo} onClick={()=>{reset();onUndo();}}>Deshacer</button><button disabled={pending||!canRedo} onClick={()=>{reset();onRedo();}}>Rehacer</button>
 <button disabled={moving} onClick={()=>fit(plan)}>Encuadrar</button><button disabled={moving} onClick={()=>setBox(b=>({...b,x:b.x+b.width*.1,y:b.y+b.height*.1,width:b.width*.8,height:b.height*.8}))}>Acercar</button><button disabled={moving} onClick={()=>setBox(b=>({...b,x:b.x-b.width*.125,y:b.y-b.height*.125,width:b.width*1.25,height:b.height*1.25}))}>Alejar</button>
</div><div className="views-bar view-tools" role="group" aria-label="Herramientas de vistas">{(['select','line','rectangle','dimension','text','pan'] as Tool[]).map((t,i)=><button key={t} disabled={pending&&t!==tool} aria-pressed={tool===t} onClick={()=>{setTool(t);reset();}}>{['Seleccionar','Línea','Rectángulo','Cota','Texto','Mover lienzo'][i]}</button>)}{tool==='text'&&<input aria-label="Texto a colocar" maxLength={80} value={text} onChange={e=>setText(e.target.value)}/>}{points.length>0&&<button onClick={()=>setPoints([])}>Cancelar trazo pendiente</button>}{selected&&<button disabled={moving} onClick={remove}>Eliminar selección</button>}</div>
 <p className="views-help">{tool==='select'?'Arrastrá para mover; usá los extremos para editar. V: seleccionar · W: línea · C: cota · Supr: eliminar.':tool==='text'?'Escribí el texto y tocá donde ubicarlo.':tool==='pan'?'Arrastrá para recorrer la vista.':tool==='dimension'?`${points.length}/3 puntos: inicio, final y separación de la cota.`:`${points.length}/2 puntos: tocá ${pending?'el final':'el inicio'} ${tool==='rectangle'?'de la diagonal del rectángulo':'de la línea'}.`} Ajuste: 10 cm y guías · Alturas hacia arriba.</p>
 <div className="view-workspace"><svg ref={svg} className="view-drawing" aria-label="Lienzo de vista 2D" viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
 <g data-editor="true"><defs><pattern id="view-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#dddcd3" strokeWidth=".012"/></pattern></defs><rect x={box.x} y={box.y} width={box.width} height={box.height} fill="url(#view-grid)"/><line x1={box.x} x2={box.x+box.width} y1="0" y2="0" stroke="#aaa" strokeWidth=".02"/></g>
 {source&&<FrontGuideDrawing source={source.plan} name={source.name} levels={levels} box={box}/>}
 {plan.reference?.visible&&<image data-editor="true" href={plan.reference.data} x={plan.reference.x} y={plan.reference.y} width={plan.reference.width} height={plan.reference.height} opacity={plan.reference.opacity} pointerEvents="none"/>}
 {(shown.projections??[]).map(p=><ViewTrace key={p.id} item={p} selected={selected===p.id&&tool==='select'} zoom={zoom}/>)}
 {shown.labels.map(l=><text key={l.id} data-id={l.id} x={l.x} y={l.y} fontSize=".22" fill="#354b40" fontFamily="Arial,sans-serif">{l.text}</text>)}
 {shown.dimensions.map(d=><DimensionShape key={d.id} item={d} selected={selected===d.id&&tool==='select'} zoom={zoom}/>)}
 {points.map((p,i)=><circle data-editor="true" key={i} cx={p.x} cy={p.y} r=".08" fill="#c98b45"/>)}
 </svg>
 {(trace||label||dimension)&&<section className="view-inspector" aria-label="Propiedades del elemento"><div className="view-inspector-title"><strong>{trace?trace.closed?'Contorno':'Línea':dimension?'Cota':'Texto'}</strong><button disabled={moving} aria-label="Limpiar selección" onClick={()=>setSelected('')}>×</button></div><fieldset disabled={moving}>
 {trace&&<>{!trace.closed&&trace.points.length===2&&<ViewLineControls key={trace.id+JSON.stringify(trace.points)} item={trace} onResize={value=>run(()=>commit(resizeViewLine(plan,trace.id,value)))} onSplit={at=>run(()=>commit(splitViewLine(plan,trace.id,at)))}/>}
 <details><summary>Coordenadas de vértices</summary><div className="views-properties"><small>Y negativo sube sobre el nivel 0.</small>{trace.points.map((p,i)=><div key={i}><span>{trace.points.length===2?i===0?'A':'B':i+1}</span>{(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()}<input aria-label={`Vértice ${i+1} ${axis.toUpperCase()}`} key={`${trace.id}-${p[axis]}`} type="number" step="0.1" defaultValue={p[axis]} onBlur={e=>run(()=>{if(!e.target.value)throw new Error('Ingresá una coordenada.');commit(moveViewVertex(plan,trace.id,i,{...p,[axis]:Number(e.target.value)}));})}/></label>)}</div>)}</div></details></>}
 {dimension&&<DimensionControls key={dimension.id+'-'+dimension.offset} item={dimension} onChange={offset=>run(()=>commit({...plan,dimensions:plan.dimensions.map(d=>d.id===dimension.id?{...d,offset}:d)}))}/>}
 {label&&<div className="views-bar"><label>Texto seleccionado<input key={label.id+label.text} maxLength={80} defaultValue={label.text} onBlur={e=>run(()=>commit({...plan,labels:plan.labels.map(l=>l.id===label.id?{...l,text:e.target.value}:l)}))}/></label>{(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()} (m)<input key={label.id+label[axis]} type="number" step=".1" defaultValue={label[axis]} onBlur={e=>run(()=>{if(!e.target.value)throw new Error('Ingresá una coordenada.');commit({...plan,labels:plan.labels.map(l=>l.id===label.id?{...l,[axis]:Number(e.target.value)}:l)});})}/></label>)}</div>}
 <button className="delete" onClick={remove}>Eliminar selección</button></fieldset></section>}
 </div></>}
 <footer className="view-settings"><button onClick={onSave} disabled={pending}>Descargar proyecto editable</button>{view&&<><button disabled={busy||pending} onClick={()=>void exportView('svg')}>Exportar SVG</button><button disabled={busy||pending} onClick={()=>void exportView('png')}>Exportar PNG</button><button disabled={busy||pending} onClick={()=>void exportView('print')}>Imprimir a escala</button></>}</footer>
 {error&&<p role="alert" className="views-error">{error}</p>}
 </div>{reference&&<ReferencePanel initial={plan.reference} onClose={()=>setReference(false)} onApply={image=>run(()=>{commit({...plan,reference:image});setReference(false);if(image)setBox({x:image.x-1,y:image.y-1,width:image.width+2,height:image.height+2});})}/>}
 </section></div>;
}
