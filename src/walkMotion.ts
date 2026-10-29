import {moveWalker} from './walkPhysics';
import type {WalkPoint,WalkWorld} from './walkPhysics';
export type WalkMotion={position:WalkPoint;feet:number;velocity:number;grounded:boolean;crouched:boolean;standBlocked:boolean};
export const crouchRatio=.7;
const gravity=9.8,jumpSpeed=Math.sqrt(2*gravity*.55);
export const bodyHeight=(world:WalkWorld,motion:WalkMotion)=>world.height*(motion.crouched?crouchRatio:1);
export const initialMotion=(world:WalkWorld):WalkMotion=>({position:{...world.start},feet:world.base,velocity:0,grounded:true,crouched:false,standBlocked:false});
export function toggleCrouch(world:WalkWorld,motion:WalkMotion):WalkMotion{
 if(!motion.crouched)return {...motion,crouched:true,standBlocked:false};
 if(!world.canOccupy(motion.position,{base:motion.feet,height:world.height}))return {...motion,standBlocked:true};
 return {...motion,crouched:false,standBlocked:false};
}
export function jump(motion:WalkMotion):WalkMotion{return motion.grounded&&!motion.crouched?{...motion,velocity:jumpSpeed,grounded:false}:motion;}
/** Sweep the entire body against vertical intervals so thin ceilings and furniture cannot be skipped. */
export function verticalStep(world:WalkWorld,position:WalkPoint,feet:number,height:number,delta:number){
 let next=feet+delta,grounded=false,ceiling=false;
 const intervals=world.verticalIntervals(position);
 if(delta>0){for(const span of intervals)if(span.bottom>=feet+height-.001&&span.bottom<next+height){next=Math.max(feet,span.bottom-height);ceiling=true;}}
 else{
  let support=world.base;
  for(const span of intervals)if(span.top<=feet+.001)support=Math.max(support,span.top);
  if(next<=support){next=support;grounded=true;}
 }
 return {feet:next,grounded,ceiling};
}
/** Horizontal and vertical integration share short substeps; the original floor remains the lower boundary. */
export function advanceWalk(world:WalkWorld,source:WalkMotion,dx:number,dz:number,seconds:number){
 let motion={...source,position:{...source.position}},distance=0;
 const duration=Math.max(0,Math.min(.05,seconds)),steps=Math.max(1,Math.ceil(duration*120)),dt=duration/steps;
 if(duration===0||(motion.grounded&&dx===0&&dz===0&&motion.velocity===0))return {motion,distance};
 const height=bodyHeight(world,motion);
 for(let i=0;i<steps;i++){
  const next=moveWalker(world,motion.position,dx/steps,dz/steps,{base:motion.feet,height});distance+=Math.hypot(next.x-motion.position.x,next.z-motion.position.z);motion.position=next;
  const vertical=verticalStep(world,next,motion.feet,height,motion.velocity*dt-gravity*dt*dt/2);
  motion.feet=vertical.feet;motion.grounded=vertical.grounded;motion.velocity=vertical.grounded||vertical.ceiling?0:motion.velocity-gravity*dt;
 }
 if(motion.standBlocked&&world.canOccupy(motion.position,{base:motion.feet,height:world.height}))motion.standBlocked=false;
 return {motion,distance};
}
