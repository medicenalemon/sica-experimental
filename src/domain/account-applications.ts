import type {State,Document,Session} from './types'
import {assertDate,documentSign} from './engine'
import {uid} from './constants'
import {canAccess} from './permissions'
import {sumMoney} from './treasury-model'
import {withinExerciseHistory} from './exercise-calendar'

export const applicationsPath='/finanzas/cuentas'
export interface ApplicationInput {date:string;reference:string;reason:string;creditId:string;lines:{documentId:string;amount:number}[];review?:string}
export interface ApplicationReversalInput {applicationId:string;date:string;reference:string;reason:string;review?:string}
type Proof=Pick<Document,'id'|'number'|'date'|'side'|'kind'|'partyId'|'branchId'|'total'|'allocations'>
export interface ApplicationPreview {kind:'Aplicación'|'Reversión'|'Liberación original';date:string;reference:string;reason:string;credit:Proof;lines:{document:Proof;amount:number;available:number}[];available:number;total:number;documentPrefixIds:string[];reversedId?:string}
export interface AccountApplication {id:string;number:string;sequence:number;responsible:string;createdAt:string;review:string;preview:ApplicationPreview}
const records=(s:State)=>s.accountApplications||[]
const proof=(d:Document):Proof=>({id:d.id,number:d.number,date:d.date,side:d.side,kind:d.kind,partyId:d.partyId,branchId:d.branchId,total:d.total,allocations:structuredClone(d.allocations)})
const same=(a:Proof,b:Proof)=>a.partyId===b.partyId&&a.side===b.side&&a.branchId===b.branchId
const value=(d:Proof)=>sumMoney([d.total*documentSign(d.kind)])
const family=(s:State,d:Proof)=>s.documents.filter(x=>same(x,d)&&documentSign(x.kind)!==0)
const cleanText=(v:string,label:string,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
export function applicationAmount(s:Pick<State,'accountApplications'>,documentId:string,direction:'credit'|'target',to='9999-12-31'){
 return sumMoney((s.accountApplications||[]).filter(r=>r.preview.date<=to).flatMap(r=>(direction==='credit'&&r.preview.credit.id===documentId?r.preview.lines:direction==='target'?r.preview.lines.filter(l=>l.document.id===documentId):[]).map(l=>l.amount*(r.preview.kind==='Aplicación'?1:-1))))
}
export function originalApplicationAvailable(s:State,d:Document,documentId?:string){return sumMoney([...d.allocations.filter(a=>!documentId||a.documentId===documentId).map(a=>a.amount),...records(s).filter(r=>r.preview.kind==='Liberación original'&&r.preview.credit.id===d.id).flatMap(r=>r.preview.lines.filter(l=>!documentId||l.document.id===documentId).map(l=>-l.amount))])}
export function creditAvailable(s:State,d:Document){return sumMoney([-value(d),-sumMoney(d.allocations.map(a=>a.amount)),-applicationAmount(s,d.id,'credit')])}
export function targetAvailable(s:State,d:Document){return sumMoney([value(d),-sumMoney(s.documents.flatMap(x=>x.allocations.filter(a=>a.documentId===d.id).map(a=>a.amount))),-applicationAmount(s,d.id,'target')])}
export function assertApplicationAllocationDate(s:State,documentId:string,day:string){if(records(s).some(r=>r.preview.date>day&&r.preview.lines.some(l=>l.document.id===documentId)))throw new Error('La aplicación del nuevo comprobante no puede preceder a aplicaciones o reversiones posteriores del destino.')}
function date(s:State,d:string,historical:boolean){if(historical){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(`${d}T12:00:00Z`).toISOString().slice(0,10)!==d||!withinExerciseHistory(s,d))throw new Error('La aplicación está fuera de los ejercicios conservados.')}else assertDate(s,d)}
function chronology(s:State,documents:Proof[],day:string){if(documents.some(d=>d.date>day)||records(s).some(r=>r.preview.date>day&&[r.preview.credit,...r.preview.lines.map(l=>l.document)].some(d=>documents.some(x=>x.id===d.id))))throw new Error('La fecha no puede preceder a los comprobantes ni a aplicaciones posteriores de esas cuentas.')}
function common(s:State,input:{date:string;reference:string;reason:string},credit:Document,historical:boolean){
 date(s,input.date,historical)
 if(!historical&&!s.masters.branches.some(b=>b.id===credit.branchId&&b.active))throw new Error('La sucursal debe estar activa.')
 const reference=cleanText(input.reference,'Referencia',200),reason=cleanText(input.reason,'Motivo',1000)
 if(records(s).some(r=>r.preview.credit.side===credit.side&&r.preview.credit.branchId===credit.branchId&&r.preview.reference.toLocaleLowerCase()===reference.toLocaleLowerCase()))throw new Error('Esa referencia de aplicación ya fue utilizada en el tipo de cuenta y sucursal.')
 return {date:input.date,reference,reason}
}
export function previewAccountApplication(s:State,input:ApplicationInput,historical=false):ApplicationPreview{
 const credit=s.documents.find(d=>d.id===input.creditId)
 if(!credit||value(credit)>=0)throw new Error('Seleccioná un cobro, pago, nota de crédito o saldo inicial negativo conservado.')
 const head=common(s,input,credit,historical),available=creditAvailable(s,credit)
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100||new Set(input.lines.map(l=>l.documentId)).size!==input.lines.length)throw new Error('Indicá entre uno y cien destinos sin repetir comprobantes.')
 const lines=input.lines.map(l=>{
  const document=s.documents.find(d=>d.id===l.documentId)
  if(!document||value(document)<=0||!same(document,credit))throw new Error('Aplicá a cargos de la misma contraparte, tipo y sucursal.')
  if(!Number.isSafeInteger(l.amount)||l.amount<=0)throw new Error('Las aplicaciones requieren centavos positivos seguros.')
  const available=targetAvailable(s,document);if(l.amount>available)throw new Error('La aplicación supera el saldo disponible del comprobante de destino.')
  return {document:proof(document),amount:l.amount,available}
 })
 const total=sumMoney(lines.map(l=>l.amount));if(total>available)throw new Error('La aplicación supera el crédito sin aplicar disponible.')
 chronology(s,[credit,...lines.map(l=>l.document)],head.date)
 return {kind:'Aplicación',...head,credit:proof(credit),lines,available,total,documentPrefixIds:family(s,credit).map(d=>d.id)}
}
export function previewOriginalApplicationRelease(s:State,input:ApplicationInput,historical=false):ApplicationPreview{
 const credit=s.documents.find(d=>d.id===input.creditId)
 if(!credit||value(credit)>=0)throw new Error('Seleccioná un crédito conservado con aplicaciones originales.')
 const head=common(s,input,credit,historical)
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100||new Set(input.lines.map(l=>l.documentId)).size!==input.lines.length)throw new Error('Indicá entre uno y cien destinos originales sin repetir comprobantes.')
 const lines=input.lines.map(l=>{
  const document=s.documents.find(d=>d.id===l.documentId)
  if(!document||value(document)<=0||!same(document,credit)||!credit.allocations.some(a=>a.documentId===l.documentId))throw new Error('El destino debe ser un cargo originalmente aplicado en ese crédito y de la misma cuenta.')
  if(!Number.isSafeInteger(l.amount)||l.amount<=0||l.amount>originalApplicationAvailable(s,credit,l.documentId))throw new Error('La liberación supera la aplicación original todavía conservada, o tiene un importe inválido.')
  return {document:proof(document),amount:l.amount,available:targetAvailable(s,document)}
 })
 chronology(s,[credit,...lines.map(l=>l.document)],head.date)
 return {kind:'Liberación original',...head,credit:proof(credit),lines,available:creditAvailable(s,credit),total:sumMoney(lines.map(l=>l.amount)),documentPrefixIds:family(s,credit).map(d=>d.id)}
}
export function applicationReversed(s:State,id:string){return records(s).some(r=>r.preview.reversedId===id)}
export function previewApplicationReversal(s:State,input:ApplicationReversalInput,historical=false):ApplicationPreview{
 const original=records(s).find(r=>r.id===input.applicationId&&r.preview.kind==='Aplicación')
 if(!original||applicationReversed(s,original.id))throw new Error('Seleccioná una aplicación conservada que aún no fue revertida.')
 const credit=s.documents.find(d=>d.id===original.preview.credit.id);if(!credit)throw new Error('Falta el crédito original.')
 const head=common(s,input,credit,historical);chronology(s,[credit,...original.preview.lines.map(l=>l.document)],head.date)
 if(head.date<original.preview.date)throw new Error('La reversión no puede preceder a la aplicación original.')
 return {kind:'Reversión',...head,credit:proof(credit),lines:original.preview.lines.map(l=>({...l,available:targetAvailable(s,s.documents.find(d=>d.id===l.document.id)!)})),available:creditAvailable(s,credit),total:original.preview.total,documentPrefixIds:family(s,credit).map(d=>d.id),reversedId:original.id}
}
export const applicationReview=(p:ApplicationPreview)=>JSON.stringify(p)
function post(s:State,p:ApplicationPreview,review:string|undefined,actor:Session){
 if(!canAccess(actor,applicationsPath))throw new Error('Tu perfil no permite aplicar créditos.')
 if(review!==applicationReview(p))throw new Error('La revisión de aplicaciones cambió. Preparala nuevamente.')
 const sequence=records(s).length+1,r:AccountApplication={id:uid(),sequence,number:`INT-AC-${String(sequence).padStart(8,'0')}`,responsible:actor.name,createdAt:new Date().toISOString(),review:applicationReview(p),preview:structuredClone(p)}
 ;(s.accountApplications??=[]).push(r);return r
}
export const applyAccountCredit=(s:State,input:ApplicationInput,actor:Session)=>post(s,previewAccountApplication(s,input),input.review,actor)
export const releaseOriginalApplication=(s:State,input:ApplicationInput,actor:Session)=>post(s,previewOriginalApplicationRelease(s,input),input.review,actor)
export const reverseAccountApplication=(s:State,input:ApplicationReversalInput,actor:Session)=>post(s,previewApplicationReversal(s,input),input.review,actor)
export function validateAccountApplications(s:State){
 if(s.accountApplications!==undefined&&!Array.isArray(s.accountApplications))throw new Error('Las aplicaciones deben ser una lista.')
 const view={...s,accountApplications:[] as AccountApplication[]},ids=new Set<string>()
 for(const [index,r] of records(s).entries()){
  if(!r.id||ids.has(r.id)||r.sequence!==index+1||r.number!==`INT-AC-${String(index+1).padStart(8,'0')}`||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||!r.preview)throw new Error('Constancia de aplicación inválida.')
  ids.add(r.id);const p=r.preview,all=family(s,p.credit),prefix=p.documentPrefixIds
  if(!Array.isArray(prefix)||JSON.stringify(prefix)!==JSON.stringify(all.slice(0,prefix.length).map(d=>d.id)))throw new Error('La aplicación perdió sus documentos de origen conservados.')
  const previous={...view,documents:all.slice(0,prefix.length)}
  const input={date:p.date,reference:p.reference,reason:p.reason,creditId:p.credit.id,lines:p.lines.map(l=>({documentId:l.document.id,amount:l.amount}))}
  const expected=p.kind==='Aplicación'?previewAccountApplication(previous,input,true):p.kind==='Liberación original'?previewOriginalApplicationRelease(previous,input,true):p.kind==='Reversión'?previewApplicationReversal(previous,{applicationId:p.reversedId!,date:p.date,reference:p.reference,reason:p.reason},true):null
  if(!expected||applicationReview(expected)!==r.review||applicationReview(p)!==r.review)throw new Error('Cambió la revisión o las fuentes de una aplicación.')
  view.accountApplications.push(r)
 }
 if(records(s).length)for(const d of s.documents){if(value(d)<0&&creditAvailable(s,d)<0||value(d)>0&&targetAvailable(s,d)<0)throw new Error('Las aplicaciones registradas consumen más que el crédito o cargo disponible.')}
 const targets=new Set(records(s).flatMap(r=>r.preview.lines.map(l=>l.document.id)))
 for(const id of targets){
  const d=s.documents.find(d=>d.id===id)!,original=s.documents.filter(x=>x.allocations.some(a=>a.documentId===id)),dates=[...new Set([d.date,...original.map(x=>x.date),...records(s).filter(r=>r.preview.lines.some(l=>l.document.id===id)).map(r=>r.preview.date)])]
  for(const day of dates.filter(day=>day>=d.date)){
   const applied=sumMoney(original.filter(x=>x.date<=day).flatMap(x=>x.allocations.filter(a=>a.documentId===id).map(a=>a.amount)))
   if(sumMoney([value(d),-applied,-applicationAmount(s,id,'target',day)])<0)throw new Error('La secuencia histórica de aplicaciones supera el cargo en una fecha intermedia.')
  }
 }
}
