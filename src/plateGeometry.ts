import {ExtrudeGeometry,Shape,Vector2,Path,ShapeUtils,BufferGeometry,Float32BufferAttribute,BoxGeometry} from 'three';
import type {Point,RoofPlane} from './model';
/** Plan Y becomes world Z; extrusion depth becomes vertical Y. */
export function plateGeometry(points:Point[],thickness:number,holes:Point[][]=[]){
 const shape=new Shape(points.map(p=>new Vector2(p.x,-p.y)));
 const clockwise=ShapeUtils.isClockWise(shape.getPoints());
 for(const points of holes){const vertices=points.map(p=>new Vector2(p.x,-p.y));if(ShapeUtils.isClockWise(vertices)===clockwise)vertices.reverse();shape.holes.push(new Path(vertices));}
 const geometry=new ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
 geometry.rotateX(-Math.PI/2);
 return geometry;
}

/** Split original triangles at every ridge before applying the affine roof height. */
function deformGeometry(geometry:BufferGeometry,planes:RoofPlane[],world:(v:number[])=>Point,transform:(v:number[],height:number)=>number[]):BufferGeometry{
 const source=geometry.index?geometry.toNonIndexed():geometry,position=source.getAttribute('position'),vertices:number[]=[];
 const at=(p:RoofPlane,v:number[])=>{const q=world(v);return p.a*q.x+p.b*q.y+p.c;};
 const unique=planes.filter((p,i)=>!planes.slice(0,i).some(q=>Math.abs(p.a-q.a)+Math.abs(p.b-q.b)+Math.abs(p.c-q.c)<1e-9));
 for(let i=0;i<position.count;i+=3)for(const plane of unique){
  let polygon=[0,1,2].map(j=>[position.getX(i+j),position.getY(i+j),position.getZ(i+j)]);
  for(const other of unique){
   if(other===plane||!polygon.length)continue;
   const next:number[][]=[];
   for(let j=0;j<polygon.length;j++){
    const a=polygon[j],b=polygon[(j+1)%polygon.length],da=at(plane,a)-at(other,a),db=at(plane,b)-at(other,b);
    if(da<=1e-8)next.push(a);
    if((da< -1e-8&&db>1e-8)||(da>1e-8&&db< -1e-8)){const t=da/(da-db);next.push(a.map((v,k)=>v+(b[k]-v)*t));}
   }
   polygon=next;
  }
  for(let j=1;j<polygon.length-1;j++)for(const vertex of [polygon[0],polygon[j],polygon[j+1]])vertices.push(...transform(vertex,at(plane,vertex)));
 }
 if(source!==geometry)source.dispose();geometry.dispose();
 const result=new BufferGeometry();result.setAttribute('position',new Float32BufferAttribute(vertices,3));result.computeVertexNormals();return result;
}
export function roofGeometry(points:Point[],thickness:number,holes:Point[][],planes:RoofPlane[],base:number){
 return deformGeometry(plateGeometry(points,thickness,holes),planes,v=>({x:v[0],y:v[2]}),(v,height)=>[v[0],v[1]+height-base,v[2]]);
}
export function wallSolidGeometry(wall:{a:Point;angle:number;thickness:number},solid:{from:number;to:number;bottom:number;top:number;planes?:RoofPlane[]}){
 const geometry=new BoxGeometry(solid.to-solid.from,1,wall.thickness);geometry.translate((solid.from+solid.to)/2,.5,0);
 const planes=solid.planes??[{a:0,b:0,c:solid.top}],cos=Math.cos(wall.angle),sin=Math.sin(wall.angle);
 return deformGeometry(geometry,planes,v=>({x:wall.a.x+v[0]*cos-v[2]*sin,y:wall.a.y+v[0]*sin+v[2]*cos}),(v,height)=>[v[0],solid.bottom+v[1]*(height-solid.bottom),v[2]]);
}
