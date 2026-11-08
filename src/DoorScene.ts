import * as THREE from 'three';
import {modelDoors,doorOpenAngle} from './doors';
import type {BuildingVolumes,ModelSelection} from './model3d';
/** Hinged leaves use the same world-space hinge and yaw as walking collisions. */
export function addDoorScene(group:THREE.Group,model:BuildingVolumes){
 const geometry=new THREE.BoxGeometry(1,1,1),edges=new THREE.EdgesGeometry(geometry),metal=new THREE.MeshStandardMaterial({color:'#74857e',roughness:.45}),outlineMaterial=new THREE.LineBasicMaterial({color:'#74684f'});
 const doors=new Map<string,{pivot:THREE.Group;closedYaw:number;swing:number;material:THREE.MeshStandardMaterial}>(),selectable:THREE.Mesh[]=[];
 for(const d of modelDoors(model)){
  const pivot=new THREE.Group(),height=d.top-d.bottom;group.add(pivot);pivot.position.set(d.hinge.x,d.bottom,d.hinge.z);pivot.rotation.y=-d.closedYaw;
  const material=new THREE.MeshStandardMaterial({color:'#bda789',roughness:.8}),leaf=new THREE.Mesh(geometry,material);leaf.position.set(d.width/2,height/2,0);leaf.scale.set(d.width,height,d.thickness);pivot.add(leaf);
  const selection={floorId:d.floorId,elementId:d.elementId};leaf.userData.selection=selection;selectable.push(leaf);
  const outline=new THREE.LineSegments(edges,outlineMaterial);outline.position.copy(leaf.position);outline.scale.copy(leaf.scale);pivot.add(outline);
  for(const z of [-1,1]){const handle=new THREE.Mesh(geometry,metal);handle.position.set(d.width-Math.min(.12,d.width*.2),height*.47,z*.04);handle.scale.set(Math.min(.12,d.width*.2),.025,.04);handle.userData.selection=selection;pivot.add(handle);selectable.push(handle);}
  doors.set(d.key,{pivot,closedYaw:d.closedYaw,swing:d.swing,material});
 }
 // Empty models do not attach the shared resources to the scene disposal traversal.
 if(!doors.size){geometry.dispose();edges.dispose();metal.dispose();outlineMaterial.dispose();}
 return {selectable,setAngle(key:string,angle:number){const d=doors.get(key);if(!d||!Number.isFinite(angle))return;d.pivot.rotation.y=-d.closedYaw-d.swing*Math.max(0,Math.min(doorOpenAngle,angle));d.pivot.updateMatrixWorld(true);},setSelected(selection:ModelSelection|null){const key=selection?JSON.stringify([selection.floorId,selection.elementId]):'';for(const [id,d] of doors)d.material.color.set(id===key?'#c18a50':'#bda789');}};
}
