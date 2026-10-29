import { distance, openingHeight, openingSill, wallHeight, wallThickness, floorLevels, plateHoles, roofPlanes, wallRoofProfile, planeHeight, wallProfilePoint, effectiveWallHeight } from './model';
import type { Plan, Building, RoofPlane } from './model';
export type WallSolid = {from:number;to:number;bottom:number;top:number;topEnd?:number;planes?:RoofPlane[]};
/** Non-overlapping wall volumes leave actual openings, including doors at floor level. */
export function wallVolumes(plan:Plan) {
 return plan.walls.map(w=>{
  const length=distance(w.a,w.b),height=effectiveWallHeight(plan,w),profile=wallRoofProfile(plan,w);
  const openings=plan.openings.filter(o=>o.wallId===w.id).map(o=>({id:o.id,kind:o.kind,from:o.t*length-o.width/2,to:o.t*length+o.width/2,bottom:openingSill(o),top:openingSill(o)+openingHeight(o)})).sort((a,b)=>a.from-b.from);
  const solids:WallSolid[]=[];
  const add=(from:number,to:number,bottom:number,top:number,follow=false)=>{
   if(!follow){if(to-from>1e-8&&top-bottom>1e-8)solids.push({from,to,bottom,top});return;}
   for(const segment of profile){const a=Math.max(from,segment.from),b=Math.min(to,segment.to);if(b-a<1e-8)continue;
    const topA=planeHeight(segment.plane,wallProfilePoint(w,a)),topB=planeHeight(segment.plane,wallProfilePoint(w,b));
    if(segment.planes)solids.push({from:a,to:b,bottom,top:topA,topEnd:topB,planes:segment.planes});else if(topA>bottom+1e-8)solids.push({from:a,to:b,bottom,top:topA});
   }
  };
  let from=0;
  for(const o of openings){add(from,o.from,0,height,true);add(o.from,o.to,0,o.bottom);add(o.from,o.to,o.top,height,true);from=o.to;}
  add(from,length,0,height,true);
  return {...(w.appearance?{appearance:w.appearance}:{}),id:w.id,a:w.a,b:w.b,length,height,thickness:wallThickness(w),angle:Math.atan2(w.b.y-w.a.y,w.b.x-w.a.x),solids,openings,profile};
 });
}

export type ModelSelection = {floorId:string; elementId:string;plate?:'slab'|'roof'};
export const modelSelectionKey=(selection:ModelSelection|null)=>selection?JSON.stringify([selection.floorId,selection.elementId]):'';
export type ModelOptions={scope:'all'|'active';slabs:boolean;roofs:boolean;furniture?:boolean};
export function buildingVolumes(building:Building,options:ModelOptions){
 const levels=floorLevels(building);
 return building.floors.flatMap((floor,index)=>{
  if(options.scope==='active'&&floor.id!==building.activeFloorId)return [];
  const plates=floor.plan.surfaces.flatMap(surface=>{
   const common={id:surface.id,name:surface.name,points:surface.points};
   return [
    ...(surface.slab&&options.slabs?[{...common,appearance:surface.slab.appearance,kind:'floor' as const,planes:undefined as RoofPlane[]|undefined,holes:plateHoles(surface,'slab'),bottom:-surface.slab.thickness,top:0}]:[]),
    ...(surface.roof&&options.roofs?[{...common,appearance:surface.roof.appearance,kind:'roof' as const,planes:roofPlanes(surface),holes:plateHoles(surface,'roof'),bottom:surface.roof.height,top:surface.roof.height+surface.roof.thickness}]:[]),
   ];
  });
  return [{id:floor.id,name:floor.name,elevation:levels[index],walls:wallVolumes(floor.plan),plates,furniture:options.furniture===false?[]:floor.plan.furniture.filter(f=>(f.kind!=='stairs'&&f.kind!=='stairLanding')||f.height!==undefined)}];
 });
}
export type BuildingVolumes=ReturnType<typeof buildingVolumes>;
