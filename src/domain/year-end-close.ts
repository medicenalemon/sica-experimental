import {assertProductionClosingReady,productionClosingRecords} from './production-closing-model'
import {assertProductionInflationReady} from './production-inflation'
import {inventoryClosingRecords,inventoryClosingResult} from './inventory-closing-model'
import type {State,Session,YearEndCloseInput,YearEndClose,EntryLine} from './types'
import {uid} from './constants'
import {requireAdmin} from './permissions'
import {trialBalance,accountingDate,accountingSum,validJournal} from './trial-balance'
import type {TrialBalance} from './trial-balance'
import {previewAccountingClose,accountingCloseReview,closeAccountingPeriod} from './accounting-close'
import type {AccountingClosePreview} from './accounting-close'

export const yearEndPath='/contabilidad/cierre-resultados'
export interface YearEndClosePreview {reference:string;reason:string;date:string;exerciseStart:string;resultsAccountId:string;result:number;reexpressionPosting?:{id:string;number:string;reexpressionId:string;result:number;baseResult?:number;productionComparisons?:{id:string;number:string;review:string}[];inventoryComparisons?:{id:string;number:string;review:string}[]};annual:TrialBalance;branches:{id:string;result:number;balance:TrialBalance;entry:EntryLine[]}[];before:AccountingClosePreview}
const resultGroup=(group:string)=>group==='Ingresos'||group==='Gastos'
function financial(b:TrialBalance){return {...b,rows:b.rows.filter(r=>r.opening||r.debit||r.credit||r.closing).map(({name,code,...r})=>{void name;void code;return r})}}
export function yearEndReview(p:YearEndClosePreview){return JSON.stringify({...p,annual:financial(p.annual),branches:p.branches.map(b=>({...b,balance:financial(b.balance)})),before:JSON.parse(accountingCloseReview(p.before))})}
export function previewYearEndClose(state:State,input:YearEndCloseInput,previousClosedUntil=state.settings.closedUntil,historical=false):YearEndClosePreview {
 const date=accountingDate(state.settings.exerciseEnd),start=accountingDate(state.settings.exerciseStart)
 if(start>date)throw new Error('El ejercicio contable debe tener un rango válido.')
 if(!historical&&state.yearEndCloses?.some(c=>c.exerciseStart===start&&c.exerciseEnd===date))throw new Error('Este ejercicio ya tiene cierre de resultados.')
 if(typeof input.reference!=='string'||!input.reference.trim()||input.reference.trim().length>200||typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)throw new Error('El cierre necesita referencia de hasta 200 caracteres y fundamento de hasta 1000.')
 const destination=state.masters.accounts.find(a=>a.id===input.resultsAccountId)
 if(!destination||destination.group!=='Patrimonio neto'||!historical&&!destination.postable)throw new Error('Seleccioná una cuenta imputable de Patrimonio neto para el resultado del ejercicio.')
 if(!historical&&destination.id===state.settings.accountMap.equity)throw new Error('Usá una cuenta de resultados separada de capital y saldos iniciales.')
 const posting=state.reexpressionPostings?.find(p=>p.preview.from===start&&p.preview.date===date)
 if(!historical&&!posting&&state.reexpressions?.some(r=>r.preview.statement.from===start&&r.preview.statement.to===date))throw new Error('Hay preparación anual en moneda de cierre: contabilizá su ajuste antes de cerrar resultados.')
 if(posting&&input.resultsAccountId!==posting.components.find(c=>c.componentId==='eq-unassigned')?.accountId)throw new Error('El cierre ajustado debe usar la cuenta revisada de Resultados no asignados.')
 if(posting?.preview.inventoryClosingRequired&&!inventoryClosingRecords(state,posting.id).some(r=>r.scope==='Inventario completo'&&r.date===date&&state.inventoryInflations?.some(ci=>ci.id===r.closing?.inflationId&&ci.postingId===posting.id)))throw new Error('Antes del cierre de resultados, conciliá el inventario con el ajuste anual y conservá su comparación completa con el VNR actual al cierre.')
 if(!historical){assertProductionInflationReady(state,date,true);assertProductionClosingReady(state,date)}
 const before=previewAccountingClose(state,{date,reference:input.reference,reason:input.reason,acknowledged:[]},previousClosedUntil),annual=trialBalance(state,start,date)
 const ids=state.masters.branches.filter(b=>state.entries.some(e=>e.branchId===b.id&&e.date<=date)).map(b=>b.id)
 let result=0
 const branches=ids.map(id=>{
  const balance=trialBalance(state,start,date,id),results=balance.rows.filter(r=>resultGroup(r.group))
  if(results.some(r=>r.opening))throw new Error('Hay saldos iniciales en cuentas de resultados. Revisá su apertura antes de cerrar el ejercicio.')
  if(!historical&&results.some(r=>r.closing&&!state.masters.accounts.find(a=>a.id===r.accountId)?.postable))throw new Error('Las cuentas de resultados con saldo deben admitir imputaciones antes del cierre.')
  const net=results.reduce((n,r)=>accountingSum(n,r.closing),0),profit=-net,entry=results.filter(r=>r.closing).map(r=>({accountId:r.accountId,debit:Math.max(0,-r.closing),credit:Math.max(0,r.closing)}))
  if(net)entry.push({accountId:input.resultsAccountId,debit:Math.max(0,net),credit:Math.max(0,-net)})
  if(entry.length)validJournal(state,{id:'preview-year-end',date,concept:'Cierre de cuentas de resultados',branchId:id,documentId:'',lines:entry})
  result=accountingSum(result,profit)
  return {id,result:profit,balance,entry}
 })
 if(posting&&result!==inventoryClosingResult(state,posting.id))throw new Error('El resultado del cierre no coincide con el ajuste anual contabilizado.')
 return {reference:input.reference.trim(),reason:input.reason.trim(),date,exerciseStart:start,resultsAccountId:input.resultsAccountId,result,...(posting?{reexpressionPosting:{id:posting.id,number:posting.number,reexpressionId:posting.reexpressionId,result:inventoryClosingResult(state,posting.id),...(productionClosingRecords(state,posting.id).length?{productionComparisons:productionClosingRecords(state,posting.id).map(r=>({id:r.id,number:r.number,review:r.review!}))}:{}),...(inventoryClosingRecords(state,posting.id).length?{baseResult:posting.preview.result,inventoryComparisons:inventoryClosingRecords(state,posting.id).map(r=>({id:r.id,number:r.number,review:r.review!}))}:{})}}:{}),annual,branches,before}
}
function acknowledgments(input:YearEndCloseInput,p:YearEndClosePreview){if(!Array.isArray(input.acknowledged)||new Set(input.acknowledged).size!==input.acknowledged.length||input.acknowledged.length!==p.before.warnings.length||p.before.warnings.some(w=>!input.acknowledged.includes(w.id)))throw new Error('Revisá y reconocé todas las observaciones del ejercicio antes de cerrar resultados.');return [...input.acknowledged].sort()}
export function prepareYearEndAccount(state:State,actor:Session){requireAdmin(actor.role);if(!state.masters.accounts.some(a=>a.id==='3.2'))state.masters.accounts.push({id:'3.2',code:'3.2',name:'Resultado del ejercicio sin asignar',group:'Patrimonio neto',postable:true})}
export function closeYearEnd(state:State,input:YearEndCloseInput,actor:Session):YearEndClose {
 requireAdmin(actor.role);const preview=previewYearEndClose(state,input),acknowledged=acknowledgments(input,preview)
 if(input.review!==yearEndReview(preview))throw new Error('La revisión del cierre de resultados cambió. Preparala nuevamente.')
 if(state.yearEndCloses?.some(c=>c.reference===preview.reference))throw new Error('La referencia del cierre de resultados ya se utilizó.')
 const working=structuredClone(state),id=uid(),number=`INT-CR-${String((working.yearEndCloses?.length||0)+1).padStart(8,'0')}`,entryIds:string[]=[]
 for(const b of preview.branches.filter(b=>b.entry.length)){const e={id:uid(),date:preview.date,concept:number,branchId:b.id,documentId:id,yearEndCloseId:id,lines:structuredClone(b.entry)};working.entries.push(e);entryIds.push(e.id)}
 const after=trialBalance(working,preview.exerciseStart,preview.date)
 if(after.rows.some(r=>resultGroup(r.group)&&r.closing))throw new Error('Las cuentas de resultados no quedaron canceladas.')
 const record:YearEndClose={...input,reference:preview.reference,reason:preview.reason,acknowledged,id,number,date:preview.date,exerciseStart:preview.exerciseStart,exerciseEnd:preview.date,previousClosedUntil:state.settings.closedUntil,responsible:actor.name,createdAt:new Date().toISOString(),entryIds,accountingCloseId:'',preview:structuredClone(preview),after:structuredClone(after)}
 working.yearEndCloses=[...(working.yearEndCloses||[]),record]
 const cp={date:preview.date,reference:number,reason:preview.reason,acknowledged},closingPreview=previewAccountingClose(working,cp)
 const closing=closeAccountingPeriod(working,{...cp,review:accountingCloseReview(closingPreview)},actor);record.accountingCloseId=closing.id
 state.entries=working.entries;state.yearEndCloses=working.yearEndCloses;state.accountingCloses=working.accountingCloses;state.settings=working.settings
 return record
}
export function validateYearEndCloses(state:State){
 const records=state.yearEndCloses||[]
 if(!Array.isArray(records)||state.yearEndCloses===null)throw new Error('Los cierres de resultados deben ser una lista.')
 const ids=new Set<string>(),references=new Set<string>(),periods=new Set<string>()
 for(const [index,c] of records.entries()){
  if(!c.id||ids.has(c.id)||c.number!==`INT-CR-${String(index+1).padStart(8,'0')}`||references.has(c.reference)||!c.responsible||typeof c.createdAt!=='string'||Number.isNaN(Date.parse(c.createdAt))||!Array.isArray(c.entryIds)||!c.preview||!c.after)throw new Error('Constancia de cierre de resultados inválida.')
  accountingDate(c.date);accountingDate(c.exerciseStart);accountingDate(c.exerciseEnd)
  const period=`${c.exerciseStart}:${c.exerciseEnd}`
  if(c.date!==c.exerciseEnd||periods.has(period))throw new Error('El ejercicio no admite cierres de resultados duplicados.')
  ids.add(c.id);references.add(c.reference);periods.add(period)
  const view={...state,productionRecoveries:(state.productionRecoveries||[]).filter(r=>c.preview.before.productionRecoveries?.some(p=>p.id===r.id)),productionInflations:(state.productionInflations||[]).filter(r=>c.preview.before.productionInflations?.some(p=>p.id===r.id)),inventoryRecoveries:(state.inventoryRecoveries||[]).filter(r=>c.preview.before.inventoryRecoveries?.some(p=>p.id===r.id)),inventoryInflations:(state.inventoryInflations||[]).filter(r=>c.preview.before.inventoryInflations?.some(p=>p.id===r.id)),assetInflations:(state.assetInflations||[]).filter(r=>c.preview.before.fixedAssets?.inflations?.some(p=>p.id===r.id)),entries:state.entries.filter(e=>e.yearEndCloseId!==c.id),yearEndCloses:records.filter(r=>r.id!==c.id),settings:{...state.settings,exerciseStart:c.exerciseStart,exerciseEnd:c.exerciseEnd,closedUntil:c.previousClosedUntil}}
  const preview=previewYearEndClose(view,c,c.previousClosedUntil,true);acknowledgments(c,preview)
  if(yearEndReview(preview)!==c.review||yearEndReview(c.preview)!==c.review)throw new Error('Cambió la revisión o las fuentes del cierre de resultados.')
  const entries=state.entries.filter(e=>e.yearEndCloseId===c.id),expected=preview.branches.filter(b=>b.entry.length)
  if(entries.length!==expected.length||JSON.stringify(entries.map(e=>e.id))!==JSON.stringify(c.entryIds))throw new Error('No se conservaron los asientos del cierre de resultados.')
  for(const [i,b] of expected.entries()){const e=entries[i];if(e.date!==c.date||e.concept!==c.number||e.branchId!==b.id||e.documentId!==c.id||JSON.stringify(e.lines)!==JSON.stringify(b.entry))throw new Error('El asiento de cierre no coincide con sus saldos revisados.')}
  const after=trialBalance({...state,settings:view.settings},c.exerciseStart,c.date)
  if(JSON.stringify(financial(after))!==JSON.stringify(financial(c.after))||after.rows.some(r=>resultGroup(r.group)&&r.closing))throw new Error('Cambió el balance posterior al cierre de resultados.')
  const closing=state.accountingCloses?.find(p=>p.id===c.accountingCloseId)
  if(!closing||closing.date!==c.date||closing.reference!==c.number||closing.previousClosedUntil!==c.previousClosedUntil||closing.preview.resultsClose?.id!==c.id)throw new Error('Falta el bloqueo de período asociado al cierre de resultados.')
 }
 if(state.entries.some(e=>e.yearEndCloseId&&!ids.has(e.yearEndCloseId))||state.accountingCloses?.some(c=>c.preview.resultsClose&&!ids.has(c.preview.resultsClose.id)))throw new Error('Falta la constancia de cierre de resultados.')
}
