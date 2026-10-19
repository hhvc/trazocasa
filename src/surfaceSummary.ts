import { surfaceArea } from './model';
import type { Building } from './model';
export function surfaceSummary(building:Building){
 const floors=building.floors.map(f=>({id:f.id,name:f.name,rooms:f.plan.surfaces.map(s=>({id:s.id,name:s.name,area:surfaceArea(s.points)}))})).map(f=>({...f,total:f.rooms.reduce((sum,r)=>sum+r.area,0)}));
 return {floors,total:floors.reduce((sum,f)=>sum+f.total,0),count:floors.reduce((sum,f)=>sum+f.rooms.length,0)};
}
function cell(value:string){const safe=/^[\s]*[=+@\-]/.test(value)?"'"+value:value;return '"'+safe.replace(/"/g,'""')+'"';}
export function surfacesCsv(building:Building){
 const summary=surfaceSummary(building);
 const rows=[['Proyecto','Planta','Concepto','Superficie m²'],...summary.floors.flatMap(f=>[...f.rooms.map(r=>[building.name,f.name,r.name,r.area.toFixed(2).replace('.',',')]),[building.name,f.name,'Subtotal de contornos',f.total.toFixed(2).replace('.',',')]]),[building.name,'Todas','Suma de contornos',summary.total.toFixed(2).replace('.',',')],['Nota','','Suma de contornos manuales: no descuenta superposiciones, muros ni huecos; no equivale a superficie construida.','']];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
