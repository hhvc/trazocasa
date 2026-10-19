import {surfaceSummary,surfacesCsv} from './surfaceSummary';
import type {Building} from './model';
export function SurfaceSummaryPanel({building,onClose,onLocate}:{building:Building;onClose:()=>void;onLocate:(floor:string,id?:string)=>void}){
 const summary=surfaceSummary(building),format=(value:number)=>value.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
 function download(){const url=URL.createObjectURL(new Blob([surfacesCsv(building)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='TrazoCasa-superficies.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div className="modal-backdrop"><section className="modal library-modal" role="dialog" aria-modal="true" aria-label="Resumen de superficies" onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}}}>
 <button autoFocus className="modal-close" aria-label="Cerrar resumen" onClick={onClose}>×</button><h2>Resumen de superficies</h2><p>{building.name}</p>
 <p>Se suman los contornos creados con Superficie. No se descuentan superposiciones, muros ni huecos. Las áreas no siguen automáticamente los cambios de paredes y no equivalen a superficie construida.</p>
 <strong>{summary.count} contornos · Suma: {format(summary.total)} m²</strong><p>Los totales se calculan antes de redondear.</p><button disabled={!summary.count} onClick={download}>Descargar resumen CSV</button>
 {summary.floors.map(f=><section className="surface-summary-floor" key={f.id}><h3>{f.name} · {format(f.total)} m²</h3>{f.rooms.length?<table><thead><tr><th scope="col">Ambiente / contorno</th><th scope="col">m²</th><th scope="col">Plano</th></tr></thead><tbody>{f.rooms.map(r=><tr key={r.id}><th scope="row">{r.name}</th><td>{format(r.area)}</td><td><button aria-label={`Ver ${r.name} en ${f.name}`} onClick={()=>onLocate(f.id,r.id)}>Ver</button></td></tr>)}</tbody></table>:<p>Sin contornos medidos. <button onClick={()=>onLocate(f.id)}>Dibujar superficie</button></p>}</section>)}
 </section></div>;
}
