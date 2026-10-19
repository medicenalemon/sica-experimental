import type {Document,State,Session} from './types'
import type {FiscalEnvironment,FiscalRequest,FiscalRecord} from './fiscal'
import {fiscalPrintModel} from './fiscal-print'
import {purchaseMonth,vatAnsi} from './vat-purchases'
import {canAccess} from './permissions'
import {uid} from './constants'
import {validCuit} from './engine'
export const vatSalesPath='/finanzas/impuestos'
export interface VatSalesInput {period:string;environment:FiscalEnvironment;previousId:string;reference:string;reason:string;scopeConfirmed:boolean;review?:string}
export interface SalesAuthorization {documentId:string;request:FiscalRequest;record:FiscalRecord;unchanged:boolean}
type SalesDocument=Pick<Document,'id'|'number'|'kind'|'letter'|'date'|'branchId'|'partyId'|'sourceId'|'lines'|'net'|'vat'|'perceptions'|'total'>
export interface VatSalesRow {document:SalesDocument;authorization:SalesAuthorization;original:string;name:string;fileName:string;operation:'0'|'E'|'N';net:number;exempt:number;untaxed:number;vat:number;perceptions:number;total:number;header:string;details:string[]}
interface Sources {company:{name:string;cuit:string;iva:string};documentPrefixIds:string[];authorizations:SalesAuthorization[]}
export interface VatSalesPreview {input:Omit<VatSalesInput,'review'>;source:Sources;rows:VatSalesRow[];excluded:{id:string;number:string;date:string;total:number}[];simulation:boolean;totals:{total:number;net:number;exempt:number;untaxed:number;vat:number;perceptions:number};bytes:{headers:number;aliquots:number};warnings:string[];status:string}
export interface VatSalesRecord {id:string;number:string;responsible:string;createdAt:string;review:string;preview:VatSalesPreview}
const saved=(s:State)=>s.vatSales||[]
const compact=(s:string)=>s.replace(/[-\s]/g,'')
const numeric=(n:number,w:number)=>{if(!Number.isSafeInteger(n)||n<0||String(n).length>w)throw new Error('Importe o número fuera del ancho del diseño de ventas.');return String(n).padStart(w,'0')}
const text=(v:string,label:string,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
export function salesCandidates(s:State,period:string){purchaseMonth(period);return s.documents.filter(d=>d.side==='cliente'&&['factura','credito','debito'].includes(d.kind)&&d.date.slice(0,7)===period).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))}
export const previousVatSales=(s:State,period:string,environment:FiscalEnvironment)=>saved(s).filter(r=>r.preview.input.period===period&&r.preview.input.environment===environment).at(-1)
function salesDocument(d:Document):SalesDocument{return structuredClone({id:d.id,number:d.number,kind:d.kind,letter:d.letter,date:d.date,branchId:d.branchId,partyId:d.partyId,sourceId:d.sourceId,lines:d.lines,net:d.net,vat:d.vat,perceptions:d.perceptions,total:d.total})}
function saleRow(d:Document,authorization:SalesAuthorization,environment:FiscalEnvironment,issuer:string):VatSalesRow{
 const a=authorization,r=a.request,c=a.record,f=r.detail
 if(a.documentId!==d.id||r.documentId!==d.id||a.unchanged!==true||c.environment!==environment)throw new Error(`${d.number}: la fuente fiscal no coincide con el comprobante y ambiente revisados.`)
 if(c.state!=='aprobado')throw new Error(`${d.number}: falta un resultado fiscal aprobado en ${environment}.`)
 const model=fiscalPrintModel({...r,environment:r.environment??environment},c)
 const expected=({'factura-A':1,'debito-A':2,'credito-A':3,'factura-B':6,'debito-B':7,'credito-B':8} as Record<string,number>)[d.kind+'-'+d.letter]
 if(!expected||r.type!==expected||r.issuer!==issuer||r.snapshot.issuer.iva!=='Responsable Inscripto')throw new Error(`${d.number}: esta salida requiere ventas ordinarias A/B de responsable inscripto del mismo CUIT; revisá clases y regímenes distintos.`)
 if(r.point>99998)throw new Error(`${d.number}: el punto de venta requiere revisión para este diseño ordinario.`)
 if(f.CbteFch!==d.date.replaceAll('-','')||f.ImpTotal!==d.total||f.ImpIVA!==d.vat||f.ImpTrib!==d.perceptions||f.ImpNeto+f.ImpOpEx+f.ImpTotConc!==d.net||JSON.stringify(r.snapshot.lines)!==JSON.stringify(d.lines))throw new Error(`${d.number}: los importes o líneas cambiaron frente a la autorización original.`)
 if(r.tributes.some(t=>t.Id!==2)||r.snapshot.nationalIndirect?.amount)throw new Error(`${d.number}: hay tributos o impuestos nacionales contenidos que requieren clasificar campos antes de exportar.`)
 const grouped=new Map<number,{Id:number;BaseImp:number;Importe:number}>(),codes:Record<string,number>={'0':3,'10.5':4,'21':5,'27':6,'5':8,'2.5':9}
 for(const l of model.lines)if(!['Exento','No gravado'].includes(l.tax)){const Id=codes[l.tax],item=grouped.get(Id)||{Id,BaseImp:0,Importe:0};item.BaseImp+=l.net;item.Importe+=l.vat;grouped.set(Id,item)}
 const order=(a:{Id:number},b:{Id:number})=>a.Id-b.Id
 if(JSON.stringify([...grouped.values()].sort(order))!==JSON.stringify([...r.iva].sort(order)))throw new Error(`${d.number}: las alícuotas autorizadas no corresponden al detalle conservado.`)
 let operation:VatSalesRow['operation']='0',aliquots=r.iva.map(i=>({net:i.BaseImp,code:i.Id,vat:i.Importe}))
 if(aliquots.some(i=>i.code===3))throw new Error(`${d.number}: revisá el tratamiento de tasa cero; no se presume una operación exenta o no gravada.`)
 if(!aliquots.length){if(f.ImpOpEx&&f.ImpTotConc)throw new Error(`${d.number}: revisá el código de operación para conceptos exclusivamente exentos y no gravados combinados.`);operation=f.ImpOpEx?'E':'N';aliquots=[{net:0,code:0,vat:0}]}
 const name=text(r.snapshot.receiver.name,'Denominación del comprador',300)
 if(Array.from(name).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)>=127&&c.charCodeAt(0)<160))throw new Error(`${d.number}: la denominación debe ocupar una sola línea sin controles.`)
 const fileName=name.normalize('NFC').slice(0,30);vatAnsi(fileName)
 const identity=numeric(r.type,3)+numeric(r.point,5)+numeric(c.number,20)
 const header=f.CbteFch+identity+numeric(c.number,20)+'80'+f.DocNro.padStart(20,'0')+fileName.padEnd(30,' ')+numeric(f.ImpTotal,15)+numeric(f.ImpTotConc,15)+numeric(0,15)+numeric(f.ImpOpEx,15)+numeric(0,15)+numeric(f.ImpTrib,15)+numeric(0,15)+numeric(0,15)+'PES'+'0001000000'+numeric(aliquots.length,1)+operation+numeric(0,15)+'00000000'
 const details=aliquots.map(i=>identity+numeric(i.net,15)+numeric(i.code,4)+numeric(i.vat,15))
 if(header.length!==266||details.some(l=>l.length!==62))throw new Error('El archivo no coincide con el diseño de ventas 266/62.')
 return {document:salesDocument(d),authorization:structuredClone(a),original:`${model.title} ${r.letter} ${model.number}`,name,fileName,operation,net:f.ImpNeto,exempt:f.ImpOpEx,untaxed:f.ImpTotConc,vat:f.ImpIVA,perceptions:f.ImpTrib,total:f.ImpTotal,header,details}
}
export function previewVatSales(s:State,input:VatSalesInput,authorizations:SalesAuthorization[],frozenCompany?:Sources['company']):VatSalesPreview{
 purchaseMonth(input.period)
 if(!['homologacion','produccion'].includes(input.environment)||input.scopeConfirmed!==true)throw new Error('Confirmá mes completo, todas las sucursales y ambiente de las ventas para revisar.')
 const previous=previousVatSales(s,input.period,input.environment)
 if(input.previousId!==(previous?.id||''))throw new Error('Cambió la preparación anterior de ventas. Actualizá la revisión.')
 const reference=text(input.reference,'Referencia de ventas',200),reason=text(input.reason,'Fundamento de ventas',2000)
 if(saved(s).some(r=>r.preview.input.reference.toLocaleLowerCase()===reference.toLocaleLowerCase()))throw new Error('La referencia de ventas ya fue utilizada.')
 const company=structuredClone(frozenCompany||{name:s.settings.name,cuit:compact(s.settings.cuit),iva:s.settings.iva});text(company.name,'Empresa',300)
 if(!validCuit(company.cuit)||company.iva!=='Responsable Inscripto')throw new Error('La preparación de IVA ventas requiere una empresa responsable inscripta.')
 const candidates=salesCandidates(s,input.period),included=candidates.filter(d=>d.letter!=='X'),excluded=candidates.filter(d=>d.letter==='X').map(d=>({id:d.id,number:d.number,date:d.date,total:d.total}))
 if(!included.length)throw new Error('No hay ventas ordinarias para preparar. Esto no declara SIN MOVIMIENTO ante ARCA.')
 if(!Array.isArray(authorizations)||new Set(authorizations.map(a=>a.documentId)).size!==authorizations.length||authorizations.some(a=>!included.some(d=>d.id===a.documentId)))throw new Error('Las fuentes fiscales de ventas no corresponden al mes completo.')
 const rows=included.map(d=>{const a=authorizations.find(a=>a.documentId===d.id);if(!a)throw new Error(`${d.number}: falta una autorización conservada en ${input.environment}; no se exporta su referencia interna.`);return saleRow(d,a,input.environment,company.cuit)})
 if(new Set(rows.map(r=>r.original)).size!==rows.length)throw new Error('Hay numeraciones fiscales repetidas en las ventas del mes.')
 const simulation=input.environment==='homologacion'||rows.some(r=>r.authorization.record.simulated===true)
 const totals={total:0,net:0,exempt:0,untaxed:0,vat:0,perceptions:0}
 for(const row of rows)for(const key of Object.keys(totals) as (keyof typeof totals)[])totals[key]+=(row.document.kind==='credito'?-1:1)*row[key]
 if(!Object.values(totals).every(Number.isSafeInteger))throw new Error('Los totales de ventas exceden la precisión segura.')
 const bytes={headers:rows.length*268,aliquots:rows.reduce((n,r)=>n+r.details.length*64,0)};if(Math.max(bytes.headers,bytes.aliquots)>10_000_000)throw new Error('Uno de los TXT de ventas supera 10 MB.')
 return {input:{period:input.period,environment:input.environment,previousId:input.previousId,reference,reason,scopeConfirmed:true},source:{company,documentPrefixIds:s.documents.map(d=>d.id),authorizations:structuredClone(authorizations)},rows,excluded,simulation,totals,bytes,status:simulation?'ENSAYO · no presentar ante ARCA':'Preparación de ventas · sin presentación ARCA',warnings:[...(simulation?['Contiene homologación o autorizaciones simuladas: los archivos son sólo de ensayo y no se deben presentar.']:[]),'Ventas ordinarias A/B en PES con CUIT, de todas las sucursales por mes de emisión. Revisá otras operaciones y ajustes fuera de este alcance.','Se utilizan la numeración fiscal, receptor y valores de la solicitud aprobada; no se sustituyen por referencias internas ni datos actuales del cliente.','Las notas de crédito tienen importes positivos en los archivos y restan en los totales. No se agrupan ventas diarias.','No sube archivos, no concilia precargas ni confirma la declaración jurada; evitá duplicar comprobantes ya registrados en el portal.']}
}
export const vatSalesReview=(p:VatSalesPreview)=>JSON.stringify(p)
export function preserveVatSales(s:State,input:VatSalesInput,authorizations:SalesAuthorization[],actor:Session){
 if(!canAccess(actor,vatSalesPath))throw new Error('Tu perfil no permite conservar preparaciones de IVA ventas.')
 const preview=previewVatSales(s,input,authorizations);if(input.review!==vatSalesReview(preview))throw new Error('La revisión de ventas cambió. Preparala nuevamente.')
 const r:VatSalesRecord={id:uid(),number:`INT-IVT-${String(saved(s).length+1).padStart(8,'0')}`,responsible:actor.name,createdAt:new Date().toISOString(),review:vatSalesReview(preview),preview:structuredClone(preview)};(s.vatSales??=[]).push(r);return r
}
export function validateVatSales(s:State){
 if(s.vatSales!==undefined&&!Array.isArray(s.vatSales))throw new Error('Las preparaciones de IVA ventas deben ser una lista.')
 const ids=new Set<string>();for(const [i,r]of saved(s).entries()){
  if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||r.number!==`INT-IVT-${String(i+1).padStart(8,'0')}`||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||!r.preview)throw new Error('Constancia de IVA ventas inválida.');ids.add(r.id)
  const source=r.preview.source;if(!source||!Array.isArray(source.documentPrefixIds)||JSON.stringify(s.documents.slice(0,source.documentPrefixIds.length).map(d=>d.id))!==JSON.stringify(source.documentPrefixIds))throw new Error('No se conserva la secuencia de fuentes de IVA ventas.')
  const expected=previewVatSales({...s,documents:s.documents.slice(0,source.documentPrefixIds.length),vatSales:saved(s).slice(0,i)},r.preview.input,source.authorizations,source.company)
  if(r.review!==vatSalesReview(expected)||r.review!==vatSalesReview(r.preview))throw new Error('Cambió una fuente o un archivo conservado de IVA ventas.')
 }
}
export function vatSalesOutdated(s:State,r:VatSalesRecord){try{const all=salesCandidates(s,r.preview.input.period);return JSON.stringify(all.filter(d=>d.letter!=='X').map(salesDocument))!==JSON.stringify(r.preview.rows.map(r=>r.document))||JSON.stringify(all.filter(d=>d.letter==='X').map(d=>({id:d.id,number:d.number,date:d.date,total:d.total})))!==JSON.stringify(r.preview.excluded)}catch{return true}}
export function vatSalesFiles(r:VatSalesRecord){const p=r.preview;if(r.review!==vatSalesReview(p)||!p.rows.length)throw new Error('La revisión conservada de ventas no coincide.');const rebuilt=previewVatSales({settings:p.source.company,documents:p.rows.map(r=>({...r.document,side:'cliente'})),vatSales:[]} as unknown as State,{...p.input,previousId:''},p.source.authorizations,p.source.company);if(JSON.stringify(rebuilt.rows)!==JSON.stringify(p.rows)||rebuilt.simulation!==p.simulation)throw new Error('El contenido de los archivos no coincide con las fuentes de ventas.');const prefix=p.simulation?'ENSAYO_NO_PRESENTAR_':'';return [{name:`${prefix}LIBRO_IVA_DIGITAL_VENTAS_CBTE_${p.input.period.replace('-','')}.txt`,bytes:vatAnsi(p.rows.map(r=>r.header).join('\r\n')+'\r\n')},{name:`${prefix}LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS_${p.input.period.replace('-','')}.txt`,bytes:vatAnsi(p.rows.flatMap(r=>r.details).map(l=>l+'\r\n').join(''))}]}
