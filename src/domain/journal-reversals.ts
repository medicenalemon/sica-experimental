import type {State,Session,Entry,JournalReversalInput,JournalReversal} from './types'
import {uid} from './constants'
import {requireAdmin} from './permissions'
import {assertDate} from './engine'
import {accountingDate,accountingSum} from './trial-balance'
import {withinExerciseHistory} from './exercise-calendar'
export interface JournalReversalPreview {date:string;reference:string;reason:string;source:Entry;lines:Entry['lines']}
export const journalReversalReview=(p:JournalReversalPreview)=>JSON.stringify(p)
export function isManualJournal(e:Entry){return e.manual===true&&!e.productionRecoveryId&&!e.productionCorrectionId&&!e.productionCostId&&!e.reexpressionPostingId&&!e.documentId&&!e.fixedAssetRecordId&&!e.inventoryBatchId&&!e.inventoryRecoveryId&&!e.serviceRecordId&&!e.revenueRecordId&&!e.yearEndCloseId&&!e.reversalRecordId}
function text(s:string,label:string,max:number){if(typeof s!=='string'||!s.trim()||s.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return s.trim()}
export function previewJournalReversal(state:State,input:JournalReversalInput,historical=false):JournalReversalPreview {
 accountingDate(input.date);const source=state.entries.find(e=>e.id===input.entryId),reference=text(input.reference,'Referencia de reversión',200),reason=text(input.reason,'Motivo de corrección',1000)
 if(!source||!isManualJournal(source))throw new Error('Seleccioná un asiento identificado como manual. Los registros anteriores sin identificación y los asientos automáticos requieren revisar su origen.')
 accountingDate(source.date)
 if(source.lines.some(l=>!Number.isSafeInteger(l.debit)||!Number.isSafeInteger(l.credit)||l.debit<0||l.credit<0||l.debit&&l.credit)||source.lines.reduce((n,l)=>accountingSum(n,l.debit-l.credit),0))throw new Error('El asiento original contiene importes inválidos o no está balanceado.')
 if(input.date<source.date)throw new Error('La reversión no puede preceder al asiento original.')
 if(!historical&&state.productionCosts?.some(r=>r.pools.some(p=>p.sources.some(s=>s.entryId===source.id))))throw new Error('El asiento ya respalda costos de producción conservados; requiere una corrección vinculada de ese circuito.')
 if(state.journalReversals?.some(r=>r.entryId===source.id))throw new Error('El asiento manual ya fue revertido.')
 if(historical){if(!withinExerciseHistory(state,source.date)||!withinExerciseHistory(state,input.date))throw new Error('La reversión o su origen están fuera de los ejercicios conservados.')}
 else{assertDate(state,source.date);assertDate(state,input.date);if(!state.masters.branches.some(b=>b.id===source.branchId&&b.active))throw new Error('La sucursal del asiento debe estar activa.')}
 if(source.lines.filter(l=>l.debit||l.credit).length<2||source.lines.some(l=>!state.masters.accounts.some(a=>a.id===l.accountId&&(historical||a.postable))))throw new Error('Las cuentas originales deben conservarse y admitir imputaciones.')
 return {date:input.date,reference,reason,source:structuredClone(source),lines:source.lines.map(l=>({accountId:l.accountId,debit:l.credit,credit:l.debit}))}
}
export function reverseJournal(state:State,input:JournalReversalInput,actor:Session):JournalReversal {
 requireAdmin(actor.role);const preview=previewJournalReversal(state,input)
 if(input.review!==journalReversalReview(preview))throw new Error('La revisión de la reversión cambió. Preparala nuevamente.')
 if(state.journalReversals?.some(r=>r.reference===preview.reference))throw new Error('La referencia de reversión ya se utilizó.')
 const id=uid(),number=`INT-RA-${String((state.journalReversals?.length||0)+1).padStart(8,'0')}`,entry:Entry={id:uid(),date:input.date,concept:number,branchId:preview.source.branchId,documentId:id,reversalRecordId:id,lines:structuredClone(preview.lines)}
 const record:JournalReversal={...input,reference:preview.reference,reason:preview.reason,id,number,responsible:actor.name,createdAt:new Date().toISOString(),reversalEntryId:entry.id,preview}
 state.entries.push(entry);state.journalReversals=[...(state.journalReversals||[]),record];return record
}
export function validateJournalReversals(state:State){
 const records=state.journalReversals||[];if(!Array.isArray(records)||state.journalReversals===null)throw new Error('Las reversiones deben ser una lista.')
 if(state.entries.some(e=>e.manual!==undefined&&(e.manual!==true||!isManualJournal(e))))throw new Error('La identificación manual del asiento es incompatible con su origen.')
 const ids=new Set<string>(),references=new Set<string>()
 for(const [index,r] of records.entries()){
  if(!r.id||ids.has(r.id)||references.has(r.reference)||r.number!==`INT-RA-${String(index+1).padStart(8,'0')}`||!r.responsible||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt)))throw new Error('Constancia de reversión inválida.')
  ids.add(r.id);references.add(r.reference)
  const p=previewJournalReversal({...state,journalReversals:records.filter(x=>x.id!==r.id)},r,true),entries=state.entries.filter(e=>e.reversalRecordId===r.id),e=entries[0]
  if(r.review!==journalReversalReview(p)||r.review!==journalReversalReview(r.preview))throw new Error('La revisión o el asiento original de una reversión cambió.')
  if(entries.length!==1||e.id!==r.reversalEntryId||e.date!==r.date||e.concept!==r.number||e.branchId!==p.source.branchId||e.documentId!==r.id||JSON.stringify(e.lines)!==JSON.stringify(p.lines))throw new Error('La contrapartida no coincide con la constancia de reversión.')
 }
 if(state.entries.some(e=>e.reversalRecordId&&!ids.has(e.reversalRecordId)))throw new Error('Falta la constancia de una reversión del diario.')
}
