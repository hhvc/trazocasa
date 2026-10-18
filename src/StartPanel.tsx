import {useState} from 'react';
import type {TemplateId} from './templates';
export function StartPanel({onClose,onLibrary,onCreate,onGuide}:{onClose:()=>void;onLibrary:()=>void;onCreate:(id:TemplateId,name:string)=>void;onGuide:()=>void}){
 const [name,setName]=useState('Mi nuevo proyecto');
 return <div className="modal-backdrop"><section className="modal library-modal" role="dialog" aria-modal="true" aria-label="Empezar en TrazoCasa" onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,input'));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}}}>
 <button autoFocus className="modal-close" aria-label="Volver al editor" onClick={onClose}>×</button><h2>Tu próxima idea empieza acá</h2><p>Continuá un trabajo o elegí un bosquejo editable como punto de partida.</p>
 <div className="library-actions"><button onClick={onLibrary}>Mis proyectos</button><button onClick={onClose}>Continuar en el editor</button></div>
 <label>Nombre del nuevo proyecto<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><p>Medidas en metros. Podés escribir decimales para indicar centímetros.</p>
 <div className="library-grid">{([['blank','En blanco','Empezá dibujando tu primera habitación.'],['studio','Monoambiente','Ambiente integrado y baño.'],['one','Un dormitorio','Estar, dormitorio y baño.'],['two','Dos dormitorios','Estar, cocina, dos dormitorios y baño.']] as const).map(([id,title,text])=><article key={id}><h3>{title}</h3><p>{text}</p><button onClick={()=>onCreate(id,name)}>Crear {title.toLowerCase()}</button></article>)}</div>
 <p>Crear conserva el trabajo actual en Mis proyectos. Son distribuciones ilustrativas para editar, no diseños constructivos.</p><button onClick={onGuide}>Aprender en cuatro pasos</button>
 </section></div>;
}
export function QuickGuide({onClose}:{onClose:()=>void}){
 const [step,setStep]=useState(0);
 const steps=[['Creá una habitación','Elegí Habitación (R). Marcá dos esquinas o usá medidas exactas en el panel.'],['Colocá una puerta','Elegí Puerta (D) y tocá una pared. Con Seleccionar podés moverla y cambiar su apertura.'],['Ajustá una medida','Con Seleccionar (V), tocá una pared o mueble y editá sus medidas en el panel de detalles.'],['Conservá tu trabajo','Menú → Guardar archivo descarga todas las plantas. Mis proyectos guarda en este navegador; la copia descargada es tu respaldo.']];
 return <aside className="quick-guide" aria-label="Guía de primeros pasos"><strong>{step+1}/4 · {steps[step][0]}</strong><p>{steps[step][1]}</p><div className="library-actions"><button onClick={onClose}>Omitir guía</button>{step>0&&<button onClick={()=>setStep(step-1)}>Anterior</button>}<button onClick={()=>step===3?onClose():setStep(step+1)}>{step===3?'Finalizar':'Siguiente'}</button></div></aside>;
}
