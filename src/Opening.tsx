import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import { doorTransform, wallThickness } from './model';
import type { Opening, Wall } from './model';

export function OpeningShape({ opening: o, wall: w, selected }: { opening: Opening; wall: Wall; selected: boolean }) {
  const angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI;
  const mirror = doorTransform(o);
  const thickness = wallThickness(w);
  return <g data-id={o.id} data-opening={o.kind} transform={`translate(${w.a.x + (w.b.x - w.a.x) * o.t} ${w.a.y + (w.b.y - w.a.y) * o.t}) rotate(${angle})`}>
    <title>{o.kind === 'door' ? 'Puerta' : 'Ventana'} · {o.width.toFixed(2)} m</title>
    <line x1={-o.width / 2} x2={o.width / 2} stroke="#faf9f5" strokeWidth={thickness+.04}/>
    {o.kind === 'door' ? <g data-swing="true" transform={`scale(${mirror.x} ${mirror.y})`}>
      <g fill="none" stroke="#8c957f" strokeWidth=".025"><path d={`M ${-o.width / 2} ${-o.width} A ${o.width} ${o.width} 0 0 1 ${o.width / 2} 0`} strokeDasharray=".045 .025"/><path d={`M ${-o.width / 2} 0 V ${-o.width}`} stroke="#5c6d5d" strokeWidth=".045"/></g>
      <rect data-editor="true" x={-o.width / 2} y={-o.width} width={o.width} height={o.width + thickness/2+.05} fill={selected ? '#b97c4920' : 'transparent'} stroke={selected ? '#b97c49' : 'none'} strokeWidth=".02"/>
    </g> : <><g stroke="#70999b" strokeWidth=".025"><rect x={-o.width / 2} y={-thickness/2} width={o.width} height={thickness} fill="#eaf1ef"/><line x1={-o.width / 2} x2={o.width / 2}/><line y1={-thickness/2} y2={thickness/2}/></g><rect data-editor="true" x={-o.width / 2} y={-Math.max(.32,thickness+.1)/2} width={o.width} height={Math.max(.32,thickness+.1)} fill={selected ? '#b97c4920' : 'transparent'} stroke={selected ? '#b97c49' : 'none'} strokeWidth=".02"/></>}
  </g>;
}

export function DoorControls({ opening, onChange }: { opening: Opening; onChange: (next: Opening) => void }) {
  return <div className="door-controls"><span className="eyebrow">SENTIDO DE APERTURA</span><button onClick={() => onChange({ ...opening, swing: opening.swing === 'positive' ? 'negative' : 'positive' })}><FlipVertical2 size={16}/>Cambiar lado de apertura</button><button onClick={() => onChange({ ...opening, hinge: opening.hinge === 'end' ? 'start' : 'end' })}><FlipHorizontal2 size={16}/>Cambiar bisagra</button><p>Elegí la combinación mirando el arco de la puerta en el plano.</p></div>;
}
