import { distance, openingHeight, openingSill, wallHeight, wallThickness } from './model';
import type { Plan } from './model';
export type WallSolid = {from:number;to:number;bottom:number;top:number};
/** Non-overlapping wall volumes leave actual openings, including doors at floor level. */
export function wallVolumes(plan:Plan) {
 return plan.walls.map(w=>{
  const length=distance(w.a,w.b),height=wallHeight(plan,w);
  const openings=plan.openings.filter(o=>o.wallId===w.id).map(o=>({id:o.id,kind:o.kind,from:o.t*length-o.width/2,to:o.t*length+o.width/2,bottom:openingSill(o),top:openingSill(o)+openingHeight(o)})).sort((a,b)=>a.from-b.from);
  const solids:WallSolid[]=[];
  const add=(from:number,to:number,bottom:number,top:number)=>{if(to-from>1e-8&&top-bottom>1e-8)solids.push({from,to,bottom,top});};
  let from=0;
  for(const o of openings){add(from,o.from,0,height);add(o.from,o.to,0,o.bottom);add(o.from,o.to,o.top,height);from=o.to;}
  add(from,length,0,height);
  return {id:w.id,a:w.a,b:w.b,length,height,thickness:wallThickness(w),angle:Math.atan2(w.b.y-w.a.y,w.b.x-w.a.x),solids,openings};
 });
}
