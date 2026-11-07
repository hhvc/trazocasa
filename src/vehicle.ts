import type {Furniture} from './model';
import type {WalkWorld,WalkPoint} from './walkPhysics';
import type {WalkMotion} from './walkMotion';
export type VehicleState={key:string;floorId:string;item:Furniture;position:WalkPoint;yaw:number;speed:number;wheelRoll:number;steerAngle:number};
export type VehicleChange={key:string;floorId:string;item:Furniture;level:number;wheels:VehicleWheels;door?:VehicleDoor};
export type VehicleDoor={side:-1|1;angle:number};
export const vehicleDoorHinge={x:.38,z:-.18},vehicleDoorLength=.34,vehicleDoorAngle=.95;
export const vehicleAccessDuration=2;
export type VehicleAccessPlan={side:-1|1;outside:WalkPoint;stage:WalkPoint;seat:NonNullable<ReturnType<typeof driverSeat>>;standingYaw:number};
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp01(n);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function vehicleLocalPoint(car:VehicleState,x:number,z:number):WalkPoint{return {x:car.position.x+x*Math.cos(car.yaw)-z*Math.sin(car.yaw),z:car.position.z+x*Math.sin(car.yaw)+z*Math.cos(car.yaw)};}
export function vehicleDoorSide(car:VehicleState,p:WalkPoint):-1|1{return (p.x-car.position.x)*Math.cos(car.yaw)+(p.z-car.position.z)*Math.sin(car.yaw)<0?-1:1;}
export function vehicleDoorStage(world:WalkWorld,car:VehicleState,side:-1|1){return vehicleLocalPoint(car,side*(car.item.width/2+world.radius+.08),(vehicleDoorHinge.z+vehicleDoorLength)*car.item.depth+world.radius+.08);}
/** Reserve the whole swept panel, including a margin between angular samples. */
export function vehicleDoorClear(world:WalkWorld,car:VehicleState,side:-1|1){
 const length=car.item.depth*vehicleDoorLength,step=vehicleDoorAngle/24;
 for(let i=0;i<=24;i++){
  const a=i*step,p=vehicleLocalPoint(car,side*(vehicleDoorHinge.x*car.item.width+Math.sin(a)*length/2),vehicleDoorHinge.z*car.item.depth+Math.cos(a)*length/2);
  if(!world.vehicleClear(car.key,p,car.yaw-side*a,car.item.width*.14+Math.hypot(car.item.width*.07,car.item.depth*.35)*step*2,car.item.depth*.36,car.item.height??1.45))return false;
 }
 return true;
}
/** The person waits behind the panel before it opens, then bends and enters. Exit reverses this path. */
export function vehicleAccessFrame(car:VehicleState,plan:VehicleAccessPlan,entering:boolean,elapsed:number){
 const t=clamp01(elapsed/vehicleAccessDuration),phase=entering?t:1-t,approach=smooth(phase/.22),transfer=clamp01((phase-.38)/.42),move=smooth((transfer-.15)/.85),seated=smooth(transfer/.45),seat=vehicleLocalPoint(car,plan.seat.x,plan.seat.z);
 const start={x:mix(plan.outside.x,plan.stage.x,approach),z:mix(plan.outside.z,plan.stage.z,approach)};
 const doorway=vehicleLocalPoint(car,plan.side*car.item.width*.48,car.item.depth*.02),reach=smooth(move*2),settle=smooth((move-.5)*2);
 const point={x:mix(mix(start.x,doorway.x,reach),seat.x,settle),z:mix(mix(start.z,doorway.z,reach),seat.z,settle)};
 const turn=smooth(phase/.65),driverYaw=car.yaw+Math.PI,delta=Math.atan2(Math.sin(driverYaw-plan.standingYaw),Math.cos(driverYaw-plan.standingYaw));
 return {position:point,lift:plan.seat.floor*seated,seated,yaw:plan.standingYaw+delta*turn,door:{side:plan.side,angle:vehicleDoorAngle*(phase<.38?smooth((phase-.22)/.16):1-smooth((phase-.8)/.2))},walking:phase>0&&phase<.22};
}
export function vehicleAccessPlan(world:WalkWorld,car:VehicleState,outside:WalkPoint,standingYaw:number):VehicleAccessPlan|null{
 const side=vehicleDoorSide(car,outside),seat=driverSeat(car.item,world.item);
 if(!seat||!vehicleDoorClear(world,car,side))return null;
 const plan={side,seat,outside:{...outside},stage:vehicleDoorStage(world,car,side),standingYaw};
 const length=Math.hypot(outside.x-plan.stage.x,outside.z-plan.stage.z)+car.item.width+world.radius*2,steps=Math.max(100,Math.ceil(length/.015));
 for(let i=0;i<=steps;i++){
  const pose=vehicleAccessFrame(car,plan,true,vehicleAccessDuration*i/steps),base=world.groundLevel+pose.lift,height=world.height-(world.height*.44-seat.seatHeight)*pose.seated;
  if(!world.isClear(pose.position,{base,height},car.key))return null;
  if(pose.seated===0&&Math.abs((world.navigationSupport(pose.position,world.groundLevel,world.groundLevel+.001)??Infinity)-world.groundLevel)>.001)return null;
 }
 return plan;
}
export type VehicleWheels={roll:number;steer:number};
export const vehicleWheelRadius=(item:Furniture)=>Math.min((item.height??1.45)*.21,item.depth*.09,item.width*.18);
export const vehicleWheelWidth=(item:Furniture)=>Math.min(item.width*.11,item.depth*.12);
/** Fits the original figure inside the compact cabin, without scaling the person. */
export function driverSeat(item:Furniture,person:Furniture){
 const h=item.height??1.45,ph=person.height??1.7,floor=h*.1,top=h*.285,seatHeight=top-floor;
 const legCos=(seatHeight-ph*.23)/(ph*.21),legReach=ph*.21*Math.sqrt(Math.max(0,1-legCos*legCos));
 if(item.kind!=='smallCar'||seatHeight<ph*.14||seatHeight>ph*.38||top+ph*.56>h*.96-.015||person.width*.49+.01>item.width*.18||person.width*.62>item.width*.29||legReach+person.depth*.41>item.depth*.26-.015||person.depth*.34>item.depth*.18-.015)return null;
 return {x:-item.width*.135,z:item.depth*.1,floor,seatHeight};
}
export function vehicleCandidate(world:WalkWorld,key:string){
 for(const floor of world.model)for(const item of floor.furniture)if(JSON.stringify([floor.id,item.id])===key)return {key,floorId:floor.id,item,position:{x:item.x,z:item.y},yaw:item.rotation*Math.PI/180,speed:0,wheelRoll:0,steerAngle:0};
 return null;
}
export function vehicleEntryReason(world:WalkWorld,motion:WalkMotion,car:VehicleState){
 if(car.item.kind!=='smallCar')return 'Por ahora solo se puede manejar el auto chico.';
 if(car.floorId!==world.model[0]?.id||Math.abs((car.item.elevation??0))>.001||Math.abs(motion.feet-world.groundLevel)>.001)return 'El auto y la persona deben estar en el suelo de planta baja.';
 if(!driverSeat(car.item,world.item))return 'El habitáculo no se adapta al tamaño de esta persona.';
 if(!motion.grounded||motion.crouched)return 'Acercate de pie y apoyado en el suelo.';
 const dx=motion.position.x-car.position.x,dz=motion.position.z-car.position.z,c=Math.cos(car.yaw),s=Math.sin(car.yaw),x=dx*c+dz*s,z=-dx*s+dz*c;
 if(Math.abs(z)>car.item.depth*.4||Math.abs(x)<car.item.width/2+world.radius-.02||Math.abs(x)>car.item.width/2+world.radius+.65)return 'Acercate a uno de los laterales del auto para entrar.';
 if(!world.vehicleClear(car.key,car.position,car.yaw,car.item.width,car.item.depth,car.item.height??1.45))return 'El auto necesita espacio libre y suelo sin huecos.';
 // The short path to the door must be clear; do not enter through a wall.
 const doorX=Math.sign(x)*(car.item.width/2+world.radius+.025);
 for(let i=0;i<=12;i++){const lx=x+(doorX-x)*i/12,p={x:car.position.x+lx*c-z*s,z:car.position.z+lx*s+z*c};if(!world.canOccupy(p,{base:world.groundLevel,height:world.height,navigation:world.groundLevel}))return 'Hay un obstáculo entre la persona y la puerta.';}
 if(!vehicleAccessPlan(world,car,motion.position,car.yaw+Math.PI))return 'No hay espacio para abrir la puerta y entrar por este lateral.';
 return '';
}
export function advanceVehicle(world:WalkWorld,source:VehicleState,throttle:number,steering:number,brake:boolean,seconds:number){
 let car={...source,position:{...source.position}},distance=0,blocked=false;
 if(![seconds,throttle,steering].every(Number.isFinite))return {car,distance,blocked};
 const duration=Math.max(0,Math.min(.05,seconds)),steps=Math.max(1,Math.ceil(duration/.005)),dt=duration/steps;
 for(let i=0;i<steps;i++){
  const slowing=brake||!throttle||Math.sign(car.speed)!==Math.sign(throttle)&&Math.abs(car.speed)>.01;
  let speed=slowing?Math.sign(car.speed)*Math.max(0,Math.abs(car.speed)-(brake?9:throttle?6:2)*dt):Math.max(-2,Math.min(4,car.speed+throttle*3*dt));
  if(Math.abs(speed)<.0001)speed=0;
  const wanted=Math.max(-1,Math.min(1,steering))*.5,steerAngle=car.steerAngle+Math.max(-2.5*dt,Math.min(2.5*dt,wanted-car.steerAngle));
  const yaw=car.yaw+speed/Math.max(1,car.item.depth*.65)*Math.tan(steerAngle)*dt;
  const position={x:car.position.x+Math.sin(yaw)*speed*dt,z:car.position.z-Math.cos(yaw)*speed*dt};
  if(!world.vehicleClear(car.key,position,yaw,car.item.width,car.item.depth,car.item.height??1.45)){car.speed=0;car.steerAngle=steerAngle;blocked=true;break;}
  distance+=Math.hypot(position.x-car.position.x,position.z-car.position.z);car={...car,position,yaw,speed,steerAngle,wheelRoll:(car.wheelRoll-speed*dt/vehicleWheelRadius(car.item))%(Math.PI*2)};
 }
 return {car,distance,blocked};
}
export function vehicleItem(car:VehicleState):Furniture{return {...car.item,x:car.position.x,y:car.position.z,rotation:((car.yaw*180/Math.PI)%360+360)%360};}
export function vehicleExit(world:WalkWorld,car:VehicleState):WalkPoint|null{
 if(Math.abs(car.speed)>.05)return null;
 for(const side of [-1,1] as const){
  const p=vehicleDoorStage(world,car,side);
  if(world.canOccupy(p,{base:world.groundLevel,height:world.height,navigation:world.groundLevel})&&vehicleAccessPlan(world,car,p,car.yaw+Math.PI))return p;
 }
 return null;
}
