import * as THREE from 'three';
import type {Furniture} from './model';
import {furnitureHeight} from './furnitureHeights';
import {furnitureParts} from './furniture3d';
import {unitGeometry} from './FurnitureScene';
import {finishMaterial} from './finishMaterials';
import type {FinishLibrary} from './finishMaterials';
/** Only the controlled figure is articulated. The rest of the catalog keeps its shared batches. */
export function createWalkingPerson(item:Furniture,finishes:FinishLibrary){
 const root=new THREE.Group(),height=furnitureHeight(item),size=new THREE.Vector3(item.width,height,item.depth);
 const joints=[[-.17,.5,0],[.17,.5,0],[-.41,.77,0],[.41,.77,0]].map(p=>{const joint=new THREE.Group();joint.position.set(p[0]*item.width,p[1]*height,p[2]*item.depth);root.add(joint);return joint;});
 const geometries=new Map<string,THREE.BufferGeometry>(),materials=new Map<string,THREE.MeshStandardMaterial>();
 for(const part of furnitureParts('person')){
  const appearance=part.color==='#7297ab'?item.appearance:undefined,key=part.color;
  const material=materials.get(key)??finishMaterial(finishes,appearance,part.color);materials.set(key,material);
  const geometry=geometries.get(part.shape)??unitGeometry(part.shape);geometries.set(part.shape,geometry);
  const mesh=new THREE.Mesh(geometry,material),[x,y]=part.position;
  const joint=Math.abs(x)>.3&&y<.8?joints[x<0?2:3]:Math.abs(x)>.1&&y<.5?joints[x<0?0:1]:null;
  mesh.position.set(...part.position).multiply(size);if(joint)mesh.position.sub(joint.position);
  mesh.scale.set(...part.scale).multiply(size);if(part.rotation)mesh.rotation.set(...part.rotation);(joint??root).add(mesh);
 }
 return {root,pose(distance:number,moving:boolean){const angle=moving?Math.sin(distance*9)*.48:0;joints[0].rotation.x=angle;joints[1].rotation.x=-angle;joints[2].rotation.x=-angle*.7;joints[3].rotation.x=angle*.7;},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}
