import {ExtrudeGeometry,Shape,Vector2,Path,ShapeUtils} from 'three';
import type {Point} from './model';
/** Plan Y becomes world Z; extrusion depth becomes vertical Y. */
export function plateGeometry(points:Point[],thickness:number,holes:Point[][]=[]){
 const shape=new Shape(points.map(p=>new Vector2(p.x,-p.y)));
 const clockwise=ShapeUtils.isClockWise(shape.getPoints());
 for(const points of holes){const vertices=points.map(p=>new Vector2(p.x,-p.y));if(ShapeUtils.isClockWise(vertices)===clockwise)vertices.reverse();shape.holes.push(new Path(vertices));}
 const geometry=new ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
 geometry.rotateX(-Math.PI/2);
 return geometry;
}
