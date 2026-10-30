import type {Furniture} from './model';
import type {WalkPoint,WalkWorld} from './walkPhysics';
import type {WalkMotion} from './walkMotion';
export type ClimbSurface={key:string;name:string;shape:'box'|'ellipse';x:number;z:number;cos:number;sin:number;halfW:number;halfD:number;top:number};
export type ClimbPose={position:WalkPoint;feet:number};
export type ClimbAction={kind:'up'|'down';name:string;surface:string;from:WalkMotion;to:WalkMotion;path:ClimbPose[];duration:number};
const names:Partial<Record<Furniture['kind'],string>>={table:'mesa',desk:'escritorio',nightstand:'mesa de luz',roundCoffeeTable:'mesa ratona',stairLanding:'descanso'};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const local=(s:ClimbSurface,p:WalkPoint)=>{const x=p.x-s.x,z=p.z-s.z;return {x:x*s.cos+z*s.sin,z:-x*s.sin+z*s.cos};};
const global=(s:ClimbSurface,p:WalkPoint)=>({x:s.x+p.x*s.cos-p.z*s.sin,z:s.z+p.x*s.sin+p.z*s.cos});
export function climbSurface(item:Furniture,level:number,height:number,floorId:string):ClimbSurface|null{
 const name=names[item.kind];if(!name||(item.kind==='stairLanding'&&item.height===undefined))return null;
 const a=item.rotation*Math.PI/180;
 return {key:JSON.stringify([floorId,item.id]),name,shape:item.kind==='roundCoffeeTable'?'ellipse':'box',x:item.x,z:item.y,cos:Math.cos(a),sin:Math.sin(a),halfW:item.width/2,halfD:item.depth/2,top:level+(item.elevation??0)+height};
}
/** Reserve a full circular footprint, including a small margin from the tabletop edge. */
export function containsClimbSurface(s:ClimbSurface,p:WalkPoint,radius:number){
 const q=local(s,p),r=radius+.015;
 if(s.shape==='box')return Math.abs(q.x)+r<=s.halfW+1e-8&&Math.abs(q.z)+r<=s.halfD+1e-8;
 // Use an inscribed circle for round/elliptical tops. This conservative support
 // avoids accepting an overhanging foot at an ellipse's narrow end.
 return Math.hypot(q.x,q.z)+r<=Math.min(s.halfW,s.halfD)+1e-8;
}
function topPoint(s:ClimbSurface,p:WalkPoint,radius:number):WalkPoint|null{
 const q=local(s,p),r=radius+.025;
 if(s.halfW<=r||s.halfD<=r)return null;
 if(s.shape==='box')return global(s,{x:clamp(q.x,-s.halfW+r,s.halfW-r),z:clamp(q.z,-s.halfD+r,s.halfD-r)});
 const limit=Math.min(s.halfW,s.halfD)-r,scale=Math.min(1,limit/(Math.hypot(q.x,q.z)||1));return global(s,{x:q.x*scale,z:q.z*scale});
}
function exitPoint(s:ClimbSurface,p:WalkPoint,yaw:number,radius:number):WalkPoint|null{
 const q=local(s,p),direction={x:-Math.sin(yaw)*s.cos+Math.cos(yaw)*s.sin,z:Math.sin(yaw)*s.sin+Math.cos(yaw)*s.cos};
 if(s.shape==='box'){
  const tx=Math.abs(direction.x)<1e-8?Infinity:((direction.x>0?s.halfW:-s.halfW)-q.x)/direction.x;
  const tz=Math.abs(direction.z)<1e-8?Infinity:((direction.z>0?s.halfD:-s.halfD)-q.z)/direction.z,t=Math.min(tx,tz);
  if(!Number.isFinite(t)||t<0)return null;
  const edge={x:q.x+direction.x*t,z:q.z+direction.z*t};
  if(tx<tz)edge.x+=Math.sign(direction.x)*(radius+.04);else edge.z+=Math.sign(direction.z)*(radius+.04);
  return global(s,edge);
 }
 const a=(direction.x/s.halfW)**2+(direction.z/s.halfD)**2,b=2*(q.x*direction.x/s.halfW**2+q.z*direction.z/s.halfD**2),c=(q.x/s.halfW)**2+(q.z/s.halfD)**2-1;
 const t=(-b+Math.sqrt(Math.max(0,b*b-4*a*c)))/(2*a),edge={x:q.x+t*direction.x,z:q.z+t*direction.z},normal={x:edge.x/s.halfW**2,z:edge.z/s.halfD**2},n=Math.hypot(normal.x,normal.z);
 return global(s,{x:edge.x+normal.x/n*(radius+.04),z:edge.z+normal.z/n*(radius+.04)});
}
const copy=(m:WalkMotion):WalkMotion=>({...m,position:{...m.position}});
/** Check the complete lift / transfer / lower path, not just the landing point. */
function prepare(world:WalkWorld,from:WalkMotion,to:WalkMotion,s:ClimbSurface,kind:ClimbAction['kind']):ClimbAction|null{
 const lift=Math.max(from.feet,to.feet)+.02,path=[{position:{...from.position},feet:from.feet},{position:{...from.position},feet:lift},{position:{...to.position},feet:lift},{position:{...to.position},feet:to.feet}];
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],steps=Math.max(1,Math.ceil(Math.hypot(b.position.x-a.position.x,b.position.z-a.position.z,b.feet-a.feet)/.02));
  for(let j=0;j<=steps;j++){const t=j/steps,position={x:a.position.x+(b.position.x-a.position.x)*t,z:a.position.z+(b.position.z-a.position.z)*t},feet=a.feet+(b.feet-a.feet)*t;if(!world.isClear(position,{base:feet,height:world.height}))return null;}
 }
 return {kind,name:s.name,surface:s.key,from:copy(from),to:copy(to),path,duration:.85+Math.abs(to.feet-from.feet)*.25};
}
export function findClimbAction(world:WalkWorld,motion:WalkMotion,yaw:number):ClimbAction|null{
 if(!motion.grounded||motion.crouched||![yaw,motion.feet].every(Number.isFinite))return null;
 const reach=Math.min(.9,world.height*.55),forward={x:-Math.sin(yaw),z:Math.cos(yaw)};
 const standing=world.climbSurfaces.find(s=>Math.abs(s.top-motion.feet)<.002&&containsClimbSurface(s,motion.position,world.radius));
 if(standing){
  const destination=exitPoint(standing,motion.position,yaw,world.radius);if(!destination||Math.hypot(destination.x-motion.position.x,destination.z-motion.position.z)>1.15)return null;
  // navigationSupport's lower window is 22 cm; offset the reference to search
  // the entire permitted descent while retaining its full-footprint checks.
  const feet=world.navigationSupport(destination,standing.top-reach+.22,standing.top-.05);
  if(feet===null||standing.top-feet>reach+.001)return null;
  return prepare(world,motion,{...copy(motion),position:destination,feet,navigation:feet,platform:undefined,velocity:0,grounded:true},standing,'down');
 }
 const candidates=world.climbSurfaces.flatMap(s=>{
  const rise=s.top-motion.feet;if(rise<.08||rise>reach)return [];
  const destination=topPoint(s,motion.position,world.radius);if(!destination)return [];
  const dx=destination.x-motion.position.x,dz=destination.z-motion.position.z,distance=Math.hypot(dx,dz);
  if(distance<.01||distance>1.05||(dx*forward.x+dz*forward.z)/distance<.7||!containsClimbSurface(s,destination,world.radius))return [];
  return [{s,destination,distance}];
 }).sort((a,b)=>a.distance-b.distance);
 for(const {s,destination} of candidates){const action=prepare(world,motion,{...copy(motion),position:destination,feet:s.top,navigation:s.top,platform:s.key,velocity:0,grounded:true},s,'up');if(action)return action;}
 return null;
}
/** A deterministic path shared by animation and tests. Never changes the saved project. */
export function climbMotion(action:ClimbAction,elapsed:number):WalkMotion{
 const t=clamp(elapsed/action.duration,0,1);if(t>=1)return copy(action.to);
 const progress=t*t*(3-2*t),lengths=action.path.slice(1).map((b,i)=>{const a=action.path[i];return Math.hypot(b.position.x-a.position.x,b.position.z-a.position.z,b.feet-a.feet);});
 let distance=progress*lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<lengths.length;i++){const a=action.path[i],b=action.path[i+1];if(distance<=lengths[i]||i===lengths.length-1){const f=lengths[i]?distance/lengths[i]:1;return {...copy(action.from),position:{x:a.position.x+(b.position.x-a.position.x)*f,z:a.position.z+(b.position.z-a.position.z)*f},feet:a.feet+(b.feet-a.feet)*f,velocity:0,grounded:false};}distance-=lengths[i];}
 return copy(action.to);
}
