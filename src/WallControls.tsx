import { useState } from 'react';
import { Scissors } from 'lucide-react';
import { distance, wallThickness } from './model';
import type { Wall } from './model';
export function WallControls({wall,onThickness,onSplit,onError}:{wall:Wall;onThickness:(value:number)=>void;onSplit:(at:number)=>void;onError:(message:string)=>void}) {
  const [thickness,setThickness]=useState(String(Number((wallThickness(wall)*100).toFixed(2))));
  const [cut,setCut]=useState((distance(wall.a,wall.b)/2).toFixed(2));
  return <div className="wall-controls"><form onSubmit={e=>{e.preventDefault();const value=Number(thickness.replace(',','.'));if(!Number.isFinite(value)||value<5||value>60){onError('El espesor debe estar entre 5 y 60 cm.');return;}onThickness(value/100);}}><label>Espesor (cm)<input aria-label="Espesor de la pared" inputMode="decimal" value={thickness} onChange={e=>setThickness(e.target.value)}/></label><button className="apply">Aplicar espesor</button></form><form onSubmit={e=>{e.preventDefault();onSplit(Number(cut.replace(',','.')));}}><label>Dividir a (m desde A)<input aria-label="Distancia de corte desde A" inputMode="decimal" value={cut} onChange={e=>setCut(e.target.value)}/></label><button className="apply"><Scissors size={15}/>Dividir pared</button></form><p>Arrastrá los círculos A y B para mover los extremos. Las paredes conectadas acompañan el cambio.</p></div>;
}
