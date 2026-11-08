import type {BuildingVolumes} from './model3d';
import type {WalkWorld,WalkPoint} from './walkPhysics';
import type {WalkMotion} from './walkMotion';
export type HouseDoor={key:string;floorId:string;elementId:string;hinge:WalkPoint;closedYaw:number;swing:number;width:number;thickness:number;bottom:number;top:number};
export type DoorChange={key:string;angle:number};
export const doorOpenAngle=Math.PI/2,doorDuration=.55;
export function modelDoors(model:BuildingVolumes):HouseDoor[]{
 return model.flatMap(f=>f.walls.flatMap(w=>w.openings.filter(o=>o.kind==='door').map(o=>{
  const direction=o.hinge==='end'?-1:1,side=o.swing==='positive'?1:-1,along=direction===1?o.from+.03:o.to-.03,across=side*(w.thickness/2+.03);
  return {key:JSON.stringify([f.id,o.id]),floorId:f.id,elementId:o.id,hinge:{x:w.a.x+along*Math.cos(w.angle)-across*Math.sin(w.angle),z:w.a.y+along*Math.sin(w.angle)+across*Math.cos(w.angle)},closedYaw:w.angle+(direction===1?0:Math.PI),swing:side*direction,width:o.to-o.from-.06,thickness:.04,bottom:f.elevation+o.bottom+.012,top:f.elevation+o.top-.012};
 })));
}
export function doorLeaf(door:HouseDoor,angle:number){
 const yaw=door.closedYaw+door.swing*angle;
 return {position:{x:door.hinge.x+Math.cos(yaw)*door.width/2,z:door.hinge.z+Math.sin(yaw)*door.width/2},yaw,width:door.width,depth:door.thickness,bottom:door.bottom,top:door.top};
}
function nearest(p:WalkPoint,leaf:ReturnType<typeof doorLeaf>){
 const dx=p.x-leaf.position.x,dz=p.z-leaf.position.z,c=Math.cos(leaf.yaw),s=Math.sin(leaf.yaw),x=Math.max(-leaf.width/2,Math.min(leaf.width/2,dx*c+dz*s)),z=Math.max(-leaf.depth/2,Math.min(leaf.depth/2,-dx*s+dz*c));
 return {x:leaf.position.x+x*c-z*s,z:leaf.position.z+x*s+z*c};
}
/** Each swept rectangle has a small overlap with its neighbours, including narrow obstacles. */
export function doorSweepReason(world:WalkWorld,door:HouseDoor,from:number,to:number,motion:WalkMotion){
 const steps=Math.max(1,Math.ceil(Math.abs(to-from)*door.width/.008));
 for(let i=0;i<=steps;i++){
  const leaf=doorLeaf(door,from+(to-from)*i/steps),point=nearest(motion.position,leaf);
  if(motion.feet<door.top&&motion.feet+world.height>door.bottom&&Math.hypot(point.x-motion.position.x,point.z-motion.position.z)<world.radius+.015)return 'Apartate del recorrido de la hoja para mover la puerta.';
  if(!world.boxClear(door.key,leaf.position,leaf.yaw,leaf.width+.012,leaf.depth+.012,door.bottom,door.top))return 'Hay un muro, mueble u otra puerta en el recorrido de la hoja.';
 }
 return '';
}
export function selectedDoor(world:WalkWorld,motion:WalkMotion,key:string){
 const door=world.doors.find(d=>d.key===key),from=world.doorAngles.get(key)??0,to=from>doorOpenAngle/2?0:doorOpenAngle;
 const fail=(reason:string)=>({door:null as HouseDoor|null,from,to,reason});
 if(!door)return fail('Esta puerta no está disponible.');
 if(!motion.grounded||motion.crouched)return fail('Acercate de pie y apoyado en el piso.');
 if(Math.abs(motion.feet-(door.bottom-.012))>.25)return fail('Acercate a la puerta desde su planta.');
 const point=nearest(motion.position,doorLeaf(door,from)),distance=Math.hypot(point.x-motion.position.x,point.z-motion.position.z);
 if(distance>world.radius+1.1)return fail('Acercate a la hoja para abrir o cerrar la puerta.');
 // Only approach as far as a full body can stand; the selected leaf itself is ignored.
 const reach=Math.max(0,distance-world.radius-.035),steps=Math.max(1,Math.ceil(reach/.025));
 for(let i=0;i<=steps;i++){const t=distance?reach/distance*i/steps:0,p={x:motion.position.x+(point.x-motion.position.x)*t,z:motion.position.z+(point.z-motion.position.z)*t};if(!world.isClear(p,{base:motion.feet,height:world.height},door.key))return fail('Hay un obstáculo entre la persona y la puerta.');}
 const reason=doorSweepReason(world,door,from,to,motion);return reason?fail(reason):{door,from,to,reason:''};
}
