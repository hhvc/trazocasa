import * as THREE from 'three';
import type {Appearance,FinishKind} from './model';
/** Small deterministic grayscale patterns; their color comes from the element material. */
export function finishPixels(finish:Exclude<FinishKind,'paint'>,size=128){
 const pixels=new Uint8Array(size*size*4),tau=Math.PI*2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,noise=((x*73+y*151+(x*y*31))%97)/96;
  let value=255;
  if(finish==='wood'){
   const grain=Math.sin(tau*(u*14+.12*Math.sin(v*tau)+.06*Math.sin(v*tau*3)));
   value=237+grain*9+noise*5;
   if(x<2||y<1)value=208;
  }else if(finish==='tile')value=x<3||y<3?203:249+noise*5;
  else value=232+noise*16+5*Math.sin(u*tau*3)*Math.cos(v*tau*2);
  const i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=Math.max(0,Math.min(255,Math.round(value)));pixels[i+3]=255;
 }
 return pixels;
}
export function createFinishLibrary(){
 const textures=new Map<FinishKind,THREE.DataTexture>();
 return {
  texture(finish:FinishKind):THREE.DataTexture|null{
   if(finish==='paint')return null;
   let texture=textures.get(finish);
   if(!texture){texture=new THREE.DataTexture(finishPixels(finish),128,128,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;textures.set(finish,texture);}
   return texture;
  },
  dispose(){textures.forEach(t=>t.dispose());textures.clear();},
 };
}
export type FinishLibrary=ReturnType<typeof createFinishLibrary>;
export function finishMaterial(library:FinishLibrary,appearance:Appearance|undefined,fallback:string,flatShading=false){
 return new THREE.MeshStandardMaterial({color:appearance?.color??fallback,map:library.texture(appearance?.finish??'paint'),roughness:appearance?.finish==='tile'?.65:1,flatShading,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
}
/** Project each face using local metre coordinates, including generated roofs and wall opening edges. */
export function finishUV(geometry:THREE.BufferGeometry,finish:FinishKind){
 const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=new Float32Array(positions.count*2),unit=finish==='tile'?.6:1;
 for(let i=0;i<positions.count;i++){
  const x=Math.abs(normals.getX(i)),y=Math.abs(normals.getY(i)),z=Math.abs(normals.getZ(i));
  uv[i*2]=(x>y&&x>z?positions.getZ(i):positions.getX(i))/unit;
  uv[i*2+1]=(y>=x&&y>=z?positions.getZ(i):positions.getY(i))/unit;
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
}
