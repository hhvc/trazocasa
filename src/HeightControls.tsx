import './heightControls.css';
import {useState} from 'react';
import {openingHeight,openingSill,wallHeight,wallRoofProfile,effectiveWallHeight} from './model';
import type {Plan,Wall,Opening} from './model';
const number=(s:string)=>s.trim()?Number(s.replace(',','.')):NaN;
export function WallHeightControls({plan,wall,onChange}:{plan:Plan;wall:Wall;onChange:(height?:number)=>void}){
 const [value,setValue]=useState(String(wallHeight(plan,wall))),followsRoof=wallRoofProfile(plan,wall).some(s=>s.planes?.length); 
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();onChange(number(value));}}>{followsRoof&&<small>Este muro sigue la cubierta, hasta {effectiveWallHeight(plan,wall).toFixed(2)} m. La altura base se usa fuera del techo. Para una terminación horizontal, desactivá Ajustar muros a la cubierta en Losas y techos.</small>}<label>Altura {followsRoof?'base ':''}del muro (m)<input aria-label="Altura del muro" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label><button className="apply">Aplicar altura</button>{wall.height!==undefined?<button type="button" onClick={()=>onChange(undefined)}>Usar altura general</button>:<small>Usa la altura general de esta planta.</small>}</form>;
}
export function OpeningHeightControls({opening,onChange}:{opening:Opening;onChange:(height:number,sill:number)=>void}){
 const [height,setHeight]=useState(String(openingHeight(opening))),[sill,setSill]=useState(String(openingSill(opening)));
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();onChange(number(height),opening.kind==='door'?0:number(sill));}}><label>Altura de {opening.kind==='door'?'puerta':'ventana'} (m)<input aria-label="Altura de abertura" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label>{opening.kind==='window'&&<label>Antepecho desde el piso (m)<input aria-label="Antepecho" inputMode="decimal" value={sill} onChange={e=>setSill(e.target.value)}/></label>}<button className="apply">Aplicar alturas</button></form>;
}
export function GeneralHeightControls({plan,onChange}:{plan:Plan;onChange:(value:number)=>void}){
 const [value,setValue]=useState(String(plan.wallHeight??2.8));
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();onChange(number(value));}}><label>Altura general de muros (m)<input aria-label="Altura general de muros" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label><button className="apply">Aplicar a muros sin altura propia</button><small>Las alturas individuales se conservan. Las aberturas deben caber dentro de sus muros.</small></form>;
}
