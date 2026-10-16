import { useEffect, useRef, useState } from 'react';
import { House, Menu, ChevronDown, Check, FilePlus2, ArrowUpFromLine, ArrowDownToLine, CircleHelp } from 'lucide-react';

type Props = { name:string; saved:boolean; onName:(name:string)=>void; onRename:()=>void; onNew:()=>void; onOpen:()=>void; onSave:()=>void; onHelp:()=>void; onSvg:()=>void; onPng:()=>void; exporting:boolean; dragging:boolean };
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
        <button onClick={()=>act(p.onNew)}><FilePlus2 size={17}/>Nuevo proyecto</button>
        <button onClick={()=>act(p.onOpen)}><ArrowUpFromLine size={17}/>Abrir archivo</button>
        <button onClick={()=>act(p.onSave)}><ArrowDownToLine size={17}/>Guardar archivo<kbd>Ctrl S</kbd></button>
        <hr/>
        <button disabled={p.exporting||p.dragging} onClick={()=>act(p.onPng)}>Exportar imagen PNG</button>
        <button disabled={p.dragging} onClick={()=>act(p.onSvg)}>Exportar imagen SVG</button>
        <hr/>
        <button onClick={()=>act(p.onHelp)}><CircleHelp size={17}/>Cómo empezar</button>
        <p>Tu plano se guarda en este navegador. Descargá una copia para conservarlo.</p>
      </nav>}
    </div>
  </header>;
}
