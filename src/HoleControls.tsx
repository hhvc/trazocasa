import {useState} from 'react';
import {plateArea,resizeSurfaceHole,surfaceArea} from './model';
import type {Surface,SurfaceHole} from './model';
import './holeControls.css';
const targetName={slab:'Losa',roof:'Cubierta',both:'Losa y cubierta'};
const number=(s:string)=>s.trim()?Number(s.replace(',','.')):NaN;
function HoleEditor({hole,onApply,onRemove}:{hole:SurfaceHole;onApply:(hole:SurfaceHole)=>void;onRemove:()=>void}){
 const xs=hole.points.map(p=>p.x),ys=hole.points.map(p=>p.y);
 const [name,setName]=useState(hole.name),[target,setTarget]=useState(hole.target),[width,setWidth]=useState(String(Number((Math.max(...xs)-Math.min(...xs)).toFixed(3)))),[depth,setDepth]=useState(String(Number((Math.max(...ys)-Math.min(...ys)).toFixed(3)))),[error,setError]=useState('');
 return <form className="hole-form" onSubmit={e=>{e.preventDefault();try{const next=resizeSurfaceHole({...hole,name:name.trim(),target},number(width),number(depth));onApply(next);setError('');}catch(e){setError((e as Error).message);}}}>
 <label>Nombre del hueco<input aria-label="Nombre del hueco" maxLength={60} required value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Recortar en<select aria-label="Destino del hueco" value={target} onChange={e=>setTarget(e.target.value as SurfaceHole['target'])}>{Object.entries(targetName).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <div className="hole-dimensions"><label>Ancho X (m)<input aria-label="Ancho del hueco" inputMode="decimal" value={width} onChange={e=>setWidth(e.target.value)}/></label><label>Largo Y (m)<input aria-label="Largo del hueco" inputMode="decimal" value={depth} onChange={e=>setDepth(e.target.value)}/></label></div>
 <small>{surfaceArea(hole.points).toFixed(2)} m² · {hole.points.length} vértices. Las medidas escalan el contorno desde su esquina mínima X/Y.</small>
 {error&&<p role="alert">{error}</p>}<button>Aplicar hueco</button><button type="button" onClick={onRemove}>Eliminar solo este hueco</button></form>;
}
export function HoleControls({surface,selectedId,onSelect,onChange,onDraw}:{surface:Surface;selectedId?:string|null;onSelect?:(id:string|null)=>void;onChange:(holes:SurfaceHole[])=>void;onDraw:(target:SurfaceHole['target'])=>void}){
 const [localId,setLocalId]=useState<string|null>(null),[target,setTarget]=useState<SurfaceHole['target']>(surface.slab?'slab':surface.roof?'roof':'slab');
 const holes=surface.holes??[],selected=holes.find(h=>h.id===(selectedId===undefined?localId:selectedId));
 function select(id:string|null){setLocalId(id);onSelect?.(id);}
 return <section className="hole-controls" aria-label="Huecos de losa y cubierta"><strong>Huecos de escalera y patios</strong>
 <label>Recorte nuevo<select aria-label="Destino del nuevo hueco" value={target} onChange={e=>setTarget(e.target.value as SurfaceHole['target'])}>{Object.entries(targetName).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <button disabled={holes.length>=20} onClick={()=>onDraw(target)}>Dibujar hueco en planta</button>
 {holes.length>0&&<label>Hueco a editar<select aria-label="Hueco a editar" value={selected?.id??''} onChange={e=>select(e.target.value||null)}><option value="">Seleccionar hueco</option>{holes.map(h=><option key={h.id} value={h.id}>{h.name} · {targetName[h.target]}</option>)}</select></label>}
 {selected&&<HoleEditor key={JSON.stringify(selected)} hole={selected} onApply={next=>onChange(holes.map(h=>h.id===next.id?next:h))} onRemove={()=>{onChange(holes.filter(h=>h.id!==selected.id));select(null);}}/>}
 <small>Los huecos recortan solo los elementos activados de este contorno. En 2D, arrastrá el borde o el nombre para moverlos; los círculos ajustan sus vértices.</small>
 {(surface.slab||surface.roof)&&<p>{surface.slab&&<>Losa neta: {plateArea(surface,'slab').toFixed(2)} m²<br/></>}{surface.roof&&<>Cubierta neta: {plateArea(surface,'roof').toFixed(2)} m²</>}</p>}
 </section>;
}
