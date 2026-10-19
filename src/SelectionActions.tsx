import { Copy, RotateCw, Trash2, X } from 'lucide-react';
type Props={name:string;canTransform:boolean;onDuplicate:()=>void;onRotate:()=>void;onRemove:()=>void;onClear:()=>void};
export function SelectionActions({name,canTransform,onDuplicate,onRotate,onRemove,onClear}:Props){
 return <div className="selection-actions" role="group" aria-label="Acciones de la selección">
  <span className="selection-actions-name">{name}</span>
  {canTransform&&<><button onClick={onDuplicate} title="Duplicar selección"><Copy size={17}/><span>Duplicar</span></button><button onClick={onRotate} title="Girar selección 90 grados"><RotateCw size={17}/><span>Girar 90°</span></button></>}
  <button onClick={onRemove} title="Eliminar selección; podés recuperarla con Deshacer"><Trash2 size={17}/><span>Eliminar</span></button>
  <button onClick={onClear} aria-label="Quitar selección" title="Quitar selección"><X size={17}/></button>
 </div>;
}
