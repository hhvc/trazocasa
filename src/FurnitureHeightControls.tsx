import {useState} from 'react';
import type {Furniture} from './model';
import {furnitureHeight,isFurniture3D} from './furnitureHeights';
import './heightControls.css';
export function FurnitureHeightControls({item,onChange}:{item:Furniture;onChange:(item:Furniture)=>void}){
 const [height,setHeight]=useState(String(furnitureHeight(item))),[elevation,setElevation]=useState(String(item.elevation??0)),[error,setError]=useState('');
 if(!isFurniture3D(item.kind))return null;
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();const h=height.trim()?Number(height.replace(',','.')):NaN,b=elevation.trim()?Number(elevation.replace(',','.')):NaN;if(!Number.isFinite(h)||h<.1||h>20||!Number.isFinite(b)||b<0||b>20){setError('Usá una altura entre 0,10 y 20 m y una elevación entre 0 y 20 m.');return;}setError('');onChange({...item,height:h,elevation:b});}}><label>Altura total 3D (m)<input aria-label="Altura del mueble 3D" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label><label>Elevación sobre el piso (m)<input aria-label="Elevación del mueble" inputMode="decimal" value={elevation} onChange={e=>setElevation(e.target.value)}/></label><button className="apply">Aplicar alturas 3D</button>{(item.height!==undefined||item.elevation!==undefined)&&<button type="button" onClick={()=>{const {height:_,elevation:__,...next}=item;setHeight(String(furnitureHeight(next)));setElevation('0');setError('');onChange(next);}}>Restablecer alturas iniciales</button>}<small>Volumen orientativo. La altura incluye patas, respaldo o copa; la elevación indica dónde empieza el objeto.</small>{error&&<small role="alert">{error}</small>}</form>;
}
