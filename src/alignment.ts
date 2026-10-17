import { furnitureCorners, snap, wallThickness } from './model';
import type { Furniture, Plan } from './model';
export type AlignmentGuide = { axis: 'x' | 'y'; value: number; from: number; to: number };
type Box = { left: number; right: number; top: number; bottom: number };
function bounds(item: Furniture): Box {
  const points = furnitureCorners(item);
  return { left: Math.min(...points.map(p=>p.x)), right: Math.max(...points.map(p=>p.x)), top: Math.min(...points.map(p=>p.y)), bottom: Math.max(...points.map(p=>p.y)) };
}
/** Align world-axis footprint edges/centres; guides are transient editor data. */
export function alignFurniture(plan: Plan, item: Furniture, tolerance: number, enabled = true, free = false): { item: Furniture; guides: AlignmentGuide[] } {
  if (free) return { item, guides: [] };
  const moved = bounds(item);
  const targets: Box[] = plan.furniture.filter(f=>f.id!==item.id).map(bounds);
  for (const wall of plan.walls) {
    const r = wallThickness(wall)/2;
    if (Math.abs(wall.a.x-wall.b.x)<1e-8) targets.push({left:wall.a.x-r,right:wall.a.x+r,top:Math.min(wall.a.y,wall.b.y),bottom:Math.max(wall.a.y,wall.b.y)});
    else if (Math.abs(wall.a.y-wall.b.y)<1e-8) targets.push({left:Math.min(wall.a.x,wall.b.x),right:Math.max(wall.a.x,wall.b.x),top:wall.a.y-r,bottom:wall.a.y+r});
  }
  const guides: AlignmentGuide[] = [];
  const result = {...item, x:snap(item.x), y:snap(item.y)};
  if (!enabled) return {item:result,guides};
  // Cap world-space reach at 20 cm when zoomed far out.
  const limit = Math.min(.2, Math.max(0,tolerance));
  for (const axis of ['x','y'] as const) {
    const lo = axis==='x'?'left':'top', hi = axis==='x'?'right':'bottom';
    const otherLo = axis==='x'?'top':'left', otherHi = axis==='x'?'bottom':'right';
    const anchors = [moved[lo], (moved[lo]+moved[hi])/2, moved[hi]];
    let best: {delta:number;value:number;target:Box}|undefined;
    for (const target of targets) {
      if (target[otherLo]-moved[otherHi]>.5 || moved[otherLo]-target[otherHi]>.5) continue;
      for (const value of [target[lo],(target[lo]+target[hi])/2,target[hi]]) for (const anchor of anchors) {
        const delta=value-anchor;
        if (Math.abs(delta)<=limit && (!best || Math.abs(delta)<Math.abs(best.delta)-1e-9)) best={delta,value,target};
      }
    }
    if (best) {
      result[axis]=item[axis]+best.delta;
      guides.push({axis,value:best.value,from:Math.min(moved[otherLo],best.target[otherLo])-.15,to:Math.max(moved[otherHi],best.target[otherHi])+.15});
    }
  }
  return {item:result,guides};
}
