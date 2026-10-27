import type {Furniture} from './model';
import type {BuildingVolumes,ModelSelection} from './model3d';
import {furnitureHeight} from './furnitureHeights';
export type PersonView={x:number;y:number;z:number;yaw:number;eyeHeight:number};
export function personView(item:Furniture,level:number):PersonView{
 const eyeHeight=(item.elevation??0)+furnitureHeight(item)*.93;
 return {x:item.x,y:level+eyeHeight,z:item.y,yaw:item.rotation*Math.PI/180,eyeHeight};
}
export function personDimensions(height:number){return {width:Math.max(.2,.6*height/1.7),depth:Math.max(.2,.4*height/1.7)};}
/** Hide only the observer's body, keeping people with the same ID on other floors. */
export function withoutObserver(model:BuildingVolumes,observer:ModelSelection|null):BuildingVolumes{
 return observer?model.map(f=>f.id===observer.floorId?{...f,furniture:f.furniture.filter(i=>i.id!==observer.elementId)}:f):model;
}
