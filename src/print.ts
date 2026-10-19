import { createExport } from './export';
import { planBounds } from './model';
import type { Plan } from './model';
import { printLayout } from './printLayout';
import type { PrintOptions } from './printLayout';

/** Printable snapshot, prepared entirely in the browser. */
export async function printPlan(source: SVGSVGElement, plan: Plan, floorName: string): Promise<void> {
 const preview=window.open('about:blank','_blank');
 if(!preview)throw new Error('Permití abrir ventanas para preparar la impresión. También podés exportar SVG.');
 preview.opener=null;
 const doc=preview.document;doc.title=`${plan.name} — ${floorName}`;doc.documentElement.lang='es';
 const style=doc.createElement('style');doc.head.append(style);
 const controls=doc.createElement('section');controls.className='controls';
 const instructions=doc.createElement('p');instructions.textContent='Imprimí al 100 % / tamaño real, sin ajustar a página y sin encabezados del navegador. Elegí el mismo papel y orientación en la impresora. Comprobá la barra con una regla.';
 const options:PrintOptions={paper:'A4',orientation:'landscape',scale:'fit'};
 function select(label:string,values:string[][],value:string,change:(value:string)=>void){const field=doc.createElement('label');field.textContent=label+' ';const input=doc.createElement('select');for(const [key,text] of values){const option=doc.createElement('option');option.value=key;option.textContent=text;input.append(option);}input.value=value;input.addEventListener('change',()=>{change(input.value);update();});field.append(input);controls.append(field);}
 select('Papel',[['A4','A4'],['A3','A3']],options.paper,value=>options.paper=value as PrintOptions['paper']);
 select('Orientación',[['landscape','Horizontal'],['portrait','Vertical']],options.orientation,value=>options.orientation=value as PrintOptions['orientation']);
 select('Escala',[['fit','Ajustar a página'],['50','1:50'],['100','1:100']],options.scale,value=>options.scale=value as PrintOptions['scale']);
 const button=doc.createElement('button');button.textContent='Preparando plano…';button.disabled=true;button.addEventListener('click',()=>preview.print());
 const warning=doc.createElement('p');warning.setAttribute('role','status');controls.append(instructions,button,warning);
 const sheet=doc.createElement('main');
 const heading=doc.createElement('h1');heading.textContent=plan.name;
 const subtitle=doc.createElement('p');subtitle.className='subtitle';
 const area=doc.createElement('div');area.className='drawing-area';
 const image=doc.createElement('img');image.alt=`Bosquejo de ${floorName}`;area.append(image);
 const footer=doc.createElement('footer');
 const bar=doc.createElement('div');bar.className='scale-bar';
 const barLabel=doc.createElement('span');
 const note=doc.createElement('p');note.textContent='TrazoCasa · Bosquejo orientativo. No constituye documentación de obra.';
 footer.append(bar,barLabel,note);sheet.append(heading,subtitle,area,footer);doc.body.append(controls,sheet);
 const bounds=planBounds(plan);let ready=false;
 function update(){
  const layout=printLayout(bounds.width,bounds.height,options);
  subtitle.textContent=`Planta: ${floorName} · ${options.paper} · ${options.scale==='fit'?'Ajustado a página (sin escala fija)':`Escala 1:${options.scale}`}`;
  warning.textContent=layout.fits?'':`El plano no cabe a esta escala. Elegí un papel mayor, otra orientación o Ajustar a página. No se reducirá automáticamente.`;
  button.disabled=!ready||!layout.fits;
  sheet.classList.toggle('does-not-fit',!layout.fits);
  image.style.width=`${layout.drawingWidth}mm`;image.style.height=`${layout.drawingHeight}mm`;
  const reference=options.scale==='fit'?50:layout.mmPerMetre;
  bar.style.width=`${reference}mm`;
  barLabel.textContent=options.scale==='fit'?'Control de impresión: esta barra debe medir 5 cm.':`1 metro en el plano = ${reference/10} cm en el papel.`;
  style.textContent=`
   @page { size:${options.paper} ${options.orientation}; margin:12mm; }
   * {box-sizing:border-box} body{margin:0;color:#26382f;font:14px Arial,sans-serif;background:#e9ece6}
   .controls{padding:16px;max-width:1000px;margin:auto} label{display:inline-block;margin:6px} select,button{font:inherit;padding:10px;min-height:44px} button{cursor:pointer} button:disabled{cursor:default}
   main{width:${layout.availableWidth}mm;margin:16px auto;background:white;box-shadow:0 2px 12px #0002}
   h1{height:8mm;line-height:8mm;font-size:18px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .subtitle{height:7mm;line-height:7mm;margin:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .drawing-area{height:${layout.availableHeight}mm;display:flex;align-items:center;justify-content:center;overflow:hidden}
   img{display:block;max-width:none;flex-shrink:0} footer{height:23mm;padding-top:3mm;font-size:11px} footer p{margin:2mm 0}
   .scale-bar{height:3mm;border:solid #26382f;border-width:0 1px 2px;margin-bottom:1mm}
   .does-not-fit .drawing-area{outline:2px solid #b23c29}
   @media print{body{background:white}.controls{display:none}main{margin:0;box-shadow:none;break-inside:avoid}.does-not-fit{display:none}}
  `;
 }
 update();
 // Preserve the exact viewBox aspect ratio rather than export raster rounding.
 const exported=await createExport(source,plan).blob.text();
 const svg=new DOMParser().parseFromString(exported,'image/svg+xml');
 svg.documentElement.setAttribute('width',String(bounds.width));svg.documentElement.setAttribute('height',String(bounds.height));
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
 try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('No se pudo preparar el plano para imprimir.'));image.src=url;});ready=true;button.textContent='Imprimir / Guardar PDF';update();}
 catch(error){warning.textContent='No se pudo preparar el plano. Cerrá esta ventana y volvé a intentar.';throw error;}
 finally{URL.revokeObjectURL(url);}
}
