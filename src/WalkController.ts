import {findClimbAction,climbMotion} from './climb';
import type {ClimbAction} from './climb';
import {MathUtils,PerspectiveCamera,Raycaster,Vector3} from 'three';
import type {Object3D} from 'three';
import {walkDelta} from './walkPhysics';
import {advanceWalk,initialMotion,jump,toggleCrouch} from './walkMotion';
import type {WalkWorld} from './walkPhysics';
import type {createWalkingPerson} from './WalkingPerson';
export type WalkCameraMode='first'|'third';
export type WalkAction='forward'|'back'|'left'|'right';
export type WalkAbility='crouch'|'jump'|'climb';
export type WalkProgress={climb:{kind:'up'|'down';name:string;active:boolean}|null;elevation:number;distance:number;blocked:boolean;crouched:boolean;grounded:boolean;standBlocked:boolean};
export type WalkClock={request:(cb:(time:number)=>void)=>number;cancel:(id:number)=>void};
const keys:Record<string,WalkAction>={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
/** The frame loop exists only while walking. Inputs are released on blur, hide and disposal. */
export function createWalkController(canvas:HTMLCanvasElement,world:WalkWorld,avatar:ReturnType<typeof createWalkingPerson>,obstacles:Object3D[],render:()=>void,report:(p:WalkProgress)=>void,clock:WalkClock={request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id)}){
 const camera=new PerspectiveCamera(65,1,.02,6000),direction=new Vector3(),target=new Vector3(),desired=new Vector3(),ray=new Raycaster();
 const keyboard=new Set<string>(),touch=new Set<WalkAction>(),windowTarget=canvas.ownerDocument.defaultView!,documentTarget=canvas.ownerDocument;
 let motion=initialMotion(world),yaw=world.item.rotation*Math.PI/180,pitch=-.1,mode:WalkCameraMode='third',distance=0,closed=false,frame=0,previous:number|undefined,drag:{id:number;x:number;y:number}|null=null,lastReport='',wasMoving=false,wasGrounded=true;
 let climb:{action:ClimbAction;elapsed:number}|null=null,hint:ClimbAction|null=null,hintKey='',hintTime=-Infinity,now=0;
 const cursor=canvas.style.cursor;canvas.style.cursor='grab';
 function cameraUpdate(){
  direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  target.set(motion.position.x,motion.feet+world.height*(motion.crouched?.63:.93),motion.position.z);
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
  camera.updateMatrixWorld();avatar.root.position.set(motion.position.x,motion.feet,motion.position.z);avatar.root.rotation.y=-yaw;
 }
 function refreshHint(force=false){
  if(climb){hint=null;return;}
  const key=JSON.stringify([motion.position,motion.feet,motion.grounded,motion.crouched,motion.platform,yaw]);
  if(!force&&(key===hintKey||now-hintTime<120))return;
  hintKey=key;hintTime=now;hint=findClimbAction(world,motion,yaw);
 }
 function pose(moving=false){avatar.pose(distance,moving,motion.crouched,!motion.grounded&&!climb,climb?climb.elapsed/climb.action.duration:0);}
 function look(dx:number,dy:number){if(!climb)yaw+=dx;pitch=MathUtils.clamp(pitch+dy,-1.15,.65);refreshHint(true);cameraUpdate();progress();render();}
 function stopDrag(){const d=drag;drag=null;if(d&&canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);}
 function pause(){
  const interrupted=!!climb;if(climb){motion={...climb.action.from,position:{...climb.action.from.position}};climb=null;hintKey='';}
  keyboard.clear();touch.clear();stopDrag();previous=undefined;pose();
  if(interrupted&&!closed){refreshHint(true);cameraUpdate();progress();render();}
 }
 function down(e:PointerEvent){if(!e.isPrimary||e.button!==0||drag)return;canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent){if(drag?.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={id:e.pointerId,x:e.clientX,y:e.clientY};look(dx*.004,-dy*.004);}
 function up(e:PointerEvent){if(drag?.id===e.pointerId)stopDrag();}
 function progress(blocked=false){const action=climb?.action??hint,value={climb:action?{kind:action.kind,name:action.name,active:!!climb}:null,elevation:motion.feet,distance,blocked,crouched:motion.crouched,grounded:motion.grounded,standBlocked:motion.standBlocked},key=JSON.stringify({...value,elevation:Math.round(motion.feet*10),distance:Math.floor(distance*10)});if(key!==lastReport){lastReport=key;report(value);}}
 function act(action:WalkAbility){
  if(climb)return;
  if(action==='climb'){
   refreshHint(true);if(!hint)return;keyboard.clear();touch.clear();stopDrag();
   const dx=hint.to.position.x-hint.from.position.x,dz=hint.to.position.z-hint.from.position.z;yaw=Math.atan2(-dx,dz);
   climb={action:hint,elapsed:0};motion=climbMotion(hint,0);hint=null;
  }else motion=action==='crouch'?toggleCrouch(world,motion):jump(motion);
  refreshHint(true);pose();cameraUpdate();progress();render();
 }
 function keyDown(e:KeyboardEvent){if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='KeyC'||e.code==='Space'||e.code==='KeyE'){e.preventDefault();if(!e.repeat)act(e.code==='KeyE'?'climb':e.code==='KeyC'?'crouch':'jump');}else if(keys[e.code]){e.preventDefault();if(!climb)keyboard.add(e.code);}else if(e.code==='Home'){e.preventDefault();reset();}}
 function keyUp(e:KeyboardEvent){keyboard.delete(e.code);}
 function reset(){pause();motion=initialMotion(world);yaw=world.item.rotation*Math.PI/180;pitch=-.1;distance=0;lastReport='';avatar.pose(0,false,false,false);camera.fov=65;camera.updateProjectionMatrix();refreshHint(true);cameraUpdate();progress();render();}
 function tick(time:number){
  if(closed)return;const dt=previous===undefined?0:(time-previous)/1000;previous=time;now=time;
  if(climb){
   const before=motion.position;climb.elapsed=Math.min(climb.action.duration,climb.elapsed+Math.max(0,Math.min(.05,dt)));motion=climbMotion(climb.action,climb.elapsed);
   distance+=Math.hypot(motion.position.x-before.x,motion.position.z-before.z);
   if(climb.elapsed>=climb.action.duration){climb=null;hintKey='';refreshHint(true);}
   pose();cameraUpdate();progress();render();wasMoving=false;wasGrounded=motion.grounded;frame=clock.request(tick);return;
  }
  const pressed=(action:WalkAction)=>touch.has(action)||[...keyboard].some(k=>keys[k]===action);
  const f=Number(pressed('forward'))-Number(pressed('back')),r=Number(pressed('right'))-Number(pressed('left'));
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
 return {camera,look,reset,pause,act,setMode(next:WalkCameraMode){pause();mode=next;cameraUpdate();render();},
  input(action:WalkAction,pressed:boolean){if(pressed&&!climb)touch.add(action);else touch.delete(action);},
  resize(aspect:number){camera.aspect=aspect;camera.updateProjectionMatrix();},
  zoom(factor:number){camera.fov=MathUtils.clamp(camera.fov/factor,35,95);camera.updateProjectionMatrix();render();},
  dispose(){closed=true;clock.cancel(frame);pause();canvas.style.cursor=cursor;for(const [name,handler] of Object.entries(events))canvas.removeEventListener(name,handler as EventListener);windowTarget.removeEventListener('keyup',keyUp);windowTarget.removeEventListener('blur',pause);documentTarget.removeEventListener('visibilitychange',pause);}
 };
}
