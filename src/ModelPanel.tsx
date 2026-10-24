import {HoleControls} from './HoleControls';
import {useEffect,useMemo,useRef,useState} from 'react';
import {createModelScene,modelViews} from './ModelScene';
import type {ModelView} from './ModelScene';
import {buildingVolumes} from './model3d';
import type {ModelOptions,ModelSelection} from './model3d';
import {GeneralHeightControls,WallHeightControls,OpeningHeightControls} from './HeightControls';
import {LevelControls,SlabControls} from './LevelControls';
import {distance,floorLevels,openingHeight,openingSill,surfaceArea,validatePlan,wallHeight,wallThickness} from './model';
import type {Building,Plan,SurfaceHole} from './model';
import './model3d.css';
export type ModelPanelProps={building:Building;plan:Plan;onChange:(plan:Plan)=>void;onLevel:(elevation?:number)=>void;onSurface:()=>void;onHole:(surfaceId:string,target:SurfaceHole['target'])=>void;onFloor:(id:string)=>void;onClose:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;onSave:()=>void;saved:boolean};
export default function ModelPanel({building,plan,onChange,onLevel,onSurface,onHole,onFloor,onClose,onUndo,onRedo,canUndo,canRedo,onSave,saved}:ModelPanelProps){
 const host=useRef<HTMLDivElement>(null),api=useRef<ReturnType<typeof createModelScene>|undefined>(undefined);
 const [mode,setMode]=useState<ModelView>('3d'),[selection,setSelection]=useState<ModelSelection|null>(null),[panel,setPanel]=useState(false),[error,setError]=useState(''),[fatal,setFatal]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [scope,setScope]=useState<ModelOptions['scope']>('all'),[slabs,setSlabs]=useState(true),[roofs,setRoofs]=useState(true);
 const floor=building.floors.find(f=>f.id===building.activeFloorId)!;
 const levels=floorLevels(building),level=levels[building.floors.indexOf(floor)];
 const selected=selection?.floorId===floor.id?selection.elementId:'';
 const wall=plan.walls.find(w=>w.id===selected),opening=plan.openings.find(o=>o.id===selected),surface=plan.surfaces.find(s=>s.id===selected);
 const model=useMemo(()=>buildingVolumes(building,{scope,slabs,roofs}),[building,scope,slabs,roofs]);
 const hasGeometry=model.some(f=>f.walls.length||f.plates.length);
 function select(id:string){setSelection(id?{floorId:floor.id,elementId:id}:null);}
 const pick=useRef((item:ModelSelection|null)=>{});
 pick.current=item=>{setSelection(item);if(item){if(item.floorId!==floor.id)onFloor(item.floorId);setPanel(true);}};
 useEffect(()=>{
  if(!host.current)return;
  let viewer:ReturnType<typeof createModelScene>|undefined;
  try{viewer=createModelScene(host.current,model,item=>pick.current(item),setFatal);api.current=viewer;setReady(true);}catch{setFatal('Este navegador no pudo iniciar WebGL 2. Podés seguir trabajando en la planta 2D o probar con la aceleración gráfica habilitada en otro navegador.');}
  return ()=>{viewer?.dispose();api.current=undefined;};
 },[]);
 useEffect(()=>{api.current?.update(model);},[model]);
 const frame=scope==='all'?'all':floor.id;
 useEffect(()=>{api.current?.fit();},[frame]);
 useEffect(()=>{if(selection&&(!selected||!wall&&!opening&&!surface))setSelection(null);},[floor.id,plan]);
 useEffect(()=>{api.current?.setSelected(selection);},[selection]);
 function change(next:Plan){try{onChange(validatePlan(next));setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo aplicar el cambio.');}}
 function changeLevel(elevation?:number){try{onLevel(elevation);setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo aplicar el nivel.');}}
 function view(next:ModelView){setMode(next);api.current?.setMode(next);}
 async function png(){if(!api.current)return;setBusy(true);try{const blob=await api.current.exportPng(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`TrazoCasa-${(scope==='all'?building.name:floor.name).replace(/[^\p{L}\p{N} _-]/gu,'')}-${mode}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="model-panel" role="dialog" aria-modal="true" aria-label="Modelo 3D" onKeyDown={e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();onSave();return;}
  if(e.key==='Escape'){e.preventDefault();if(panel){setPanel(false);setSelection(null);}else onClose();return;}
  if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(n=>n.getClientRects().length>0);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}
  if((e.target as HTMLElement).closest('input,select'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?onRedo():onUndo();}
 }}>
 <header className="model-bar"><strong>TrazoCasa · 3D</strong>
 <select aria-label="Alcance del modelo" value={scope} onChange={e=>setScope(e.target.value as ModelOptions['scope'])}><option value="all">Edificio completo</option><option value="active">Solo planta activa</option></select>
 <select aria-label="Planta del modelo 3D" value={floor.id} onChange={e=>onFloor(e.target.value)}>{building.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
 <span className="model-save">{saved?'Guardado local':'Descargá una copia: guardado local pendiente'}</span><button aria-expanded={panel} onClick={()=>setPanel(p=>!p)}>Niveles y opciones</button><button autoFocus onClick={onClose}>Editar planta</button></header>
 <nav className="model-bar model-modes" aria-label="Vistas del modelo">{modelViews.map(v=><button key={v.id} disabled={!ready||!!fatal} aria-pressed={mode===v.id} onClick={()=>view(v.id)}>{v.name}</button>)}<span className="model-separator"/><button disabled={!canUndo} onClick={onUndo}>Deshacer</button><button disabled={!canRedo} onClick={onRedo}>Rehacer</button><button disabled={!ready||!!fatal} onClick={()=>api.current?.fit()}>Encuadrar</button><button disabled={!ready||!!fatal} aria-label="Alejar modelo" onClick={()=>api.current?.zoom(1/1.2)}>−</button><button disabled={!ready||!!fatal} aria-label="Acercar modelo" onClick={()=>api.current?.zoom(1.2)}>+</button></nav>
 <div className="model-stage"><div className="model-canvas" ref={host}/>
 {!hasGeometry&&!fatal&&<div className="model-empty"><strong>Empezá por las paredes</strong><p>Dibujá muros y aberturas, o una superficie para crear su losa.</p><button onClick={onClose}>Dibujar planta</button></div>}
 {fatal&&<div className="model-empty" role="alert"><p>{fatal}</p><button onClick={onClose}>Volver al editor 2D</button></div>}
 {panel&&<aside className="model-properties" aria-label="Niveles y opciones"><div className="model-property-title"><strong>{wall?'Muro '+(plan.walls.indexOf(wall)+1):opening?opening.kind==='door'?'Puerta':'Ventana':surface?surface.name:'Niveles y alturas'}</strong><button aria-label="Cerrar propiedades 3D" onClick={()=>setPanel(false)}>×</button></div>
 <p>{floor.name} · Nivel {level.toFixed(2)} m</p>
 <div className="model-visibility"><button aria-pressed={slabs} onClick={()=>setSlabs(v=>!v)}>{slabs?'Ocultar losas':'Mostrar losas'}</button><button aria-pressed={roofs} onClick={()=>setRoofs(v=>!v)}>{roofs?'Ocultar cubiertas':'Mostrar cubiertas'}</button></div>
 <label>Elemento de {floor.name}<select aria-label="Elemento del modelo" value={wall||opening||surface?selected:''} onChange={e=>select(e.target.value)}><option value="">Nivel y altura general</option>{plan.walls.map((w,i)=><option key={w.id} value={w.id}>Muro {i+1} · {wallHeight(plan,w).toFixed(2)} m</option>)}{plan.openings.map((o,i)=><option key={o.id} value={o.id}>{o.kind==='door'?'Puerta':'Ventana'} {i+1} · {openingHeight(o).toFixed(2)} m</option>)}{plan.surfaces.map(s=><option key={s.id} value={s.id}>Superficie · {s.name}</option>)}</select></label>
 {wall?<><p>{distance(wall.a,wall.b).toFixed(2)} m de largo · {(wallThickness(wall)*100).toFixed(0)} cm de espesor</p><WallHeightControls key={floor.id+wall.id+'-'+wallHeight(plan,wall)} plan={plan} wall={wall} onChange={height=>change({...plan,walls:plan.walls.map(w=>w.id===wall.id?{...w,height}:w)})}/></>:opening?<><p>{opening.width.toFixed(2)} m de ancho · hueco en el muro</p><OpeningHeightControls key={floor.id+opening.id+'-'+openingHeight(opening)+'-'+openingSill(opening)} opening={opening} onChange={(height,sill)=>change({...plan,openings:plan.openings.map(o=>o.id===opening.id?{...o,height,sill}:o)})}/></>:surface?<><p>{surfaceArea(surface.points).toFixed(2)} m² · contorno manual</p><SlabControls key={floor.id+surface.id+JSON.stringify([surface.slab,surface.roof])} surface={surface} plan={plan} onChange={(slab,roof)=>change({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,slab,roof}:s)})}/><HoleControls key={floor.id+surface.id} surface={surface} onChange={holes=>change({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,holes}:s)})} onDraw={target=>onHole(surface.id,target)}/></>:<>
 <LevelControls key={floor.id+'-'+floor.elevation+'-'+level} floor={floor} level={level} onChange={changeLevel}/>
 <GeneralHeightControls key={floor.id+'-'+(plan.wallHeight??2.8)} plan={plan} onChange={wallHeight=>change({...plan,wallHeight})}/>
 <p>Para crear losas y cubiertas, dibujá una superficie en 2D y elegila en Elemento.</p><button onClick={onSurface}>Dibujar contorno en planta</button>
 </>}
 <div className="model-files"><button onClick={onSave}>Descargar proyecto editable</button><button disabled={busy||!ready||!!fatal||!hasGeometry} onClick={()=>void png()}>{busy?'Preparando imagen…':'Descargar vista PNG'}</button></div><small>Muros, aberturas, losas y cubiertas planas. Las alturas se miden desde el piso de cada planta. Los huecos se dibujan en la planta y recortan el elemento elegido. Los contornos no siguen los muros automáticamente.</small>
 </aside>}
 </div>
 {error&&<div className="model-error" role="alert">{error}<button aria-label="Cerrar error" onClick={()=>setError('')}>×</button></div>}
 <footer>{mode==='3d'?'Arrastrá para girar · Rueda o dos dedos para zoom · Botón derecho para mover':'Fachada sin perspectiva · Arrastrá para mover · Rueda o dos dedos para zoom'}<span>{scope==='all'?building.floors.length+' plantas':'Planta activa'} · {floor.name}: {level.toFixed(2)} m · Frente: borde inferior del plano.</span></footer>
 </section>;
}
