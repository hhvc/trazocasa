import { useState } from 'react';
import { Copy, RotateCw } from 'lucide-react';
import { furnitureCatalog } from './model';
import type { Furniture, FurnitureKind } from './model';

/** Normalized top-down symbols. Keep all strokes inside the physical footprint. */
export function FurnitureGlyph({ kind }: { kind: FurnitureKind }) {
  return <g fill="#f0ecdf" stroke="#8b907d" strokeWidth=".018" strokeLinejoin="round">
    {kind === 'bed' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".04"/><rect x="-.43" y="-.44" width=".86" height=".88" rx=".035" fill="#f8f5ec"/><rect x="-.37" y="-.36" width=".32" height=".19" rx=".035"/><rect x=".05" y="-.36" width=".32" height=".19" rx=".035"/><path d="M -.43 -.1 H .43 M -.43 -.06 H .43" fill="none"/></>}
    {kind === 'sofa' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".09"/><rect x="-.37" y="-.24" width=".74" height=".65" rx=".05" fill="#f8f5ec"/><path d="M 0 -.24 V .41 M -.38 -.23 H .38"/><rect x="-.48" y="-.27" width=".12" height=".7" rx=".04"/><rect x=".36" y="-.27" width=".12" height=".7" rx=".04"/></>}
    {kind === 'table' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".09"/><rect x="-.43" y="-.43" width=".86" height=".86" rx=".07" fill="#f8f5ec"/><path d="M -.35 -.35 h .08 M .27 -.35 h .08 M -.35 .35 h .08 M .27 .35 h .08"/></>}
    {kind === 'desk' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".025"/><rect x=".2" y="-.42" width=".22" height=".84" fill="#f8f5ec"/><path d="M .24 -.14 H .38 M .24 .14 H .38"/><rect x="-.34" y="-.3" width=".37" height=".34" rx=".025" fill="#e6e9df"/><path d="M -.16 .04 V .15 M -.26 .15 H -.06"/></>}
    {kind === 'wardrobe' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".02"/><path d="M 0 -.48 V .48 M -.06 -.12 V .12 M .06 -.12 V .12"/></>}
    {kind === 'toilet' && <><ellipse cx="0" cy=".08" rx=".41" ry=".39" fill="#f8f8f0"/><ellipse cx="0" cy=".1" rx=".25" ry=".25" fill="#e6ede7"/><rect x="-.46" y="-.46" width=".92" height=".26" rx=".06" fill="#f8f8f0"/><circle cx=".21" cy="-.33" r=".045"/></>}
  </g>;
}
export function FurnitureShape({ item, selected = false, ghost = false }: { item: Furniture; selected?: boolean; ghost?: boolean }) {
  const title = furnitureCatalog.find(f => f.kind === item.kind)!.name;
  return <g data-id={ghost ? undefined : item.id} data-furniture={ghost ? undefined : item.kind} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`} opacity={ghost ? .5 : 1} pointerEvents={ghost ? 'none' : undefined}>
    <title>{title} · {item.width.toFixed(2)} × {item.depth.toFixed(2)} m</title>
    <g transform={`scale(${item.width} ${item.depth})`}><FurnitureGlyph kind={item.kind}/></g>
    <rect data-editor="true" x={-item.width / 2} y={-item.depth / 2} width={item.width} height={item.depth} rx=".035" fill={selected ? '#b97c4910' : 'transparent'} stroke={selected ? '#b97c49' : 'none'} strokeWidth=".025" strokeDasharray=".08 .05"/>
  </g>;
}
export function FurnitureCatalog({ selected, onChoose }: { selected: FurnitureKind; onChoose: (kind: FurnitureKind) => void }) {
  return <div className="furniture-catalog"><span className="eyebrow">HACELO TUYO</span><p>Elegí un mueble y tocá el plano.</p><div className="furniture-grid">{furnitureCatalog.map(f => <button key={f.kind} className={f.kind === selected ? 'chosen' : ''} aria-pressed={f.kind === selected} aria-label={`Colocar ${f.name.toLowerCase()}`} onClick={() => onChoose(f.kind)}><svg viewBox="-.6 -.6 1.2 1.2" aria-hidden="true"><FurnitureGlyph kind={f.kind}/></svg><strong>{f.name}</strong><small>{f.width.toFixed(2)} × {f.depth.toFixed(2)} m</small></button>)}</div></div>;
}
export function FurnitureProperties({ item, onChange, onDuplicate, onError }: { item: Furniture; onChange: (next: Furniture) => void; onDuplicate: () => void; onError: (message: string) => void }) {
  const [width, setWidth] = useState(item.width.toFixed(2));
  const [depth, setDepth] = useState(item.depth.toFixed(2));
  const [rotation, setRotation] = useState(String(item.rotation));
  function submit(e: React.FormEvent) { e.preventDefault(); const w = Number(width.replace(',', '.')), d = Number(depth.replace(',', '.')), angle = Number(rotation.replace(',', '.')); if (!width.trim() || !depth.trim() || !rotation.trim() || ![w, d, angle].every(Number.isFinite) || w < .2 || w > 10 || d < .2 || d > 10 || Math.abs(angle) > 3600) { onError('Usá medidas de 0,20 a 10 metros y un ángulo válido.'); return; } onChange({ ...item, width: w, depth: d, rotation: ((angle % 360) + 360) % 360 }); }
  return <><form className="furniture-form" onSubmit={submit}><div className="furniture-fields"><label>Ancho (m)<input aria-label="Ancho del mueble" inputMode="decimal" value={width} onChange={e => setWidth(e.target.value)}/></label><label>Fondo (m)<input aria-label="Fondo del mueble" inputMode="decimal" value={depth} onChange={e => setDepth(e.target.value)}/></label></div><label>Ángulo (°)<input aria-label="Ángulo del mueble" inputMode="decimal" value={rotation} onChange={e => setRotation(e.target.value)}/></label><button className="apply" type="submit">Aplicar al mueble</button></form><div className="furniture-actions"><button onClick={() => onChange({ ...item, rotation: (item.rotation + 90) % 360 })}><RotateCw size={15}/>Girar 90°</button><button onClick={onDuplicate}><Copy size={15}/>Duplicar</button></div></>;
}
