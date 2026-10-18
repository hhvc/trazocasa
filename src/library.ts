import { validateBuilding } from './model';
import type { Building } from './model';
export type LocalProject = { id:string; updated:string; deleted:boolean; building:Building };
export const LIBRARY_KEY='trazocasa.library.v1';
export function readLibrary(storage:Pick<Storage,'getItem'>=localStorage):LocalProject[]{
  const raw=storage.getItem(LIBRARY_KEY); if(!raw)return [];
  return parseLibrary(JSON.parse(raw));
}
export function parseLibrary(value:unknown):LocalProject[]{
  const data=value as {format?:string;projects?:unknown[]};
  if(data?.format!=='trazocasa-library-1'||!Array.isArray(data.projects))throw new Error('El respaldo de proyectos no es válido.');
  const ids=new Set<string>();
  return data.projects.map(value=>{const item=value as LocalProject;
    if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.deleted!=='boolean'||typeof item.updated!=='string'||!Number.isFinite(Date.parse(item.updated)))throw new Error('El respaldo contiene datos inválidos.');
    ids.add(item.id);return {id:item.id,updated:item.updated,deleted:item.deleted,building:validateBuilding(item.building)};
  });
}
export function encodeLibrary(projects:LocalProject[]){return JSON.stringify({format:'trazocasa-library-1',projects});}
export function writeLibrary(projects:LocalProject[],storage:Pick<Storage,'setItem'>=localStorage){storage.setItem(LIBRARY_KEY,encodeLibrary(projects));}
export function storeProject(id:string,building:Building){
  const projects=readLibrary(); const existing=projects.find(p=>p.id===id);
  if(existing?.deleted)return;
  const record={id,building,deleted:false,updated:new Date().toISOString()};
  writeLibrary([...projects.filter(p=>p.id!==id),record]);
}
