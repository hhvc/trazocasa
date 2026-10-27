import type {Appearance,FinishKind,FurnitureKind,Plan} from './model';
export type AppearanceTarget={kind:'wall'|'slab'|'roof'|'furniture';id:string};
export const finishOptions:{id:FinishKind;name:string;color:string}[]=[
 {id:'paint',name:'Pintura lisa',color:'#e6e4d8'},
 {id:'wood',name:'Madera',color:'#bda789'},
 {id:'tile',name:'Cerámico',color:'#e3dfd3'},
 {id:'concrete',name:'Hormigón',color:'#bcbdb6'},
];
export function targetAppearance(plan:Plan,target:AppearanceTarget):Appearance|undefined{
 if(target.kind==='wall')return plan.walls.find(w=>w.id===target.id)?.appearance;
 if(target.kind==='furniture')return plan.furniture.find(f=>f.id===target.id)?.appearance;
 return plan.surfaces.find(s=>s.id===target.id)?.[target.kind]?.appearance;
}
/** The same update serves preview and committed edits; geometry and other finishes are preserved. */
export function withAppearance(plan:Plan,target:AppearanceTarget,appearance?:Appearance):Plan{
 const update=<T extends {appearance?:Appearance}>(item:T):T=>{const {appearance:_,...rest}=item;return {...rest,...(appearance?{appearance:{...appearance}}:{})} as T;};
 if(target.kind==='wall')return {...plan,walls:plan.walls.map(w=>w.id===target.id?update(w):w)};
 if(target.kind==='furniture')return {...plan,furniture:plan.furniture.map(f=>f.id===target.id?update(f):f)};
 const kind=target.kind;return {...plan,surfaces:plan.surfaces.map(s=>s.id===target.id&&s[kind]?{...s,[kind]:update(s[kind]!)}:s)};
}
/** Only primary surfaces change: glass, tires, fixtures and small details retain their colors. */
export function furnitureFinishColors(kind:FurnitureKind):string[]{
 if(kind==='person')return ['#7297ab'];
 if(['bed','singleBed'].includes(kind))return ['#b6c5b7'];
 if(['sofa','sofa3','armchair'].includes(kind))return ['#b6c5b7','#eeeade'];
 if(['chair','table','desk','wardrobe','nightstand','roundCoffeeTable','argentineGrill'].includes(kind))return ['#bda789','#eeeade'];
 if(['smallCar','mediumCar','pickup'].includes(kind))return ['#b6c5b7','#eeeade'];
 if(['tree','palm','shrub'].includes(kind))return ['#94ad7b','#a8bc94','#a6bc8f'];
 if(kind==='pottedPlant')return ['#c6a58a'];
 if(kind==='tv')return ['#45554e'];
 if(kind==='firePit')return ['#74857e'];
 if(kind==='kitchenSink')return ['#bda789','#eeeade'];
 return ['#f1f0e8','#eeeade'];
}
