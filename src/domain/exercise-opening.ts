import {applicationAmount} from './account-applications'
import type {State,Session,ExerciseOpeningInput,ExerciseOpening,YearEndClose} from './types'
import type {TrialBalance} from './trial-balance'
import {accountingDate,accountingSum,trialBalance} from './trial-balance'
import {nextInventoryDate} from './inventory-dates'
import {serviceEstimate,serviceAccrualActive} from './service-accruals'
import {uid} from './constants'
import {requireAdmin} from './permissions'

export const exerciseOpeningPath='/contabilidad/apertura-ejercicio'
export interface ExerciseOpeningPreview {
 reexpressionPosting?:{id:string;number:string;reexpressionId:string};
 reference:string;reason:string;exerciseStart:string;exerciseEnd:string;previousStart:string;previousEnd:string;
 yearEndCloseId:string;accountingCloseId:string;closingReview:string;balance:TrialBalance;branches:{id:string;balance:TrialBalance}[];
 pending:{revenues?:{id:string;number:string;branchId:string;net:number;vat:number;amount:number}[];documents:{id:string;number:string;branchId:string;side:string;kind:string;amount:number}[];deliveries:{id:string;number:string;branchId:string;side:string}[];services:{id:string;number:string;branchId:string;amount:number}[]};
 inventoryBatchId:string;treasury:{id:string;branchId:string;amount:number}[];warnings:{id:string;message:string;reference:string}[];
}
function financial(b:TrialBalance){return {...b,rows:b.rows.filter(r=>r.opening||r.debit||r.credit||r.closing).map(({name,code,...r})=>{void name;void code;return r})}}
export function exerciseOpeningReview(p:ExerciseOpeningPreview){return JSON.stringify({...p,balance:financial(p.balance),branches:p.branches.map(b=>({id:b.id,balance:financial(b.balance)}))})}
function text(s:string,name:string,max:number){if(typeof s!=='string'||!s.trim()||s.trim().length>max)throw new Error(`${name}: completá hasta ${max} caracteres.`);return s.trim()}
function preview(state:State,input:ExerciseOpeningInput,close:YearEndClose):ExerciseOpeningPreview {
 const exerciseStart=nextInventoryDate(accountingDate(close.exerciseEnd)),exerciseEnd=accountingDate(input.exerciseEnd)
 if(exerciseEnd<exerciseStart)throw new Error('El nuevo ejercicio debe terminar en una fecha igual o posterior a su inicio.')
 const period=state.accountingCloses?.find(c=>c.id===close.accountingCloseId)
 if(!period||period.date!==close.exerciseEnd||period.preview.resultsClose?.id!==close.id)throw new Error('La apertura requiere el cierre de resultados y su bloqueo contable asociado.')
 const previousStart=close.exerciseStart,previousEnd=close.exerciseEnd,reference=text(input.reference,'Referencia de apertura',200),reason=text(input.reason,'Fundamento de apertura',1000)
 // Retained journals provide opening balances. Adding another opening journal would duplicate assets and debts.
 const view={...state,entries:state.entries.filter(e=>e.date<exerciseStart),settings:{...state.settings,exerciseStart,exerciseEnd}},balance=trialBalance(view,exerciseStart,exerciseStart)
 if(balance.rows.some(r=>(r.group==='Ingresos'||r.group==='Gastos')&&r.opening))throw new Error('Las cuentas de resultados deben estar canceladas antes de abrir el siguiente ejercicio.')
 const previous=trialBalance({...state,settings:{...state.settings,exerciseStart:previousStart,exerciseEnd:previousEnd}},previousStart,previousEnd)
 if(balance.rows.some(r=>r.opening!==previous.rows.find(p=>p.accountId===r.accountId)?.closing))throw new Error('La apertura no coincide con los saldos finales del ejercicio anterior.')
 const branches=state.masters.branches.filter(b=>view.entries.some(e=>e.branchId===b.id)).map(b=>({id:b.id,balance:trialBalance(view,exerciseStart,exerciseStart,b.id)})),docs=period.preview.sources.documents
 const documents=docs.filter(d=>['factura','debito','saldo','credito','cobro','pago'].includes(d.kind)).map(d=>{
  const applied=docs.reduce((n,x)=>accountingSum(n,x.allocations.filter(a=>a.documentId===d.id).reduce((a,l)=>accountingSum(a,l.amount),0)),0)
  const base=['credito','cobro','pago'].includes(d.kind)?-d.total:d.total,applications={accountApplications:period.preview.sources.applications||[]}
  const amount=base<0?accountingSum(base,accountingSum(d.allocations.reduce((n,a)=>accountingSum(n,a.amount),0),applicationAmount(applications,d.id,'credit',previousEnd))):accountingSum(base,-accountingSum(applied,applicationAmount(applications,d.id,'target',previousEnd)))
  return {id:d.id,number:d.number,branchId:d.branchId,side:d.side,kind:d.kind,amount}
 }).filter(d=>d.amount!==0)
 const deliveries=docs.filter(d=>d.kind==='remito'&&!docs.some(i=>i.kind==='factura'&&i.sourceId===d.id)).map(d=>({id:d.id,number:d.number,branchId:d.branchId,side:d.side})),services=(state.serviceAccruals||[]).filter(a=>a.date<=previousEnd&&serviceAccrualActive(state,a.id,previousEnd)&&!state.serviceSettlements?.some(s=>s.accrualId===a.id&&s.date<=previousEnd)).map(a=>({id:a.id,number:a.number,branchId:a.preview.source.branchId,amount:serviceEstimate(state,a,previousEnd).total}))
 const revenueRecords=(state.revenueAccruals||[]).filter(a=>a.date<=previousEnd),revenues=revenueRecords.filter(a=>!state.revenueSettlements?.some(s=>s.accrualId===a.id&&s.date<=previousEnd)).map(a=>({id:a.id,number:a.number,branchId:a.preview.source.branchId,net:a.preview.net,vat:a.preview.vat,amount:a.preview.total}))
 const treasury=new Map<string,{id:string;branchId:string;amount:number}>()
 for(const m of period.preview.sources.treasury){const r=treasury.get(m.treasuryId)||{id:m.treasuryId,branchId:m.branchId,amount:0};r.amount=accountingSum(r.amount,m.amount);treasury.set(r.id,r)}
 const adjusted=close.preview.reexpressionPosting
 return {reference,reason,exerciseStart,exerciseEnd,previousStart,previousEnd,...(adjusted?{reexpressionPosting:{id:adjusted.id,number:adjusted.number,reexpressionId:adjusted.reexpressionId}}:{}),yearEndCloseId:close.id,accountingCloseId:period.id,closingReview:period.review!,balance,branches,pending:{documents,deliveries,services,...(revenueRecords.length?{revenues}:{})},inventoryBatchId:period.preview.inventoryBatchId,treasury:[...treasury.values()],warnings:[{id:'nominal-opening',message:adjusted?`Los saldos incorporan el ajuste anual contabilizado ${adjusted.number}. Conservá su moneda de origen y usá Continuidad con el antecedente INT-MC; no reexpreses otra vez los mismos importes. Revisá las demás mediciones y la emisión profesional.`:'Los saldos conservan los importes nominales registrados. Revisá los ajustes normativos y la moneda de presentación antes de emitir estados contables.',reference:close.number},{id:'operational-history',message:'Comprobantes, existencias, tesorería, cheques, tarjetas y producción continúan con su historial y numeración. Revisá los pendientes en cada módulo.',reference:period.number}]}
}
export function previewExerciseOpening(state:State,input:ExerciseOpeningInput){
 const close=state.yearEndCloses?.find(c=>c.exerciseStart===state.settings.exerciseStart&&c.exerciseEnd===state.settings.exerciseEnd)
 if(!close||state.settings.closedUntil!==close.exerciseEnd||state.settings.accountingCloseId!==close.accountingCloseId)throw new Error('Cerrá primero las cuentas de resultados del ejercicio y su período completo.')
 if(state.exerciseOpenings?.some(o=>o.yearEndCloseId===close.id))throw new Error('El siguiente ejercicio ya fue abierto desde este cierre.')
 return preview(state,input,close)
}
function acknowledgments(input:ExerciseOpeningInput,p:ExerciseOpeningPreview){if(!Array.isArray(input.acknowledged)||new Set(input.acknowledged).size!==input.acknowledged.length||input.acknowledged.length!==p.warnings.length||p.warnings.some(w=>!input.acknowledged.includes(w.id)))throw new Error('Revisá y reconocé todas las observaciones antes de abrir el ejercicio.');return [...input.acknowledged].sort()}
export function openExercise(state:State,input:ExerciseOpeningInput,actor:Session):ExerciseOpening {
 requireAdmin(actor.role);const p=previewExerciseOpening(state,input),acknowledged=acknowledgments(input,p)
 if(input.review!==exerciseOpeningReview(p))throw new Error('La revisión de apertura cambió. Preparala nuevamente.')
 if(state.exerciseOpenings?.some(o=>o.reference===p.reference))throw new Error('La referencia de apertura ya se utilizó.')
 const record:ExerciseOpening={...input,reference:p.reference,reason:p.reason,acknowledged,id:uid(),number:`INT-AE-${String((state.exerciseOpenings?.length||0)+1).padStart(8,'0')}`,exerciseStart:p.exerciseStart,previousStart:p.previousStart,previousEnd:p.previousEnd,yearEndCloseId:p.yearEndCloseId,accountingCloseId:p.accountingCloseId,responsible:actor.name,createdAt:new Date().toISOString(),preview:structuredClone(p)}
 state.exerciseOpenings=[...(state.exerciseOpenings||[]),record]
 state.settings={...state.settings,exerciseStart:p.exerciseStart,exerciseEnd:p.exerciseEnd,exerciseHistory:[...(state.settings.exerciseHistory||[]),{start:p.previousStart,end:p.previousEnd}]}
 return record
}
export function validateExerciseCalendar(state:State){
 const records=state.exerciseOpenings||[],history=state.settings.exerciseHistory||[]
 if(!Array.isArray(records)||state.exerciseOpenings===null||!Array.isArray(history)||state.settings.exerciseHistory===null)throw new Error('Los ejercicios y sus aperturas deben ser listas.')
 accountingDate(state.settings.exerciseStart);accountingDate(state.settings.exerciseEnd)
 if(state.settings.exerciseEnd<state.settings.exerciseStart)throw new Error('El ejercicio configurado tiene un rango inválido.')
 if(JSON.stringify(history)!==JSON.stringify(records.map(o=>({start:o.previousStart,end:o.previousEnd}))))throw new Error('El historial de ejercicios no coincide con las aperturas conservadas.')
 const ids=new Set<string>(),references=new Set<string>(),closures=new Set<string>()
 for(const [i,o] of records.entries()){
  if(!o.id||ids.has(o.id)||references.has(o.reference)||closures.has(o.yearEndCloseId)||o.number!==`INT-AE-${String(i+1).padStart(8,'0')}`||!o.responsible||typeof o.createdAt!=='string'||Number.isNaN(Date.parse(o.createdAt))||!o.preview)throw new Error('Constancia de apertura de ejercicio inválida.')
  ids.add(o.id);references.add(o.reference);closures.add(o.yearEndCloseId)
  for(const d of [o.previousStart,o.previousEnd,o.exerciseStart,o.exerciseEnd])accountingDate(d)
  const close=state.yearEndCloses?.find(c=>c.id===o.yearEndCloseId)
  if(!close||close.exerciseStart!==o.previousStart||close.exerciseEnd!==o.previousEnd||close.accountingCloseId!==o.accountingCloseId||o.previousStart>o.previousEnd||o.exerciseStart!==nextInventoryDate(o.previousEnd)||o.exerciseEnd<o.exerciseStart||i&&(records[i-1].exerciseStart!==o.previousStart||records[i-1].exerciseEnd!==o.previousEnd))throw new Error('La secuencia de apertura y cierre de ejercicios no se conserva.')
 }
 const last=records.at(-1)
 if(last&&(last.exerciseStart!==state.settings.exerciseStart||last.exerciseEnd!==state.settings.exerciseEnd))throw new Error('El ejercicio activo no coincide con la última apertura.')
 if(state.settings.closedUntil){accountingDate(state.settings.closedUntil);if(state.settings.closedUntil>state.settings.exerciseEnd||state.settings.closedUntil<state.settings.exerciseStart&&state.settings.closedUntil!==last?.previousEnd)throw new Error('El bloqueo contable no corresponde al ejercicio ni a su cierre anterior.')}
}
export function validateExerciseOpenings(state:State){
 validateExerciseCalendar(state)
 for(const o of state.exerciseOpenings||[]){const close=state.yearEndCloses!.find(c=>c.id===o.yearEndCloseId)!,p=preview(state,o,close);acknowledgments(o,p);if(exerciseOpeningReview(p)!==o.review||exerciseOpeningReview(o.preview)!==o.review)throw new Error('Cambió la revisión, el saldo inicial o los pendientes conservados de una apertura.')}
}
