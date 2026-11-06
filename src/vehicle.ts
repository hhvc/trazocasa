import type {Furniture} from './model';
import type {WalkWorld,WalkPoint} from './walkPhysics';
import type {WalkMotion} from './walkMotion';
export type VehicleState={key:string;floorId:string;item:Furniture;position:WalkPoint;yaw:number;speed:number};
export type VehicleChange={key:string;floorId:string;item:Furniture;level:number};
export function vehicleCandidate(world:WalkWorld,key:string){
 for(const floor of world.model)for(const item of floor.furniture)if(JSON.stringify([floor.id,item.id])===key)return {key,floorId:floor.id,item,position:{x:item.x,z:item.y},yaw:item.rotation*Math.PI/180,speed:0};
 return null;
}
export function vehicleEntryReason(world:WalkWorld,motion:WalkMotion,car:VehicleState){
 if(car.item.kind!=='smallCar')return 'Por ahora solo se puede manejar el auto chico.';
 if(car.floorId!==world.model[0]?.id||Math.abs((car.item.elevation??0))>.001||Math.abs(motion.feet-world.groundLevel)>.001)return 'El auto y la persona deben estar en el suelo de planta baja.';
 if(!motion.grounded||motion.crouched)return 'Acercate de pie y apoyado en el suelo.';
 const dx=motion.position.x-car.position.x,dz=motion.position.z-car.position.z,c=Math.cos(car.yaw),s=Math.sin(car.yaw),x=dx*c+dz*s,z=-dx*s+dz*c;
 if(Math.abs(z)>car.item.depth*.4||Math.abs(x)<car.item.width/2+world.radius-.02||Math.abs(x)>car.item.width/2+world.radius+.65)return 'Acercate a uno de los laterales del auto para entrar.';
 if(!world.vehicleClear(car.key,car.position,car.yaw,car.item.width,car.item.depth,car.item.height??1.45))return 'El auto necesita espacio libre y suelo sin huecos.';
 // The short path to the door must be clear; do not enter through a wall.
 const doorX=Math.sign(x)*(car.item.width/2+world.radius+.025);
 for(let i=0;i<=12;i++){const lx=x+(doorX-x)*i/12,p={x:car.position.x+lx*c-z*s,z:car.position.z+lx*s+z*c};if(!world.canOccupy(p,{base:world.groundLevel,height:world.height,navigation:world.groundLevel}))return 'Hay un obstáculo entre la persona y la puerta.';}
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
  const yaw=car.yaw+Math.max(-1,Math.min(1,steering))*speed/Math.max(1,car.item.depth*.65)*Math.tan(.5)*dt;
  const position={x:car.position.x+Math.sin(yaw)*speed*dt,z:car.position.z-Math.cos(yaw)*speed*dt};
  if(!world.vehicleClear(car.key,position,yaw,car.item.width,car.item.depth,car.item.height??1.45)){car.speed=0;blocked=true;break;}
  distance+=Math.hypot(position.x-car.position.x,position.z-car.position.z);car={...car,position,yaw,speed};
 }
 return {car,distance,blocked};
}
export function vehicleItem(car:VehicleState):Furniture{return {...car.item,x:car.position.x,y:car.position.z,rotation:((car.yaw*180/Math.PI)%360+360)%360};}
export function vehicleExit(world:WalkWorld,car:VehicleState):WalkPoint|null{
 if(Math.abs(car.speed)>.05)return null;
 const c=Math.cos(car.yaw),s=Math.sin(car.yaw);
 for(const side of [-1,1])for(const z of [0,-car.item.depth*.2,car.item.depth*.2]){
  let result:WalkPoint|null=null;
  for(let i=0;i<=4;i++){const x=side*(car.item.width/2+world.radius+.025+i*.025),p={x:car.position.x+x*c-z*s,z:car.position.z+x*s+z*c};
   if(!world.isClear(p,{base:world.groundLevel,height:world.height})||Math.abs((world.navigationSupport(p,world.groundLevel,world.groundLevel+.001)??Infinity)-world.groundLevel)>.001){result=null;break;}result=p;
  }
  if(result)return result;
 }
 return null;
}
