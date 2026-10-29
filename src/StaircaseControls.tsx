import type { StaircaseFields } from './stairs';
export function StaircaseControls({value,onChange,error,width,depth}: {value:StaircaseFields;onChange:(value:StaircaseFields)=>void;error:string;width?:number;depth?:number}) {
  const fields=[['rise','Altura total a subir (m)'],['width','Ancho de los tramos (m)'],['firstLength','Largo del primer tramo (m)'],['secondLength','Largo del segundo tramo (m)'],['landingDepth','Fondo del descanso (m)']] as const;
  return <div className="staircase-tool">
    <strong>Escalera prearmada</strong>
    <div className="room-modes">{(['L','U'] as const).map(shape=><button key={shape} aria-pressed={value.shape===shape} onClick={()=>onChange({...value,shape})}>Escalera en {shape}</button>)}</div>
    <div className="staircase-fields">{fields.map(([key,label])=><label key={key}>{label}<input aria-label={label} inputMode="decimal" value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>)}
      {value.shape==='U'&&<label>Separación entre tramos (m)<input aria-label="Separación entre tramos (m)" inputMode="decimal" value={value.gap} onChange={e=>onChange({...value,gap:e.target.value})}/></label>}
      <label>Sentido al subir<select aria-label="Sentido al subir" value={value.side} onChange={e=>onChange({...value,side:e.target.value as StaircaseFields['side']})}><option value="right">Hacia la derecha</option><option value="left">Hacia la izquierda</option></select></label>
      <label>Giro del conjunto<select aria-label="Giro del conjunto" value={value.rotation} onChange={e=>onChange({...value,rotation:Number(e.target.value) as StaircaseFields['rotation']})}>{[0,90,180,270].map(n=><option key={n} value={n}>{n}°</option>)}</select></label>
    </div>
    {error?<p role="status" className="staircase-error">{error}</p>:<p>Huella total: <b>{width?.toFixed(2)} × {depth?.toFixed(2)} m</b>. Tocá el plano para colocar las tres piezas agrupadas.</p>}
    <small>Después podés mover, girar o duplicar el grupo. Desagrupá para editar cada pieza. La altura se reparte entre ambos tramos. En 3D podés ajustar cada pieza. Prepará el hueco de la losa superior para recorrerla.</small>
  </div>;
}
