import { useEffect, useRef, useState } from 'react';
import { Cloud, X } from 'lucide-react';
import type { Building } from './model';
import { DriveError, driveFileUrl } from './driveApi';
import type { DriveBinding, DriveFile } from './driveApi';
import { connectDrive, disconnectDrive, driveAccount, driveApi, driveConfigured, pickDriveFile, prepareDrive } from './googleDrive';

type Props={open:boolean;building:Building;initialBinding?:DriveBinding;onClose:()=>void;onOpen:(building:Building,binding:DriveBinding)=>void;onDownload:()=>void};
export function DrivePanel({open,building,initialBinding,onClose,onOpen,onDownload}:Props){
 const [account,setAccount]=useState(driveAccount),[binding,setBinding]=useState(initialBinding);
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false);
 const [pending,setPending]=useState<{building:Building;file:DriveFile}|null>(null);
 const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
 const locked=useRef(false);
 useEffect(()=>{
  if(!open)return;let alive=true;setAccount(driveAccount());close.current?.focus();
  if(driveConfigured){setLoading(true);prepareDrive().then(()=>{if(alive){setReady(true);setError('');}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});}
  return()=>{alive=false;};
 },[open]);
 async function run(action:()=>Promise<void>){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setNotice('');
  try{await action();}catch(e){
   if(e instanceof DriveError){if(e.code==='auth'){disconnectDrive();setAccount(null);}if(e.code==='conflict')setConflict(true);}
   setError(e instanceof Error?e.message:'No pudimos completar la operación. Tu proyecto local sigue disponible.');
  }finally{locked.current=false;setBusy(false);}
 }
 function connect(){void run(async()=>{const next=await connectDrive();setAccount(next);setPending(null);if(binding&&binding.accountId!==next.id){setBinding(undefined);setConflict(false);}setNotice('Drive conectado. El guardado en la nube es manual.');});}
 function choose(){void run(async()=>{const id=await pickDriveFile();if(!id)return;const result=await driveApi.open(id);setPending(result);});}
 function save(copy:boolean){void run(async()=>{
  const current=driveAccount();if(!current)throw new DriveError('Volvé a conectar Google Drive.','auth');
  if(binding&&!copy&&binding.accountId!==current.id)throw new DriveError('Este archivo pertenece a otra conexión. Abrilo nuevamente o guardá una copia.');
  const result=await driveApi.save(building,copy?undefined:binding?.file);
  setBinding({...result,accountId:current.id});setConflict(false);setNotice('Todas las plantas quedaron guardadas en Drive.');
 });}
 if(!open)return null;
 const dirty=!binding||binding.snapshot!==JSON.stringify(building);
 function finishOpen(){if(!pending||!account)return;onOpen(pending.building,{file:pending.file,snapshot:JSON.stringify(pending.building),accountId:account.id});}
 return <div className="modal-backdrop" onClick={()=>{if(!busy)onClose();}}><section ref={panel} className="modal drive-modal" role="dialog" aria-modal="true" aria-labelledby="drive-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
  if(e.key==='Escape'&&!busy){e.stopPropagation();onClose();}
  if(e.key==='Tab'&&!busy){const nodes=Array.from(panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select'));const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}>
 <button ref={close} className="modal-close" disabled={busy} aria-label="Cerrar Google Drive" onClick={onClose}><X size={20}/></button>
 <Cloud size={28}/><h2 id="drive-title">Google Drive</h2>
 {!driveConfigured?<><p>Google Drive todavía no está habilitado en este sitio.</p><p>Podés seguir guardando y abriendo archivos en tu dispositivo.</p><button className="apply" onClick={onDownload}>Descargar proyecto</button></>:<>
 <p>Guardá todas las plantas en tu Drive y abrí el proyecto desde otro dispositivo. Solo accedemos a los archivos que creás o elegís para TrazoCasa.</p>
 {loading&&<p role="status">Preparando conexión con Google…</p>}
 {account?<p className="drive-account">Conectado: <strong>{account.label}</strong></p>:<button className="primary" disabled={!ready||busy} onClick={connect}>Conectar Google Drive</button>}
 {account&&<>
 <div className="drive-status"><strong>{binding?binding.file.name:'Proyecto sin archivo asociado en Drive'}</strong><p>{binding?(dirty?'Hay cambios locales pendientes de guardar en Drive.':'Esta versión está guardada en Drive.'):'El primer guardado creará un archivo en Mi unidad.'}</p>{binding?.file.capabilities?.canEdit===false&&<p>Archivo de solo lectura: podés guardar una copia.</p>}</div>
 <div className="drive-actions">
 <button disabled={busy||!ready} onClick={choose}>Abrir desde Drive</button>
 <button disabled={busy||conflict||binding?.file.capabilities?.canEdit===false} onClick={()=>save(false)}>{binding?'Guardar cambios en Drive':'Guardar en Drive'}</button>
 <button disabled={busy} onClick={()=>save(true)}>Guardar una copia en Drive</button>
 {binding&&<a href={driveFileUrl(binding.file.id)} target="_blank" rel="noopener noreferrer">Ver archivo y compartir en Drive ↗</a>}
 <button disabled={busy} onClick={()=>{disconnectDrive();setAccount(null);setBinding(undefined);setPending(null);setConflict(false);setNotice('Conexión cerrada en este navegador.');}}>Desconectar</button>
 </div></>}
 {pending&&<div className="drive-confirm"><strong>Abrir «{pending.file.name}»</strong><p>Reemplazará el proyecto visible. Podés descargar el actual antes de continuar y recuperarlo con Deshacer.</p><div className="drive-actions"><button disabled={busy} onClick={onDownload}>Descargar el proyecto actual</button><button className="primary" disabled={busy} onClick={finishOpen}>Abrir proyecto elegido</button><button disabled={busy} onClick={()=>setPending(null)}>Cancelar apertura</button></div></div>}
 <p className="modal-note">El autoguardado del navegador sigue siendo local. Drive se actualiza solo al pulsar Guardar. Después de recargar, conectá y abrí el archivo desde Drive para seguir actualizándolo. Para compartir, usá los permisos del archivo en Drive.</p>
 </>}
 {busy&&<p role="status">Procesando con Google Drive…</p>}{error&&<p className="drive-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section></div>;
}
