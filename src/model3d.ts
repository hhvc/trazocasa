import { distance, openingHeight, openingSill, wallHeight, wallThickness, floorLevels } from './model';
import type { Plan, Building } from './model';
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

export type ModelSelection = {floorId:string; elementId:string};
export const modelSelectionKey=(selection:ModelSelection|null)=>selection?JSON.stringify([selection.floorId,selection.elementId]):'';
export type ModelOptions={scope:'all'|'active';slabs:boolean;roofs:boolean};
export function buildingVolumes(building:Building,options:ModelOptions){
 const levels=floorLevels(building);
 return building.floors.flatMap((floor,index)=>{
  if(options.scope==='active'&&floor.id!==building.activeFloorId)return [];
  const plates=floor.plan.surfaces.flatMap(surface=>{
   const common={id:surface.id,name:surface.name,points:surface.points};
   return [
    ...(surface.slab&&options.slabs?[{...common,kind:'floor' as const,bottom:-surface.slab.thickness,top:0}]:[]),
    ...(surface.roof&&options.roofs?[{...common,kind:'roof' as const,bottom:surface.roof.height,top:surface.roof.height+surface.roof.thickness}]:[]),
   ];
  });
  return [{id:floor.id,name:floor.name,elevation:levels[index],walls:wallVolumes(floor.plan),plates}];
 });
}
export type BuildingVolumes=ReturnType<typeof buildingVolumes>;
