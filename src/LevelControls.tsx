import {useState} from 'react';
import type {Floor,Plan,Surface,Slab,FlatRoof,RoofShape} from './model';
import './heightControls.css';
import {validatePlan,roofHeightRange} from './model';
const number=(value:string)=>value.trim()?Number(value.replace(',','.')):NaN;
export function LevelControls({floor,level,onChange}:{floor:Floor;level:number;onChange:(elevation?:number)=>void}){
 const [value,setValue]=useState(String(Number(level.toFixed(3))));
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();onChange(number(value));}}>
 <label>Nivel de piso (m)<input aria-label="Nivel de piso" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label>
 <button>Aplicar nivel de piso</button>{floor.elevation!==undefined&&<button type="button" onClick={()=>onChange(undefined)}>Usar nivel automático</button>}
 <small>{floor.elevation===undefined?'Nivel automático. ':'Nivel manual. '}La primera planta parte de 0 m. Las siguientes se apoyan sobre la altura mayor de muros de la anterior, más el espesor de losa (mínimo 20 cm). Los niveles manuales quedan fijos.</small></form>;
}
export function SlabControls({surface,plan,onChange}:{surface:Surface;plan:Plan;onChange:(slab:Slab|undefined,roof:FlatRoof|undefined)=>void}){
 const [floor,setFloor]=useState(!!surface.slab),[roof,setRoof]=useState(!!surface.roof);
 const [thickness,setThickness]=useState(String(surface.slab?.thickness??.2)),[roofThickness,setRoofThickness]=useState(String(surface.roof?.thickness??.2)),[height,setHeight]=useState(String(surface.roof?.height??plan.wallHeight??2.8));
 const [kind,setKind]=useState<RoofShape['kind']|'flat'>(surface.roof?.shape?.kind??'flat'),[slope,setSlope]=useState(String(surface.roof?.shape?.slope??30)),[direction,setDirection]=useState(String(surface.roof?.shape?.direction??0)),[fitWalls,setFitWalls]=useState(surface.roof?.fitWalls??false),[error,setError]=useState('');
 const range=surface.roof?roofHeightRange(surface):null;
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();try{
  const slab=floor?{...surface.slab,thickness:number(thickness)}:undefined;
  const nextRoof:FlatRoof|undefined=roof?{...(surface.roof?.appearance?{appearance:surface.roof.appearance}:{}),thickness:number(roofThickness),height:number(height),fitWalls,...(kind!=='flat'?{shape:{kind,slope:number(slope),direction:kind==='perimeter'?0:number(direction)}}:{})}:undefined;
  validatePlan({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,slab,roof:nextRoof}:s)});onChange(slab,nextRoof);setError('');
 }catch(e){setError((e as Error).message);}}}>
 <strong>Losa y techo de este contorno</strong>
 <label className="plate-toggle"><input type="checkbox" checked={floor} onChange={e=>setFloor(e.target.checked)}/>Losa de piso</label>
 {floor&&<label>Espesor de losa (m)<input aria-label="Espesor de losa" inputMode="decimal" value={thickness} onChange={e=>setThickness(e.target.value)}/></label>}
 <label className="plate-toggle"><input type="checkbox" checked={roof} onChange={e=>setRoof(e.target.checked)}/>Cubierta / techo</label>
 {roof&&<><label>Forma del techo<select aria-label="Forma del techo" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="flat">Plano</option><option value="shed">Un agua</option><option value="gable">Dos aguas</option><option value="halfHip">Tres aguas</option><option value="hip">Cuatro aguas</option><option value="perimeter">Varias aguas · una por lado</option></select></label>
 <label>{kind==='flat'?'Altura inferior de cubierta (m)':'Altura del alero inferior (m)'}<input aria-label="Altura inferior de cubierta" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label>
 {kind!=='flat'&&<><label>Pendiente (%)<input aria-label="Pendiente del techo" inputMode="decimal" value={slope} onChange={e=>setSlope(e.target.value)}/></label><small>30 % significa subir 30 cm por cada metro horizontal.</small>{kind!=='perimeter'?<label>Orientación (°)<input aria-label="Orientación del techo" inputMode="decimal" value={direction} onChange={e=>setDirection(e.target.value)}/><small>0°: sube hacia la derecha del plano. 90°: hacia abajo. En dos o más aguas, orienta el par de pendientes principal.</small></label>:<small>Una pendiente hacia adentro por cada lado: pentágono para 5 aguas, hexágono para 6, etc. Requiere contorno convexo; para formas en L o U, combiná paños separados.</small>}</>}
 <label>Espesor vertical del techo (m)<input aria-label="Espesor de cubierta" inputMode="decimal" value={roofThickness} onChange={e=>setRoofThickness(e.target.value)}/></label>
 <label className="plate-toggle"><input type="checkbox" checked={fitWalls} onChange={e=>setFitWalls(e.target.checked)}/>Ajustar muros a la cubierta</label><small>Los muros bajo este contorno terminan en la cara inferior del techo, incluso en los hastiales. Fuera del contorno o bajo un hueco conservan su altura. Si dos techos se superponen, manda el inferior.</small></>}
 {error&&<p role="alert" className="roof-error">{error}</p>}
 <button>Aplicar losa y techo</button>{range&&<small>Techo aplicado: {range[0].toFixed(2)} a {range[1].toFixed(2)} m sobre este piso (cara inferior).</small>}
 <small>La losa termina al nivel del piso. Dibujá cada contorno incluyendo el alero deseado. Los contornos no siguen los cambios de muros. Sin cálculo estructural.</small></form>;
}
