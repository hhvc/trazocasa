import * as THREE from 'three';
import type {Furniture} from './model';
import {furnitureHeight} from './furnitureHeights';
import {furnitureParts} from './furniture3d';
import {unitGeometry} from './FurnitureScene';
import {finishMaterial} from './finishMaterials';
import type {FinishLibrary} from './finishMaterials';
/** The controlled figure has hip, knee and shoulder joints; static people stay in shared batches. */
export function createWalkingPerson(item:Furniture,finishes:FinishLibrary){
 const root=new THREE.Group(),body=new THREE.Group(),height=furnitureHeight(item),size=new THREE.Vector3(item.width,height,item.depth);root.add(body);
 const arms=[-.41,.41].map(x=>{const joint=new THREE.Group();joint.position.set(x*item.width,.77*height,0);body.add(joint);return joint;});
 const legs=[-.17,.17].map(x=>{const hip=new THREE.Group(),knee=new THREE.Group(),foot=new THREE.Group();hip.position.set(x*item.width,.49*height,0);knee.position.y=-.21*height;foot.position.y=-.21*height;root.add(hip);hip.add(knee);knee.add(foot);return {hip,knee,foot};});
 const geometries=new Map<string,THREE.BufferGeometry>(),materials=new Map<string,THREE.MeshStandardMaterial>();
 function mesh(shape:Parameters<typeof unitGeometry>[0],color:string){
  const appearance=color==='#7297ab'?item.appearance:undefined;
  const material=materials.get(color)??finishMaterial(finishes,appearance,color);materials.set(color,material);
  const geometry=geometries.get(shape)??unitGeometry(shape);geometries.set(shape,geometry);return new THREE.Mesh(geometry,material);
 }
 for(const part of furnitureParts('person')){
  const [x,y,z]=part.position,leg=Math.abs(x)>.1&&Math.abs(x)<.3&&y<.5?legs[x<0?0:1]:null;
  if(leg&&part.shape==='cylinder'){
   for(const parent of [leg.hip,leg.knee]){const segment=mesh('cylinder',part.color);segment.position.y=-.105*height;segment.scale.set(.22*item.width,.21*height,.45*item.depth);parent.add(segment);}continue;
  }
  const node=mesh(part.shape,part.color);
  if(leg){node.position.set(0,(y-.07)*height,z*item.depth);leg.foot.add(node);}
  else{const arm=Math.abs(x)>.3&&y<.8?arms[x<0?0:1]:null;node.position.set(...part.position).multiply(size);if(arm)node.position.sub(arm.position);(arm??body).add(node);}
  node.scale.set(...part.scale).multiply(size);if(part.rotation)node.rotation.set(...part.rotation);
 }
 return {root,pose(distance:number,moving:boolean,crouched=false,airborne=false,climbPhase=0){
  const climbing=Math.sin(Math.PI*climbPhase);
  const drop=crouched?.3*height:0,back=crouched?.09*height:0,bend=crouched?Math.acos(2/7):airborne?.25:0;
  const stride=moving?Math.sin(distance*9)*(crouched?.16:.48):0;
  body.position.set(0,-drop,-back);
  legs.forEach(({hip,knee,foot},i)=>{hip.position.set((i?1:-1)*.17*item.width,.49*height-drop,-back);hip.rotation.x=-bend+(i?-stride:stride);knee.rotation.x=2*bend;foot.rotation.x=-hip.rotation.x-knee.rotation.x;});
  arms[0].rotation.x=airborne?-.35:-stride*.7;arms[1].rotation.x=airborne?-.35:stride*.7;
  if(climbing>0){legs.forEach(({hip,knee,foot},i)=>{hip.rotation.x=-climbing*(i?.5:.9);knee.rotation.x=climbing*(i?.8:1.3);foot.rotation.x=-hip.rotation.x-knee.rotation.x;});arms.forEach(arm=>arm.rotation.x=-1.1*climbing);}
 },dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}
