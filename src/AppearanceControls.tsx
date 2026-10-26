import {useEffect,useState} from 'react';
import type {Appearance,FinishKind,Plan} from './model';
import {finishOptions} from './appearance';
import './appearance.css';
const swatches=[['Marfil','#e6e4d8'],['Arena','#cdb795'],['Madera','#bda789'],['Salvia','#8eac9b'],['Azul','#7297ab'],['Terracota','#c4876e'],['Gris','#aeb3b0'],['Grafito','#535e5b']];
export function AppearanceControls({value,fallback,furniture,revision,onPreview,onApply,onCancel}:{revision:Plan;value?:Appearance;fallback:string;furniture?:boolean;onPreview:(value?:Appearance)=>void;onApply:(value?:Appearance)=>void;onCancel:()=>void}){
 const [color,setColor]=useState(value?.color??fallback),[finish,setFinish]=useState<FinishKind>(value?.finish??'paint'),[dirty,setDirty]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setColor(value?.color??fallback);setFinish(value?.finish??'paint');setDirty(false);setError('');},[revision,value,fallback]);
 function preview(nextColor:string,nextFinish:FinishKind){setColor(nextColor);setFinish(nextFinish);setDirty(true);setError('');onPreview(/^#[\da-f]{6}$/i.test(nextColor)?{color:nextColor.toLowerCase(),finish:nextFinish}:value);}
 function cancel(){setColor(value?.color??fallback);setFinish(value?.finish??'paint');setDirty(false);setError('');onCancel();}
 return <form className="appearance-controls" onSubmit={e=>{e.preventDefault();if(!/^#[\da-f]{6}$/i.test(color)){setError('Usá un color hexadecimal de seis dígitos, por ejemplo #8eac9b.');return;}onApply({color:color.toLowerCase(),finish});setDirty(false);setError('');}}>
  <label>Acabado<select aria-label="Acabado" value={finish} onChange={e=>{const option=finishOptions.find(f=>f.id===e.target.value)!;preview(option.color,option.id);}}>{finishOptions.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
  <div className="appearance-sample" data-finish={finish} style={{backgroundColor:/^#[\da-f]{6}$/i.test(color)?color:fallback}} aria-hidden="true"/>
  <label>Color principal<div className="appearance-color"><input type="color" aria-label="Elegir color" value={/^#[\da-f]{6}$/i.test(color)?color:fallback} onChange={e=>preview(e.target.value,finish)}/><input aria-label="Código de color" maxLength={7} spellCheck={false} value={color} onChange={e=>preview(e.target.value,finish)}/></div></label>
  <div className="appearance-swatches" role="group" aria-label="Colores sugeridos">{swatches.map(([name,hex])=><button type="button" key={hex} aria-label={name} title={name} aria-pressed={color.toLowerCase()===hex} style={{backgroundColor:hex}} onClick={()=>preview(hex,finish)}/>)}</div>
  <small>{furniture?'Cambia las superficies principales; conserva vidrios, patas y otros detalles.':'El acabado se aplica al elemento completo. En muros incluye ambas caras.'}</small>
  {dirty&&<small role="status">Vista previa sin guardar. Aplicá el acabado para conservarlo.</small>}
  {error&&<p role="alert">{error}</p>}
  <div className="appearance-actions"><button type="submit" disabled={!dirty}>Aplicar acabado</button><button type="button" disabled={!dirty} onClick={cancel}>Cancelar</button></div>
  <button type="button" disabled={!value&&!dirty} onClick={()=>{onApply(undefined);setColor(fallback);setFinish('paint');setDirty(false);setError('');}}>Restablecer aspecto original</button>
 </form>;
}
