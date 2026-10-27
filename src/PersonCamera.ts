import {MathUtils,PerspectiveCamera,Vector3} from 'three';
import type {PersonView} from './personView';
/** A fixed eye position with yaw/pitch look controls. No movement or animation loop. */
export function createPersonCamera(canvas:HTMLCanvasElement,render:()=>void){
 const camera=new PerspectiveCamera(65,1,.02,6000),direction=new Vector3();
 let view:PersonView|null=null,yaw=0,pitch=0,drag:{id:number;x:number;y:number}|null=null;
 const cursor=canvas.style.cursor;
 function update(){direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));camera.lookAt(direction.add(camera.position));camera.updateMatrixWorld();render();}
 function look(horizontal:number,vertical:number){if(!view)return;yaw+=horizontal;pitch=MathUtils.clamp(pitch+vertical,-Math.PI*4/9,Math.PI*4/9);update();}
 function stop(){const previous=drag;drag=null;if(previous&&canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);}
 function down(e:PointerEvent){if(!view||!e.isPrimary||e.button!==0||drag)return;canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent){if(!view||drag?.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={id:e.pointerId,x:e.clientX,y:e.clientY};look(dx*.004,-dy*.004);}
 function up(e:PointerEvent){if(drag?.id===e.pointerId)stop();}
 function reset(){if(!view)return;yaw=view.yaw;pitch=0;camera.fov=65;camera.updateProjectionMatrix();update();}
 function key(e:KeyboardEvent){if(!view||e.ctrlKey||e.metaKey||e.altKey)return;const delta:Record<string,[number,number]>={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,.12],ArrowDown:[0,-.12]};if(delta[e.key]){e.preventDefault();look(...delta[e.key]);}else if(e.key==='Home'){e.preventDefault();reset();}}
 const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:up,keydown:key};
 for(const [name,handler] of Object.entries(events))canvas.addEventListener(name,handler as EventListener);
 return {camera,get active(){return !!view;},look,reset,
  set(next:PersonView|null){stop();view=next;canvas.style.cursor=next?'grab':cursor;if(next){camera.position.set(next.x,next.y,next.z);reset();}},
  resize(aspect:number){camera.aspect=aspect;camera.updateProjectionMatrix();},
  zoom(factor:number){if(!view)return;camera.fov=MathUtils.clamp(camera.fov/factor,35,95);camera.updateProjectionMatrix();render();},
  dispose(){stop();view=null;canvas.style.cursor=cursor;for(const [name,handler] of Object.entries(events))canvas.removeEventListener(name,handler as EventListener);}
 };
}
