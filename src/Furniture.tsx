import { useState } from 'react';
import { Copy, RotateCw } from 'lucide-react';
import { furnitureCatalog } from './model';
import type { Furniture, FurnitureKind } from './model';

/** Normalized top-down symbols. Keep all strokes inside the physical footprint. */
export function FurnitureGlyph({ kind }: { kind: FurnitureKind }) {
  return <g fill="#f0ecdf" stroke="#8b907d" strokeWidth=".018" strokeLinejoin="round">
    {kind === 'stairLanding' && <rect x="-.5" y="-.5" width="1" height="1" fill="#f8f5ec"/>}
    {kind === 'stairs' && <><rect x="-.48" y="-.48" width=".96" height=".96" fill="#f8f5ec"/>{Array.from({length:11},(_,i)=><line key={i} x1="-.48" x2=".48" y1={-.4+i*.08} y2={-.4+i*.08}/>)}<path d="M 0 .4 V -.39 M -.13 -.28 L 0 -.4 L .13 -.28" fill="none" stroke="#425d4b" strokeWidth=".035"/></>}
    {kind === 'tv' && <><rect x="-.48" y="-.42" width=".96" height=".2" rx=".02" fill="#65756b"/><path d="M 0 -.22 V .24 M -.27 .39 L 0 .24 L .27 .39" fill="none" strokeWidth=".04"/></>}
    {kind === 'bathtub' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".09" fill="#f8f8f0"/><rect x="-.36" y="-.36" width=".72" height=".74" rx=".24" fill="#e6ede7"/><circle cx="0" cy="-.23" r=".035"/><path d="M 0 -.45 V -.32 M -.09 -.43 H .09" fill="none"/></>}
    {kind === 'roundCoffeeTable' && <><circle r=".48"/><circle r=".42" fill="#f8f5ec"/><path d="M -.22 -.25 L -.14 -.3 M .23 .23 L .29 .17" fill="none"/></>}
    {kind === 'armchair' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".12"/><rect x="-.32" y="-.22" width=".64" height=".63" rx=".07" fill="#f8f5ec"/><rect x="-.48" y="-.25" width=".15" height=".67" rx=".05"/><rect x=".33" y="-.25" width=".15" height=".67" rx=".05"/><path d="M -.32 -.25 H .32" fill="none"/></>}
    {kind === 'fridge' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".035" fill="#edf0e9"/><rect x="-.41" y="-.41" width=".82" height=".73" rx=".02" fill="#f8f8f0"/><path d="M -.48 .35 H .48 M .18 .41 H .37" fill="none" strokeWidth=".025"/></>}
    {kind === 'stove' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".03" fill="#f8f8f0"/>{[-.23,.23].flatMap(x=>[-.23,.16].map(y=><g key={x+','+y}><circle cx={x} cy={y} r=".135"/><path d={`M ${x-.17} ${y} H ${x+.17} M ${x} ${y-.17} V ${y+.17}`} fill="none"/></g>))}<path d="M -.34 .39 H .34" fill="none"/></>}
    {kind === 'washer' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".04" fill="#f8f8f0"/><rect x="-.39" y="-.37" width=".78" height=".65" rx=".08" fill="#e6ede7"/><path d="M -.13 .19 H .13 M -.48 .34 H .48" fill="none"/><circle cx=".27" cy=".41" r=".035"/><path d="M -.33 .41 H -.13" fill="none"/></>}
    {kind === 'singleBed' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".04"/><rect x="-.43" y="-.44" width=".86" height=".88" rx=".035" fill="#f8f5ec"/><rect x="-.31" y="-.36" width=".62" height=".19" rx=".035"/><path d="M -.43 -.1 H .43 M -.43 -.06 H .43" fill="none"/></>}
    {kind === 'sofa3' && <><rect x="-.48" y="-.48" width=".96" height=".96" rx=".09"/><rect x="-.37" y="-.24" width=".74" height=".65" rx=".05" fill="#f8f5ec"/><path d="M -.123 -.24 V .41 M .123 -.24 V .41 M -.38 -.23 H .38" fill="none"/><rect x="-.48" y="-.27" width=".12" height=".7" rx=".04"/><rect x=".36" y="-.27" width=".12" height=".7" rx=".04"/></>}
    {kind === 'chair' && <><rect x="-.4" y="-.29" width=".8" height=".76" rx=".1" fill="#f8f5ec"/><rect x="-.46" y="-.47" width=".92" height=".2" rx=".05"/><path d="M -.3 -.22 H .3 M -.3 .35 H .3" fill="none"/></>}
    {kind === 'bidet' && <><path d="M -.36 -.46 Q -.46 -.46 -.46 -.27 V .07 C -.46 .6 .46 .6 .46 .07 V -.27 Q .46 -.46 .36 -.46 Z" fill="#f8f8f0"/><ellipse cx="0" cy=".1" rx=".29" ry=".28" fill="#e6ede7"/><circle cx="0" cy=".23" r=".035"/><path d="M 0 -.34 V -.13" fill="none"/><circle cx="-.16" cy="-.31" r=".035"/><circle cx=".16" cy="-.31" r=".035"/></>}
    {kind === 'bathroomSink' && <><rect x="-.48" y="-.46" width=".96" height=".92" rx=".15" fill="#f8f8f0"/><ellipse cx="0" cy=".07" rx=".36" ry=".28" fill="#e6ede7"/><circle cx="0" cy=".17" r=".035"/><path d="M 0 -.35 V -.08 M -.07 -.35 H .07" fill="none"/></>}
    {kind === 'kitchenSink' && <><rect x="-.48" y="-.46" width=".96" height=".92" rx=".04" fill="#f8f8f0"/><rect x="-.41" y="-.28" width=".49" height=".65" rx=".09" fill="#e6ede7"/><circle cx="-.165" cy=".1" r=".045"/><path d="M -.16 -.38 V -.17 M -.23 -.38 H -.09 M .18 -.28 V .34 M .25 -.28 V .34 M .32 -.28 V .34 M .39 -.28 V .34" fill="none"/></>}
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
  return <div className="furniture-catalog"><span className="eyebrow">HACELO TUYO</span><p>Elegí un mueble y tocá el plano.</p><div className="furniture-grid">{furnitureCatalog.map(f => <button key={f.kind} className={f.kind === selected ? 'chosen' : ''} aria-pressed={f.kind === selected} aria-label={`Colocar ${f.name.toLowerCase()}`} onClick={() => onChoose(f.kind)}><svg viewBox="-.6 -.6 1.2 1.2" aria-hidden="true"><FurnitureGlyph kind={f.kind}/></svg><strong>{f.name}</strong><small>{f.kind === 'roundCoffeeTable' ? `Ø ${f.width.toFixed(2)} m` : `${f.width.toFixed(2)} × ${f.depth.toFixed(2)} m`}</small></button>)}</div></div>;
}
export function FurnitureProperties({ item, onChange, onDuplicate, onError }: { item: Furniture; onChange: (next: Furniture) => void; onDuplicate: () => void; onError: (message: string) => void }) {
  const landing = item.kind === 'stairLanding';
  const round = item.kind === 'roundCoffeeTable';
  const [width, setWidth] = useState(item.width.toFixed(2));
  const [depth, setDepth] = useState(item.depth.toFixed(2));
  const [rotation, setRotation] = useState(String(item.rotation));
  function submit(e: React.FormEvent) { e.preventDefault(); const w = Number(width.replace(',', '.')), d = round ? w : Number(depth.replace(',', '.')), angle = Number(rotation.replace(',', '.')); if (!width.trim() || !depth.trim() || !rotation.trim() || ![w, d, angle].every(Number.isFinite) || w < .2 || w > 10 || d < .2 || d > 10 || Math.abs(angle) > 3600) { onError('Usá medidas de 0,20 a 10 metros y un ángulo válido.'); return; } onChange({ ...item, width: w, depth: d, rotation: ((angle % 360) + 360) % 360 }); }
  return <>{landing && <p className="property-help">Combiná este descanso con tramos rectos girados para armar una escalera en L o en U. Ajustá ancho y largo por separado.</p>}{item.kind==='stairs'&&<p className="property-help">La flecha indica la subida. Representación 2D: no calcula altura, huellas ni conexión entre plantas.</p>}<form className="furniture-form" onSubmit={submit}><div className="furniture-fields"><label>{round ? 'Diámetro (m)' : 'Ancho (m)'}<input aria-label={round ? 'Diámetro de la mesa' : landing ? 'Ancho del descanso' : 'Ancho del mueble'} inputMode="decimal" value={width} onChange={e => setWidth(e.target.value)}/></label>{!round && <label>{landing ? 'Largo (m)' : 'Fondo (m)'}<input aria-label={landing ? 'Largo del descanso' : 'Fondo del mueble'} inputMode="decimal" value={depth} onChange={e => setDepth(e.target.value)}/></label>}</div><label>Ángulo (°)<input aria-label="Ángulo del mueble" inputMode="decimal" value={rotation} onChange={e => setRotation(e.target.value)}/></label><button className="apply" type="submit">{landing ? 'Aplicar al descanso' : 'Aplicar al mueble'}</button></form><div className="furniture-actions"><button onClick={() => onChange({ ...item, rotation: (item.rotation + 90) % 360 })}><RotateCw size={15}/>Girar 90°</button><button onClick={onDuplicate}><Copy size={15}/>Duplicar</button></div></>;
}
