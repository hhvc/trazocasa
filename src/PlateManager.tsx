import {useEffect,useRef,useState} from 'react';
import {SlabControls} from './LevelControls';
import {validatePlan} from './model';
import {HoleControls} from './HoleControls';
import type {Plan,SurfaceHole} from './model';
import './plateManager.css';
export function PlateManager({plan,initialId,onChange,onDraw,onLocate,onHole,onClose}:{plan:Plan;initialId?:string|null;onChange:(plan:Plan)=>void;onDraw:(kind:'slab'|'roof')=>void;onLocate:(id:string)=>void;onHole:(id:string,target:SurfaceHole['target'])=>void;onClose:()=>void}){
 const [error,setError]=useState(''),[id,setId]=useState(initialId??plan.surfaces[0]?.id??''),dialog=useRef<HTMLElement>(null),surface=plan.surfaces.find(s=>s.id===id);
 useEffect(()=>{const old=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();return ()=>old?.focus();},[]);
 function change(next:Plan){try{onChange(validatePlan(next));setError('');}catch(e){setError((e as Error).message);}}
 return <div className="plate-backdrop"><section ref={dialog} className="plate-manager" role="dialog" aria-modal="true" aria-label="Losas y techos" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')).filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}}}>
 <header><h2>Losas y techos</h2><button aria-label="Cerrar losas y techos" onClick={onClose}>×</button></header>
 <p>Dibujá el perímetro sobre la planta. Cada contorno puede tener losa, techo o ambos. Para techos compuestos, agregá varios paños.</p>
 <div className="plate-create"><button onClick={()=>onDraw('slab')}>Dibujar losa</button><button onClick={()=>onDraw('roof')}>Dibujar cubierta</button></div>
 {plan.surfaces.length>0?<><label>Contorno existente<select aria-label="Contorno de losa o techo" value={id} onChange={e=>setId(e.target.value)}><option value="">Elegir contorno</option>{plan.surfaces.map(s=><option key={s.id} value={s.id}>{s.name}{s.slab?' · losa':''}{s.roof?' · techo':''}</option>)}</select></label>
 {surface&&<><button onClick={()=>onLocate(surface.id)}>Ver y editar contorno en planta</button><SlabControls key={surface.id+JSON.stringify([surface.slab,surface.roof])} surface={surface} plan={plan} onChange={(slab,roof)=>change({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,slab,roof}:s)})}/><HoleControls key={surface.id} surface={surface} onChange={holes=>change({...plan,surfaces:plan.surfaces.map(s=>s.id===surface.id?{...s,holes}:s)})} onDraw={target=>onHole(surface.id,target)}/></>}
 </>:<p>Todavía no hay contornos en esta planta. Elegí Dibujar losa o Dibujar cubierta para empezar.</p>}
 {error&&<p role="alert" className="roof-error">{error}</p>}
 </section></div>;
}
