import {WalkControls} from './WalkControls';
import {createWalkWorld} from './walkPhysics';
import type {WalkWorld} from './walkPhysics';
import type {WalkCameraMode,WalkProgress} from './WalkController';
import {PersonControls} from './PersonControls';
import {personView,withoutObserver} from './personView';
import {AppearanceControls} from './AppearanceControls';
import {targetAppearance,withAppearance,furnitureFinishColors} from './appearance';
import type {AppearanceTarget} from './appearance';
import type {Appearance} from './model';
import {FurnitureHeightControls} from './FurnitureHeightControls';
import {isFurniture3D} from './furnitureHeights';
import {furnitureCatalog} from './model';
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
export type ModelPanelProps={building:Building;plan:Plan;onChange:(plan:Plan)=>void;onLevel:(elevation?:number)=>void;onPerson:()=>void;onFurniture:(id:string)=>void;onSurface:()=>void;onPlates:()=>void;onHole:(surfaceId:string,target:SurfaceHole['target'])=>void;onFloor:(id:string)=>void;onClose:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;onSave:()=>void;saved:boolean};
export default function ModelPanel({building,plan,onChange,onLevel,onPerson,onFurniture,onSurface,onPlates,onHole,onFloor,onClose,onUndo,onRedo,canUndo,canRedo,onSave,saved}:ModelPanelProps){
 const host=useRef<HTMLDivElement>(null),api=useRef<ReturnType<typeof createModelScene>|undefined>(undefined);
 const [mode,setMode]=useState<ModelView>('3d'),[selection,setSelection]=useState<ModelSelection|null>(null),[panel,setPanel]=useState(false),[error,setError]=useState(''),[fatal,setFatal]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [scope,setScope]=useState<ModelOptions['scope']>('all'),[slabs,setSlabs]=useState(true),[roofs,setRoofs]=useState(true),[showFurniture,setShowFurniture]=useState(true);
 const [inspector,setInspector]=useState<'geometry'|'appearance'>('geometry'),[plateTarget,setPlateTarget]=useState<'slab'|'roof'>('slab');
 const [walking,setWalking]=useState<{world:WalkWorld;selection:ModelSelection;revision:Building}|null>(null),[walkMode,setWalkMode]=useState<WalkCameraMode>('third'),[walkProgress,setWalkProgress]=useState<WalkProgress>({distance:0,blocked:false});
 const [observer,setObserver]=useState<ModelSelection|null>(null);
 const [preview,setPreview]=useState<{key:string;appearance?:Appearance}|null>(null);
 const floor=building.floors.find(f=>f.id===building.activeFloorId)!;
 const levels=floorLevels(building),level=levels[building.floors.indexOf(floor)];
 const selected=selection?.floorId===floor.id?selection.elementId:'';
 const wall=plan.walls.find(w=>w.id===selected),opening=plan.openings.find(o=>o.id===selected),surface=plan.surfaces.find(s=>s.id===selected);
 const furniture=plan.furniture.find(f=>f.id===selected&&isFurniture3D(f.kind));
 const furnitureName=(kind:string)=>furnitureCatalog.find(f=>f.kind===kind)?.name??'Mueble';
 const target:AppearanceTarget|null=wall?{kind:'wall',id:wall.id}:furniture?{kind:'furniture',id:furniture.id}:surface&&(surface.slab||surface.roof)?{kind:surface[plateTarget]?plateTarget:surface.slab?'slab':'roof',id:surface.id}:null;
 const targetKey=JSON.stringify([floor.id,target]),hasPreview=!!(panel&&inspector==='appearance'&&target&&preview?.key===targetKey);
 const observed=observer?.floorId===floor.id?plan.furniture.find(f=>f.id===observer.elementId&&f.kind==='person'):undefined;
 const eyes=observed?personView(observed,level):null;
 const model=useMemo(()=>{const shown=hasPreview?{...building,floors:building.floors.map(f=>f.id===floor.id?{...f,plan:withAppearance(plan,target!,preview!.appearance)}:f)}:building;return withoutObserver(buildingVolumes(shown,{scope,slabs,roofs,furniture:showFurniture}),walking?.selection??(eyes?observer:null));},[building,scope,slabs,roofs,showFurniture,hasPreview,preview,observer,!!eyes,walking]);
 useEffect(()=>setPreview(null),[targetKey,plan,inspector,panel]);
 const appearance=target?targetAppearance(plan,target):undefined;
 const fallback=wall?'#e6e4d8':furniture?furnitureFinishColors(furniture.kind)[0]:target?.kind==='roof'?'#a7b3a4':'#d6ccb6';
 const hasGeometry=model.some(f=>f.walls.length||f.plates.length||f.furniture.length);
 function select(id:string){setSelection(id?{floorId:floor.id,elementId:id}:null);}
 const pick=useRef((item:ModelSelection|null)=>{});
 pick.current=item=>{setSelection(item);if(item){if(item.plate)setPlateTarget(item.plate);if(item.floorId!==floor.id)onFloor(item.floorId);setPanel(true);}};
 useEffect(()=>{
  if(!host.current)return;
  let viewer:ReturnType<typeof createModelScene>|undefined;
  try{viewer=createModelScene(host.current,model,item=>pick.current(item),setFatal);api.current=viewer;setReady(true);}catch{setFatal('Este navegador no pudo iniciar WebGL 2. Podés seguir trabajando en la planta 2D o probar con la aceleración gráfica habilitada en otro navegador.');}
  return ()=>{viewer?.dispose();api.current=undefined;};
 },[]);
 useEffect(()=>{api.current?.update(model);},[model]);
 useEffect(()=>{api.current?.setObserver(eyes);if(observer&&!eyes)setObserver(null);},[eyes?.x,eyes?.y,eyes?.z,eyes?.yaw]);
 function stopWalking(){api.current?.stopWalk();setWalking(null);}
 useEffect(()=>{if(!walking)return;try{api.current?.setWalk(walking.world,setWalkProgress);}catch{setError('No se pudo iniciar el recorrido. Volvé a seleccionar la persona.');setWalking(null);}return ()=>api.current?.stopWalk();},[walking]);
 useEffect(()=>{api.current?.walkMode(walkMode);},[walkMode,walking]);
 useEffect(()=>{if(walking&&walking.revision!==building)stopWalking();},[building]);
 function stopObserving(){stopWalking();setObserver(null);api.current?.setObserver(null);}
 function startWalking(){
  if(!furniture||furniture.kind!=='person')return;
  try{const selection={floorId:floor.id,elementId:furniture.id},world=createWalkWorld(buildingVolumes(building,{scope:'all',slabs:true,roofs:true,furniture:true}),selection);
   if(!world.canOccupy(world.start)){setError('La persona necesita espacio libre y apoyo en el piso. Ubicala fuera de muros y muebles; en plantas superiores dibujá una losa bajo sus pies.');return;}
   stopObserving();setSlabs(true);setRoofs(true);setShowFurniture(true);setSelection(null);setPreview(null);setPanel(false);setError('');setWalkMode('third');setWalkProgress({distance:0,blocked:false});setWalking({world,selection,revision:building});
  }catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar el recorrido.');}
 }
 function observe(){if(!furniture||furniture.kind!=='person')return;setObserver({floorId:floor.id,elementId:furniture.id});setPanel(false);setSelection(null);setPreview(null);host.current?.querySelector('canvas')?.focus();}
 const frame=scope==='all'?'all':floor.id;
 useEffect(()=>{api.current?.fit();},[frame]);
 useEffect(()=>{if(selection&&(!selected||!wall&&!opening&&!surface&&!furniture))setSelection(null);},[floor.id,plan]);
 useEffect(()=>{api.current?.setSelected(panel&&inspector==='appearance'?null:selection);},[selection,panel,inspector]);
 function change(next:Plan){try{onChange(validatePlan(next));setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo aplicar el cambio.');}}
 function changeLevel(elevation?:number){try{onLevel(elevation);setError('');}catch(e){setError(e instanceof Error?e.message:'No se pudo aplicar el nivel.');}}
 function view(next:ModelView){stopObserving();setMode(next);api.current?.setMode(next);}
 async function png(){if(!api.current)return;setBusy(true);try{const blob=await api.current.exportPng(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`TrazoCasa-${(scope==='all'?building.name:floor.name).replace(/[^\p{L}\p{N} _-]/gu,'')}-${walking?'recorrido':eyes?'persona':mode}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="model-panel" role="dialog" aria-modal="true" aria-label="Modelo 3D" onKeyDown={e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(hasPreview)setError('Aplicá o cancelá el acabado antes de guardar el proyecto.');else onSave();return;}
  if(e.key==='Escape'){e.preventDefault();if(panel){setPanel(false);setSelection(null);}else if(eyes||walking)stopObserving();else onClose();return;}
  if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(n=>n.getClientRects().length>0);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}
  if((e.target as HTMLElement).closest('input,select'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(!walking)e.shiftKey?onRedo():onUndo();}
 }}>
 <header className="model-bar"><strong>TrazoCasa · 3D</strong>
 <select aria-label="Alcance del modelo" value={scope} onChange={e=>{stopObserving();setScope(e.target.value as ModelOptions['scope']);}}><option value="all">Edificio completo</option><option value="active">Solo planta activa</option></select>
 <select aria-label="Planta del modelo 3D" value={floor.id} onChange={e=>{stopObserving();onFloor(e.target.value);}}>{building.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
 <span className="model-save">{hasPreview?'Vista previa sin aplicar':saved?'Guardado local':'Descargá una copia: guardado local pendiente'}</span><button disabled={!!walking} onClick={onPlates}>Losas y techos</button><button disabled={!!walking} aria-expanded={panel} onClick={()=>setPanel(p=>!p)}>Propiedades</button><button autoFocus onClick={onClose}>Editar planta</button></header>
 <nav className="model-bar model-modes" aria-label="Vistas del modelo">{modelViews.map(v=><button key={v.id} disabled={!ready||!!fatal} aria-pressed={!eyes&&!walking&&mode===v.id} onClick={()=>view(v.id)}>{v.name}</button>)}<span className="model-separator"/><button disabled={!!walking} aria-pressed={showFurniture} onClick={()=>setShowFurniture(v=>!v)}>{showFurniture?'Ocultar muebles':'Mostrar muebles'}</button><button disabled={!!walking||!canUndo} onClick={onUndo}>Deshacer</button><button disabled={!!walking||!canRedo} onClick={onRedo}>Rehacer</button><button disabled={!ready||!!fatal} onClick={()=>api.current?.fit()}>{walking?'Volver al inicio':eyes?'Centrar mirada':'Encuadrar'}</button><button disabled={!ready||!!fatal} aria-label={eyes||walking?'Ampliar campo de visión':'Alejar modelo'} onClick={()=>api.current?.zoom(1/1.2)}>−</button><button disabled={!ready||!!fatal} aria-label={eyes||walking?'Reducir campo de visión':'Acercar modelo'} onClick={()=>api.current?.zoom(1.2)}>+</button></nav>
 <div className="model-stage"><div className="model-canvas" ref={host}/>
 {walking&&!fatal&&<WalkControls mode={walkMode} progress={walkProgress} onMode={setWalkMode} onInput={(action,pressed)=>api.current?.walkInput(action,pressed)} onLook={(x,y)=>api.current?.look(x,y)} onReset={()=>api.current?.fit()} onExit={stopObserving} onPng={()=>void png()} busy={busy}/>}
 {eyes&&!fatal&&<><div className="person-view-bar"><span>Vista desde persona · ojos a {eyes.eyeHeight.toFixed(2)} m sobre el piso</span><button onClick={stopObserving}>Volver a la maqueta</button></div><div className="person-look" role="group" aria-label="Dirección de la mirada"><button aria-label="Mirar a la izquierda" onClick={()=>api.current?.look(-.25,0)}>←</button><div><button aria-label="Mirar hacia arriba" onClick={()=>api.current?.look(0,.18)}>↑</button><button aria-label="Centrar mirada" onClick={()=>api.current?.fit()}>◎</button><button aria-label="Mirar hacia abajo" onClick={()=>api.current?.look(0,-.18)}>↓</button></div><button aria-label="Mirar a la derecha" onClick={()=>api.current?.look(.25,0)}>→</button></div></>}
 {!hasGeometry&&!eyes&&!walking&&!fatal&&<div className="model-empty"><strong>No hay elementos visibles</strong><p>Dibujá muros, agregá muebles o activá los elementos ocultos.</p><button onClick={onClose}>Dibujar planta</button></div>}
 {fatal&&<div className="model-empty" role="alert"><p>{fatal}</p><button onClick={onClose}>Volver al editor 2D</button></div>}
 {panel&&<aside className="model-properties" aria-label="Propiedades del modelo"><div className="model-property-title"><strong>{wall?'Muro '+(plan.walls.indexOf(wall)+1):opening?opening.kind==='door'?'Puerta':'Ventana':surface?surface.name:furniture?furnitureName(furniture.kind):'Niveles y alturas'}</strong><button aria-label="Cerrar propiedades 3D" onClick={()=>setPanel(false)}>×</button></div>
 <p>{floor.name} · Nivel {level.toFixed(2)} m</p>
 <div className="model-visibility"><button aria-pressed={slabs} onClick={()=>setSlabs(v=>!v)}>{slabs?'Ocultar losas':'Mostrar losas'}</button><button aria-pressed={roofs} onClick={()=>setRoofs(v=>!v)}>{roofs?'Ocultar cubiertas':'Mostrar cubiertas'}</button></div>
 <label>Elemento de {floor.name}<select aria-label="Elemento del modelo" value={wall||opening||surface||furniture?selected:''} onChange={e=>select(e.target.value)}><option value="">Nivel y altura general</option>{plan.walls.map((w,i)=><option key={w.id} value={w.id}>Muro {i+1} · {wallHeight(plan,w).toFixed(2)} m</option>)}{plan.openings.map((o,i)=><option key={o.id} value={o.id}>{o.kind==='door'?'Puerta':'Ventana'} {i+1} · {openingHeight(o).toFixed(2)} m</option>)}{plan.surfaces.map(s=><option key={s.id} value={s.id}>Superficie · {s.name}</option>)}{plan.furniture.filter(f=>isFurniture3D(f.kind)).map((f,i)=><option key={f.id} value={f.id}>{furnitureName(f.kind)} {i+1}</option>)}</select></label>
 {furniture?.kind==='person'&&<><button className="person-observe" disabled={hasPreview||!ready||!!fatal} onClick={startWalking}>Controlar persona</button><button className="person-observe" disabled={hasPreview||!ready||!!fatal} onClick={observe}>Ver desde aquí</button></>}
 <div className="appearance-tabs" role="group" aria-label="Edición del elemento"><button aria-pressed={inspector==='geometry'} onClick={()=>setInspector('geometry')}>Medidas</button><button aria-pressed={inspector==='appearance'} onClick={()=>setInspector('appearance')}>Color y acabado</button></div>
 {inspector==='appearance'&&<>{surface?.slab&&surface.roof&&<label>Elemento a colorear<select aria-label="Elemento a colorear" value={target?.kind??'slab'} onChange={e=>setPlateTarget(e.target.value as 'slab'|'roof')}><option value="slab">Losa de piso</option><option value="roof">Cubierta / techo</option></select></label>}{target?<><p>{target.kind==='slab'?'Acabado de la losa de piso':target.kind==='roof'?'Acabado de la cubierta':'Acabado del elemento seleccionado'}</p>{(target.kind==='slab'&&!slabs||target.kind==='roof'&&!roofs||target.kind==='furniture'&&!showFurniture)&&<p>Este elemento está oculto. Activá su visibilidad para ver el acabado.</p>}<AppearanceControls key={targetKey+JSON.stringify(appearance)} revision={plan} value={appearance} fallback={fallback} furniture={!!furniture} onPreview={appearance=>setPreview({key:targetKey,appearance})} onCancel={()=>setPreview(null)} onApply={appearance=>{change(withAppearance(plan,target,appearance));setPreview(null);}}/></>:<p>Seleccioná un muro, un mueble o una superficie con losa o cubierta para cambiar su aspecto.</p>}</>}
 <div hidden={inspector!=='geometry'}>
 {wall?<><p>{distance(wall.a,wall.b).toFixed(2)} m de largo · {(wallThickness(wall)*100).toFixed(0)} cm de espesor</p><WallHeightControls key={floor.id+wall.id+'-'+wallHeight(plan,wall)} plan={plan} wall={wall} onChange={height=>change({...plan,walls:plan.walls.map(w=>w.id===wall.id?{...w,height}:w)})}/></>:opening?<><p>{opening.width.toFixed(2)} m de ancho · hueco en el muro</p><OpeningHeightControls key={floor.id+opening.id+'-'+openingHeight(opening)+'-'+openingSill(opening)} opening={opening} onChange={(height,sill)=>change({...plan,openings:plan.openings.map(o=>o.id===opening.id?{...o,height,sill}:o)})}/></>:surface?<><p>{surfaceArea(surface.points).toFixed(2)} m² · contorno manual</p><SlabControls key={floor.id+surface.id+JSON.stringify([surface.slab,surface.roof])} surface={surface} plan={plan} onChange={(slab,roof)=>change({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,slab,roof}:s)})}/><HoleControls key={floor.id+surface.id} surface={surface} onChange={holes=>change({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,holes}:s)})} onDraw={target=>onHole(surface.id,target)}/></>:furniture?<><p>{furniture.width.toFixed(2)} × {furniture.depth.toFixed(2)} m · Giro {furniture.rotation}°</p>{furniture.kind==='person'?<PersonControls key={floor.id+furniture.id+JSON.stringify([furniture.height,furniture.rotation,furniture.elevation])} item={furniture} onChange={item=>change({...plan,furniture:plan.furniture.map(f=>f.id===item.id?item:f)})}/>:<FurnitureHeightControls key={floor.id+furniture.id+JSON.stringify([furniture.height,furniture.elevation])} item={furniture} onChange={item=>change({...plan,furniture:plan.furniture.map(f=>f.id===item.id?item:f)})}/>}<button onClick={()=>onFurniture(furniture.id)}>{furniture.kind==='person'?'Ubicar persona en planta':'Editar mueble en planta'}</button>{furniture.groupId&&<small>Forma parte de un grupo. En planta podés mover el conjunto o desagruparlo.</small>}</>:<>
 <LevelControls key={floor.id+'-'+floor.elevation+'-'+level} floor={floor} level={level} onChange={changeLevel}/>
 <GeneralHeightControls key={floor.id+'-'+(plan.wallHeight??2.8)} plan={plan} onChange={wallHeight=>change({...plan,wallHeight})}/>
 <p>Para crear losas y cubiertas, dibujá una superficie en 2D y elegila en Elemento.</p><button onClick={onSurface}>Dibujar contorno en planta</button><button onClick={onPerson}>Agregar persona en planta</button>
 </>}
 </div>
 <div className="model-files"><button disabled={hasPreview} onClick={onSave}>Descargar proyecto editable</button><button disabled={hasPreview||busy||!ready||!!fatal||(!hasGeometry&&!eyes)} onClick={()=>void png()}>{busy?'Preparando imagen…':'Descargar vista PNG'}</button></div>{building.floors.some(f=>(scope==='all'||f.id===floor.id)&&f.plan.furniture.some(i=>!isFurniture3D(i.kind)))&&<p>Las escaleras y descansos se muestran solo en la planta 2D.</p>}<small>Muros, aberturas, losas, cubiertas y mobiliario. Las alturas se miden desde el piso de cada planta. Los huecos se dibujan en la planta y recortan el elemento elegido. Los contornos no siguen los muros automáticamente.</small>
 </aside>}
 </div>
 {error&&<div className="model-error" role="alert">{error}<button aria-label="Cerrar error" onClick={()=>setError('')}>×</button></div>}
 <footer>{walking?'WASD o flechas para caminar · Arrastrá para mirar · Esc para terminar · Movimiento temporal':eyes?'Vista fija · Arrastrá para mirar · Flechas con el lienzo enfocado · Esc para volver':mode==='3d'?'Arrastrá para girar · Rueda o dos dedos para zoom · Botón derecho para mover':'Fachada sin perspectiva · Arrastrá para mover · Rueda o dos dedos para zoom'}<span>{scope==='all'?building.floors.length+' plantas':'Planta activa'} · {floor.name}: {level.toFixed(2)} m · Frente: borde inferior del plano.</span></footer>
 </section>;
}
