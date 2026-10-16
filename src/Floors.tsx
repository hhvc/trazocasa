import { useState } from 'react';
import { X } from 'lucide-react';
import type { Building } from './model';
export function FloorManager({building,onAdd,onRename,onRemove,onClose}:{building:Building;onAdd:(name:string,mode:'blank'|'walls'|'copy')=>void;onRename:(name:string)=>void;onRemove:()=>void;onClose:()=>void}) {
 const current=building.floors.find(f=>f.id===building.activeFloorId)!;
 const [name,setName]=useState(current.name),[newName,setNewName]=useState('Planta '+building.floors.length);
 const [mode,setMode]=useState<'blank'|'walls'|'copy'>('walls');
 const [confirmDelete,setConfirmDelete]=useState(false);
 return <div className="modal-backdrop" onClick={onClose}><section className="modal floor-modal" role="dialog" aria-modal="true" aria-label="Administrar plantas" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
 <button className="modal-close" autoFocus aria-label="Cerrar plantas" onClick={onClose}><X size={20}/></button>
 <h2>Plantas del proyecto</h2><p>{building.floors.length} de 20 plantas. Cada planta tiene su propio plano.</p>
 <form onSubmit={e=>{e.preventDefault();onRename(name);}}><label>Nombre de la planta actual<input aria-label="Nombre de la planta actual" required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><button className="apply" type="submit">Renombrar planta</button></form>
 <form onSubmit={e=>{e.preventDefault();onAdd(newName,mode);}}><h3>Agregar planta superior</h3><label>Nombre de la nueva planta<input aria-label="Nombre de la nueva planta" required maxLength={60} value={newName} onChange={e=>setNewName(e.target.value)}/></label><label>Contenido inicial<select aria-label="Contenido inicial" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="blank">En blanco</option><option value="walls">Copiar solo paredes de {current.name}</option><option value="copy">Duplicar toda {current.name}</option></select></label><button className="primary" disabled={building.floors.length>=20} type="submit">Crear planta</button></form>
 {confirmDelete?<div className="floor-delete"><p>Se quitará «{current.name}» con todo su contenido. Podrás recuperarla con Deshacer.</p><button className="delete" onClick={onRemove}>Confirmar eliminación</button><button onClick={()=>setConfirmDelete(false)}>Cancelar</button></div>:<button className="delete" disabled={building.floors.length===1} onClick={()=>setConfirmDelete(true)}>Eliminar planta actual</button>}
 </section></div>;
}
