import type {ReceiptPrintModel} from './receipt-print'
import {receiptPrintModel} from './receipt-print'
import type {State} from './types'
import {dateLabel} from './constants'
import {downloadBlob} from './files'

export interface ReceiptFonts {regular:Uint8Array;bold:Uint8Array}
let browserFonts:Promise<ReceiptFonts>|undefined
async function fonts(){
 if(typeof window==='undefined')throw new Error('Proporcioná las fuentes de la constancia al generar el PDF fuera del navegador.')
 if(!browserFonts)browserFonts=Promise.all(['DejaVuSans.ttf','DejaVuSans-Bold.ttf'].map(async name=>{const r=await fetch(`/fonts/${name}`);if(!r.ok)throw new Error('No se pudieron cargar las fuentes de la constancia.');return new Uint8Array(await r.arrayBuffer())})).then(([regular,bold])=>({regular,bold})).catch(e=>{browserFonts=undefined;throw e})
 return browserFonts
}
function base64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)}
const amount=(n:number)=>new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100)+' ARS'
const clean=(v:unknown)=>String(v??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\t/g,' ').replace(/[–—−‑]/g,'-').replace(/→/g,'>')
export async function buildReceiptPdf(model:ReceiptPrintModel,fontBytes?:ReceiptFonts){
 const [{jsPDF},pair]=await Promise.all([import('jspdf'),fontBytes||fonts()])
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true}),margin=14,width=182,bottom=270,line=4.2
 for(const [name,data,style]of [['SicaSans.ttf',pair.regular,'normal'],['SicaSans-Bold.ttf',pair.bold,'bold']] as const){doc.addFileToVFS(name,base64(data));doc.addFont(name,'SicaSans',style)}
 const title=model.document.kind==='cobro'?'RECIBO DE COBRO':'ORDEN DE PAGO',banner='CONSTANCIA INTERNA - SIN VALIDEZ FISCAL'
 let y=0
 function font(size=9,bold=false){doc.setFont('SicaSans',bold?'bold':'normal');doc.setFontSize(size)}
 function checked(v:unknown,bold=false){font(9,bold);const s=clean(v),metadata=doc.getFont().metadata as {characterToGlyph?:(n:number)=>number};if(typeof metadata.characterToGlyph!=='function')throw new Error('No se pudo verificar la fuente del PDF.');for(const c of s){const n=c.codePointAt(0)!;if(c!=='\n'&&(n>65535||!metadata.characterToGlyph(n)))throw new Error(`La fuente de la constancia no representa el carácter ${c}. Conservá el dato original y revisá su representación antes de imprimir.`)}return s}
 function lines(v:unknown,w=width,size=9,bold=false):string[]{const s=checked(v,bold);font(size,bold);return doc.splitTextToSize(s,w)}
 function page(){
  doc.setFillColor(15,23,42);doc.rect(0,0,210,14,'F');doc.setTextColor(255,255,255);font(10,true);doc.text(banner,margin,9)
  doc.setTextColor(15,23,42);font(11,true);doc.text(title,margin,23);font(8);doc.text(model.document.number,margin,29)
  const provenance=lines(model.provenance,width,8);doc.text(provenance,margin,35);y=35+provenance.length*3.8+6
 }
 function next(){doc.addPage();page()}
 function space(h:number){if(y+h>bottom)next()}
 function paragraph(v:unknown,size=9,bold=false){for(const s of lines(v,width,size,bold)){space(size*.43+2);font(size,bold);doc.text(s,margin,y);y+=size*.43+1}y+=1}
 function heading(v:string){space(15);doc.setFillColor(239,242,246);doc.rect(margin,y-4,width,9,'F');font(10,true);doc.text(v,margin+2,y+2);y+=11}
 function field(label:string,v:unknown){paragraph(`${label}: ${value(v)}`)}
 const value=(v:unknown)=>clean(v)||'No informado'
 page()
 paragraph(`${title==='RECIBO DE COBRO'?'Cobro':'Pago'} registrado el ${dateLabel(model.document.date)} | Clase declarada ${model.document.letter} | Numeración interna`,9,true)
 heading('EMPRESA Y SUCURSAL')
 paragraph(model.company.name,11,true);field('CUIT',model.company.cuit);field('Condición IVA',model.company.iva);field('Forma jurídica declarada',model.company.legalForm)
 field('Domicilio',model.company.address);field('Provincia',model.company.province);field('Sucursal',model.branch.name);field('Punto interno',model.branch.point)
 if(model.branch.address)field('Domicilio de sucursal',model.branch.address)
 heading(model.document.side==='cliente'?'CLIENTE':'PROVEEDOR')
 paragraph(model.party.name,11,true);field('Código',model.party.code);field('CUIT',model.party.cuit);field('Condición IVA',model.party.iva);field('Domicilio',model.party.address);field('Provincia',model.party.province)
 heading('MEDIOS REGISTRADOS')
 for(const [index,row]of model.payments.entries()){
  const p=row.payment;space(16);paragraph(`${index+1}. ${p.method} | ${amount(p.amount)}`,10,true)
  if(p.reference)field(p.method==='Retención'?'Certificado o referencia declarada':'Referencia',p.reference)
  if(row.treasury)field('Caja o cuenta registrada',`${row.treasury.name||row.treasury.id} (${row.treasury.type||'Tipo no informado'})`)
  if(row.card){field('Tarjeta declarada',row.card.name||row.card.id);if(p.cardDue)field('Fecha estimada al registrar',dateLabel(p.cardDue))}
  if(row.cheque){const c=row.cheque;field('Cheque',`${c.number} | ${c.type}`);field('Banco declarado',c.bankName||c.bankId);field('Titular',c.holder);field('Fecha de emisión',dateLabel(c.issued));field('Vencimiento',dateLabel(c.due))}
  if(p.method==='Retención'){field('Impuesto',p.tax);field('Jurisdicción',p.jurisdiction||'Sin jurisdicción provincial declarada');paragraph('Retención registrada. Esta constancia no emite ni valida el certificado del agente.',8)}
 }
 heading('COMPOSICIÓN DEL TOTAL REGISTRADO')
 for(const [label,n]of [['Medios de caja o cuenta',model.totals.cashMethods],['Cheques registrados',model.totals.cheques],['Tarjetas en cobros',model.totals.cards],['Retenciones registradas',model.totals.withheld]] as const)paragraph(`${label}: ${amount(n)}`)
 paragraph(`TOTAL REGISTRADO: ${amount(model.totals.total)}`,12,true)
 heading('APLICACIONES ORIGINALES')
 const cols=[{label:'Cargo / referencia interna',width:88},{label:'Fecha del cargo',width:38},{label:'Aplicado ARS',width:56}]
 function tableHead(){space(15);doc.setFillColor(239,242,246);doc.rect(margin,y-4,width,8,'F');let x=margin;for(const c of cols){font(8,true);doc.text(c.label,x+2,y+1);x+=c.width}y+=10}
 if(!model.allocations.length)paragraph('Sin aplicaciones al registrar. El total se conservó como importe sin aplicar.')
 else{
  tableHead()
  for(const a of model.allocations){const cells=[`${a.number}\nTotal del cargo: ${amount(a.total)}`,dateLabel(a.date),amount(a.amount)],wrapped=cells.map((v,i)=>lines(v,cols[i].width-4,8));let offset=0,max=Math.max(...wrapped.map(v=>v.length))
   while(offset<max){let available=Math.floor((bottom-y-5)/line);if(available<1){next();tableHead();available=Math.floor((bottom-y-5)/line)}const count=Math.min(max-offset,available);let x=margin;for(const [i,c]of cols.entries()){font(8);const part=wrapped[i].slice(offset,offset+count);if(part.length)doc.text(part,x+2,y);x+=c.width}y+=count*line+5;doc.setDrawColor(220,226,234);doc.line(margin,y-3,margin+width,y-3);offset+=count;if(offset<max){next();tableHead()}}
  }
 }
 paragraph(`Aplicado al registrar: ${amount(model.totals.applied)}`,10,true)
 paragraph(`IMPORTE SIN APLICACIÓN AL REGISTRAR: ${amount(model.totals.unapplied)}`,10,true)
 heading('RESPONSABLE Y OBSERVACIONES')
 field('Responsable del registro',model.document.responsible)
 paragraph(model.document.observations||'Sin observaciones informadas.')
 heading('ALCANCE DE ESTA CONSTANCIA')
 for(const warning of model.warnings)paragraph(warning,8)
 for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.setDrawColor(210,216,224);doc.line(margin,280,margin+width,280);font(7);doc.text(`SICA | ${banner} | Página ${page} de ${doc.getNumberOfPages()}`,margin,286)}
 doc.setProperties({title:`SICA ${title} ${model.document.number}`,subject:banner,author:'SICA'})
 return doc
}
export async function exportReceiptPdf(s:State,documentId:string){const model=receiptPrintModel(s,documentId),doc=await buildReceiptPdf(model);downloadBlob(`SICA_INTERNO_${model.document.number}.pdf`,doc.output('blob'))}
