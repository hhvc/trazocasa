import { furnitureCorners, uid, validatePlan } from './model';
import type { Furniture, Plan, Point } from './model';

/** A group belongs to one floor. Always operate on complete groups. */
export function expandFurnitureSelection(plan: Plan, ids: string[]): string[] {
  const requested = new Set(ids);
  const groups = new Set(plan.furniture.filter(f=>requested.has(f.id) && f.groupId).map(f=>f.groupId));
  return plan.furniture.filter(f=>requested.has(f.id) || (f.groupId && groups.has(f.groupId))).map(f=>f.id);
}
export function selectionBounds(items: Furniture[]) {
  if (!items.length) throw new Error('Seleccioná al menos un elemento.');
  const points = items.flatMap(furnitureCorners);
  const left = Math.min(...points.map(p=>p.x)), right = Math.max(...points.map(p=>p.x));
  const top = Math.min(...points.map(p=>p.y)), bottom = Math.max(...points.map(p=>p.y));
  return { x:(left+right)/2, y:(top+bottom)/2, width:right-left, depth:bottom-top };
}
export function groupFurniture(plan: Plan, ids: string[]): Plan {
  const selected = new Set(expandFurnitureSelection(plan,ids));
  if (selected.size<2) throw new Error('Seleccioná al menos dos muebles o piezas de escalera.');
  const groupId=uid();
  return validatePlan({...plan,furniture:plan.furniture.map(f=>selected.has(f.id)?{...f,groupId}:f)});
}
export function ungroupFurniture(plan: Plan, ids: string[]): Plan {
  const selected = new Set(expandFurnitureSelection(plan,ids));
  return validatePlan({...plan,furniture:plan.furniture.map(f=>{
    if (!selected.has(f.id)) return f;
    const {groupId: _groupId,...item}=f;
    return item;
  })});
}
export function translateFurnitureSelection(plan: Plan, ids: string[], delta: Point): Plan {
  const selected = new Set(expandFurnitureSelection(plan,ids));
  return validatePlan({...plan,furniture:plan.furniture.map(f=>selected.has(f.id)?{...f,x:f.x+delta.x,y:f.y+delta.y}:f)});
}
export function rotateFurnitureSelection(plan: Plan, ids: string[]): Plan {
  const selected = new Set(expandFurnitureSelection(plan,ids));
  const center=selectionBounds(plan.furniture.filter(f=>selected.has(f.id)));
  // Exact quarter-turn avoids accumulating trigonometric error in joined pieces.
  return validatePlan({...plan,furniture:plan.furniture.map(f=>selected.has(f.id)?{
    ...f,x:center.x-(f.y-center.y),y:center.y+(f.x-center.x),rotation:(f.rotation+90)%360
  }:f)});
}
export function duplicateFurnitureSelection(plan: Plan, ids: string[]): {plan:Plan; ids:string[]} {
  const selected = new Set(expandFurnitureSelection(plan,ids));
  const groups = new Map<string,string>();
  const copies = plan.furniture.filter(f=>selected.has(f.id)).map(f=>{
    if(f.groupId && !groups.has(f.groupId))groups.set(f.groupId,uid());
    return {...f,id:uid(),x:f.x+.3,y:f.y+.3,...(f.groupId?{groupId:groups.get(f.groupId)!}:{})};
  });
  return {plan:validatePlan({...plan,furniture:[...plan.furniture,...copies]}),ids:copies.map(f=>f.id)};
}
export function removeFurnitureSelection(plan: Plan, ids: string[]): Plan {
  const selected = new Set(expandFurnitureSelection(plan,ids));
  return validatePlan({...plan,furniture:plan.furniture.filter(f=>!selected.has(f.id))});
}
