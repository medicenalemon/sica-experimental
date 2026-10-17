import type { FiscalRecord, FiscalRequest } from './fiscal'
import { fiscalPrintModel } from './fiscal-print'
import { downloadBlob } from './files'

const amount=(n:number)=>new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100)
const numeric=(n:number)=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:6}).format(n)
const printable=(s:unknown)=>Array.from(String(s??'').normalize('NFC'),c=>c<' '&&c!=='\n'?' ':c).join('').replace(/[→–—]/g,'-').replace(/[^\n\u0020-\u00ff]/g,'?')
export async function buildFiscalPdf(request:FiscalRequest,record:FiscalRecord) {
 const model=fiscalPrintModel(request,record),[{jsPDF},{default:QRCode}]=await Promise.all([import('jspdf'),import('qrcode')])
 const production=record.environment==='produccion',simulation=production&&record.simulated===true,banner=production?(simulation?'SIMULACIÓN DE PRODUCCIÓN - SIN VALIDEZ FISCAL':'ORIGINAL - COMPROBANTE ELECTRÓNICO'):'HOMOLOGACIÓN - SIN VALIDEZ FISCAL'
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true}),width=186,margin=12
 const qr=QRCode.create(model.qrUrl,{errorCorrectionLevel:'M'}).modules
 let y=0
 function text(s:unknown,x:number,top:number,w:number,size=9,bold=false){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);const lines=doc.splitTextToSize(printable(s),w);doc.text(lines,x,top);return lines.length*size*0.39}
 function title(){doc.setFillColor(15,23,42);doc.rect(0,0,210,17,'F');doc.setTextColor(255,255,255);text(banner,margin,10,width,production?10:12,true);doc.setTextColor(15,23,42);if(production){doc.setDrawColor(15,23,42);doc.rect(94,22,22,25);text(request.letter,100,39,14,22,true);text(model.title,margin,32,77,14,true);text(`Cód. ${String(record.type).padStart(3,'0')}`,126,28,72,10,true);text(`Nº ${model.number}`,126,36,72,11,true);text(`Fecha: ${model.emission}`,126,43,72,10);y=57}else{y=25;text(`SICA - ${model.title} ${request.letter}`,margin,y,130,14,true);text(`Cód. ${String(record.type).padStart(3,'0')}`,166,y,32,10,true);y+=8;const h=text(`Nº ${model.number} | Fecha: ${model.emission}`,margin,y,width,10);y+=h+5}}
 function newPage(){doc.addPage();title()}
 function section(label:string,content:string){const h=doc.splitTextToSize(printable(content),width).length*3.6+10;if(h>190)throw new Error('Los datos de cabecera superan el espacio del comprobante.');if(y+h>260)newPage();text(label,margin,y,width,9,true);y+=5;y+=text(content,margin,y,width,9)+4}
 title()
 section('EMISOR',`${request.snapshot.issuer.name}\nCUIT: ${request.issuer} | ${request.snapshot.issuer.iva}\nDomicilio: ${request.snapshot.issuer.address||'No informado en la solicitud'}\nIngresos Brutos: ${request.snapshot.issuer.iibbRegistration||'No informado en la solicitud original'}\nINICIO DE ACTIVIDADES: ${request.snapshot.issuer.activityStart||'No informado en la solicitud original'}`)
 section('RECEPTOR',`${request.snapshot.receiver.name}\nCUIT: ${request.detail.DocNro} | ${request.snapshot.receiver.iva}${request.snapshot.receiver.iva==='Consumidor Final'?' | A CONSUMIDOR FINAL':''}\nDomicilio: ${request.snapshot.receiver.address||'No informado en la solicitud'}`)
 if(request.snapshot.saleTerms)section('CONDICIÓN DE VENTA',request.snapshot.saleTerms)
 if(request.detail.FchServDesde)section('PRESTACIÓN',`${request.detail.FchServDesde} a ${request.detail.FchServHasta} | Vencimiento del pago: ${request.detail.FchVtoPago}`)
 for(const a of request.associated)section('COMPROBANTE ASOCIADO',`Tipo ${a.Tipo} | Punto ${String(a.PtoVta).padStart(5,'0')} | Nº ${String(a.Nro).padStart(8,'0')} | CUIT ${a.Cuit}`)
 const cols=[{title:'Descripción / unidad',w:70},{title:'Cant.',w:19},{title:request.letter==='B'?'P. bruto':'Precio',w:27},{title:'Desc. %',w:19},{title:'IVA',w:18},{title:'Total ARS',w:33}]
 function tableHeader(){doc.setFillColor(239,242,246);doc.rect(margin,y-4,width,9,'F');let x=margin;cols.forEach(c=>{text(c.title,x+1,y,c.w-2,8,true);x+=c.w});y+=9}
 if(y+20>258)newPage();tableHeader()
 for(const l of model.lines){const cells=[`${l.description} / ${l.unit}`,numeric(l.quantity),amount(l.price),numeric(l.discount),request.letter==='C'?'No discr.':`${l.tax}${['Exento','No gravado'].includes(l.tax)?'':' %'}`,amount(l.total)],heights=cells.map((s,i)=>doc.splitTextToSize(printable(s),cols[i].w-3).length*3.5),height=Math.max(...heights)+5
  if(height>200)throw new Error('Una descripción es demasiado extensa para el PDF.')
  if(y+height>258){newPage();tableHeader()}
  let x=margin;cells.forEach((s,i)=>{text(s,x+1,y,cols[i].w-3,8);x+=cols[i].w});doc.setDrawColor(225,230,237);doc.line(margin,y+height-5,198,y+height-5);y+=height
 }
 const d=request.detail,totals=request.letter==='A'?[[`Neto gravado`,d.ImpNeto],['Exento',d.ImpOpEx],['No gravado',d.ImpTotConc],['IVA',d.ImpIVA],['Otros tributos',d.ImpTrib]]:request.letter==='B'?[['Subtotal (IVA incluido)',d.ImpTotal-d.ImpTrib],['IVA contenido',d.ImpIVA],['Otros tributos',d.ImpTrib]]:[['Subtotal',d.ImpNeto],['Otros tributos',d.ImpTrib]]
 const needed=totals.length*5+request.iva.length*5+request.tributes.length*9+72+(request.letter==='B'?27:0)
 if(y+needed>265)newPage();y+=4
 for(const [label,value] of totals){text(`${label}: ${amount(Number(value))} ARS`,111,y,87,9);y+=5}
 text(`TOTAL: ${amount(d.ImpTotal)} ARS`,111,y,87,13,true);y+=9
 if(request.letter==='A')for(const v of request.iva){text(`IVA cód. ${v.Id} | Base ${amount(v.BaseImp)} | Impuesto ${amount(v.Importe)} ARS`,margin,y,width,8);y+=5}
 for(const t of request.tributes){if(y+15>258)newPage();y+=text(`${t.Desc}: ${amount(t.Importe)} ARS (base ${amount(t.BaseImp)}; ${numeric(t.Alic)} %)`,margin,y,width,8)+4}
 if(request.letter==='B'){
  if(y+30>258)newPage();y+=3
  y+=text('Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)',margin,y,width,9,true)+3
  text(`IVA Contenido: ${amount(d.ImpIVA)} ARS`,margin,y,width,9);y+=5
  y+=text(`Otros Impuestos Nacionales Indirectos: ${model.nationalIndirect===null?'No informado en la solicitud original':`${amount(model.nationalIndirect)} ARS`}`,margin,y,width,9)+3
 }
 for(const legend of model.legends){if(y+22>258)newPage();y+=text(legend,margin,y+3,width,8)+6}
 if(production&&record.messages.length){if(y+15>258)newPage();text('OBSERVACIONES DE LA AUTORIZACIÓN ARCA',margin,y,width,9,true);y+=6;for(const message of record.messages){const lines=doc.splitTextToSize(printable(message),width);for(const line of lines){if(y+6>258)newPage();text(line,margin,y,width,8);y+=4}y+=3}}
 if(y+62>266)newPage();y+=5
 const side=42,cell=side/(qr.size+8);doc.setFillColor(255,255,255);doc.rect(margin,y,side,side,'F');doc.setFillColor(0,0,0)
 for(let row=0;row<qr.size;row++)for(let col=0;col<qr.size;col++)if(qr.get(row,col))doc.rect(margin+(col+4)*cell,y+(row+4)*cell,cell,cell,'F')
 text(production?(simulation?'CAE simulado':'CAE'):'CAE de homologación',62,y+7,136,10,true);text(record.cae,62,y+14,136,12,true);text(`Vencimiento del CAE: ${record.expires}`,62,y+21,136,9);text(production?(simulation?'Código QR de simulación.\nNo corresponde a una emisión real.':'Código QR para consulta del comprobante.\nConservá los datos y observaciones de la autorización.'):'QR de prueba conforme al formato ARCA.\nNo acredita una autorización productiva.',62,y+29,136,9);y+=side+6
 text(production?(simulation?'Ejemplo sintético de producción simulada. No se contactó ARCA y este documento no tiene validez fiscal.':'Representación del comprobante electrónico original a partir de la solicitud y autorización conservadas. Revisá las observaciones de ARCA que correspondan al comprobante.'):'Documento de prueba generado a partir de la solicitud fiscal conservada. No usar como factura legal. Pendiente validación de datos registrales y leyendas aplicables antes de habilitar producción.',margin,y,width,8)
 for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.setDrawColor(200,205,212);doc.line(margin,278,198,278);text(`SICA | ${banner} | Página ${page} de ${doc.getNumberOfPages()}`,margin,285,width,8)}
 doc.setProperties({title:`${production?(simulation?'SIMULACION-PRODUCCION':'ORIGINAL'):'HOMOLOGACION'} ${model.title} ${request.letter} ${model.number}`,subject:production&&!simulation?'Comprobante electrónico con CAE conservado':'Prueba sin validez fiscal',author:'SICA'})
 return {doc,model}
}
export async function exportFiscalPdf(request:FiscalRequest,record:FiscalRecord){const {doc,model}=await buildFiscalPdf(request,record);downloadBlob(`${record.environment==='produccion'?(record.simulated?'SIMULACION-PRODUCCION':'COMPROBANTE'):'HOMOLOGACION'}-${request.letter}-${model.number}.pdf`,doc.output('blob'))}
