import {globalPurchaseMode,calculatePurchaseProration} from './vat-proration'
import type {PurchaseProrationInput,PurchaseProration} from './vat-proration'
import {exerciseRanges} from './exercise-calendar'
import type {Document,Session,State} from './types'
import {lineTotals,validCuit} from './engine'
import {supplierOriginal,supplierOriginalLabel} from './supplier-originals'
import {canAccess} from './permissions'
import {uid} from './constants'

export const vatPurchasesPath='/finanzas/impuestos'
export const purchaseCreditModes=['Sin prorrateo','Asignación directa','Prorrateo global','Asignación directa y global'] as const
export type PurchaseCreditMode=typeof purchaseCreditModes[number]
export interface VatPurchasesInput {period:string;previousId:string;reference:string;reason:string;mode:PurchaseCreditMode;credits:{documentId:string;amount:number}[];scopeConfirmed:boolean;proration?:PurchaseProrationInput;review?:string}
type PurchaseSource=Pick<Document,'id'|'number'|'kind'|'letter'|'date'|'branchId'|'partyId'|'lines'|'net'|'vat'|'perceptions'|'total'>
interface Sources {exercise?:{start:string;end:string};company:{name:string;cuit:string;iva:string};documentPrefixIds:string[];originalPrefixIds:string[];names:{partyId:string;name:string}[]}
export interface VatPurchaseRow {document:PurchaseSource;originalId:string;original:string;type:number;point:number;number:number;issuer:string;receiver:string;name:string;fileName:string;operation:'0'|'E'|'N';net:number;exempt:number;untaxed:number;vat:number;credit:number;perceptions:number;total:number;aliquots:{code:number;net:number;vat:number}[];header:string;details:string[]}
export interface VatPurchasesPreview {proration?:PurchaseProration;input:Omit<VatPurchasesInput,'review'>;source:Sources;rows:VatPurchaseRow[];excluded:{id:string;number:string;date:string;total:number}[];totals:{total:number;vat:number;credit:number;nonComputable:number;perceptions:number};warnings:string[];bytes:{headers:number;aliquots:number};status:'Preparación de compras · sin presentación ARCA'}
export interface VatPurchasesRecord {id:string;number:string;responsible:string;createdAt:string;review:string;preview:VatPurchasesPreview}
const saved=(s:State)=>s.vatPurchases||[]
const compact=(s:string)=>s.replace(/[-\s]/g,'')
const validIso=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s
const text=(v:string,label:string,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
export function purchaseMonth(period:string){if(typeof period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||Number(period.slice(0,4))<1900)throw new Error('Indicá un mes calendario válido para IVA.');return period}
export function purchaseCandidates(s:State,period:string){purchaseMonth(period);return s.documents.filter(d=>d.side==='proveedor'&&['factura','debito','credito'].includes(d.kind)&&d.date.slice(0,7)===period).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))}
export function previousVatPurchases(s:State,period:string){return saved(s).filter(r=>r.preview.input.period===period).at(-1)}
function numeric(n:number,width:number){if(!Number.isSafeInteger(n)||n<0||String(n).length>width)throw new Error('Importe o número fuera del ancho del diseño de IVA.');return String(n).padStart(width,'0')}
// ISO-8859-1 is one of the ANSI encodings accepted by the published specification.
export function vatAnsi(value:string){const bytes=new Uint8Array(value.length);for(let i=0;i<value.length;i++){const code=value.charCodeAt(i);if(code>255||code>=127&&code<160||code<32&&code!==10&&code!==13)throw new Error('La denominación contiene caracteres no representables en ANSI ISO-8859-1. Revisá el nombre del proveedor.');bytes[i]=code}return bytes}
function sourceFor(s:State,period:string,frozen?:Sources):Sources{
 const names=[...new Set(purchaseCandidates(s,period).map(d=>d.partyId))].sort().map(partyId=>({partyId,name:text(frozen?.names.find(n=>n.partyId===partyId)?.name??s.parties.find(p=>p.id===partyId)?.name??'','Denominación del proveedor',300)}))
 const company=frozen?.company||{name:s.settings.name,cuit:compact(s.settings.cuit),iva:s.settings.iva}
 text(company.name,'Denominación de la empresa',300)
 if(!validCuit(company.cuit)||company.iva!=='Responsable Inscripto')throw new Error('La preparación de compras requiere CUIT válido de una empresa responsable inscripta.')
 return structuredClone({company,documentPrefixIds:s.documents.map(d=>d.id),originalPrefixIds:(s.supplierOriginals||[]).map(r=>r.id),names,...(frozen?.exercise?{exercise:frozen.exercise}:{})})
}
function purchaseRow(s:State,d:Document,amount:number,name:string):VatPurchaseRow{
 const original=supplierOriginal(s,d.id);if(!original)throw new Error(`${d.number}: falta identificar el comprobante original del proveedor.`)
 const o=original.preview.input
 if(o.receiverCuit!==compact(s.settings.cuit))throw new Error(`${d.number}: el CUIT receptor del original no coincide con la empresa del período.`)
 if(o.point>99998)throw new Error(`${d.number}: revisá el punto de venta; 99999 no se admite para esta salida ordinaria.`)
 if(Array.from(name).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)>=127&&c.charCodeAt(0)<160))throw new Error(`${d.number}: la denominación del proveedor debe ocupar una sola línea, sin caracteres de control.`)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||Number.isNaN(Date.parse(d.date))||new Date(d.date+'T12:00:00Z').toISOString().slice(0,10)!==d.date)throw new Error(`${d.number}: fecha de emisión inválida.`)
 const fileName=name.normalize('NFC').slice(0,30);vatAnsi(fileName)
 const grouped=new Map<number,{code:number;net:number;vat:number}>(),ids:Record<string,number>={'10.5':4,'21':5,'27':6,'5':8,'2.5':9}
 let net=0,vat=0,exempt=0,untaxed=0
 for(const l of d.lines){const t=lineTotals(l,d.letter);if(![t.net,t.vat,t.total].every(v=>Number.isSafeInteger(v)&&v>=0))throw new Error(`${d.number}: una línea contiene importes inválidos.`);net+=t.net;vat+=t.vat;if(l.tax==='Exento')exempt+=t.net;else if(l.tax==='No gravado')untaxed+=t.net;else if(d.letter==='A'){if(!Object.hasOwn(ids,l.tax))throw new Error(`${d.number}: la tasa cero requiere revisar su operación fiscal; no se convierte automáticamente en exenta o no gravada.`);const code=ids[l.tax],a=grouped.get(code)||{code,net:0,vat:0};a.net+=t.net;a.vat+=t.vat;grouped.set(code,a)}}
 if(!d.lines.length||net!==d.net||vat!==d.vat||d.total!==d.net+d.vat+d.perceptions||![d.net,d.vat,d.perceptions,d.total,exempt,untaxed].every(v=>Number.isSafeInteger(v)&&v>=0)||d.total===0)throw new Error(`${d.number}: el detalle, IVA y total no concilian con el comprobante.`)
 if(!Number.isSafeInteger(amount)||amount<0||amount>(d.letter==='A'?d.vat:0))throw new Error(`${d.number}: el crédito computable debe estar entre cero y el IVA discriminado; B y C no generan crédito en esta preparación.`)
 let operation:VatPurchaseRow['operation']='0'
 if(d.letter==='A'&&!grouped.size){if(exempt&&untaxed)throw new Error(`${d.number}: la combinación exclusivamente exenta y no gravada requiere revisión manual del código de operación.`);operation=exempt?'E':'N';grouped.set(0,{code:0,net:0,vat:0})}
 const aliquots=d.letter==='A'?[...grouped.values()].sort((a,b)=>a.code-b.code):[],discriminated=d.letter==='A'?d.vat:0
 const identity=numeric(original.preview.type,3)+numeric(o.point,5)+numeric(o.number,20)
 const header=d.date.replaceAll('-','')+identity+'0'.repeat(16)+'80'+o.issuerCuit.padStart(20,'0')+fileName.padEnd(30,' ')+numeric(d.total,15)+numeric(untaxed,15)+numeric(exempt,15)+numeric(0,15)+numeric(0,15)+numeric(d.perceptions,15)+numeric(0,15)+numeric(0,15)+'PES'+'0001000000'+numeric(aliquots.length,1)+operation+numeric(amount,15)+numeric(0,15)+'0'.repeat(11)+' '.repeat(30)+numeric(0,15)
 const details=aliquots.map(a=>identity+'80'+o.issuerCuit.padStart(20,'0')+numeric(a.net,15)+numeric(a.code,4)+numeric(a.vat,15))
 if(header.length!==325||details.some(l=>l.length!==84))throw new Error('El archivo no coincide con el diseño de compras 325/84.')
 return {document:structuredClone({id:d.id,number:d.number,kind:d.kind,letter:d.letter,date:d.date,branchId:d.branchId,partyId:d.partyId,lines:d.lines,net:d.net,vat:d.vat,perceptions:d.perceptions,total:d.total}),originalId:original.id,original:supplierOriginalLabel(original),type:original.preview.type,point:o.point,number:o.number,issuer:o.issuerCuit,receiver:o.receiverCuit,name,fileName,operation,net:d.net-exempt-untaxed,exempt,untaxed,vat:discriminated,credit:amount,perceptions:d.perceptions,total:d.total,aliquots,header,details}
}
export function previewVatPurchases(state:State,input:VatPurchasesInput,frozen?:Sources):VatPurchasesPreview{
 purchaseMonth(input.period)
 if(!purchaseCreditModes.some(m=>m===input.mode)||input.scopeConfirmed!==true)throw new Error('Elegí el cómputo y confirmá el alcance: compras ordinarias en pesos de todas las sucursales, sin presumir una presentación completa.')
 const previous=previousVatPurchases(state,input.period)
 if(input.previousId!==(previous?.id||''))throw new Error('Cambió la preparación anterior del mes. Actualizá la revisión.')
 const reference=text(input.reference,'Referencia de preparación',200),reason=text(input.reason,'Fundamento de preparación',2000)
 if(saved(state).some(r=>r.preview.input.reference.toLocaleLowerCase()===reference.toLocaleLowerCase()))throw new Error('Esa referencia de preparación ya fue utilizada.')
 const source=sourceFor(state,input.period,frozen),working={...state,settings:{...state.settings,...source.company}},candidates=purchaseCandidates(working,input.period),included=candidates.filter(d=>d.letter!=='X'),excluded=candidates.filter(d=>d.letter==='X').map(d=>({id:d.id,number:d.number,date:d.date,total:d.total}))
 if(!included.length)throw new Error('No hay compras ordinarias para preparar. Esto no declara SIN MOVIMIENTO ante ARCA.')
 if(included.some(d=>!['A','B','C'].includes(d.letter)))throw new Error('Hay un tipo de compra que requiere otro diseño de registración.')
 if(!Array.isArray(input.credits)||input.credits.length!==included.length||new Set(input.credits.map(c=>c.documentId)).size!==included.length||input.credits.some(c=>!included.some(d=>d.id===c.documentId)))throw new Error('Revisá el crédito de todas las compras del mes, sin omitir ni repetir comprobantes.')
 const rows=included.map(d=>{const declared=input.credits.find(c=>c.documentId===d.id)!.amount,credit=input.mode==='Prorrateo global'?0:declared;if(input.mode==='Sin prorrateo'&&credit!==(d.letter==='A'?d.vat:0))throw new Error(`${d.number}: sin prorrateo el crédito informado debe coincidir con el IVA discriminado.`);return purchaseRow(working,d,credit,source.names.find(n=>n.partyId===d.partyId)!.name)})
 let proration:PurchaseProration|undefined
 if(globalPurchaseMode(input.mode)){
  if(!input.proration)throw new Error('Completá las bases y las asignaciones del prorrateo global.')
  const to=new Date(Date.UTC(Number(input.period.slice(0,4)),Number(input.period.slice(5,7)),0)).toISOString().slice(0,10),exercise=frozen?.exercise||exerciseRanges(state).find(r=>r.start<=input.period+'-01'&&r.end>=to)
  if(!exercise||!validIso(exercise.start)||!validIso(exercise.end)||exercise.start>input.period+'-01'||exercise.end<to||input.proration.from!==exercise.start||input.proration.to!==to)throw new Error('Las bases deben cubrir desde el inicio del ejercicio hasta el último día del mes de preparación.')
  source.exercise=structuredClone(exercise);proration=calculatePurchaseProration(rows,input.credits,input.proration)
 }else if(input.proration!==undefined)throw new Error('Las bases globales sólo corresponden a un modo de prorrateo global o mixto.')
 if(new Set(rows.map(r=>JSON.stringify([r.issuer,r.type,r.point,r.number]))).size!==rows.length)throw new Error('Hay originales repetidos en la preparación de compras.')
 const warnings=['Preparación de compras ordinarias A/B/C en ARS; no incluye ventas, importaciones, regímenes especiales ni ajustes de la declaración.','Los originales están declarados sin constatación ARCA. Revisá su validez y evitá duplicar comprobantes ya precargados en el portal.','No se envía ni finaliza la registración ni se determina el saldo de la declaración jurada.','El mes se selecciona por fecha de emisión. Revisá por separado compras que deban imputarse a otro período fiscal.']
 if(excluded.length)warnings.push(`${excluded.length} comprobante(s) X interno(s) excluido(s) del archivo; revisá que no oculten originales pendientes.`)
 if(rows.some(r=>r.name.normalize('NFC').length>30))warnings.push('El diseño limita la denominación a 30 caracteres. Se conserva el nombre completo y se muestra el texto exportado para revisión.')
 if(rows.some(r=>r.document.letter==='B'&&r.document.vat))warnings.push('El IVA contenido en compras B permanece en el registro interno, pero no se informa como IVA discriminado ni crédito computable en estos archivos.')
 const totals={total:0,vat:0,credit:0,nonComputable:0,perceptions:0};for(const r of rows){const sign=r.document.kind==='credito'?-1:1;totals.total+=r.total*sign;totals.vat+=r.vat*sign;totals.credit+=r.credit*sign;totals.nonComputable+=(r.vat-r.credit)*sign;totals.perceptions+=r.perceptions*sign}
 if(proration){totals.credit=proration.creditNet;totals.nonComputable=proration.nonComputableNet;warnings.push('El crédito global se informa por separado en el portal. El TXT no lleva el importe prorrateado: en modo global sus créditos son cero; en modo mixto sólo lleva los importes directos o a restituir revisados.','La proporción usa bases fiscales declaradas del ejercicio; no se infiere de las ventas registradas ni sustituye el ajuste anual. Las restituciones conservan el cómputo histórico declarado.')}
 if(!Object.values(totals).every(Number.isSafeInteger))throw new Error('Los totales exceden la precisión segura de importes.')
 const bytes={headers:rows.length*327,aliquots:rows.reduce((n,r)=>n+r.details.length*86,0)};if(Math.max(bytes.headers,bytes.aliquots)>10_000_000)throw new Error('Uno de los TXT supera 10 MB. Revisá la carga por lotes en el portal.')
 return {input:{period:input.period,previousId:input.previousId,reference,reason,mode:input.mode,scopeConfirmed:true,credits:rows.map(r=>({documentId:r.document.id,amount:input.credits.find(c=>c.documentId===r.document.id)!.amount})),...(proration?{proration:proration.input}:{})},source,rows,excluded,totals,warnings,bytes,status:'Preparación de compras · sin presentación ARCA',...(proration?{proration}:{})}
}
export const vatPurchasesReview=(p:VatPurchasesPreview)=>JSON.stringify(p)
export function preserveVatPurchases(s:State,input:VatPurchasesInput,actor:Session){
 if(!canAccess(actor,vatPurchasesPath))throw new Error('Tu perfil no permite conservar preparaciones de IVA compras.')
 const preview=previewVatPurchases(s,input);if(input.review!==vatPurchasesReview(preview))throw new Error('La revisión de compras cambió. Preparala nuevamente.')
 const r:VatPurchasesRecord={id:uid(),number:`INT-IC-${String(saved(s).length+1).padStart(8,'0')}`,responsible:actor.name,createdAt:new Date().toISOString(),review:vatPurchasesReview(preview),preview:structuredClone(preview)}
 ;(s.vatPurchases??=[]).push(r);return r
}
function historicalState(s:State,source:Sources){
 if(!source||!Array.isArray(source.documentPrefixIds)||!Array.isArray(source.originalPrefixIds)||!Array.isArray(source.names)||JSON.stringify(s.documents.slice(0,source.documentPrefixIds.length).map(d=>d.id))!==JSON.stringify(source.documentPrefixIds)||JSON.stringify((s.supplierOriginals||[]).slice(0,source.originalPrefixIds.length).map(r=>r.id))!==JSON.stringify(source.originalPrefixIds))throw new Error('No se conserva la secuencia de fuentes de IVA compras.')
 return {...s,documents:s.documents.slice(0,source.documentPrefixIds.length),supplierOriginals:(s.supplierOriginals||[]).slice(0,source.originalPrefixIds.length)}
}
export function validateVatPurchases(s:State){
 if(s.vatPurchases!==undefined&&!Array.isArray(s.vatPurchases))throw new Error('Las preparaciones de IVA compras deben ser una lista.')
 const ids=new Set<string>();for(const [i,r]of saved(s).entries()){
  if(typeof r.id!=='string'||!r.id||ids.has(r.id)||r.number!==`INT-IC-${String(i+1).padStart(8,'0')}`||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||!r.preview)throw new Error('Constancia de IVA compras inválida.')
  ids.add(r.id);const working={...historicalState(s,r.preview.source),vatPurchases:saved(s).slice(0,i)},expected=previewVatPurchases(working,r.preview.input,r.preview.source)
  if(r.review!==vatPurchasesReview(expected)||r.review!==vatPurchasesReview(r.preview))throw new Error('Cambió el comprobante, original, crédito o archivo conservado de IVA compras.')
 }
}
export function vatPurchasesOutdated(s:State,r:VatPurchasesRecord){try{const current=previewVatPurchases({...s,vatPurchases:saved(s).slice(0,saved(s).findIndex(x=>x.id===r.id))},r.preview.input);return JSON.stringify({source:current.source.company,rows:current.rows,excluded:current.excluded})!==JSON.stringify({source:r.preview.source.company,rows:r.preview.rows,excluded:r.preview.excluded})}catch{return true}}
export function vatPurchaseFiles(r:VatPurchasesRecord){const p=r.preview;if(r.review!==vatPurchasesReview(p)||!p.rows.length||p.rows.some(r=>r.header.length!==325||r.details.some(l=>l.length!==84)))throw new Error('La revisión o el diseño del archivo conservado no coincide.');return [{name:`LIBRO_IVA_DIGITAL_COMPRAS_CBTE_${p.input.period.replace('-','')}.txt`,bytes:vatAnsi(p.rows.map(r=>r.header).join('\r\n')+'\r\n')},{name:`LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS_${p.input.period.replace('-','')}.txt`,bytes:vatAnsi(p.rows.flatMap(r=>r.details).map(l=>l+'\r\n').join(''))},...(p.proration?[{name:`SICA_IVA_COMPRAS_PRORRATEO_${p.input.period.replace('-','')}_${r.number}.json`,bytes:new TextEncoder().encode(JSON.stringify({kind:'Papel de trabajo SICA · no importar como TXT ARCA',record:r.number,period:p.input.period,mode:p.input.mode,company:p.source.company,proration:p.proration,status:p.status},null,2)+'\n')}]:[])]}
