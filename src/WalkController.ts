import {MathUtils,PerspectiveCamera,Raycaster,Vector3} from 'three';
import type {Object3D} from 'three';
import {moveWalker,walkDelta} from './walkPhysics';
import type {WalkWorld} from './walkPhysics';
import type {createWalkingPerson} from './WalkingPerson';
export type WalkCameraMode='first'|'third';
export type WalkAction='forward'|'back'|'left'|'right';
export type WalkProgress={distance:number;blocked:boolean};
export type WalkClock={request:(cb:(time:number)=>void)=>number;cancel:(id:number)=>void};
const keys:Record<string,WalkAction>={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
/** The frame loop exists only while walking. Inputs are released on blur, hide and disposal. */
export function createWalkController(canvas:HTMLCanvasElement,world:WalkWorld,avatar:ReturnType<typeof createWalkingPerson>,obstacles:Object3D[],render:()=>void,report:(p:WalkProgress)=>void,clock:WalkClock={request:requestAnimationFrame,cancel:cancelAnimationFrame}){
 const camera=new PerspectiveCamera(65,1,.02,6000),direction=new Vector3(),target=new Vector3(),desired=new Vector3(),ray=new Raycaster();
 const keyboard=new Set<string>(),touch=new Set<WalkAction>(),windowTarget=canvas.ownerDocument.defaultView!,documentTarget=canvas.ownerDocument;
 let position={...world.start},yaw=world.item.rotation*Math.PI/180,pitch=-.1,mode:WalkCameraMode='third',distance=0,closed=false,frame=0,previous:number|undefined,drag:{id:number;x:number;y:number}|null=null,lastReport=-1,lastBlocked=false;
 const cursor=canvas.style.cursor;canvas.style.cursor='grab';
 function cameraUpdate(){
  direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  target.set(position.x,world.base+world.height*.93,position.z);
  if(mode==='first'){camera.position.copy(target);camera.lookAt(desired.copy(target).add(direction));avatar.root.visible=false;}
  else{
   const length=Math.max(1.5,world.height*1.8);desired.copy(target).addScaledVector(direction,-length);desired.y=Math.max(world.base+.18,desired.y);
   const vector=desired.clone().sub(target),full=vector.length();vector.normalize();let reach=full;
   // Multiple rays reserve space for the near plane around the camera, including at corners.
   const side=new Vector3().crossVectors(vector,new Vector3(0,1,0)).normalize();
   for(const offset of [new Vector3(),side.clone().multiplyScalar(.14),side.clone().multiplyScalar(-.14),new Vector3(0,.14,0),new Vector3(0,-.14,0)]){
    ray.set(target.clone().add(offset),vector);ray.far=full+.15;const hit=ray.intersectObjects(obstacles,false)[0];if(hit)reach=Math.min(reach,Math.max(.02,hit.distance-.18));
   }
   camera.position.copy(target).addScaledVector(vector,reach);camera.lookAt(target);avatar.root.visible=reach>world.height*.4;
  }
  camera.updateMatrixWorld();avatar.root.position.set(position.x,world.base,position.z);avatar.root.rotation.y=-yaw;
 }
 function look(dx:number,dy:number){yaw+=dx;pitch=MathUtils.clamp(pitch+dy,-1.15,.65);cameraUpdate();render();}
 function stopDrag(){const d=drag;drag=null;if(d&&canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);}
 function pause(){keyboard.clear();touch.clear();stopDrag();previous=undefined;avatar.pose(distance,false);}
 function down(e:PointerEvent){if(!e.isPrimary||e.button!==0||drag)return;canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent){if(drag?.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={id:e.pointerId,x:e.clientX,y:e.clientY};look(dx*.004,-dy*.004);}
 function up(e:PointerEvent){if(drag?.id===e.pointerId)stopDrag();}
 function keyDown(e:KeyboardEvent){if(e.ctrlKey||e.metaKey||e.altKey)return;if(keys[e.code]){e.preventDefault();keyboard.add(e.code);}else if(e.code==='Home'){e.preventDefault();reset();}}
 function keyUp(e:KeyboardEvent){keyboard.delete(e.code);}
 function reset(){pause();position={...world.start};yaw=world.item.rotation*Math.PI/180;pitch=-.1;distance=0;lastReport=-1;camera.fov=65;camera.updateProjectionMatrix();cameraUpdate();report({distance:0,blocked:false});render();}
 function tick(time:number){
  if(closed)return;const dt=previous===undefined?0:(time-previous)/1000;previous=time;
  const pressed=(action:WalkAction)=>touch.has(action)||[...keyboard].some(k=>keys[k]===action);
  const f=Number(pressed('forward'))-Number(pressed('back')),r=Number(pressed('right'))-Number(pressed('left'));
  const delta=walkDelta(yaw,f,r,dt),next=moveWalker(world,position,delta.x,delta.z),travel=Math.hypot(next.x-position.x,next.z-position.z);position=next;distance+=travel;
  const blocked=!!(f||r)&&dt>0&&travel<Math.hypot(delta.x,delta.z)*.25;avatar.pose(distance,travel>.0001);cameraUpdate();
  if(Math.floor(distance*10)!==lastReport||blocked!==lastBlocked){lastReport=Math.floor(distance*10);lastBlocked=blocked;report({distance,blocked});}
  render();frame=clock.request(tick);
 }
 const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:up,keydown:keyDown,blur:pause};
 for(const [name,handler] of Object.entries(events))canvas.addEventListener(name,handler as EventListener);
 windowTarget.addEventListener('keyup',keyUp);windowTarget.addEventListener('blur',pause);documentTarget.addEventListener('visibilitychange',pause);
 cameraUpdate();frame=clock.request(tick);
 return {camera,look,reset,pause,setMode(next:WalkCameraMode){pause();mode=next;cameraUpdate();render();},
  input(action:WalkAction,pressed:boolean){if(pressed)touch.add(action);else touch.delete(action);},
  resize(aspect:number){camera.aspect=aspect;camera.updateProjectionMatrix();},
  zoom(factor:number){camera.fov=MathUtils.clamp(camera.fov/factor,35,95);camera.updateProjectionMatrix();render();},
  dispose(){closed=true;clock.cancel(frame);pause();canvas.style.cursor=cursor;for(const [name,handler] of Object.entries(events))canvas.removeEventListener(name,handler as EventListener);windowTarget.removeEventListener('keyup',keyUp);windowTarget.removeEventListener('blur',pause);documentTarget.removeEventListener('visibilitychange',pause);}
 };
}
