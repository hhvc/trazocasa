import { useState } from 'react';
import { frontReference, planBounds } from './model';
import type { Building, DrawingView, Plan, ViewGuides, Point } from './model';

export function draftingBounds(plan:Plan,source?:Plan,levels:number[]=[]){
 const b=planBounds(plan);if(!source)return b;
 const r=frontReference(source);
 const xs=[b.x,b.x+b.width,...r.anchors.map(p=>p.x)];
 const ys=[b.y,b.y+b.height,0,-3,...levels.map(h=>-h),...r.anchors.map(p=>p.y+r.shift)];
 const x=Math.min(...xs)-1,y=Math.min(...ys)-1;
 return {x,y,width:Math.max(...xs)-x+1,height:Math.max(...ys)-y+1};
}
export function snapToGuides(p:Point,source:Plan,levels:number[],tolerance:number):Point{
 const axes=frontReference(source).axes;
 const closest=(value:number,candidates:number[])=>candidates.reduce((best,n)=>Math.abs(n-value)<Math.abs(best-value)?n:best,Infinity);
 const x=closest(p.x,axes),y=closest(p.y,[0,...levels.map(h=>-h)]);
 return {x:Math.abs(x-p.x)<=tolerance?x:Math.round(p.x*10)/10,y:Math.abs(y-p.y)<=tolerance?y:Math.round(p.y*10)/10};
}
export function FrontGuideControls({building,view,onChange,disabled}:{building:Building;view:DrawingView;onChange:(g?:ViewGuides)=>void;disabled:boolean}){
 const [height,setHeight]=useState('2.80'),[error,setError]=useState('');
 const guides=view.guides;
 return <details className="front-guide-controls"><summary>Proyectar desde la planta · Frente</summary><div className="views-bar">
 <label>Planta de referencia<select disabled={disabled} value={guides?.floorId??''} onChange={e=>onChange(e.target.value?{floorId:e.target.value,visible:true,levels:guides?.levels??[0,.9,2.1,2.8]}:undefined)}><option value="">Sin planta de referencia</option>{building.floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
 {guides&&<><button disabled={disabled} aria-pressed={guides.visible} onClick={()=>onChange({...guides,visible:!guides.visible})}>{guides.visible?'Ocultar planta y guías':'Mostrar planta y guías'}</button><form onSubmit={e=>{e.preventDefault();const h=Number(height.replace(',','.'));if(!height.trim()||!Number.isFinite(h)||h< -100||h>100){setError('Ingresá una altura entre -100 y 100 m.');return;}if(guides.levels.length>=30){setError('Máximo 30 niveles.');return;}onChange({...guides,levels:[...guides.levels,h]});setError('');}}><label>Altura de nivel (m)<input inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label><button disabled={disabled}>Agregar nivel</button></form></>}
 </div>{guides&&<div className="views-bar">{guides.levels.map(h=><button key={h} disabled={disabled} aria-label={`Quitar nivel ${h.toFixed(2)} m`} onClick={()=>onChange({...guides,levels:guides.levels.filter(n=>n!==h)})}>{h>=0?'+':''}{h.toFixed(2)} m ×</button>)}</div>}
 <small>Frente mirando hacia arriba de la planta. La planta queda bloqueada debajo del nivel 0. Las guías se actualizan al modificarla; los trazos de la vista conservan su posición. Alt desactiva el ajuste a guías. No se calculan alturas ni visibilidad de elementos automáticamente.</small>{error&&<p role="alert">{error}</p>}</details>;
}
export function FrontGuideDrawing({source,name,levels,box}:{source:Plan;name:string;levels:number[];box:{x:number;y:number;width:number;height:number}}){
 const r=frontReference(source);
 return <g data-editor="true" pointerEvents="none" aria-label={`Referencia bloqueada: ${name}`}>
 {r.axes.map(x=><line key={x} x1={x} x2={x} y1={Math.min(box.y,-3,...levels.map(h=>-h))} y2={Math.max(3,...r.anchors.filter(p=>p.x===x).map(p=>p.y+r.shift))} stroke="#8daca0" strokeWidth=".015" strokeDasharray=".10 .10"/>)}
 {[...new Set([0,...levels])].map(h=><g key={h}><line x1={box.x} x2={box.x+box.width} y1={-h} y2={-h} stroke="#b58957" strokeWidth=".02" strokeDasharray=".18 .12"/><text x={box.x+.1} y={-h-.08} fontSize=".18" fill="#8a603b">{h>=0?'+':''}{h.toFixed(2)} m</text></g>)}
 <g transform={`translate(0 ${r.shift})`} opacity=".6">
 {r.walls.map(w=><line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="#65796f" strokeWidth=".10"/>)}
 {r.openings.map(o=><g key={o.id}><line x1={o.a.x} y1={o.a.y} x2={o.b.x} y2={o.b.y} stroke="#faf9f5" strokeWidth=".13"/><line x1={o.a.x} y1={o.a.y} x2={o.b.x} y2={o.b.y} stroke={o.kind==='door'?'#ae8054':'#468baf'} strokeWidth=".035"/></g>)}
 {r.anchors.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".045" fill="#65796f"/>)}
 </g><text x={r.axes[0]??0} y="2.5" fontSize=".22" fill="#65796f">{name} · referencia bloqueada</text>
 </g>;
}
