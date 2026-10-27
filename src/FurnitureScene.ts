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
 type Entry={matrix:THREE.Matrix4;color:THREE.Color;selection:ModelSelection;key:string};
 const batches=new Map<string,{shape:FurniturePart['shape'];finish:FinishKind;entries:Entry[]}>();
 const cache=new Map<Furniture['kind'],FurniturePart[]>();
 for(const floor of model)for(const item of floor.furniture){
  if(!isFurniture3D(item.kind))continue;
  const parts=cache.get(item.kind)??furnitureParts(item.kind);cache.set(item.kind,parts);
  const root=furnitureMatrix(item,floor.elevation),selection={floorId:floor.id,elementId:item.id},key=modelSelectionKey(selection);
  const primary=furnitureFinishColors(item.kind);
  for(const part of parts){const appearance=primary.includes(part.color)?item.appearance:undefined,finish=appearance?.finish??'paint',batchKey=part.shape+'-'+finish;
   const batch=batches.get(batchKey)??{shape:part.shape,finish,entries:[]};batch.entries.push({matrix:root.clone().multiply(furniturePartMatrix(part)),color:new THREE.Color(appearance?.color??part.color),selection,key});batches.set(batchKey,batch);
  }
 }
 const selectable:THREE.InstancedMesh[]=[],outlines:number[]=[];
 const materials=new Map<FinishKind,THREE.MeshStandardMaterial>(),geometries=new Map<FurniturePart['shape'],THREE.BufferGeometry>();
 for(const {shape,finish,entries} of batches.values()){
  const material=materials.get(finish)??finishMaterial(finishes,{color:'#ffffff',finish},'#ffffff',true);materials.set(finish,material);
  const geometry=geometries.get(shape)??unitGeometry(shape);geometries.set(shape,geometry);const mesh=new THREE.InstancedMesh(geometry,material,entries.length);
  mesh.userData.selections=entries.map(e=>e.selection);
  entries.forEach((e,i)=>{mesh.setMatrixAt(i,e.matrix);mesh.setColorAt(i,e.color);});
  mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);selectable.push(mesh);
  if(shape==='box'){
   const edges=new THREE.EdgesGeometry(geometry),positions=edges.getAttribute('position'),point=new THREE.Vector3();
   for(const entry of entries)for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(entry.matrix);outlines.push(point.x,point.y,point.z);}edges.dispose();
  }
 }
 if(outlines.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(outlines,3));group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#637166',transparent:true,opacity:.35,depthWrite:false})));}
 return {selectable,disposeTextures:()=>finishes.dispose(),setSelected:(selection:ModelSelection|null)=>{
  const key=modelSelectionKey(selection),highlight=new THREE.Color('#c18a50');
  let batchIndex=0;for(const {entries} of batches.values()){const mesh=selectable[batchIndex++];entries.forEach((e,i)=>mesh.setColorAt(i,e.key===key?e.color.clone().lerp(highlight,.65):e.color));if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }};
}
export function selectionFromIntersection(hit:THREE.Intersection|undefined):ModelSelection|null{
 if(!hit)return null;
 return hit.instanceId!==undefined?hit.object.userData.selections?.[hit.instanceId]??null:hit.object.userData.selection??null;
}
