import { useState } from 'react';
import { dimensionGeometry } from './model';
import type { Dimension } from './model';

export function DimensionShape({item,selected=false,zoom=1}:{item:Dimension;selected?:boolean;zoom?:number}) {
  const g=dimensionGeometry(item), color='#65796f';
  return <g data-id={item.id} aria-label={`Cota · ${g.length.toFixed(2)} m`}>
    {(['a','b'] as const).map(end=><line key={end} x1={item[end].x} y1={item[end].y} x2={g[end].x} y2={g[end].y} stroke={color} strokeWidth=".018" strokeDasharray=".05 .04"/>)}
    <g transform={`translate(${g.label.x} ${g.label.y}) rotate(${g.angle})`}>
      <line x1={-g.length/2} x2={g.length/2} y1="0" y2="0" stroke={color} strokeWidth=".025"/>
      {[-1,1].map(sign=><line key={sign} x1={sign*g.length/2-.07} y1=".1" x2={sign*g.length/2+.07} y2="-.1" stroke={color} strokeWidth=".025"/>)}
      <line data-editor="true" x1={-g.length/2} x2={g.length/2} y1="0" y2="0" stroke={selected?'#b97c49':'transparent'} opacity=".25" strokeWidth={.25/zoom}/>
      <rect x="-.65" y="-.34" width="1.3" height=".28" rx=".04" fill="#faf9f5"/>
      <text textAnchor="middle" y="-.12" fontFamily="Arial,sans-serif" fontSize=".2" fill={color}>{g.length.toFixed(2)} m</text>
    </g>
    {selected && <g data-editor="true">{(['a','b'] as const).map(end=><g key={end} data-endpoint={end}><title>Extremo {end.toUpperCase()} de cota</title><circle cx={item[end].x} cy={item[end].y} r={.2/zoom} fill="transparent"/><circle cx={item[end].x} cy={item[end].y} r={.07/zoom} fill="white" stroke="#b97c49" strokeWidth={.025/zoom}/><text x={item[end].x} y={item[end].y-.18/zoom} textAnchor="middle" fontSize={.15/zoom} fill="#9b663b" pointerEvents="none">{end.toUpperCase()}</text></g>)}</g>}
  </g>;
}
export function DimensionControls({item,onChange}:{item:Dimension;onChange:(offset:number)=>void}) {
  const [value,setValue]=useState(item.offset.toFixed(2));
  return <div><p>Distancia: <strong>{dimensionGeometry(item).length.toFixed(2)} m</strong></p><form onSubmit={e=>{e.preventDefault();onChange(value.trim()?Number(value.replace(',','.')):NaN);}}><label htmlFor="dimension-offset">Separación de la línea (m)</label><div className="measure-input"><input id="dimension-offset" inputMode="decimal" required value={value} onChange={e=>setValue(e.target.value)}/></div><button className="apply" type="submit">Aplicar separación</button></form><p>Usá un valor negativo para ubicarla al otro lado.</p></div>;
}
