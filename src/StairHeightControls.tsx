import {useState} from 'react';
import type {Furniture} from './model';
import {stairStepCount} from './stairGeometry';
import './heightControls.css';
export function StairHeightControls({item,nextLevel,onChange}:{item:Furniture;nextLevel?:number;onChange:(item:Furniture)=>void}){
 const landing=item.kind==='stairLanding';
 const [height,setHeight]=useState(String(item.height??(landing?.2:3))),[level,setLevel]=useState(String((item.elevation??0)+(landing?(item.height??.2):0))),[error,setError]=useState('');
 const number=(s:string)=>s.trim()?Number(s.replace(',','.')):NaN;
 const h=number(height),l=number(level),steps=stairStepCount(h);
 function apply(){const base=landing?l-h:l;if(!Number.isFinite(h)||h<.1||h>20||!Number.isFinite(base)||base<0||base>20){setError(landing?'El espesor debe estar entre 0,10 y 20 m. El nivel superior debe alcanzar al menos ese espesor.':'Usá una altura entre 0,10 y 20 m y un nivel de arranque entre 0 y 20 m.');return;}setError('');onChange({...item,height:h,elevation:base});}
 return <form className="height-controls" onSubmit={e=>{e.preventDefault();apply();}}>
 <p>{item.height===undefined?'Este símbolo aún no tiene volumen 3D. Aplicá sus alturas para activarlo.':landing?'Plataforma horizontal para unir tramos.':'La flecha del plano indica el sentido de subida.'}</p>
 <label>{landing?'Nivel superior del descanso (m)':'Nivel de arranque del tramo (m)'}<input aria-label={landing?'Nivel superior del descanso':'Nivel de arranque del tramo'} inputMode="decimal" value={level} onChange={e=>setLevel(e.target.value)}/></label>
 <label>{landing?'Espesor del descanso (m)':'Altura a subir (m)'}<input aria-label={landing?'Espesor del descanso':'Altura a subir'} inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label>
 {!landing&&Number.isFinite(h)&&h>=.1&&h<=20&&<small>{steps} peldaños · huella {(item.depth/steps*100).toFixed(1)} cm · contrahuella {(h/steps*100).toFixed(1)} cm. Llegada a {(l+h).toFixed(2)} m.</small>}
 {nextLevel!==undefined&&<button type="button" onClick={()=>{if(landing)setLevel(String(nextLevel));else setHeight(String(Math.round((nextLevel-l)*1000)/1000));setError('');}}>Usar nivel de la planta siguiente</button>}
 <button className="apply">Aplicar escalera 3D</button>
 {item.height!==undefined&&<button type="button" onClick={()=>{const {height:_,elevation:__,...rest}=item;onChange(rest);}}>Dejar solo símbolo 2D</button>}
 <small>Niveles relativos al piso de esta planta. Para conectar plantas, la llegada debe coincidir con la losa superior y tener un hueco libre. Peldaños orientativos; no es un cálculo constructivo.</small>
 {error&&<small role="alert">{error}</small>}
 </form>;
}
