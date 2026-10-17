import type {State,Document,Session} from './types'
import {assertDate,validCuit} from './engine'
import {uid} from './constants'
import {canAccess} from './permissions'
import {withinExerciseHistory} from './exercise-calendar'

export type SupplierDocumentKind='factura'|'credito'|'debito'
export interface SupplierOriginalInput {documentId:string;documentKind:SupplierDocumentKind;date:string;previousId:string;issuerCuit:string;receiverCuit:string;point:number;number:number;authorization:'Sin consignar'|'CAE'|'CAEA'|'CAI';code:string;expires:string;reference:string;reason:string;review?:string}
export interface SupplierOriginalPreview {input:Omit<SupplierOriginalInput,'review'>;type:number;key:string;source:Pick<Document,'id'|'number'|'date'|'kind'|'letter'|'partyId'|'branchId'|'sourceId'|'net'|'vat'|'perceptions'|'total'>;status:'Datos declarados · sin constatación ARCA'}
export interface SupplierOriginal {id:string;number:string;sequence:number;responsible:string;createdAt:string;review:string;preview:SupplierOriginalPreview}
const records=(s:State)=>s.supplierOriginals||[]
export function supplierOriginal(s:State,documentId:string){return records(s).filter(r=>r.preview.source.id===documentId).at(-1)}
export function supplierOriginalType(d:Pick<Document,'kind'|'letter'>){const base={A:0,B:5,C:10}[d.letter as 'A'|'B'|'C'],offset={factura:1,debito:2,credito:3}[d.kind as SupplierDocumentKind];if(base===undefined||!offset)throw new Error('Se identifican facturas y notas ordinarias A, B o C de proveedores.');return base+offset}
export const supplierOriginalPath=(kind:SupplierDocumentKind)=>kind==='factura'?'/proveedores/compras':'/proveedores/notas'
export const supplierOriginalLabel=(r:SupplierOriginal)=>`${String(r.preview.type).padStart(3,'0')} · ${String(r.preview.input.point).padStart(5,'0')}-${String(r.preview.input.number).padStart(8,'0')}`
const text=(v:string,label:string,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
const iso=(d:string)=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(`${d}T12:00:00Z`).toISOString().slice(0,10)===d
const cuit=(s:string)=>typeof s==='string'?s.replace(/[-\s]/g,''):''
export function previewSupplierOriginal(s:State,input:SupplierOriginalInput,historical=false):SupplierOriginalPreview{
 const d=s.documents.find(d=>d.id===input.documentId&&d.side==='proveedor')
 if(!d||d.kind!==input.documentKind)throw new Error('Seleccioná el comprobante de proveedor y su tipo correcto.')
 const type=supplierOriginalType(d),previous=supplierOriginal(s,d.id)
 if(input.previousId!==(previous?.id||''))throw new Error('La identificación anterior cambió. Actualizá la revisión.')
 if(historical){if(!iso(input.date)||!withinExerciseHistory(s,input.date))throw new Error('La fecha de identificación está fuera de los ejercicios conservados.')}else assertDate(s,input.date)
 if(input.date<d.date||previous&&input.date<previous.preview.input.date)throw new Error('La identificación no puede preceder al comprobante ni a sus correcciones conservadas.')
 const issuerCuit=cuit(input.issuerCuit),receiverCuit=cuit(input.receiverCuit)
 if(!validCuit(issuerCuit)||!validCuit(receiverCuit))throw new Error('Indicá CUIT válidos del proveedor emisor y de la empresa receptora.')
 if(!historical&&(![cuit(s.parties.find(p=>p.id===d.partyId)?.cuit||''),previous?.preview.input.issuerCuit].includes(issuerCuit)||![cuit(s.settings.cuit),previous?.preview.input.receiverCuit].includes(receiverCuit)))throw new Error('Los CUIT deben coincidir con el proveedor y la empresa configurados o con la identificación anterior conservada. Revisá sus datos registrales.')
 if(!Number.isSafeInteger(input.point)||input.point<1||input.point>99999||!Number.isSafeInteger(input.number)||input.number<1||input.number>99999999)throw new Error('Indicá punto de venta entre 1 y 99999 y número entre 1 y 99999999.')
 if(!['Sin consignar','CAE','CAEA','CAI'].includes(input.authorization)||typeof input.code!=='string'||typeof input.expires!=='string')throw new Error('Elegí el tipo de autorización del comprobante.')
 const code=input.code.trim(),expires=input.expires.trim()
 if(input.authorization==='Sin consignar'&&(code||expires)||input.authorization!=='Sin consignar'&&(!/^\d{14}$/.test(code)||/^0+$/.test(code))||expires&&(!iso(expires)||expires<d.date))throw new Error('Copiá el código de autorización de 14 dígitos y, si se informa, una fecha de vencimiento no anterior a la emisión. Sin consignar no lleva código ni vencimiento.')
 const reference=text(input.reference,'Referencia de identificación',200),reason=text(input.reason,'Fundamento de identificación o corrección',1000)
 if(records(s).some(r=>r.preview.source.id===d.id&&r.preview.input.reference.toLocaleLowerCase()===reference.toLocaleLowerCase()))throw new Error('Esa referencia de identificación ya fue utilizada en el comprobante.')
 const key=JSON.stringify([issuerCuit,type,input.point,input.number]),current=new Map(records(s).map(r=>[r.preview.source.id,r]))
 if([...current.values()].some(r=>r.preview.source.id!==d.id&&r.preview.key===key))throw new Error('Ese comprobante del proveedor ya identifica otro registro interno, incluso en otra sucursal.')
 const clean={documentId:d.id,documentKind:input.documentKind,date:input.date,previousId:input.previousId,issuerCuit,receiverCuit,point:input.point,number:input.number,authorization:input.authorization,code,expires,reference,reason}
 return {input:clean,type,key,source:{id:d.id,number:d.number,date:d.date,kind:d.kind,letter:d.letter,partyId:d.partyId,branchId:d.branchId,sourceId:d.sourceId,net:d.net,vat:d.vat,perceptions:d.perceptions,total:d.total},status:'Datos declarados · sin constatación ARCA'}
}
export const supplierOriginalReview=(p:SupplierOriginalPreview)=>JSON.stringify(p)
export function identifySupplierOriginal(s:State,input:SupplierOriginalInput,actor:Session){
 const p=previewSupplierOriginal(s,input)
 if(!canAccess(actor,supplierOriginalPath(input.documentKind)))throw new Error('Tu perfil no permite identificar ese comprobante de proveedor.')
 if(input.review!==supplierOriginalReview(p))throw new Error('La revisión del original cambió. Preparala nuevamente.')
 const sequence=records(s).length+1,r:SupplierOriginal={id:uid(),number:`INT-CO-${String(sequence).padStart(8,'0')}`,sequence,responsible:actor.name,createdAt:new Date().toISOString(),review:supplierOriginalReview(p),preview:structuredClone(p)}
 ;(s.supplierOriginals??=[]).push(r);return r
}
export function validateSupplierOriginals(s:State){
 if(s.supplierOriginals!==undefined&&!Array.isArray(s.supplierOriginals))throw new Error('Las identificaciones de proveedores deben ser una lista.')
 const view={...s,supplierOriginals:[] as SupplierOriginal[]},ids=new Set<string>()
 for(const [i,r] of records(s).entries()){
  if(!r.id||ids.has(r.id)||r.sequence!==i+1||r.number!==`INT-CO-${String(i+1).padStart(8,'0')}`||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||!r.preview)throw new Error('Constancia de identificación de proveedor inválida.')
  ids.add(r.id);const expected=previewSupplierOriginal(view,r.preview.input,true)
  if(r.review!==supplierOriginalReview(expected)||r.review!==supplierOriginalReview(r.preview))throw new Error('Cambió la identificación, el antecedente o el comprobante original de proveedor.')
  view.supplierOriginals.push(r)
 }
}
