import {ExtrudeGeometry,Shape,Vector2} from 'three';
import type {Point} from './model';
/** Plan Y becomes world Z; extrusion depth becomes vertical Y. */
export function plateGeometry(points:Point[],thickness:number){
 const shape=new Shape(points.map(p=>new Vector2(p.x,-p.y)));
 const geometry=new ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
 geometry.rotateX(-Math.PI/2);
 return geometry;
}
