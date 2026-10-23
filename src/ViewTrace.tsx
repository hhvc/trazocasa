import { useState } from 'react';
import { distance } from './model';
import type { Projection } from './model';
export function ViewTrace({item,selected,zoom}:{item:Projection;selected:boolean;zoom:number}) {
 const points=[...item.points,...(item.closed?[item.points[0]]:[])].map(p=>`${p.x},${p.y}`).join(' ');
 return <g data-id={item.id} aria-label={item.closed?'Contorno de vista':'Línea de vista'}>
 <polyline points={points} fill="none" stroke="#354b40" strokeWidth=".035"/>
 <polyline data-editor="true" points={points} fill="none" stroke={selected?'#c98b45':'transparent'} strokeOpacity=".4" strokeWidth={.28/zoom}/>
 {selected&&<g data-editor="true">{item.points.map((p,i)=><g key={i} data-vertex={i} aria-label={`Vértice ${i+1}`}>
 <circle cx={p.x} cy={p.y} r={.22/zoom} fill="transparent"/><circle cx={p.x} cy={p.y} r={.07/zoom} fill="white" stroke="#b97c49" strokeWidth={.025/zoom}/>
 <text x={p.x} y={p.y-.2/zoom} textAnchor="middle" fontSize={.15/zoom} fill="#9b663b" pointerEvents="none">{item.points.length===2?i===0?'A':'B':i+1}</text></g>)}</g>}
 </g>;
}
export function ViewLineControls({item,onResize,onSplit}:{item:Projection;onResize:(value:number)=>void;onSplit:(value:number)=>void}) {
 const length=distance(item.points[0],item.points[1]);
 const [value,setValue]=useState(length.toFixed(2)),[cut,setCut]=useState((length/2).toFixed(2));
 const number=(s:string)=>s.trim()?Number(s.replace(',','.')):NaN;
 return <><form onSubmit={e=>{e.preventDefault();onResize(number(value));}}><label>Largo de la línea (m)<input aria-label="Largo de la línea" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label><button className="apply">Aplicar medida</button></form>
 <details><summary>Dividir línea</summary><form onSubmit={e=>{e.preventDefault();onSplit(number(cut));}}><label>Distancia desde A (m)<input aria-label="Distancia de corte desde A" inputMode="decimal" value={cut} onChange={e=>setCut(e.target.value)}/></label><button className="apply">Dividir línea</button></form></details>
 <small>El largo conserva A y la dirección. Arrastrá A o B para mover los extremos; los vértices unidos acompañan.</small></>;
}
