import { validateBuilding } from './model';
import type { Building } from './model';
export const DRIVE_LIMIT = 20_000_000;
export type DriveFile = { id:string; name:string; version:string; size?:string; mimeType:string; trashed?:boolean; capabilities?:{canEdit?:boolean;canDownload?:boolean} };
export type DriveBinding = {file:DriveFile; snapshot:string; accountId:string};
export class DriveError extends Error { constructor(message:string,public code:'auth'|'conflict'|'permission'|'network'|'file'='file'){super(message);} }
const FIELDS='id,name,version,size,mimeType,trashed,capabilities(canEdit,canDownload)';
const ROOT='https://www.googleapis.com/drive/v3';
export function driveFilename(name:string){return (name.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'Mi plano')+'.trazocasa';}
export function driveFileUrl(id:string){return 'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view';}
function fileId(id:string){if(!/^[\w-]+$/.test(id))throw new DriveError('El identificador del archivo no es válido.');return id;}
function metadata(value:unknown):DriveFile{
 const f=value as DriveFile;
 if(!f||typeof f.id!=='string'||typeof f.name!=='string'||typeof f.version!=='string'||!/^\d+$/.test(f.version)||typeof f.mimeType!=='string')throw new DriveError('Drive no devolvió una versión válida del archivo. Volvé a abrirlo.');
 fileId(f.id);return f;
}
function assertReadable(f:DriveFile){
 if(f.trashed)throw new DriveError('El archivo está en la papelera de Drive.');
 if(f.mimeType.startsWith('application/vnd.google-apps.'))throw new DriveError('Elegí un archivo .trazocasa o JSON, no un documento de Google.');
 if(f.capabilities?.canDownload===false)throw new DriveError('No tenés permiso para descargar este archivo.','permission');
 if(f.size!==undefined&&(!/^\d+$/.test(f.size)||Number(f.size)>DRIVE_LIMIT))throw new DriveError('El archivo supera el límite de 20 MB.');
}
export class DriveApi {
 constructor(private token:()=>string,private transport:typeof fetch=fetch){}
 private async request(url:string,init:RequestInit={}){
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),90_000);
  try {
   const response=await this.transport(url,{...init,cache:'no-store',headers:{...init.headers,Authorization:'Bearer '+this.token()},signal:controller.signal});
   if(response.status===401)throw new DriveError('La conexión con Google venció. Volvé a conectar Drive.','auth');
   if(response.status===409||response.status===412)throw new DriveError('El archivo cambió en Drive. Abrí la versión actual o guardá una copia.','conflict');
   if(response.status===403)throw new DriveError('Drive rechazó la operación. Revisá los permisos del archivo, el espacio disponible o la configuración de la aplicación.','permission');
   if(response.status===404)throw new DriveError('El archivo ya no existe o esta cuenta no tiene acceso. Volvé a elegirlo en Drive.');
   if(!response.ok)throw new DriveError('Drive no pudo completar la operación. Conservá tu copia local e intentá nuevamente.','network');
   return response;
  } catch(error){if(error instanceof DriveError)throw error;throw new DriveError('No se pudo confirmar la operación con Drive. Revisá tu conexión y el archivo en Drive antes de reintentar. Tu proyecto local sigue disponible.','network');}
  finally {clearTimeout(timer);}
 }
 async account():Promise<{id:string;label:string}>{
  const value=await (await this.request(ROOT+'/about?fields=user(permissionId,displayName,emailAddress)')).json();
  if(typeof value.user?.permissionId!=='string')throw new DriveError('No pudimos identificar la cuenta de Drive.');
  return {id:value.user.permissionId,label:value.user.emailAddress||value.user.displayName||'Cuenta de Google'};
 }
 async info(id:string):Promise<DriveFile>{return metadata(await (await this.request(ROOT+'/files/'+fileId(id)+'?supportsAllDrives=true&fields='+encodeURIComponent(FIELDS))).json());}
 async open(id:string):Promise<{building:Building;file:DriveFile}>{
  const before=await this.info(id);assertReadable(before);
  const response=await this.request(ROOT+'/files/'+fileId(id)+'?alt=media&supportsAllDrives=true');
  const reader=response.body?.getReader();if(!reader)throw new DriveError('Drive devolvió un archivo vacío.');
  const chunks:Uint8Array[]=[];let length=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>DRIVE_LIMIT)throw new DriveError('El archivo supera el límite de 20 MB.');chunks.push(value);}}
  finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let building:Building;try{building=validateBuilding(JSON.parse(new TextDecoder().decode(bytes)));}catch{throw new DriveError('Este archivo no contiene un proyecto TrazoCasa válido.');}
  const after=await this.info(id);assertReadable(after);
  if(before.version!==after.version)throw new DriveError('El archivo cambió mientras lo abríamos. Volvé a elegirlo.','conflict');
  return {building,file:after};
 }
 async save(building:Building,existing?:DriveFile):Promise<{file:DriveFile;snapshot:string}>{
  const snapshot=JSON.stringify(validateBuilding(building));const body=new Blob([snapshot],{type:'application/json'});
  if(body.size>DRIVE_LIMIT)throw new DriveError('El proyecto supera el límite de 20 MB.');
  if(existing){
   const current=await this.info(existing.id);assertReadable(current);
   if(current.version!==existing.version)throw new DriveError('El archivo cambió en Drive. Abrí la versión actual o guardá una copia.','conflict');
   if(current.capabilities?.canEdit!==true)throw new DriveError('Este archivo es de solo lectura. Podés guardar una copia en tu Drive.','permission');
  }
  const url='https://www.googleapis.com/upload/drive/v3/files'+(existing?'/'+fileId(existing.id):'')+'?uploadType=resumable&supportsAllDrives=true&fields='+encodeURIComponent(FIELDS);
  const start=await this.request(url,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(body.size)},body:JSON.stringify({name:driveFilename(building.name),...(!existing?{mimeType:'application/json'}:{})})});
  const location=start.headers.get('Location');
  if(!location)throw new DriveError('Drive no pudo iniciar la carga. Conservá la copia local.');
  const upload=new URL(location);
  if(upload.origin!=='https://www.googleapis.com'||!upload.pathname.startsWith('/upload/drive/v3/files'))throw new DriveError('Drive devolvió un destino de carga inesperado.');
  const response=await this.request(upload.href,{method:'PUT',headers:{'Content-Type':'application/json'},body});
  return {file:metadata(await response.json()),snapshot};
 }
}
