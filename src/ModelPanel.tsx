import {useEffect,useRef,useState} from 'react';
import {createModelScene,modelViews} from './ModelScene';
import type {ModelView} from './ModelScene';
import {GeneralHeightControls,WallHeightControls,OpeningHeightControls} from './HeightControls';
import {distance,openingHeight,openingSill,validatePlan,wallHeight,wallThickness} from './model';
import type {Building,Plan} from './model';
import './model3d.css';
export type ModelPanelProps={building:Building;plan:Plan;onChange:(plan:Plan)=>void;onFloor:(id:string)=>void;onClose:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;onSave:()=>void;saved:boolean};
export default function ModelPanel({building,plan,onChange,onFloor,onClose,onUndo,onRedo,canUndo,canRedo,onSave,saved}:ModelPanelProps){
 const host=useRef<HTMLDivElement>(null),api=useRef<ReturnType<typeof createModelScene>|undefined>(undefined);
 const [mode,setMode]=useState<ModelView>('3d'),[selected,setSelected]=useState(''),[panel,setPanel]=useState(false),[error,setError]=useState(''),[fatal,setFatal]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const floor=building.floors.find(f=>f.id===building.activeFloorId)!;
 const wall=plan.walls.find(w=>w.id===selected),opening=plan.openings.find(o=>o.id===selected);
 function select(id:string){setSelected(id);if(id)setPanel(true);}
 useEffect(()=>{
  if(!host.current)return;setReady(false);setFatal('');setSelected('');setMode('3d');
  let viewer:ReturnType<typeof createModelScene>|undefined;
  try{viewer=createModelScene(host.current,plan,select,setFatal);api.current=viewer;setReady(true);}catch{setFatal('Este navegador no pudo iniciar WebGL 2. Podés seguir trabajando en la planta 2D o probar con la aceleración gráfica habilitada en otro navegador.');}
  return ()=>{viewer?.dispose();api.current=undefined;};
 },[floor.id]);
 useEffect(()=>{api.current?.update(plan);if(selected&&!plan.walls.some(w=>w.id===selected)&&!plan.openings.some(o=>o.id===selected))setSelected('');},[plan]);
 useEffect(()=>{api.current?.setSelected(selected);},[selected]);
 function change(next:Plan){try{onChange(validatePlan(next));setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo aplicar el cambio.');}}
 function view(next:ModelView){setMode(next);api.current?.setMode(next);}
 async function png(){if(!api.current)return;setBusy(true);try{const blob=await api.current.exportPng(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`TrazoCasa-${floor.name.replace(/[^\p{L}\p{N} _-]/gu,'')}-${mode}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="model-panel" role="dialog" aria-modal="true" aria-label="Modelo 3D" onKeyDown={e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();onSave();return;}
  if(e.key==='Escape'){e.preventDefault();if(panel){setPanel(false);setSelected('');}else onClose();return;}
  if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(n=>n.getClientRects().length>0);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}
  if((e.target as HTMLElement).closest('input,select'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?onRedo():onUndo();}
 }}>
 <header className="model-bar"><strong>TrazoCasa · 3D</strong><select aria-label="Planta del modelo 3D" value={floor.id} onChange={e=>onFloor(e.target.value)}>{building.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><span className="model-save">{saved?'Guardado local':'Descargá una copia: guardado local pendiente'}</span><button aria-expanded={panel} onClick={()=>setPanel(p=>!p)}>Alturas y opciones</button><button autoFocus onClick={onClose}>Editar planta</button></header>
 <nav className="model-bar model-modes" aria-label="Vistas del modelo">{modelViews.map(v=><button key={v.id} disabled={!ready||!!fatal} aria-pressed={mode===v.id} onClick={()=>view(v.id)}>{v.name}</button>)}<span className="model-separator"/><button disabled={!canUndo} onClick={onUndo}>Deshacer</button><button disabled={!canRedo} onClick={onRedo}>Rehacer</button><button disabled={!ready||!!fatal} onClick={()=>api.current?.fit()}>Encuadrar</button><button disabled={!ready||!!fatal} aria-label="Alejar modelo" onClick={()=>api.current?.zoom(1/1.2)}>−</button><button disabled={!ready||!!fatal} aria-label="Acercar modelo" onClick={()=>api.current?.zoom(1.2)}>+</button></nav>
 <div className="model-stage"><div className="model-canvas" ref={host}/>
 {!plan.walls.length&&<div className="model-empty"><strong>Empezá por las paredes</strong><p>Dibujá muros y aberturas en la planta para verlos en 3D.</p><button onClick={onClose}>Dibujar planta</button></div>}
 {fatal&&<div className="model-empty" role="alert"><p>{fatal}</p><button onClick={onClose}>Volver al editor 2D</button></div>}
 {panel&&<aside className="model-properties" aria-label="Alturas y opciones"><div className="model-property-title"><strong>{wall?'Muro '+(plan.walls.indexOf(wall)+1):opening?opening.kind==='door'?'Puerta':'Ventana':'Alturas de '+floor.name}</strong><button aria-label="Cerrar propiedades 3D" onClick={()=>setPanel(false)}>×</button></div>
 <label>Elemento<select aria-label="Elemento del modelo" value={wall||opening?selected:''} onChange={e=>select(e.target.value)}><option value="">Altura general de la planta</option>{plan.walls.map((w,i)=><option key={w.id} value={w.id}>Muro {i+1} · {wallHeight(plan,w).toFixed(2)} m</option>)}{plan.openings.map((o,i)=><option key={o.id} value={o.id}>{o.kind==='door'?'Puerta':'Ventana'} {i+1} · {openingHeight(o).toFixed(2)} m</option>)}</select></label>
 {wall?<><p>{distance(wall.a,wall.b).toFixed(2)} m de largo · {(wallThickness(wall)*100).toFixed(0)} cm de espesor</p><WallHeightControls key={wall.id+'-'+wallHeight(plan,wall)} plan={plan} wall={wall} onChange={height=>change({...plan,walls:plan.walls.map(w=>w.id===wall.id?{...w,height}:w)})}/></>:opening?<><p>{opening.width.toFixed(2)} m de ancho · hueco en el muro</p><OpeningHeightControls key={opening.id+'-'+openingHeight(opening)+'-'+openingSill(opening)} opening={opening} onChange={(height,sill)=>change({...plan,openings:plan.openings.map(o=>o.id===opening.id?{...o,height,sill}:o)})}/></>:<GeneralHeightControls key={plan.wallHeight??2.8} plan={plan} onChange={wallHeight=>change({...plan,wallHeight})}/>}
 <div className="model-files"><button onClick={onSave}>Descargar proyecto editable</button><button disabled={busy||!ready||!!fatal||!plan.walls.length} onClick={()=>void png()}>{busy?'Preparando imagen…':'Descargar vista PNG'}</button></div><small>Se muestra solo la planta elegida. Esta etapa incluye muros y huecos; losas, cubiertas, mobiliario y cortes se incorporarán después.</small>
 </aside>}
 </div>
 {error&&<div className="model-error" role="alert">{error}<button aria-label="Cerrar error" onClick={()=>setError('')}>×</button></div>}
 <footer>{mode==='3d'?'Arrastrá para girar · Rueda o dos dedos para zoom · Botón derecho para mover':'Fachada sin perspectiva · Arrastrá para mover · Rueda o dos dedos para zoom'}<span>Tocá un muro o abertura para editar su altura. Frente: desde el borde inferior de la planta.</span></footer>
 </section>;
}
