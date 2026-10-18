import { addRectangle, emptyPlan, sample, uid, validatePlan } from './model';
import type { Plan } from './model';
export type TemplateId='blank'|'studio'|'one'|'two';
export function createTemplate(id:TemplateId,name:string):Plan {
  let plan=emptyPlan();
  if(id==='one')plan=sample();
  if(id==='studio'||id==='two'){
    const rooms=id==='studio'?[['Estar · cocina · dormitorio',0,0,4,3],['Baño',4,0,6,3]] as const:[['Estar · comedor',0,0,4,3],['Cocina',4,0,8,3],['Dormitorio 1',0,3,4,6],['Dormitorio 2',4,3,8,6]] as const;
    for(const [label,x,y,x2,y2] of rooms)plan=addRectangle(plan,{x,y},{x:x2,y:y2},label);
    if(id==='two')plan=addRectangle(plan,{x:8,y:0},{x:10,y:3},'Baño');
    
    plan.openings=plan.walls.flatMap(w=>{
      const shared=(w.a.x===4&&w.b.x===4)||(id==='two'&&((w.a.y===3&&w.b.y===3&&Math.max(w.a.x,w.b.x)<=8)||(w.a.x===8&&w.b.x===8&&Math.max(w.a.y,w.b.y)<=3)));
      const exterior=!shared;
      return [{id:uid(),wallId:w.id,t:.5,width:exterior?1:.8,kind:exterior?'window' as const:'door' as const}];
    });
    const entry=plan.walls.find(w=>w.a.x===0&&w.b.x===0)!;
    plan.openings=plan.openings.filter(o=>o.wallId!==entry.id);
    plan.openings.push({id:uid(),wallId:entry.id,t:.5,width:.9,kind:'door'});
    plan.furniture=[{id:uid(),kind:'bed',x:1,y:id==='two'?4.4:1.5,width:1.6,depth:2,rotation:0},{id:uid(),kind:'toilet',x:id==='two'?9.3:5.3,y:.7,width:.4,depth:.7,rotation:0}];
    if(id==='two')plan.furniture.push({id:uid(),kind:'bed',x:5.2,y:4.4,width:1.6,depth:2,rotation:0});
  }
  plan.name=name.trim().slice(0,100)||'Mi nuevo proyecto';
  return validatePlan(plan);
}
