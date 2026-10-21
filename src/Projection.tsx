import type {Projection} from './model';
export function ProjectionShape({item,selected,zoom}:{item:Projection;selected:boolean;zoom:number}){
 const points=item.points.map(p=>`${p.x},${p.y}`).join(' '),path=item.closed?points+' '+`${item.points[0].x},${item.points[0].y}`:points;
 return <g data-id={item.id} aria-label={`Proyección ${item.name||'sin nombre'}`}>
 <polyline points={path} fill="none" stroke="#687886" strokeWidth=".035" strokeDasharray=".18 .12" strokeLinejoin="round"/>
 <polyline data-editor="true" points={path} fill="none" stroke="transparent" strokeWidth={.28/zoom}/>
 {item.name&&<text x={item.points[0].x} y={item.points[0].y-.2} textAnchor="middle" fontSize=".2" fill="#687886">{item.name}</text>}
 {selected&&item.points.map((p,i)=><circle data-editor="true" data-vertex={i} key={i} cx={p.x} cy={p.y} r={.1/zoom} fill="#fffefa" stroke="#b97c49" strokeWidth={.02/zoom}/>)}
 </g>;
}
