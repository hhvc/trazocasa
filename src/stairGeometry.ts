import type {Furniture} from './model';
/** Shared by drawing and collision: the 2D arrow climbs from +Z toward -Z. */
export const stairStepCount=(rise:number)=>Math.max(1,Math.ceil(rise/.18));
export function stairTreads(item:Furniture){
 if(item.height===undefined)return [];
 const n=item.kind==='stairs'?stairStepCount(item.height):1;
 return Array.from({length:n},(_,i)=>({from:item.depth/2-(i+1)*item.depth/n,to:item.depth/2-i*item.depth/n,bottom:0,top:item.height!*(i+1)/n}));
}
