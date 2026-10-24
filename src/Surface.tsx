import { useState } from 'react';
import { surfaceArea, surfaceLabel, plateHoles } from './model';
import type { Point, Surface } from './model';

export function SurfaceFill({item}:{item:Surface}) {
  const path=[item.points,...plateHoles(item,'slab')].map(points=>'M'+points.map(p=>`${p.x},${p.y}`).join('L')+'Z').join(' ');
  return <path data-id={item.id} d={path} fillRule="evenodd" fill="#e4eadc" fillOpacity=".45" stroke="#91a185" strokeWidth=".025" strokeDasharray=".12 .08"/>;
}
export function SurfaceAnnotation({item,selected,zoom}:{item:Surface;selected:boolean;zoom:number}) {
  const c=surfaceLabel(item.points,(item.holes??[]).map(h=>h.points)), half=Math.max(.8,item.name.length*.065);
  return <g data-id={item.id} aria-label={`Superficie ${item.name}: ${surfaceArea(item.points).toFixed(2)} m²`}>
    <g transform={`translate(${c.x} ${c.y})`}>
      <rect x={-half} y="-.32" width={half*2} height=".65" rx=".09" fill="#f3f5eb"/>
      <text textAnchor="middle" y="-.06" fontSize=".22" fontFamily="Arial,sans-serif" fill="#425c48">{item.name}</text>
      <text textAnchor="middle" y=".22" fontSize=".2" fontFamily="Arial,sans-serif" fill="#65795c">{surfaceArea(item.points).toFixed(2)} m²</text>
    </g>
    {selected && <g data-editor="true"><polygon points={item.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#b97c49" strokeWidth={.025/zoom} pointerEvents="none"/>{item.points.map((p,i)=><g key={i} data-vertex={i}><title>Vértice {i+1}</title><circle cx={p.x} cy={p.y} r={.2/zoom} fill="transparent"/><circle cx={p.x} cy={p.y} r={.065/zoom} fill="white" stroke="#b97c49" strokeWidth={.025/zoom}/></g>)}</g>}
  </g>;
}
export function SurfacePreview({points,cursor}:{points:Point[];cursor:Point|null}) {
  const line=cursor?[...points,cursor]:points;
  return <g data-editor="true" pointerEvents="none"><polyline points={line.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#b97c49" strokeWidth=".04" strokeDasharray=".1 .07"/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===0?.1:.05} fill={i===0?'#295246':'#b97c49'}/>)}{points.length>2&&cursor&&<line x1={cursor.x} y1={cursor.y} x2={points[0].x} y2={points[0].y} stroke="#91a185" strokeWidth=".025" strokeDasharray=".08 .08"/>}</g>;
}
export function SurfaceControls({item,onRename}:{item:Surface;onRename:(name:string)=>void}) {
  const [name,setName]=useState(item.name);
  return <div><p>Superficie: <strong>{surfaceArea(item.points).toFixed(2)} m²</strong></p><form onSubmit={e=>{e.preventDefault();onRename(name.trim()||'Ambiente');}}><label htmlFor="surface-name">Nombre de la superficie</label><div className="measure-input"><input id="surface-name" maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></div><button className="apply" type="submit">Aplicar nombre</button></form><p>{item.points.length} vértices · contorno manual</p></div>;
}

export function HoleShapes({item,selectedId,zoom}:{item:Surface;selectedId:string|null;zoom:number}){
 return <>{(item.holes??[]).map(h=>{const c=surfaceLabel(h.points),selected=selectedId===h.id;return <g key={h.id} data-id={item.id} data-hole={h.id} aria-label={'Hueco '+h.name}>
 <polygon points={h.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="transparent" stroke="#8a6c54" strokeWidth=".03" strokeDasharray=".12 .08"/>
 <text x={c.x} y={c.y} textAnchor="middle" fontSize=".16" fill="#7d5d40">{h.name} · {h.target==='both'?'Losa / cubierta':h.target==='slab'?'Losa':'Cubierta'}</text>
 {selected&&<g data-editor="true"><polygon points={h.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#b97c49" strokeWidth={.03/zoom} pointerEvents="none"/>{h.points.map((p,i)=><g key={i} data-vertex={i}><title>Vértice {i+1} del hueco</title><circle cx={p.x} cy={p.y} r={.2/zoom} fill="transparent"/><circle cx={p.x} cy={p.y} r={.07/zoom} fill="white" stroke="#b97c49" strokeWidth={.025/zoom}/></g>)}</g>}
 </g>;})}</>;
}
