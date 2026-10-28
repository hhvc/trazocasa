import type {Furniture,Point} from './model';
import type {BuildingVolumes,ModelSelection} from './model3d';
import {furnitureHeight} from './furnitureHeights';
export type WalkPoint={x:number;z:number};
export type WalkWorld=ReturnType<typeof createWalkWorld>;
const epsilon=.001;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function closest(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return {x:a.x+t*dx,y:a.y+t*dy};}
function inside(p:Point,polygon:Point[]){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(Math.hypot(p.x-closest(p,a,b).x,p.y-closest(p,a,b).y)<1e-7)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function contacts(p:Point,r:number,polygon:Point[]){const points=inside(p,polygon)?[p]:[];for(let i=0;i<polygon.length;i++){const q=closest(p,polygon[i],polygon[(i+1)%polygon.length]);if(Math.hypot(q.x-p.x,q.y-p.y)<=r)points.push(q);}return points;}
type Block={x:number;z:number;cos:number;sin:number;halfW:number;halfD:number;bottom:number;top:(p:Point,localX:number)=>number};
/** A horizontal kinematic body. Architectural visibility never changes collision geometry. */
export function createWalkWorld(model:BuildingVolumes,selection:ModelSelection){
 const floor=model.find(f=>f.id===selection.floorId),item=floor?.furniture.find(f=>f.id===selection.elementId&&f.kind==='person');
 if(!floor||!item)throw new Error('Seleccioná una persona para iniciar el recorrido.');
 const height=furnitureHeight(item),radius=Math.max(.15,Math.min(.45,item.width*.45)),base=floor.elevation+(item.elevation??0),blocks:Block[]=[];
 for(const f of model){
  for(const w of f.walls){
   const cos=Math.cos(w.angle),sin=Math.sin(w.angle);
   for(const s of w.solids){const center=(s.from+s.to)/2;blocks.push({x:w.a.x+cos*center,z:w.a.y+sin*center,cos,sin,halfW:(s.to-s.from)/2,halfD:w.thickness/2,bottom:f.elevation+s.bottom,top:(p,x)=>f.elevation+(s.planes?Math.min(...s.planes.map(plane=>plane.a*p.x+plane.b*p.y+plane.c)):s.top+(s.topEnd===undefined?0:(s.topEnd-s.top)*(x+center-s.from)/(s.to-s.from)))});}
   // Glass remains an obstacle even when the opening starts at floor level.
   for(const o of w.openings.filter(o=>o.kind==='window')){const center=(o.from+o.to)/2;blocks.push({x:w.a.x+cos*center,z:w.a.y+sin*center,cos,sin,halfW:(o.to-o.from)/2,halfD:w.thickness/2,bottom:f.elevation+o.bottom,top:()=>f.elevation+o.top});}
  }
  for(const i of f.furniture){if(f.id===selection.floorId&&i.id===selection.elementId)continue;const angle=i.rotation*Math.PI/180;blocks.push({x:i.x,z:i.y,cos:Math.cos(angle),sin:Math.sin(angle),halfW:i.width/2,halfD:i.depth/2,bottom:f.elevation+(i.elevation??0),top:()=>f.elevation+(i.elevation??0)+furnitureHeight(i)});}
 }
 const plates=model.flatMap(f=>f.plates.map(p=>({...p,level:f.elevation})));
 const supports=plates.filter(p=>p.kind==='floor'&&Math.abs(p.level+p.top-base)<epsilon);
 const ground=Math.abs((model[0]?.elevation??0)-base)<epsilon;
 const covered=(p:Point)=>supports.some(s=>inside(p,s.points)&&!s.holes.some(h=>inside(p,h)));
 function supported(p:Point){
  // The base floor has ground outside its contours. Slab holes still block passage.
  if(ground)return !supports.some(s=>s.holes.some(h=>contacts(p,radius,h).some(q=>!covered(q))));
  if(!supports.length)return false;
  for(let i=-1;i<24;i++){const a=i*Math.PI/12,q=i<0?p:{x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius};if(!covered(q))return false;}
  return !supports.some(s=>s.holes.some(h=>contacts(p,radius,h).some(q=>!covered(q))));
 }
 function canOccupy(pos:WalkPoint){
  const p={x:pos.x,y:pos.z};if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!supported(p))return false;
  for(const b of blocks){if(b.bottom>=base+height-epsilon)continue;const dx=p.x-b.x,dz=p.y-b.z,x=dx*b.cos+dz*b.sin,z=-dx*b.sin+dz*b.cos,qx=clamp(x,-b.halfW,b.halfW),qz=clamp(z,-b.halfD,b.halfD);if(Math.hypot(x-qx,z-qz)>=radius)continue;const q={x:b.x+qx*b.cos-qz*b.sin,y:b.z+qx*b.sin+qz*b.cos};if(b.top(q,qx)>base+epsilon)return false;}
  for(const plate of plates){
   const footprint=[...contacts(p,radius,plate.points),...Array.from({length:24},(_,i)=>({x:p.x+Math.cos(i*Math.PI/12)*radius,y:p.y+Math.sin(i*Math.PI/12)*radius})).filter(q=>inside(q,plate.points))];
   for(const q of footprint){if(plate.holes.some(h=>inside(q,h)))continue;const bottom=plate.level+(plate.planes?Math.min(...plate.planes.map(v=>v.a*q.x+v.b*q.y+v.c)):plate.bottom),top=bottom+plate.top-plate.bottom;if(bottom<base+height-epsilon&&top>base+epsilon)return false;}
  }
  return true;
 }
 return {item:item as Furniture,base,height,radius,start:{x:item.x,z:item.y},canOccupy};
}
/** Short substeps prevent tunneling; axis fallback lets the body slide along obstacles. */
export function moveWalker(world:WalkWorld,from:WalkPoint,dx:number,dz:number):WalkPoint{
 if(![dx,dz].every(Number.isFinite))return {...from};
 const length=Math.hypot(dx,dz),scale=length>1?1/length:1,steps=Math.max(1,Math.ceil(Math.min(length,1)/.025));
 dx=dx*scale/steps;dz=dz*scale/steps;let p={...from};
 for(let i=0;i<steps;i++){const next={x:p.x+dx,z:p.z+dz};if(world.canOccupy(next)){p=next;continue;}const x={x:p.x+dx,z:p.z},z={x:p.x,z:p.z+dz};if(world.canOccupy(x))p=x;if(world.canOccupy({...z,x:p.x}))p={...z,x:p.x};}
 return p;
}
export function walkDelta(yaw:number,forward:number,right:number,seconds:number){const norm=Math.max(1,Math.hypot(forward,right)),step=1.4*Math.max(0,Math.min(.05,seconds))/norm;return {x:(-Math.sin(yaw)*forward-Math.cos(yaw)*right)*step,z:(Math.cos(yaw)*forward-Math.sin(yaw)*right)*step};}
