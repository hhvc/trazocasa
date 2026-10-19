import { validateBuilding, uid } from './model';
import type { Building } from './model';
export type ProjectVersion={id:string;name:string;created:string;manual:boolean;building:Building};
export type LocalProject = { id:string; updated:string; deleted:boolean; building:Building; versions?:ProjectVersion[] };
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
    ids.add(item.id);return {id:item.id,updated:item.updated,deleted:item.deleted,building:validateBuilding(item.building),...(item.versions!==undefined?{versions:validateVersions(item.versions)}:{})};
  });
}
export function encodeLibrary(projects:LocalProject[]){return JSON.stringify({format:'trazocasa-library-1',projects});}
export function writeLibrary(projects:LocalProject[],storage:Pick<Storage,'setItem'>=localStorage){storage.setItem(LIBRARY_KEY,encodeLibrary(projects));}
export function storeProject(id:string,building:Building){
  const projects=readLibrary(); const existing=projects.find(p=>p.id===id);
  if(existing?.deleted)return;
  let versions=existing?.versions??[];
  if(existing&&JSON.stringify(existing.building)!==JSON.stringify(building)){
    const last=versions.at(-1);
    if(!last||Date.now()-Date.parse(last.created)>=5*60_000){
      try{versions=appendVersion(existing,'Automática',false);}catch{/* Keep current work if version budget is full. */}
    }
  }
  const record={...existing,id,building,deleted:false,updated:new Date().toISOString(),...(versions.length?{versions}:{})};
  writeLibrary([...projects.filter(p=>p.id!==id),record]);
}

function validateVersions(value:unknown):ProjectVersion[]{
 if(!Array.isArray(value)||value.length>20)throw new Error('Historial de versiones inválido.');
 const ids=new Set<string>();return value.map(v=>{if(!v||typeof v.id!=='string'||!v.id||ids.has(v.id)||typeof v.name!=='string'||v.name.length>100||typeof v.manual!=='boolean'||typeof v.created!=='string'||!Number.isFinite(Date.parse(v.created)))throw new Error('Versión inválida.');ids.add(v.id);return {id:v.id,name:v.name,manual:v.manual,created:v.created,building:validateBuilding(v.building)};});
}
export function appendVersion(project:LocalProject,name:string,manual=true):ProjectVersion[]{
 let versions=[...(project.versions??[]),{id:uid(),name:name.trim().slice(0,100)||'Versión',created:new Date().toISOString(),manual,building:project.building}];
 while(versions.length>20||JSON.stringify(versions).length*2>2_000_000){
  const index=versions.findIndex((v,i)=>!v.manual&&i<versions.length-1);
  if(index<0)throw new Error('El historial alcanzó el límite de 20 versiones o 2 MB por proyecto. Descargá un respaldo; no se eliminaron versiones manuales.');
  versions.splice(index,1);
 }
 return versions;
}
export function restoreVersion(project:LocalProject,id:string):LocalProject{
 const version=project.versions?.find(v=>v.id===id);if(!version)throw new Error('La versión ya no está disponible.');
 const versions=appendVersion(project,'Antes de restaurar',true);
 return {...project,building:version.building,updated:new Date().toISOString(),versions};
}
