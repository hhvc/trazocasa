import {containsClimbSurface} from './climb';
import {maxWalkStep} from './walkPhysics';
import type {WalkPoint,WalkWorld} from './walkPhysics';
export type WalkMotion={platform?:string;position:WalkPoint;feet:number;navigation:number;velocity:number;grounded:boolean;crouched:boolean;standBlocked:boolean};
export const crouchRatio=.7;
const gravity=9.8,jumpSpeed=Math.sqrt(2*gravity*.55);
export const bodyHeight=(world:WalkWorld,motion:WalkMotion)=>world.height*(motion.crouched?crouchRatio:1);
export const initialMotion=(world:WalkWorld):WalkMotion=>({position:{...world.start},feet:world.base,navigation:world.base,velocity:0,grounded:true,crouched:false,standBlocked:false});
export function toggleCrouch(world:WalkWorld,motion:WalkMotion):WalkMotion{
 if(!motion.crouched)return {...motion,crouched:true,standBlocked:false};
 if(!world.isClear(motion.position,{base:motion.feet,height:world.height}))return {...motion,standBlocked:true};
 return {...motion,crouched:false,standBlocked:false};
}
export function jump(motion:WalkMotion):WalkMotion{return motion.grounded&&!motion.crouched?{...motion,velocity:jumpSpeed,grounded:false}:motion;}
/** Sweep the entire body against vertical intervals so thin ceilings and furniture cannot be skipped. */
export function verticalStep(world:WalkWorld,position:WalkPoint,feet:number,height:number,delta:number){
 let next=feet+delta,grounded=false,ceiling=false;
 const intervals=world.verticalIntervals(position);
 if(delta>0){for(const span of intervals)if(span.bottom>=feet+height-.001&&span.bottom<next+height){next=Math.max(feet,span.bottom-height);ceiling=true;}}
 else{
  let support=world.groundLevel;
  for(const span of intervals)if(span.top<=feet+.001)support=Math.max(support,span.top);
  if(next<=support){next=support;grounded=true;}
 }
 return {feet:next,grounded,ceiling};
}
function stepTo(world:WalkWorld,motion:WalkMotion,position:WalkPoint,height:number):WalkMotion|null{
 const platform=world.climbSurfaces.find(s=>s.key===motion.platform);
 if(platform&&containsClimbSurface(platform,position,world.radius))return world.isClear(position,{base:motion.feet,height})?{...motion,position}:null;
 const navigation=world.navigationSupport(position,motion.navigation,motion.feet+(motion.grounded?maxWalkStep:0));
 if(navigation===null)return null;
 let feet=motion.feet;
 if(motion.grounded){
  if(navigation>feet)feet=navigation;
  else if(Math.abs(feet-motion.navigation)<.001)feet=navigation;
 }
 if(!world.isClear(position,{base:feet,height}))return null;
 if(feet>motion.feet&&!world.isClear(motion.position,{base:feet,height}))return null;
 return {...motion,position,feet,navigation,platform:undefined};
}
/** Short substeps join nearby architectural supports. Furniture still requires jumping. */
export function advanceWalk(world:WalkWorld,source:WalkMotion,dx:number,dz:number,seconds:number){
 let motion={...source,position:{...source.position}},distance=0;
 if(![dx,dz,seconds].every(Number.isFinite))return {motion,distance};
 const duration=Math.max(0,Math.min(.05,seconds)),length=Math.hypot(dx,dz),scale=length>1?1/length:1;
 const steps=Math.max(1,Math.ceil(duration*120),Math.ceil(Math.min(1,length)/.025)),dt=duration/steps;
 if(duration===0||(motion.grounded&&dx===0&&dz===0&&motion.velocity===0))return {motion,distance};
 dx=dx*scale/steps;dz=dz*scale/steps;
 const height=bodyHeight(world,motion);
 for(let i=0;i<steps;i++){
  const before=motion.position;
  if(dx||dz){
   const diagonal=stepTo(world,motion,{x:before.x+dx,z:before.z+dz},height);
   if(diagonal)motion=diagonal;
   else{
    if(dx)motion=stepTo(world,motion,{x:motion.position.x+dx,z:motion.position.z},height)??motion;
    if(dz)motion=stepTo(world,motion,{x:motion.position.x,z:motion.position.z+dz},height)??motion;
   }
  }
  distance+=Math.hypot(motion.position.x-before.x,motion.position.z-before.z);
  const vertical=verticalStep(world,motion.position,motion.feet,height,motion.velocity*dt-gravity*dt*dt/2);
  motion.feet=vertical.feet;motion.grounded=vertical.grounded;motion.velocity=vertical.grounded||vertical.ceiling?0:motion.velocity-gravity*dt;
 }
 if(motion.standBlocked&&world.isClear(motion.position,{base:motion.feet,height:world.height}))motion.standBlocked=false;
 return {motion,distance};
}
