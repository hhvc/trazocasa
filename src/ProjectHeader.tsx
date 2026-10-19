import { useEffect, useRef, useState } from 'react';
import { House, Menu, ChevronDown, Check, FilePlus2, ArrowUpFromLine, ArrowDownToLine, CircleHelp } from 'lucide-react';

type Props = { name:string; saved:boolean; onName:(name:string)=>void; onRename:()=>void; onNew:()=>void; onOpen:()=>void; onSave:()=>void; onReference:()=>void; onSummary:()=>void; onStart:()=>void; onLibrary:()=>void; onDrive:()=>void; onPrint:()=>void; onHelp:()=>void; onSvg:()=>void; onPng:()=>void; exporting:boolean; dragging:boolean };
const driveEnabled = import.meta.env.VITE_ENABLE_GOOGLE_DRIVE === 'true';
function donationLink(): string | undefined {
  try { const url = new URL(import.meta.env.VITE_DONATION_URL ?? 'https://link.mercadopago.com.ar/trazocasa'); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
const donationUrl = donationLink();
export function ProjectHeader(p:Props) {
  const [open,setOpen]=useState(false);
  const container=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false);};
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);trigger.current?.focus();}
      else event.stopPropagation();
    };
    document.addEventListener('pointerdown',outside);
    window.addEventListener('keydown',keys,true);
    return ()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',keys,true);};
  },[open]);
  const act=(action:()=>void)=>{setOpen(false);trigger.current?.focus();action();};
  return <header className="compact-header">
    <a className="compact-brand" href="#" onClick={e=>e.preventDefault()} aria-label="TrazoCasa inicio"><House size={21}/><span>TrazoCasa</span></a>
    <div className="compact-project"><input aria-label="Nombre del proyecto" value={p.name} maxLength={100} onChange={e=>p.onName(e.target.value)} onBlur={p.onRename} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><span className="compact-save-state" title={p.saved?'Guardado en este navegador':'Guardado pendiente'}><Check size={12}/><span>{p.saved?'Guardado en este navegador':'Guardado pendiente'}</span></span></div>
    <div className="project-disclosure" ref={container} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false);}}>
      <button ref={trigger} className="project-menu-trigger" aria-expanded={open} aria-controls="project-menu" onClick={()=>setOpen(v=>!v)}><Menu size={18}/><span>Menú</span><ChevronDown size={14}/></button>
      {open&&<nav id="project-menu" className="project-dropdown" aria-label="Acciones del proyecto">
        <button disabled={p.dragging} onClick={()=>act(p.onStart)}>Inicio y plantillas</button>
        <button disabled={p.dragging} onClick={()=>act(p.onLibrary)}>Mis proyectos</button>
        <button onClick={()=>act(p.onNew)}><FilePlus2 size={17}/>Nuevo proyecto</button>
        <button onClick={()=>act(p.onOpen)}><ArrowUpFromLine size={17}/>Abrir archivo</button>
        <button onClick={()=>act(p.onSave)}><ArrowDownToLine size={17}/>Guardar archivo<kbd>Ctrl S</kbd></button>
        <hr/>
        {driveEnabled&&<><button disabled={p.dragging} onClick={()=>act(p.onDrive)}>Google Drive…</button><hr/></>}
        <button disabled={p.dragging} onClick={()=>act(p.onReference)}>Imagen de referencia</button>
        <button disabled={p.dragging} onClick={()=>act(p.onSummary)}>Resumen de superficies</button>
        <button disabled={p.dragging||p.exporting} onClick={()=>act(p.onPrint)}>Imprimir / Guardar PDF</button>
        <button disabled={p.exporting||p.dragging} onClick={()=>act(p.onPng)}>Exportar imagen PNG</button>
        <button disabled={p.dragging} onClick={()=>act(p.onSvg)}>Exportar imagen SVG</button>
        <hr/>
        <button onClick={()=>act(p.onHelp)}><CircleHelp size={17}/>Cómo empezar</button>
        {donationUrl&&<a className="donation-link" href={donationUrl} target="_blank" rel="noopener noreferrer">Apoyar TrazoCasa ↗</a>}
        <p>Editor gratuito. Tus planos quedan en tu dispositivo. Descargá una copia para conservarlos o compartirlos.</p>
      </nav>}
    </div>
  </header>;
}
