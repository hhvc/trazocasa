import {isSeatKind,selectedSeat,seatExit} from './seating';
import type {SeatPlace} from './seating';
import {driverSeat,advanceVehicle,vehicleCandidate,vehicleEntryReason,vehicleItem,vehicleExit} from './vehicle';
import type {VehicleState,VehicleChange} from './vehicle';
import {createWalkWorld} from './walkPhysics';
import {findClimbAction,climbMotion,selectedClimb} from './climb';
import type {ClimbAction,WalkTarget} from './climb';
import {MathUtils,PerspectiveCamera,Raycaster,Vector3} from 'three';
import type {Object3D} from 'three';
import {walkDelta} from './walkPhysics';
import {advanceWalk,initialMotion,jump,toggleCrouch} from './walkMotion';
import type {WalkWorld} from './walkPhysics';
import type {createWalkingPerson} from './WalkingPerson';
export type WalkCameraMode='first'|'third';
export type WalkAction='forward'|'back'|'left'|'right'|'brake';
export type WalkAbility='crouch'|'jump'|'climb'|'clearSelection';
export type WalkProgress={seat?:{active:boolean;canSit:boolean}|null;vehicle?:{active:boolean;canEnter:boolean;speed:number}|null;interaction?:{key:string;name:string;reason:string}|null;climb:{kind:'up'|'down';name:string;active:boolean}|null;elevation:number;distance:number;blocked:boolean;crouched:boolean;grounded:boolean;standBlocked:boolean};
export type WalkClock={request:(cb:(time:number)=>void)=>number;cancel:(id:number)=>void};
const keys:Record<string,WalkAction>={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
/** The frame loop exists only while walking. Inputs are released on blur, hide and disposal. */
export function createWalkController(canvas:HTMLCanvasElement,world:WalkWorld,avatar:ReturnType<typeof createWalkingPerson>,obstacles:Object3D[],render:()=>void,report:(p:WalkProgress)=>void,clock:WalkClock={request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id)},vehicleChanged:(change:VehicleChange)=>void=()=>{}){
 const camera=new PerspectiveCamera(65,1,.02,6000),direction=new Vector3(),target=new Vector3(),desired=new Vector3(),ray=new Raycaster();
 const keyboard=new Set<string>(),touch=new Set<WalkAction>(),windowTarget=canvas.ownerDocument.defaultView!,documentTarget=canvas.ownerDocument;
 let motion=initialMotion(world),yaw=world.item.rotation*Math.PI/180,pitch=-.1,mode:WalkCameraMode='third',distance=0,closed=false,frame=0,previous:number|undefined,drag:{id:number;x:number;y:number}|null=null,lastReport='',wasMoving=false,wasGrounded=true;
 let climb:{action:ClimbAction;elapsed:number;distance:number}|null=null,hint:ClimbAction|null=null,hintKey='',hintTime=-Infinity,now=0;
 let selectedTarget:WalkTarget|null=null,interaction:WalkProgress['interaction']=null;
 let seated:SeatPlace|null=null,seatHint:SeatPlace|null=null,seatReason='';
 const originalWorld=world,changedVehicles=new Map<string,VehicleChange>();
 let driving:VehicleState|null=null,vehicleHint:VehicleState|null=null,vehicleReason='';
 function changeVehicle(car:VehicleState){const change={key:car.key,floorId:car.floorId,item:vehicleItem(car),level:world.groundLevel,wheels:{roll:car.wheelRoll,steer:car.steerAngle}};changedVehicles.set(car.key,change);vehicleChanged(change);}
 function parkedWorld(){return createWalkWorld(originalWorld.model.map(f=>({...f,furniture:f.furniture.map(item=>changedVehicles.get(JSON.stringify([f.id,item.id]))?.item??item)})),originalWorld.selection);}
 function resetVehicles(){driving=null;for(const change of changedVehicles.values()){const original=vehicleCandidate(originalWorld,change.key);if(original)vehicleChanged({...change,item:original.item,wheels:{roll:0,steer:0}});}changedVehicles.clear();world=originalWorld;vehicleHint=null;vehicleReason='';}
 const cursor=canvas.style.cursor;canvas.style.cursor='grab';
 function cameraUpdate(){
  if(driving){const car=driving,h=car.item.height??1.45,seat=driverSeat(car.item,world.item)!;
   target.set(car.position.x,world.groundLevel+h*.7,car.position.z);direction.set(Math.sin(car.yaw),0,-Math.cos(car.yaw));desired.copy(target).addScaledVector(direction,-Math.max(4,car.item.depth*1.35)).add(new Vector3(-Math.cos(car.yaw),0,-Math.sin(car.yaw)).multiplyScalar(car.item.width*.9));desired.y+=h*.35;
   const v=desired.clone().sub(target),length=v.length();ray.set(target,v.normalize());ray.far=length;
   // Ignore only this car's instances, retaining walls and other cars in the same batch.
   const hit=ray.intersectObjects(obstacles,false).find(hit=>{const selected=hit.instanceId===undefined?hit.object.userData.selection:hit.object.userData.selections?.[hit.instanceId];return selected?.floorId!==car.floorId||selected?.elementId!==car.item.id;});
   camera.position.copy(target).addScaledVector(v,hit?Math.max(.05,hit.distance-.15):length);camera.lookAt(target);camera.updateMatrixWorld();
   avatar.root.position.set(car.position.x+seat.x*Math.cos(car.yaw)-seat.z*Math.sin(car.yaw),world.groundLevel+seat.floor,car.position.z+seat.x*Math.sin(car.yaw)+seat.z*Math.cos(car.yaw));avatar.root.rotation.y=Math.PI-car.yaw;avatar.root.visible=true;avatar.pose(0,false,false,false,0,seat.seatHeight);return;}

  direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  target.set(motion.position.x,motion.feet+(seated?seated.height+world.height*.49:world.height*(motion.crouched?.63:.93)),motion.position.z);
  if(mode==='first'){camera.position.copy(target);camera.lookAt(desired.copy(target).add(direction));avatar.root.visible=false;}
  else{
   const length=Math.max(1.5,world.height*1.8);desired.copy(target).addScaledVector(direction,-length);desired.y=Math.max(motion.feet+.18,desired.y);
   const vector=desired.clone().sub(target),full=vector.length();vector.normalize();let reach=full;
   // Multiple rays reserve space for the near plane around the camera, including at corners.
   const side=new Vector3().crossVectors(vector,new Vector3(0,1,0)).normalize();
   for(const offset of [new Vector3(),side.clone().multiplyScalar(.14),side.clone().multiplyScalar(-.14),new Vector3(0,.14,0),new Vector3(0,-.14,0)]){
    ray.set(target.clone().add(offset),vector);ray.far=full+.15;const hit=ray.intersectObjects(obstacles,false)[0];if(hit)reach=Math.min(reach,Math.max(.02,hit.distance-.18));
   }
   camera.position.copy(target).addScaledVector(vector,reach);camera.lookAt(target);avatar.root.visible=reach>world.height*.4;
  }
  camera.updateMatrixWorld();avatar.root.position.set(motion.position.x,motion.feet,motion.position.z);avatar.root.rotation.y=-(seated?.yaw??yaw);
 }
 function refreshHint(force=false){
  if(seated){hint=null;seatHint=null;vehicleHint=null;interaction={key:seated.key,name:seated.name,reason:seatReason||'E o Levantarse para volver a caminar. Podés mirar alrededor.'};return;}
  if(driving){hint=null;vehicleHint=null;interaction={key:driving.key,name:'Auto chico',reason:vehicleReason||(Math.abs(driving.speed)>.05?'Detenete para salir.':'E: salir · W/S: acelerar o retroceder · A/D: girar · Espacio: frenar')};return;}
  if(climb){hint=null;return;}
  const key=JSON.stringify([motion.position,motion.feet,motion.grounded,motion.crouched,motion.platform,yaw,selectedTarget?.key]);
  if(!force&&(key===hintKey||now-hintTime<120))return;
  hintKey=key;hintTime=now;vehicleHint=null;seatHint=null;
  if(selectedTarget&&isSeatKind(selectedTarget.kind)){const result=selectedSeat(world,motion,selectedTarget);seatHint=result.place;hint=null;interaction={key:selectedTarget.key,name:selectedTarget.name,reason:result.reason||'Usá Sentarse o E.'};return;}
  if(selectedTarget&&['smallCar','mediumCar','pickup'].includes(selectedTarget.kind)){const car=vehicleCandidate(world,selectedTarget.key);const reason=car?vehicleEntryReason(world,motion,car):'Este vehículo no está disponible.';vehicleHint=car&&!reason?car:null;hint=null;interaction={key:selectedTarget.key,name:selectedTarget.name,reason:reason||'Usá Entrar o E para manejar.'};return;}
  if(selectedTarget){const result=selectedClimb(world,motion,yaw,selectedTarget);hint=result.action;interaction={key:selectedTarget.key,name:selectedTarget.name,reason:result.reason};}else{hint=findClimbAction(world,motion,yaw);interaction=null;}
 }
 function pose(moving=false){avatar.pose(distance,moving,motion.crouched,!motion.grounded&&!climb,climb?climb.elapsed/climb.action.duration:0,seated?.height);}
 function look(dx:number,dy:number){if(driving)return;if(!climb)yaw+=dx;pitch=MathUtils.clamp(pitch+dy,-1.15,.65);refreshHint(true);cameraUpdate();progress();render();}
 function stopDrag(){const d=drag;drag=null;if(d&&canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);}
 function pause(){
  const interrupted=!!climb||!!driving;if(driving){driving.speed=0;driving.steerAngle=0;changeVehicle(driving);}if(climb){motion={...climb.action.from,position:{...climb.action.from.position}};distance=climb.distance;climb=null;hintKey='';}
  keyboard.clear();touch.clear();stopDrag();previous=undefined;pose();
  if(interrupted&&!closed){refreshHint(true);cameraUpdate();progress();render();}
 }
 function down(e:PointerEvent){if(!e.isPrimary||e.button!==0||drag)return;canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent){if(drag?.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={id:e.pointerId,x:e.clientX,y:e.clientY};look(dx*.004,-dy*.004);}
 function up(e:PointerEvent){if(drag?.id===e.pointerId)stopDrag();}
 function progress(blocked=false){const action=climb?.action??hint,value={seat:seated?{active:true,canSit:false}:selectedTarget&&isSeatKind(selectedTarget.kind)?{active:false,canSit:!!seatHint}:null,vehicle:driving?{active:true,canEnter:false,speed:driving.speed}:vehicleHint?{active:false,canEnter:true,speed:0}:null,interaction,climb:action?{kind:action.kind,name:action.name,active:!!climb}:null,elevation:motion.feet,distance,blocked,crouched:motion.crouched,grounded:motion.grounded,standBlocked:motion.standBlocked},key=JSON.stringify({...value,elevation:Math.round(motion.feet*10),distance:Math.floor(distance*10)});if(key!==lastReport){lastReport=key;report(value);}}
 function act(action:WalkAbility){
  if(climb)return;
  if(driving){
   if(action!=='climb')return;
   if(Math.abs(driving.speed)>.05){vehicleReason='Detenete para salir.';refreshHint(true);progress();return;}
   const nextWorld=parkedWorld(),exit=vehicleExit(nextWorld,driving);
   if(!exit){vehicleReason='No hay espacio junto a las puertas. Mové el auto a un lugar despejado.';refreshHint(true);progress();return;}
   driving.steerAngle=0;changeVehicle(driving);
   motion={...initialMotion(nextWorld),position:exit,feet:nextWorld.groundLevel,navigation:nextWorld.groundLevel};yaw=driving.yaw+Math.PI;world=nextWorld;driving=null;vehicleReason='';keyboard.clear();touch.clear();hintKey='';refreshHint(true);pose();cameraUpdate();progress();render();return;
  }
  if(seated){
   if(action!=='climb')return;
   const exit=seatExit(world,seated);
   if(!exit){seatReason='No hay espacio libre para levantarse. Podés volver al inicio.';refreshHint(true);progress();return;}
   motion={...motion,position:exit,feet:seated.base,navigation:seated.base,velocity:0,grounded:true,crouched:false,standBlocked:false,platform:undefined};seated=null;seatReason='';keyboard.clear();touch.clear();stopDrag();hintKey='';refreshHint(true);pose();cameraUpdate();progress();render();return;
  }
  if(action==='clearSelection'){selectTarget(null);return;}
  if(action==='climb'){
   refreshHint(true);
   if(seatHint){seated=seatHint;seatHint=null;seatReason='';motion={...motion,position:{...seated.position},feet:seated.base,navigation:seated.base,velocity:0,grounded:true,platform:undefined};yaw=seated.yaw;pitch=-.1;keyboard.clear();touch.clear();stopDrag();refreshHint(true);pose();cameraUpdate();progress();render();return;}
   if(vehicleHint){driving={...vehicleHint,position:{...vehicleHint.position},wheelRoll:changedVehicles.get(vehicleHint.key)?.wheels.roll??0};vehicleHint=null;vehicleReason='';keyboard.clear();touch.clear();stopDrag();changeVehicle(driving);refreshHint(true);cameraUpdate();progress();render();return;}
   if(!hint)return;keyboard.clear();touch.clear();stopDrag();
   const dx=hint.to.position.x-hint.from.position.x,dz=hint.to.position.z-hint.from.position.z;yaw=Math.atan2(-dx,dz);
   climb={action:hint,elapsed:0,distance};motion=climbMotion(hint,0);hint=null;
  }else motion=action==='crouch'?toggleCrouch(world,motion):jump(motion);
  refreshHint(true);pose();cameraUpdate();progress();render();
 }
 function selectTarget(target:WalkTarget|null){if(climb||driving||seated)return;selectedTarget=target;refreshHint(true);progress();render();}
 function keyDown(e:KeyboardEvent){if(e.ctrlKey||e.metaKey||e.altKey)return;if(driving&&e.code==='Space'){e.preventDefault();keyboard.add('Space');return;}if(e.code==='KeyC'||e.code==='Space'||e.code==='KeyE'){e.preventDefault();if(!e.repeat)act(e.code==='KeyE'?'climb':e.code==='KeyC'?'crouch':'jump');}else if(keys[e.code]){e.preventDefault();if(!climb&&!seated)keyboard.add(e.code);}else if(e.code==='Home'){e.preventDefault();reset();}}
 function keyUp(e:KeyboardEvent){keyboard.delete(e.code);}
 function reset(){pause();seated=null;seatHint=null;seatReason='';resetVehicles();selectedTarget=null;motion=initialMotion(world);yaw=world.item.rotation*Math.PI/180;pitch=-.1;distance=0;lastReport='';avatar.pose(0,false,false,false);camera.fov=65;camera.updateProjectionMatrix();refreshHint(true);cameraUpdate();progress();render();}
 function tick(time:number){
  if(closed)return;const dt=previous===undefined?0:(time-previous)/1000;previous=time;now=time;
  if(climb){
   const before=motion.position;climb.elapsed=Math.min(climb.action.duration,climb.elapsed+Math.max(0,Math.min(.05,dt)));motion=climbMotion(climb.action,climb.elapsed);
   distance+=Math.hypot(motion.position.x-before.x,motion.position.z-before.z);
   if(climb.elapsed>=climb.action.duration){climb=null;hintKey='';refreshHint(true);}
   pose();cameraUpdate();progress();render();wasMoving=false;wasGrounded=motion.grounded;frame=clock.request(tick);return;
  }
  if(seated){frame=clock.request(tick);return;}
  const pressed=(action:WalkAction)=>touch.has(action)||(action==='brake'&&keyboard.has('Space'))||[...keyboard].some(k=>keys[k]===action);
  const f=Number(pressed('forward'))-Number(pressed('back')),r=Number(pressed('right'))-Number(pressed('left'));
  if(driving){const result=advanceVehicle(world,driving,f,r,pressed('brake'),dt),changed=result.distance>0||result.car.steerAngle!==driving.steerAngle;driving=result.car;distance+=result.distance;if(result.distance>0)vehicleReason='';if(changed)changeVehicle(driving);cameraUpdate();refreshHint();progress(result.blocked);if(changed)render();frame=clock.request(tick);return;}
  const delta=walkDelta(yaw,f,r,dt),speed=motion.crouched?.5:1,previousFeet=motion.feet;
  const result=advanceWalk(world,motion,delta.x*speed,delta.z*speed,dt);motion=result.motion;const travel=result.distance;distance+=travel;
  const blocked=!!(f||r)&&dt>0&&travel<Math.hypot(delta.x,delta.z)*speed*.25,moving=travel>.0001;
  pose(moving);if(travel>0||motion.feet!==previousFeet)cameraUpdate();refreshHint();progress(blocked);
  if(travel>0||motion.feet!==previousFeet||moving!==wasMoving||motion.grounded!==wasGrounded)render();wasMoving=moving;wasGrounded=motion.grounded;frame=clock.request(tick);
 }
 const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:up,keydown:keyDown,blur:pause};
 for(const [name,handler] of Object.entries(events))canvas.addEventListener(name,handler as EventListener);
 windowTarget.addEventListener('keyup',keyUp);windowTarget.addEventListener('blur',pause);documentTarget.addEventListener('visibilitychange',pause);
 refreshHint(true);cameraUpdate();progress();frame=clock.request(tick);
 return {camera,look,reset,pause,act,selectTarget,get interacting(){return !!climb||!!driving||!!seated;},setMode(next:WalkCameraMode){pause();mode=next;cameraUpdate();render();},
  input(action:WalkAction,pressed:boolean){if(pressed&&!climb&&!seated)touch.add(action);else touch.delete(action);},
  resize(aspect:number){camera.aspect=aspect;camera.updateProjectionMatrix();},
  zoom(factor:number){camera.fov=MathUtils.clamp(camera.fov/factor,35,95);camera.updateProjectionMatrix();render();},
  dispose(){closed=true;clock.cancel(frame);pause();seated=null;seatHint=null;resetVehicles();canvas.style.cursor=cursor;for(const [name,handler] of Object.entries(events))canvas.removeEventListener(name,handler as EventListener);windowTarget.removeEventListener('keyup',keyUp);windowTarget.removeEventListener('blur',pause);documentTarget.removeEventListener('visibilitychange',pause);}
 };
}
