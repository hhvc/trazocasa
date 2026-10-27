import {useState} from 'react';
import type {Furniture} from './model';
import {furnitureHeight} from './furnitureHeights';
import {personDimensions} from './personView';
export function PersonControls({item,onChange}:{item:Furniture;onChange:(item:Furniture)=>void}){
 const [height,setHeight]=useState(furnitureHeight(item).toFixed(2)),[rotation,setRotation]=useState(String(item.rotation)),[elevation,setElevation]=useState(String(item.elevation??0)),[error,setError]=useState('');
 function submit(e:React.FormEvent){
  e.preventDefault();const values=[height,rotation,elevation],numbers=values.map(v=>Number(v.replace(',','.'))),[h,r,b]=numbers;
  if(values.some(v=>!v.trim())||!numbers.every(Number.isFinite)||h<.5||h>2.5||Math.abs(r)>3600||b<0||b>20){setError('Usá una estatura entre 0,50 y 2,50 m, un ángulo válido y una elevación de 0 a 20 m.');return;}
  onChange({...item,height:h,rotation:((r%360)+360)%360,elevation:b,...personDimensions(h)});setError('');
 }
 return <form className="height-controls" onSubmit={submit}>
  <label>Estatura (m)<input aria-label="Estatura de la persona" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label>
  <label>Orientación (°)<input aria-label="Orientación de la persona" inputMode="decimal" value={rotation} onChange={e=>setRotation(e.target.value)}/></label>
  <label>Elevación sobre el piso (m)<input aria-label="Elevación de la persona" inputMode="decimal" value={elevation} onChange={e=>setElevation(e.target.value)}/></label>
  <small>La flecha en planta indica hacia dónde mira. El cuerpo mantiene sus proporciones al cambiar la estatura.</small>
  {error&&<small role="alert">{error}</small>}<button className="apply" type="submit">Aplicar a la persona</button>
 </form>;
}
