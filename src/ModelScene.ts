import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {wallVolumes} from './model3d';
import type {Plan} from './model';
export type ModelView='3d'|'front'|'back'|'left'|'right';
export const modelViews:{id:ModelView;name:string}[]=[{id:'3d',name:'3D'},{id:'front',name:'Frente'},{id:'back',name:'Contrafrente'},{id:'left',name:'Lateral izquierdo'},{id:'right',name:'Lateral derecho'}];
function disposeGroup(group:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 group.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
export function createModelScene(host:HTMLDivElement,plan:Plan,onSelect:(id:string)=>void,onError:(message:string)=>void){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor('#faf9f5');
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','Modelo 3D de la planta activa');canvas.setAttribute('role','img');canvas.tabIndex=0;host.appendChild(canvas);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-10,10,10,-10,.01,1000);
 scene.add(new THREE.HemisphereLight(0xffffff,0x8d998c,2));
 const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(-10,18,12);scene.add(light);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;controls.minZoom=.1;controls.maxZoom=30;controls.screenSpacePanning=true;
 let group=new THREE.Group(),grid:THREE.GridHelper|undefined,mode:ModelView='3d',selected='',span=10,lastPlan:Plan|undefined,closed=false;
 let bounds=new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(9,3,7));
 const selectable:THREE.Object3D[]=[];
 const colors=new Map<string,{material:THREE.MeshStandardMaterial|THREE.LineBasicMaterial;base:string}[]>();
 const render=()=>{if(!closed)renderer.render(scene,camera);};controls.addEventListener('change',render);
 const remember=(id:string,material:THREE.MeshStandardMaterial|THREE.LineBasicMaterial,base:string)=>{const list=colors.get(id)??[];list.push({material,base});colors.set(id,list);};
 function setSelected(id:string){selected=id;colors.forEach((list,key)=>list.forEach(({material,base})=>material.color.set(key===id?'#c18a50':base)));render();}
 function size(){const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight),aspect=width/height;renderer.setSize(width,height,false);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();render();}
 function fit(){
  const center=bounds.getCenter(new THREE.Vector3()),diagonal=Math.max(3,bounds.getSize(new THREE.Vector3()).length());
  const directions={ '3d':new THREE.Vector3(1,.8,1),front:new THREE.Vector3(0,0,1),back:new THREE.Vector3(0,0,-1),left:new THREE.Vector3(-1,0,0),right:new THREE.Vector3(1,0,0)};
  camera.up.set(0,1,0);camera.position.copy(center).add(directions[mode].normalize().multiplyScalar(diagonal*2));camera.far=diagonal*6+100;camera.zoom=1;controls.target.copy(center);camera.lookAt(center);camera.updateMatrixWorld();
  const inverse=camera.quaternion.clone().invert();let width=0,height=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inverse);width=Math.max(width,Math.abs(p.x)*2);height=Math.max(height,Math.abs(p.y)*2);}
  span=Math.max(2,height,width/(Math.max(1,host.clientWidth)/Math.max(1,host.clientHeight)))*1.25;controls.update();size();
 }
 function setMode(next:ModelView){mode=next;controls.maxPolarAngle=mode==='3d'?Math.PI*.49:Math.PI;controls.enableRotate=mode==='3d';controls.mouseButtons.LEFT=mode==='3d'?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN;controls.touches.ONE=mode==='3d'?THREE.TOUCH.ROTATE:THREE.TOUCH.PAN;if(grid)grid.visible=mode==='3d';fit();}
 function update(next:Plan){
  if(next===lastPlan)return;lastPlan=next;
  scene.remove(group);disposeGroup(group);if(grid){scene.remove(grid);disposeGroup(grid);}group=new THREE.Group();selectable.length=0;colors.clear();
  for(const w of wallVolumes(next)){
   const wall=new THREE.Group();wall.position.set(w.a.x,0,w.a.y);wall.rotation.y=-w.angle;group.add(wall);
   const material=new THREE.MeshStandardMaterial({color:'#e6e4d8',roughness:1,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});remember(w.id,material,'#e6e4d8');
   for(const s of w.solids){const mesh=new THREE.Mesh(new THREE.BoxGeometry(s.to-s.from,s.top-s.bottom,w.thickness),material);mesh.position.set((s.from+s.to)/2,(s.bottom+s.top)/2,0);mesh.userData.id=w.id;wall.add(mesh);selectable.push(mesh);}
   const edges:number[]=[];const line=(a:number[],b:number[])=>edges.push(...a,...b);
   for(const z of [-w.thickness/2,w.thickness/2]){
    line([0,0,z],[0,w.height,z]);line([w.length,0,z],[w.length,w.height,z]);
    for(const s of w.solids){if(s.top===w.height)line([s.from,w.height,z],[s.to,w.height,z]);if(s.bottom===0)line([s.from,0,z],[s.to,0,z]);}
   }
   for(const x of [0,w.length])for(const y of [0,w.height])line([x,y,-w.thickness/2],[x,y,w.thickness/2]);
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));wall.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#637166'})));
   for(const o of w.openings){
    const edgeMaterial=new THREE.LineBasicMaterial({color:o.kind==='door'?'#9b7854':'#56888a'});remember(o.id,edgeMaterial,o.kind==='door'?'#9b7854':'#56888a');
    const border:number[]=[];const edge=(a:number[],b:number[])=>border.push(...a,...b);
    for(const z of [-w.thickness/2,w.thickness/2]){edge([o.from,o.bottom,z],[o.from,o.top,z]);edge([o.to,o.bottom,z],[o.to,o.top,z]);if(o.top<w.height)edge([o.from,o.top,z],[o.to,o.top,z]);if(o.bottom>0)edge([o.from,o.bottom,z],[o.to,o.bottom,z]);}
    const outline=new THREE.BufferGeometry();outline.setAttribute('position',new THREE.Float32BufferAttribute(border,3));wall.add(new THREE.LineSegments(outline,edgeMaterial));
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(o.to-o.from,o.top-o.bottom),new THREE.MeshBasicMaterial({color:'#a8c7c5',side:THREE.DoubleSide,transparent:true,opacity:o.kind==='window'?.18:0,depthWrite:false}));plane.position.set((o.from+o.to)/2,(o.bottom+o.top)/2,0);plane.userData.id=o.id;wall.add(plane);selectable.push(plane);
   }
  }
  scene.add(group);group.updateMatrixWorld(true);
  bounds=next.walls.length?new THREE.Box3().setFromObject(group):new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(9,3,7));
  const extent=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),gridSize=Math.max(10,Math.ceil(Math.max(extent.x,extent.z)+4));
  grid=new THREE.GridHelper(gridSize,Math.min(100,gridSize),0xb7c6b7,0xe1e5db);grid.position.set(center.x,-.02,center.z);grid.visible=mode==='3d';scene.add(grid);setSelected(selected);
 }
 const raycaster=new THREE.Raycaster();let start:{x:number;y:number;id:number}|undefined;
 function pointerDown(e:PointerEvent){if(e.isPrimary&&e.button===0)start={x:e.clientX,y:e.clientY,id:e.pointerId};else start=undefined;}
 function pointerUp(e:PointerEvent){if(!start||start.id!==e.pointerId)return;const click=Math.hypot(e.clientX-start.x,e.clientY-start.y)<5;start=undefined;if(!click)return;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);onSelect(raycaster.intersectObjects(selectable,false)[0]?.object.userData.id??'');}
 const contextLost=(e:Event)=>{e.preventDefault();onError('Se interrumpió la visualización 3D. Volvé a la planta y abrí el visor nuevamente. Tu dibujo sigue guardado.');};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('webglcontextlost',contextLost);
 const observer=new ResizeObserver(size);observer.observe(host);update(plan);setMode('3d');
 return {update,setMode,setSelected,fit,zoom:(factor:number)=>{camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.1,30);camera.updateProjectionMatrix();render();},
  exportPng:async()=>{const previous=selected;setSelected('');try{return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo generar la imagen.')),'image/png'));}finally{setSelected(previous);}},
  dispose:()=>{closed=true;observer.disconnect();controls.dispose();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('webglcontextlost',contextLost);disposeGroup(group);if(grid)disposeGroup(grid);renderer.dispose();renderer.forceContextLoss();canvas.remove();}
 };
}
