import {stairTreads} from './stairGeometry';
import type {Furniture,Point} from './model';
import type {BuildingVolumes,ModelSelection} from './model3d';
import {furnitureHeight} from './furnitureHeights';
export type WalkPoint={x:number;z:number};
export type WalkWorld=ReturnType<typeof createWalkWorld>;
const epsilon=.001;
export const maxWalkStep=.22;
export type WalkBody={base:number;height:number;navigation?:number};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function closest(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return {x:a.x+t*dx,y:a.y+t*dy};}
function inside(p:Point,polygon:Point[]){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(Math.hypot(p.x-closest(p,a,b).x,p.y-closest(p,a,b).y)<1e-7)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function contacts(p:Point,r:number,polygon:Point[]){const points=inside(p,polygon)?[p]:[];for(let i=0;i<polygon.length;i++){const q=closest(p,polygon[i],polygon[(i+1)%polygon.length]);if(Math.hypot(q.x-p.x,q.y-p.y)<=r)points.push(q);}return points;}
type Block={x:number;z:number;cos:number;sin:number;halfW:number;halfD:number;bottom:number;top:(p:Point,localX:number)=>number};
type Support={points:Point[];holes:Point[][];height:number;treads?:Block[];entry?:{height:number;outside:(q:Point)=>boolean}};
function contactTop(b:Block,p:Point,r:number){const dx=p.x-b.x,dz=p.y-b.z,x=dx*b.cos+dz*b.sin,z=-dx*b.sin+dz*b.cos,qx=clamp(x,-b.halfW,b.halfW),qz=clamp(z,-b.halfD,b.halfD);if(Math.hypot(x-qx,z-qz)>=r)return null;return b.top({x:b.x+qx*b.cos-qz*b.sin,y:b.z+qx*b.sin+qz*b.cos},qx);}
/** Architectural visibility never changes collision geometry or connected walking surfaces. */
export function createWalkWorld(model:BuildingVolumes,selection:ModelSelection){
 const floor=model.find(f=>f.id===selection.floorId),item=floor?.furniture.find(f=>f.id===selection.elementId&&f.kind==='person');
 if(!floor||!item)throw new Error('Seleccioná una persona para iniciar el recorrido.');
 const height=furnitureHeight(item),radius=Math.max(.15,Math.min(.45,item.width*.45)),base=floor.elevation+(item.elevation??0),blocks:Block[]=[],stairSupports:Support[]=[];
 for(const f of model){
  for(const w of f.walls){
   const cos=Math.cos(w.angle),sin=Math.sin(w.angle);
   for(const s of w.solids){const center=(s.from+s.to)/2;blocks.push({x:w.a.x+cos*center,z:w.a.y+sin*center,cos,sin,halfW:(s.to-s.from)/2,halfD:w.thickness/2,bottom:f.elevation+s.bottom,top:(p,x)=>f.elevation+(s.planes?Math.min(...s.planes.map(plane=>plane.a*p.x+plane.b*p.y+plane.c)):s.top+(s.topEnd===undefined?0:(s.topEnd-s.top)*(x+center-s.from)/(s.to-s.from)))});}
   // Glass remains an obstacle even when the opening starts at floor level.
   for(const o of w.openings.filter(o=>o.kind==='window')){const center=(o.from+o.to)/2;blocks.push({x:w.a.x+cos*center,z:w.a.y+sin*center,cos,sin,halfW:(o.to-o.from)/2,halfD:w.thickness/2,bottom:f.elevation+o.bottom,top:()=>f.elevation+o.top});}
  }
  for(const i of f.furniture){
   if(f.id===selection.floorId&&i.id===selection.elementId)continue;
   const angle=i.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),bottom=f.elevation+(i.elevation??0);
   if(i.kind==='stairs'||i.kind==='stairLanding'){
    const treads=stairTreads(i).map(t=>{const z=(t.from+t.to)/2;return {x:i.x-z*sin,z:i.y+z*cos,cos,sin,halfW:i.width/2,halfD:(t.to-t.from)/2,bottom:bottom+t.bottom,top:()=>bottom+t.top};});
    if(!treads.length)continue;blocks.push(...treads);
    const points=[[-i.width/2,-i.depth/2],[i.width/2,-i.depth/2],[i.width/2,i.depth/2],[-i.width/2,i.depth/2]].map(([x,z])=>({x:i.x+x*cos-z*sin,y:i.y+x*sin+z*cos}));
    stairSupports.push({points,holes:[],height:bottom+i.height!,treads,...(i.kind==='stairs'?{entry:{height:bottom,outside:(q:Point)=>-(q.x-i.x)*sin+(q.y-i.y)*cos>=i.depth/2-epsilon}}:{})});
   }else blocks.push({x:i.x,z:i.y,cos,sin,halfW:i.width/2,halfD:i.depth/2,bottom,top:()=>bottom+furnitureHeight(i)});
  }
 }
 const plates=model.flatMap(f=>f.plates.map(p=>({...p,level:f.elevation})));
 const groundLevel=model[0]?.elevation??0;
 const supports:Support[]=[...plates.filter(p=>p.kind==='floor').map(p=>({points:p.points,holes:p.holes,height:p.level+p.top})),...stairSupports];
 const groundSlabs=supports.filter(p=>!p.treads&&Math.abs(p.height-groundLevel)<epsilon);
 const within=(q:Point,s:Support)=>inside(q,s.points)&&!s.holes.some(h=>inside(q,h));
 const groundAt=(q:Point)=>!groundSlabs.some(s=>s.holes.some(h=>inside(q,h)))||groundSlabs.some(s=>within(q,s));
 /** The complete circular footprint needs support. Only nearby connected levels are eligible;
  * this permits stairs while keeping upper-floor edges and unrelated holes impassable. */
 function navigationSupport(pos:WalkPoint,reference:number,ceiling:number):number|null{
  const p={x:pos.x,y:pos.z},candidates:Support[]=[];
  for(const s of supports){
   if(!contacts(p,radius,s.points).length)continue;
   let height=s.height;
   if(s.treads){const tops=s.treads.map(t=>contactTop(t,p,radius)).filter((h):h is number=>h!==null);if(!tops.length)continue;height=Math.max(...tops);}
   if(height>=reference-maxWalkStep-epsilon&&height<=ceiling+epsilon)candidates.push({...s,height});
  }
  const ground=groundLevel>=reference-maxWalkStep-epsilon&&groundLevel<=ceiling+epsilon;
  // While the circular body straddles the first risers, its trailing edge still
  // rests on the entry floor. Extend coverage only past the flight's entry end.
  const entries=candidates.flatMap(s=>s.entry?[s.entry]:[]);
  const entryFloors=supports.filter(s=>!s.entry&&entries.some(e=>Math.abs(e.height-s.height)<epsilon));
  const entryGround=entries.some(e=>Math.abs(e.height-groundLevel)<epsilon);
  const covered=(q:Point)=>(ground&&groundAt(q))||candidates.some(s=>within(q,s))||entries.some(e=>e.outside(q)&&((Math.abs(e.height-groundLevel)<epsilon&&groundAt(q))||entryFloors.some(s=>Math.abs(s.height-e.height)<epsilon&&within(q,s))));
  const samples=[p,...Array.from({length:24},(_,i)=>({x:p.x+Math.cos(i*Math.PI/12)*radius,y:p.y+Math.sin(i*Math.PI/12)*radius}))];
  if(samples.some(q=>!covered(q)))return null;
  for(const s of [...candidates,...entryFloors,...(ground||entryGround?groundSlabs:[])])for(const hole of s.holes)if(contacts(p,radius,hole).some(q=>!covered(q)))return null;
  const touched=candidates.filter(s=>[...samples,...contacts(p,radius,s.points)].some(q=>within(q,s)));
  return Math.max(...touched.map(s=>s.height),...(ground&&samples.some(groundAt)?[groundLevel]:[]));
 }
 function verticalIntervals(pos:WalkPoint){
  const p={x:pos.x,y:pos.z},spans:{bottom:number;top:number}[]=[];
  for(const b of blocks){const top=contactTop(b,p,radius);if(top!==null)spans.push({bottom:b.bottom,top});}
  for(const plate of plates){
   const footprint=[...contacts(p,radius,plate.points),...Array.from({length:24},(_,i)=>({x:p.x+Math.cos(i*Math.PI/12)*radius,y:p.y+Math.sin(i*Math.PI/12)*radius})).filter(q=>inside(q,plate.points))];
   for(const q of footprint){if(plate.holes.some(h=>inside(q,h)))continue;const bottom=plate.level+(plate.planes?Math.min(...plate.planes.map(v=>v.a*q.x+v.b*q.y+v.c)):plate.bottom);spans.push({bottom,top:bottom+plate.top-plate.bottom});}
  }
  return spans;
 }
 function isClear(pos:WalkPoint,body:WalkBody){
  if(![pos.x,pos.z,body.base,body.height].every(Number.isFinite)||body.base<groundLevel-epsilon||body.height<=0)return false;
  return !verticalIntervals(pos).some(span=>span.bottom<body.base+body.height-epsilon&&span.top>body.base+epsilon);
 }
 function canOccupy(pos:WalkPoint,body:WalkBody={base,height}){
  return isClear(pos,body)&&navigationSupport(pos,body.navigation??base,body.base+maxWalkStep)!==null;
 }
 return {item:item as Furniture,base,height,radius,groundLevel,start:{x:item.x,z:item.y},canOccupy,isClear,navigationSupport,verticalIntervals};
}
/** Short substeps prevent tunneling; axis fallback lets the body slide along obstacles. */
export function moveWalker(world:WalkWorld,from:WalkPoint,dx:number,dz:number,body?:{base:number;height:number}):WalkPoint{
 if(![dx,dz].every(Number.isFinite))return {...from};
 const length=Math.hypot(dx,dz),scale=length>1?1/length:1,steps=Math.max(1,Math.ceil(Math.min(length,1)/.025));
 dx=dx*scale/steps;dz=dz*scale/steps;let p={...from};
 for(let i=0;i<steps;i++){const next={x:p.x+dx,z:p.z+dz};if(world.canOccupy(next,body)){p=next;continue;}const x={x:p.x+dx,z:p.z},z={x:p.x,z:p.z+dz};if(world.canOccupy(x,body))p=x;if(world.canOccupy({...z,x:p.x},body))p={...z,x:p.x};}
 return p;
}
export function walkDelta(yaw:number,forward:number,right:number,seconds:number){const norm=Math.max(1,Math.hypot(forward,right)),step=1.4*Math.max(0,Math.min(.05,seconds))/norm;return {x:(-Math.sin(yaw)*forward-Math.cos(yaw)*right)*step,z:(Math.cos(yaw)*forward-Math.sin(yaw)*right)*step};}
