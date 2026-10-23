import { dimensionOffset, distance, uid, validatePlan } from './model';
import type { Plan, Point } from './model';
export type ViewEdit = { id:string; kind:'trace'|'vertex'|'label'|'dimension'|'dimensionEndpoint'; vertex?:number; end?:'a'|'b' };
const same=(a:Point,b:Point)=>distance(a,b)<1e-6;
/** Coincident vertices stay joined, without moving unrelated traces. */
function replaceVertices(plan:Plan,changes:{from:Point;to:Point}[]):Plan {
 return validatePlan({...plan,projections:plan.projections?.map(t=>({...t,points:t.points.map(p=>changes.find(c=>same(c.from,p))?.to??p)}))});
}
export function moveViewVertex(plan:Plan,id:string,vertex:number,to:Point):Plan {
 const from=plan.projections?.find(t=>t.id===id)?.points[vertex];
 if(!from)throw new Error('No se encontró el vértice del trazo.');
 return replaceVertices(plan,[{from,to}]);
}
export function resizeViewLine(plan:Plan,id:string,length:number):Plan {
 const t=plan.projections?.find(t=>t.id===id);
 if(!t||t.closed||t.points.length!==2)throw new Error('Seleccioná una línea de dos extremos.');
 if(!Number.isFinite(length)||length<.1||length>100)throw new Error('Ingresá un largo entre 0,10 y 100 metros.');
 const [a,b]=t.points,scale=length/distance(a,b);
 return moveViewVertex(plan,id,1,{x:a.x+(b.x-a.x)*scale,y:a.y+(b.y-a.y)*scale});
}
export function splitViewLine(plan:Plan,id:string,at:number):Plan {
 const t=plan.projections?.find(t=>t.id===id);
 if(!t||t.closed||t.points.length!==2)throw new Error('Seleccioná una línea de dos extremos.');
 const [a,b]=t.points,length=distance(a,b);
 if(!Number.isFinite(at)||at<.1-1e-9||length-at<.1-1e-9)throw new Error('Dejá al menos 10 cm a cada lado del corte.');
 const middle={x:a.x+(b.x-a.x)*at/length,y:a.y+(b.y-a.y)*at/length};
 return validatePlan({...plan,projections:plan.projections!.flatMap(p=>p.id!==id?[p]:[{...p,points:[a,middle]},{...p,id:uid(),points:[middle,b]}])});
}
/** Every drag preview starts from the original geometry. */
export function editView(plan:Plan,edit:ViewEdit,start:Point,target:Point):Plan {
 const dx=target.x-start.x,dy=target.y-start.y;
 if(edit.kind==='vertex')return moveViewVertex(plan,edit.id,edit.vertex!,target);
 if(edit.kind==='trace'){
  const t=plan.projections?.find(t=>t.id===edit.id);
  if(!t)throw new Error('No se encontró el trazo.');
  return replaceVertices(plan,t.points.map(from=>({from,to:{x:from.x+dx,y:from.y+dy}})));
 }
 if(edit.kind==='label')return validatePlan({...plan,labels:plan.labels.map(l=>l.id===edit.id?{...l,x:l.x+dx,y:l.y+dy}:l)});
 return validatePlan({...plan,dimensions:plan.dimensions.map(d=>d.id!==edit.id?d:edit.kind==='dimensionEndpoint'?{...d,[edit.end!]:target}:{...d,offset:d.offset+dimensionOffset(d.a,d.b,target)-dimensionOffset(d.a,d.b,start)})});
}
export function snapViewVertex(plan:Plan,p:Point,tolerance:number,excluded:Point[]=[]):Point|undefined {
 return plan.projections?.flatMap(t=>t.points).filter(q=>!excluded.some(e=>same(e,q)))
  .filter(q=>distance(q,p)<=tolerance).sort((a,b)=>distance(a,p)-distance(b,p))[0];
}
