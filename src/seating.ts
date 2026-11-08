import type {Furniture} from './model';
import type {WalkWorld,WalkPoint} from './walkPhysics';
import type {WalkMotion} from './walkMotion';
import type {WalkTarget} from './climb';
import {furnitureHeight} from './furnitureHeights';

export type SeatPlace={key:string;name:string;item:Furniture;position:WalkPoint;yaw:number;base:number;height:number;x:number;z:number};
export const isSeatKind=(kind:Furniture['kind']|'door')=>['chair','armchair','sofa','sofa3'].includes(kind);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function point(s:Pick<SeatPlace,'item'|'yaw'>,x:number,z:number):WalkPoint{return {x:s.item.x+x*Math.cos(s.yaw)-z*Math.sin(s.yaw),z:s.item.y+x*Math.sin(s.yaw)+z*Math.cos(s.yaw)};}
function local(item:Furniture,p:WalkPoint){const yaw=item.rotation*Math.PI/180,dx=p.x-item.x,dz=p.z-item.y;return {x:dx*Math.cos(yaw)+dz*Math.sin(yaw),z:-dx*Math.sin(yaw)+dz*Math.cos(yaw)};}
/** Only the selected seat is excluded; walls, other furniture, ceilings and holes still apply. */
function clearPath(world:WalkWorld,s:SeatPlace,path:WalkPoint[]){
 for(let n=1;n<path.length;n++){
  const a=path[n-1],b=path[n],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.025));
  for(let i=0;i<=steps;i++){const t=i/steps,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
   if(!world.isClear(p,{base:s.base,height:world.height},s.key)||Math.abs((world.navigationSupport(p,s.base,s.base+.001)??Infinity)-s.base)>.001)return false;
  }
 }
 return true;
}
export function selectedSeat(world:WalkWorld,motion:WalkMotion,target:WalkTarget):{place:SeatPlace|null;reason:string}{
 const fail=(reason:string)=>({place:null,reason});
 let item:Furniture|undefined,base=0;
 for(const f of world.model){item=f.furniture.find(i=>JSON.stringify([f.id,i.id])===target.key);if(item){base=f.elevation+(item.elevation??0);break;}}
 if(!item||!isSeatKind(item.kind))return fail('Este objeto no tiene asiento disponible.');
 if(motion.crouched)return fail('Ponete de pie antes de sentarte.');
 if(!motion.grounded)return fail('Esperá a estar apoyado en el suelo.');
 if(Math.abs(motion.feet-base)>.001||motion.platform)return fail('Acercate desde el piso donde está apoyado el asiento.');
 const chair=item.kind==='chair',count=item.kind==='sofa3'?3:item.kind==='sofa'?2:1,height=furnitureHeight(item)*(chair?.58:.57),seatWidth=item.width*(chair?1:.75/count);
 if(seatWidth<world.item.width*.62+.02||(!chair&&item.width*.39-(count-1)/2*item.width*.77/count<world.item.width*.49+.01))return fail('El asiento es demasiado angosto para esta persona.');
 if(height<world.height*.2||height>world.height*.38)return fail('La altura del asiento no se adapta a esta persona.');
 const back=item.depth*(chair?-.39:-.22),front=item.depth*(chair?.5:.46),bodyDepth=world.item.depth*.34;
 if(front-back<bodyDepth*2+.03)return fail('El asiento es demasiado corto para esta persona.');
 const kneeReach=world.height*.21*Math.sqrt(1-clamp((height-world.height*.23)/(world.height*.21),-1,1)**2);
 const z=Math.max(back+bodyDepth+.015,front-kneeReach+.025);
 if(z+bodyDepth>front-.01||front-z>world.height*.25)return fail('La profundidad del asiento no se adapta a esta persona.');
 const current=local(item,motion.position),frontZ=item.depth/2+world.radius+.04;
 if(current.z<item.depth/2+world.radius-.03)return fail('Acercate por delante del asiento.');
 const slots=Array.from({length:count},(_,i)=>(i-(count-1)/2)*item.width*.77/count).sort((a,b)=>Math.abs(a-current.x)-Math.abs(b-current.x));
 let nearby=false;
 for(const x of slots){
  const place:SeatPlace={key:target.key,name:target.name,item,base,height,yaw:item.rotation*Math.PI/180,x,z,position:{x:0,z:0}};place.position=point(place,x,z);
  const approach=point(place,x,frontZ);
  if(Math.hypot(approach.x-motion.position.x,approach.z-motion.position.z)>.85)continue;nearby=true;
  // The feet extend beyond the knees. Reserve their space too when sitting.
  const feet=point(place,x,z+kneeReach+world.item.depth*.2);
  if(world.canOccupy(approach,{base,height:world.height,navigation:base})&&clearPath(world,place,[motion.position,approach,place.position,feet]))return {place,reason:''};
 }
 return fail(nearby?'No hay espacio libre para sentarse desde aquí. Revisá obstáculos y apoyo.':'Acercate al asiento para sentarte.');
}
export function seatExit(world:WalkWorld,s:SeatPlace):WalkPoint|null{
 const frontZ=s.item.depth/2+world.radius+.04,limit=Math.max(0,s.item.width*.385-world.item.width*.49-.02);
 const xs=[s.x,clamp(s.x-world.radius*2,-limit,limit),clamp(s.x+world.radius*2,-limit,limit)];
 const candidates=xs.map(x=>point(s,x,frontZ));
 // Chairs have no armrests; side exits are valid, but never through the backrest.
 if(s.item.kind==='chair')for(const side of [-1,1])candidates.push(point(s,side*(s.item.width/2+world.radius+.04),s.z));
 for(const p of candidates)if(world.canOccupy(p,{base:s.base,height:world.height,navigation:s.base})&&clearPath(world,s,[s.position,p]))return p;
 return null;
}
