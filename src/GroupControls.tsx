import { Copy, Group, Ungroup, RotateCw, Trash2 } from 'lucide-react';
export function GroupControls({count,grouped,hasGroups,disabled,onGroup,onUngroup,onRotate,onDuplicate,onRemove}: {
  count:number;grouped:boolean;hasGroups:boolean;disabled:boolean;
  onGroup:()=>void;onUngroup:()=>void;onRotate:()=>void;onDuplicate:()=>void;onRemove:()=>void;
}) {
  return <div className="properties group-properties">
    <span className="selection-tag"><span/>{count} ELEMENTOS SELECCIONADOS</span>
    <p className="property-help">{grouped?'Este grupo se selecciona y mueve como una sola pieza. Desagrupá para editar las medidas de cada elemento.':'Arrastrá cualquiera de las piezas seleccionadas para mover el conjunto. Agrupalas para conservar la unión.'}</p>
    <div className="group-actions">
      <button disabled={disabled||grouped} onClick={onGroup}><Group size={16}/>Agrupar</button>
      <button disabled={disabled||!hasGroups} onClick={onUngroup}><Ungroup size={16}/>Desagrupar</button>
      <button disabled={disabled} onClick={onRotate}><RotateCw size={16}/>Girar conjunto 90°</button>
      <button disabled={disabled} onClick={onDuplicate}><Copy size={16}/>Duplicar conjunto</button>
      <button className="delete" disabled={disabled} onClick={onRemove}><Trash2 size={16}/>Eliminar selección</button>
    </div>
    <p className="property-help">Shift + clic agrega o quita piezas. En pantallas táctiles, activá Selección múltiple; desactivala para arrastrar.</p>
  </div>;
}
