export type PrintOptions={paper:'A4'|'A3';orientation:'portrait'|'landscape';scale:'fit'|'50'|'100'};
export function printLayout(width:number,height:number,options:PrintOptions){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Las dimensiones del plano no son válidas.');
 const short=options.paper==='A3'?297:210,long=options.paper==='A3'?420:297;
 const pageWidth=options.orientation==='landscape'?long:short,pageHeight=options.orientation==='landscape'?short:long;
 const availableWidth=pageWidth-24,availableHeight=pageHeight-24-38;
 const mmPerMetre=options.scale==='fit'?Math.min(availableWidth/width,availableHeight/height):1000/Number(options.scale);
 const drawingWidth=width*mmPerMetre,drawingHeight=height*mmPerMetre;
 return {pageWidth,pageHeight,availableWidth,availableHeight,mmPerMetre,drawingWidth,drawingHeight,fits:drawingWidth<=availableWidth+0.001&&drawingHeight<=availableHeight+0.001};
}
