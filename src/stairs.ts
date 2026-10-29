import { uid, validatePlan } from './model';
import type { Furniture, Plan, Point } from './model';
import { selectionBounds } from './groups';

export type StaircaseOptions = {
  shape: 'L' | 'U'; side: 'right' | 'left'; width: number;
  firstLength: number; secondLength: number; landingDepth: number;
  rise?: number; gap: number; rotation: 0 | 90 | 180 | 270;
};
export type StaircaseFields = Omit<StaircaseOptions, 'width'|'firstLength'|'secondLength'|'landingDepth'|'gap'|'rise'> & {
  rise: string; width: string; firstLength: string; secondLength: string; landingDepth: string; gap: string;
};
export const defaultStaircase: StaircaseFields = {shape:'L',side:'right',rise:'3',width:'1',firstLength:'3',secondLength:'3',landingDepth:'1',gap:'0',rotation:0};
export function parseStaircase(fields: StaircaseFields): StaircaseOptions {
  const number = (s: string) => s.trim() ? Number(s.replace(',', '.')) : NaN;
  const options = {...fields,rise:number(fields.rise),width:number(fields.width),firstLength:number(fields.firstLength),secondLength:number(fields.secondLength),landingDepth:number(fields.landingDepth),gap:fields.shape==='U'?number(fields.gap):0};
  validateOptions(options);
  return options;
}
function validateOptions(o: StaircaseOptions) {
  if(o.rise!==undefined&&(!Number.isFinite(o.rise)||o.rise<.4||o.rise>20))throw new Error('La altura total debe estar entre 0,40 y 20 m.');
  if (!['L','U'].includes(o.shape) || !['right','left'].includes(o.side) || ![0,90,180,270].includes(o.rotation)) throw new Error('Elegí una forma, un sentido y un giro válidos.');
  if (![o.width,o.firstLength,o.secondLength,o.landingDepth].every(n=>Number.isFinite(n)&&n>=.2&&n<=10)) throw new Error('Ingresá medidas de 0,20 a 10 metros.');
  if (o.landingDepth < o.width) throw new Error('El fondo del descanso debe ser igual o mayor al ancho del tramo para unir las piezas.');
  if (o.shape==='U' && (!Number.isFinite(o.gap)||o.gap<0||2*o.width+o.gap>10)) throw new Error('La separación no puede ser negativa y el ancho total de la U no puede superar 10 m.');
}
/** Two flights and one landing, centred on their bounding box, with connected vertical levels, without construction calculations. */
export function staircasePieces(o: StaircaseOptions, center: Point, makeId: ()=>string = uid): Furniture[] {
  validateOptions(o);
  if (![center.x,center.y].every(Number.isFinite)) throw new Error('La posición de la escalera no es válida.');
  const rise=o.rise??3;
  const groupId=makeId(), w=o.width, d=o.landingDepth, sign=o.side==='right'?1:-1;
  const flight = (x:number,y:number,depth:number,rotation:number): Furniture => ({id:makeId(),groupId,kind:'stairs',x,y,width:w,depth,rotation});
  const firstX=o.shape==='U'?-sign*(w+o.gap)/2:0;
  const items: Furniture[] = [
    flight(firstX,d/2+o.firstLength/2,o.firstLength,0),
    {id:makeId(),groupId,kind:'stairLanding',x:0,y:0,width:o.shape==='U'?2*w+o.gap:w,depth:d,rotation:0},
    o.shape==='L'?flight(sign*(w/2+o.secondLength/2),-d/2+w/2,o.secondLength,sign===1?90:270)
      :flight(sign*(w+o.gap)/2,d/2+o.secondLength/2,o.secondLength,180)
  ];
  const box=selectionBounds(items);
  return items.map(item=>{
    let x=item.x-box.x, y=item.y-box.y;
    for(let quarter=0;quarter<o.rotation/90;quarter++) [x,y]=[-y,x];
    const first=item===items[0];
    return {...item,height:item.kind==='stairLanding'?.2:rise/2,elevation:item.kind==='stairLanding'?rise/2-.2:first?0:rise/2,x:center.x+x,y:center.y+y,rotation:(item.rotation+o.rotation)%360};
  });
}
export function addStaircase(plan: Plan, options: StaircaseOptions, center: Point): {plan:Plan;ids:string[]} {
  if(plan.furniture.length>497) throw new Error('La escalera necesita tres lugares libres: el límite es de 500 muebles por planta.');
  const items=staircasePieces(options,center);
  return {plan:validatePlan({...plan,furniture:[...plan.furniture,...items]}),ids:items.map(f=>f.id)};
}
