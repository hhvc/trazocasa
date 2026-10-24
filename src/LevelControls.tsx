import {useState} from 'react';
import type {Floor,Plan,Surface,Slab,FlatRoof} from './model';
import './heightControls.css';
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
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();onChange(floor?{thickness:number(thickness)}:undefined,roof?{thickness:number(roofThickness),height:number(height)}:undefined);}}>
 <strong>Losa y cubierta de este contorno</strong>
 <label className="plate-toggle"><input type="checkbox" checked={floor} onChange={e=>setFloor(e.target.checked)}/>Losa de piso</label>
 {floor&&<label>Espesor de losa (m)<input aria-label="Espesor de losa" inputMode="decimal" value={thickness} onChange={e=>setThickness(e.target.value)}/></label>}
 <label className="plate-toggle"><input type="checkbox" checked={roof} onChange={e=>setRoof(e.target.checked)}/>Cubierta plana</label>
 {roof&&<><label>Altura inferior de cubierta (m)<input aria-label="Altura inferior de cubierta" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label><label>Espesor de cubierta (m)<input aria-label="Espesor de cubierta" inputMode="decimal" value={roofThickness} onChange={e=>setRoofThickness(e.target.value)}/></label></>}
 <button>Aplicar losa y cubierta</button><small>La losa termina al nivel del piso. La cubierta empieza a la altura indicada sobre ese piso. Ambas siguen este contorno; modificá sus vértices en 2D. Sin huecos de escalera ni cálculo estructural.</small></form>;
}
