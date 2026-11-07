import {vehicleDoorHinge,vehicleWheelRadius,vehicleWheelWidth} from './vehicle';
import type {VehicleDoor,VehicleWheels} from './vehicle';
import * as THREE from 'three';
import {furnitureParts} from './furniture3d';
import type {FurniturePart} from './furniture3d';
import {furnitureHeight,isFurniture3D} from './furnitureHeights';
import {modelSelectionKey} from './model3d';
import type {BuildingVolumes,ModelSelection} from './model3d';
import type {Furniture,FinishKind} from './model';
import {furnitureFinishColors} from './appearance';
import {createFinishLibrary,finishMaterial} from './finishMaterials';
import type {FinishLibrary} from './finishMaterials';

export function furnitureMatrix(item:Furniture,level:number){
 return new THREE.Matrix4().compose(new THREE.Vector3(item.x,level+(item.elevation??0),item.y),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-item.rotation*Math.PI/180),new THREE.Vector3(item.width,furnitureHeight(item),item.depth));
}
export function furniturePartMatrix(part:FurniturePart){
 return new THREE.Matrix4().compose(new THREE.Vector3(...part.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation??[0,0,0]))),new THREE.Vector3(...part.scale));
}
/** Joint rotations happen in metres, so resized tires remain round rather than shearing. */
export function wheelPartMatrix(part:FurniturePart,item:Furniture,wheels:VehicleWheels={roll:0,steer:0}){
 if(!part.wheel)return furniturePartMatrix(part);
 const {center,front,component}=part.wheel,h=furnitureHeight(item),r=vehicleWheelRadius(item),width=vehicleWheelWidth(item),side=Math.sign(center[0]);
 const offset=component==='tire'?0:side*width*(component==='hub'?.51:.537);
 const scale=component==='tire'?[2*r,width,2*r]:component==='hub'?[1.2*r,width*.04,1.2*r]:[width*.014,1.3*r,.16*r];
 return new THREE.Matrix4().makeScale(1/item.width,1/h,1/item.depth)
  .multiply(new THREE.Matrix4().makeTranslation(center[0]*item.width,r+.01*h,center[2]*item.depth))
  .multiply(new THREE.Matrix4().makeRotationY(front?-wheels.steer:0)).multiply(new THREE.Matrix4().makeRotationX(wheels.roll))
  .multiply(new THREE.Matrix4().compose(new THREE.Vector3(offset,0,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation??[0,0,0]))),new THREE.Vector3(scale[0],scale[1],scale[2])));
}
/** Rotate the complete panel around its metric hinge, without stretching resized doors. */
export function doorPartMatrix(part:FurniturePart,item:Furniture,door?:VehicleDoor){
 if(!part.door||part.door.side!==door?.side||!door.angle)return furniturePartMatrix(part);
 const h=furnitureHeight(item),x=part.door.side*vehicleDoorHinge.x*item.width,z=vehicleDoorHinge.z*item.depth;
 return new THREE.Matrix4().makeScale(1/item.width,1/h,1/item.depth)
  .multiply(new THREE.Matrix4().makeTranslation(x,0,z)).multiply(new THREE.Matrix4().makeRotationY(part.door.side*door.angle))
  .multiply(new THREE.Matrix4().makeTranslation(-x,0,-z)).multiply(new THREE.Matrix4().makeScale(item.width,h,item.depth)).multiply(furniturePartMatrix(part));
}
export function unitGeometry(shape:FurniturePart['shape']):THREE.BufferGeometry{
 switch(shape){
  case 'box':return new THREE.BoxGeometry(1,1,1);
  case 'cylinder':return new THREE.CylinderGeometry(.5,.5,1,16);
  case 'sphere':return new THREE.SphereGeometry(.5,12,8);
  case 'ring':return new THREE.TorusGeometry(.38,.12,8,20).rotateX(-Math.PI/2).scale(1,1/.24,1);
 }
}
/** Shared geometry/material batches keep draw calls bounded even with hundreds of items. */
export function addFurnitureScene(group:THREE.Group,model:BuildingVolumes,finishes:FinishLibrary=createFinishLibrary()){
 type Entry={part:FurniturePart;local:THREE.Matrix4;matrix:THREE.Matrix4;color:THREE.Color;selection:ModelSelection;key:string};
 const batches=new Map<string,{shape:FurniturePart['shape'];finish:FinishKind;opacity:number;entries:Entry[]}>();
 const cache=new Map<string,FurniturePart[]>();
 for(const floor of model)for(const item of floor.furniture){
  if(!isFurniture3D(item.kind))continue;
  const cacheKey=item.kind==='stairs'?item.kind+'-'+furnitureHeight(item):item.kind;
  const parts=cache.get(cacheKey)??furnitureParts(item.kind,furnitureHeight(item));cache.set(cacheKey,parts);
  const root=furnitureMatrix(item,floor.elevation),selection={floorId:floor.id,elementId:item.id},key=modelSelectionKey(selection);
  const primary=furnitureFinishColors(item.kind);
  for(const part of parts){const appearance=primary.includes(part.color)?item.appearance:undefined,finish=appearance?.finish??'paint',opacity=part.opacity??1,batchKey=part.shape+'-'+finish+'-'+opacity;
   const local=wheelPartMatrix(part,item),batch=batches.get(batchKey)??{shape:part.shape,finish,opacity,entries:[]};batch.entries.push({part,local,matrix:root.clone().multiply(local),color:new THREE.Color(appearance?.color??part.color),selection,key});batches.set(batchKey,batch);
  }
 }
 const selectable:THREE.InstancedMesh[]=[],outlines:number[]=[],outlineRefs:{entry:Entry;local:THREE.Vector3;offset:number}[]=[];let outlineGeometry:THREE.BufferGeometry|undefined;
 const materials=new Map<string,THREE.MeshStandardMaterial>(),geometries=new Map<FurniturePart['shape'],THREE.BufferGeometry>();
 for(const {shape,finish,opacity,entries} of batches.values()){
  const materialKey=finish+'-'+opacity,material=materials.get(materialKey)??finishMaterial(finishes,{color:'#ffffff',finish},'#ffffff',true);material.transparent=opacity<1;material.opacity=opacity;material.depthWrite=opacity===1;materials.set(materialKey,material);
  const geometry=geometries.get(shape)??unitGeometry(shape);geometries.set(shape,geometry);const mesh=new THREE.InstancedMesh(geometry,material,entries.length);
  mesh.userData.selections=entries.map(e=>e.selection);
  entries.forEach((e,i)=>{mesh.setMatrixAt(i,e.matrix);mesh.setColorAt(i,e.color);});
  mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);selectable.push(mesh);
  if(shape==='box'){
   const edges=new THREE.EdgesGeometry(geometry),positions=edges.getAttribute('position'),point=new THREE.Vector3();
   for(const entry of entries)for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i);outlineRefs.push({entry,local:point.clone(),offset:outlines.length/3});point.applyMatrix4(entry.matrix);outlines.push(point.x,point.y,point.z);}edges.dispose();
  }
 }
 if(outlines.length){const geometry=outlineGeometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(outlines,3));group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#637166',transparent:true,opacity:.35,depthWrite:false})));}
 return {selectable,move:(selection:ModelSelection,item:Furniture,level:number,wheels:VehicleWheels={roll:0,steer:0},door?:VehicleDoor)=>{
  const key=modelSelectionKey(selection),root=furnitureMatrix(item,level);let batchIndex=0;
  for(const {entries} of batches.values()){const mesh=selectable[batchIndex++];let changed=false;entries.forEach((entry,i)=>{if(entry.key!==key)return;entry.matrix.multiplyMatrices(root,entry.part.wheel?wheelPartMatrix(entry.part,item,wheels):entry.part.door?doorPartMatrix(entry.part,item,door):entry.local);mesh.setMatrixAt(i,entry.matrix);changed=true;});if(changed){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}}
  if(outlineGeometry){const positions=outlineGeometry.getAttribute('position');for(const ref of outlineRefs)if(ref.entry.key===key){const p=ref.local.clone().applyMatrix4(ref.entry.matrix);positions.setXYZ(ref.offset,p.x,p.y,p.z);}positions.needsUpdate=true;outlineGeometry.computeBoundingBox();outlineGeometry.computeBoundingSphere();}
 },disposeTextures:()=>finishes.dispose(),setSelected:(selection:ModelSelection|null)=>{
  const key=modelSelectionKey(selection),highlight=new THREE.Color('#c18a50');
  let batchIndex=0;for(const {entries} of batches.values()){const mesh=selectable[batchIndex++];entries.forEach((e,i)=>mesh.setColorAt(i,e.key===key?e.color.clone().lerp(highlight,.65):e.color));if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }};
}
export function selectionFromIntersection(hit:THREE.Intersection|undefined):ModelSelection|null{
 if(!hit)return null;
 return hit.instanceId!==undefined?hit.object.userData.selections?.[hit.instanceId]??null:hit.object.userData.selection??null;
}
