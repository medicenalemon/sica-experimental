import type {State,Session,Entry,EntryLine,CardSettlement} from './types'
import {uid} from './constants'
import {assertDate,isCardPayment} from './engine'
import {canAccess,requireAdmin} from './permissions'
import {withinExerciseHistory} from './exercise-calendar'
import {sumMoney} from './treasury-model'

export interface CardSource {receiptId:string;paymentIndex:number;entryId:string;accountId:string;amount:number}
export interface CardDisputeInput {receiptId:string;paymentIndex:number;settlementId:string;date:string;reference:string;reason:string;amount:number;claimAccountId:string;lossAccountId:string;recoveryAccountId:string;treatment:'Crédito cierto documentado'|'Reclamo contingente'|'Pérdida definitiva';assetConfirmed:boolean;review?:string}
export interface CardResolutionInput {disputeId:string;date:string;reference:string;reason:string;amount:number;outcome:'Reintegrado'|'Pérdida'|'Recupero posterior';review?:string}
export interface CardPreview {
 kind:'Contracargo'|'Resolución';input:Omit<CardDisputeInput,'review'>|Omit<CardResolutionInput,'review'>;
 receipt:State['documents'][number];source:CardSource;settlement?:CardSettlement;settlementPrefixIds:string[];
 branchId:string;claimAccountId:string;lossAccountId:string;recoveryAccountId:string;sourceAccountId:string;treasuryId:string;available:number;
 lines:EntryLine[];treasuryAmount:number;
}
export interface CardDisputeRecord {id:string;number:string;sequence:number;responsible:string;createdAt:string;review:string;preview:CardPreview;entryId?:string;treasuryMoveId?:string}
const disputeInput=(r:CardDisputeRecord)=>r.preview.input as CardDisputeInput
const resolutionInput=(r:CardDisputeRecord)=>r.preview.input as CardResolutionInput
const disputes=(s:State)=>s.cardDisputes||[]
const coupon=(a:{receiptId:string;paymentIndex:number},b:{receiptId:string;paymentIndex:number})=>a.receiptId===b.receiptId&&a.paymentIndex===b.paymentIndex
const text=(s:string,label:string,max:number)=>{if(typeof s!=='string'||!s.trim()||s.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return s.trim()}
const positive=(n:number)=>{if(!Number.isSafeInteger(n)||n<=0)throw new Error('Indicá un importe positivo en centavos dentro del rango seguro.');return n}
function account(s:State,id:string,group:string,historical:boolean){const a=s.masters.accounts.find(a=>a.id===id&&a.group===group&&(historical||a.postable));if(!a)throw new Error('Seleccioná cuentas imputables de activo para reclamos y origen, y de gastos para pérdidas.');return a}
function date(s:State,value:string,historical:boolean){if(historical){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value||!withinExerciseHistory(s,value))throw new Error('La fecha del contracargo está fuera de los ejercicios conservados.')}else assertDate(s,value)}
export function cardLedgerSources(s:State):CardSource[]{return s.documents.filter(d=>d.side==='cliente'&&d.kind==='cobro').flatMap(d=>d.payments.flatMap((p,paymentIndex)=>{if(!p.cardId||!isCardPayment(p.method))return [];const entries=s.entries.filter(e=>e.documentId===d.id),e=entries[0],line=e?.lines[paymentIndex+1];if(entries.length!==1||!line||line.debit!==p.amount||line.credit!==0||e.branchId!==d.branchId||e.date!==d.date)return [];return [{receiptId:d.id,paymentIndex,entryId:e.id,accountId:line.accountId,amount:p.amount}]}))}
function source(s:State,i:{receiptId:string;paymentIndex:number},projection:boolean){
 const receipt=s.documents.find(d=>d.id===i.receiptId&&d.kind==='cobro'&&d.side==='cliente'),p=receipt?.payments[i.paymentIndex]
 const ledger=(projection&&s.cardSources?s.cardSources:cardLedgerSources(s)).find(r=>coupon(r,i))
 if(!Number.isInteger(i.paymentIndex)||i.paymentIndex<0||!receipt||!p||!isCardPayment(p.method)||!p.cardId||!ledger||ledger.amount!==p.amount)throw new Error('Seleccioná un cupón con tarjeta y asiento original conservados.')
 return {receipt,p,ledger}
}
export function cardClaimRemaining(s:State,id:string){const r=disputes(s).find(r=>r.id===id&&r.preview.kind==='Contracargo');return r&&disputeInput(r).treatment!=='Pérdida definitiva'?sumMoney([disputeInput(r).amount,...disputes(s).filter(x=>x.preview.kind==='Resolución'&&resolutionInput(x).disputeId===id&&resolutionInput(x).outcome!=='Recupero posterior').map(x=>-resolutionInput(x).amount)]):0}
export function cardPendingDisputed(s:State,receiptId:string,paymentIndex:number){
 const records=disputes(s).filter(r=>r.preview.kind==='Contracargo'&&!disputeInput(r).settlementId&&coupon(disputeInput(r),{receiptId,paymentIndex}))
 return sumMoney(records.flatMap(r=>[disputeInput(r).amount,...disputes(s).filter(x=>x.preview.kind==='Resolución'&&resolutionInput(x).disputeId===r.id&&resolutionInput(x).outcome!=='Pérdida').map(x=>-resolutionInput(x).amount)]))
}
export function cardLossRecoverable(s:State,id:string){const r=disputes(s).find(r=>r.id===id&&r.preview.kind==='Contracargo');if(!r)return 0;const rows=disputes(s).filter(x=>x.preview.kind==='Resolución'&&resolutionInput(x).disputeId===id);return sumMoney([disputeInput(r).treatment==='Pérdida definitiva'?disputeInput(r).amount:0,...rows.filter(x=>resolutionInput(x).outcome==='Pérdida').map(x=>resolutionInput(x).amount),...rows.filter(x=>resolutionInput(x).outcome==='Recupero posterior').map(x=>-resolutionInput(x).amount)])}
function lastCouponDate(s:State,i:{receiptId:string;paymentIndex:number}){const records=disputes(s).filter(r=>coupon(r.preview.source,i));return [...(s.cardSettlements||[]).filter(r=>r.items.some(x=>coupon(x,i))).map(r=>r.date),...records.map(r=>r.preview.input.date)].sort().at(-1)||''}
export const cardDisputeReview=(p:CardPreview)=>JSON.stringify(p)
export function previewCardDispute(s:State,input:CardDisputeInput,historical=false,projection=true):CardPreview{
 if(typeof input.settlementId!=='string')throw new Error('Indicá el origen del contracargo: cupón pendiente o liquidación.');const {receipt,p,ledger}=source(s,input,projection);date(s,input.date,historical)
 if(input.date<receipt.date||input.date<lastCouponDate(s,input))throw new Error('Registrá con fecha no anterior al recibo y a las operaciones conservadas de ese cupón.')
 if(!historical&&!s.masters.branches.some(b=>b.id===receipt.branchId&&b.active))throw new Error('La sucursal del cupón debe estar activa.')
 const reference=text(input.reference,'Referencia de procesadora',200),reason=text(input.reason,'Fundamento del reclamo',1000),amount=positive(input.amount)
 if(!['Crédito cierto documentado','Reclamo contingente','Pérdida definitiva'].includes(input.treatment)||typeof input.assetConfirmed!=='boolean'||input.treatment==='Crédito cierto documentado'&&!input.assetConfirmed)throw new Error('Un reclamo como activo requiere confirmar un crédito cierto, exigible y recuperable documentado; en caso definitivo revisá la imputación a pérdida.')
 if(disputes(s).some(r=>r.preview.kind==='Contracargo'&&r.preview.receipt.branchId===receipt.branchId&&r.preview.receipt.payments[r.preview.source.paymentIndex].cardId===p.cardId&&disputeInput(r).reference.toLocaleLowerCase()===reference.toLocaleLowerCase()))throw new Error('Esa referencia de contracargo ya fue registrada para la tarjeta y sucursal.')
 account(s,input.claimAccountId,'Activo',historical);account(s,input.lossAccountId,'Gastos',historical);account(s,input.recoveryAccountId,'Ingresos',historical)
 const settlement=input.settlementId?(s.cardSettlements||[]).find(r=>r.id===input.settlementId&&r.cardId===p.cardId&&r.branchId===receipt.branchId&&r.items.some(x=>coupon(x,input))):undefined
 if(input.settlementId&&!settlement)throw new Error('La liquidación debe contener el cupón seleccionado.')
 const bank=settlement?s.masters.treasury.find(t=>t.id===settlement.treasuryId&&t.type==='Banco'&&t.branchId===receipt.branchId):undefined
 const sourceAccountId=settlement?String(bank?.accountId||''):ledger.accountId;account(s,sourceAccountId,'Activo',historical)
 if(input.claimAccountId===sourceAccountId)throw new Error('La cuenta de reclamos debe ser distinta de la cuenta de origen.')
 const relevant=disputes(s).filter(r=>r.preview.kind==='Contracargo'&&coupon(disputeInput(r),input)&&disputeInput(r).settlementId===input.settlementId)
 const consumed=sumMoney(relevant.flatMap(r=>[disputeInput(r).amount,...disputes(s).filter(x=>x.preview.kind==='Resolución'&&resolutionInput(x).disputeId===r.id&&resolutionInput(x).outcome!=='Pérdida').map(x=>-resolutionInput(x).amount)]))
 const allocated=settlement?sumMoney(settlement.items.filter(x=>coupon(x,input)).map(x=>x.amount)):sumMoney([p.amount,...(s.cardSettlements||[]).flatMap(r=>r.items.filter(x=>coupon(x,input)).map(x=>-x.amount))])
 const available=sumMoney([allocated,-consumed]);if(amount>available)throw new Error('El contracargo supera el importe disponible de ese origen.')
 const clean={receiptId:input.receiptId,paymentIndex:input.paymentIndex,settlementId:input.settlementId,date:input.date,reference,reason,amount,claimAccountId:input.claimAccountId,lossAccountId:input.lossAccountId,recoveryAccountId:input.recoveryAccountId,treatment:input.treatment,assetConfirmed:input.assetConfirmed}
 const financialReceipt=structuredClone(receipt);delete financialReceipt.receiptSnapshot
 return {kind:'Contracargo',input:clean,receipt:financialReceipt,source:ledger,...(settlement?{settlement:structuredClone(settlement)}:{}),settlementPrefixIds:(s.cardSettlements||[]).map(r=>r.id),branchId:receipt.branchId,claimAccountId:input.claimAccountId,lossAccountId:input.lossAccountId,recoveryAccountId:input.recoveryAccountId,sourceAccountId,treasuryId:bank?.id||'',available,lines:[{accountId:input.treatment==='Crédito cierto documentado'?input.claimAccountId:input.lossAccountId,debit:amount,credit:0},{accountId:sourceAccountId,debit:0,credit:amount}],treasuryAmount:settlement?-amount:0}
}
export function previewCardResolution(s:State,input:CardResolutionInput,historical=false,projection=true):CardPreview{
 const original=disputes(s).find(r=>r.id===input.disputeId&&r.preview.kind==='Contracargo');if(!original)throw new Error('Seleccioná un contracargo conservado.')
 const p=original.preview;source(s,p.source,projection);date(s,input.date,historical)
 if(input.date<p.input.date||input.date<lastCouponDate(s,p.source))throw new Error('La resolución no puede preceder a las operaciones conservadas del cupón.')
 const reference=text(input.reference,'Referencia de resolución',200),reason=text(input.reason,'Fundamento de resolución',1000),amount=positive(input.amount),available=input.outcome==='Recupero posterior'?cardLossRecoverable(s,original.id):cardClaimRemaining(s,original.id)
 if(!['Reintegrado','Pérdida','Recupero posterior'].includes(input.outcome)||amount>available)throw new Error('La resolución supera el reclamo pendiente o tiene un resultado inválido.')
 if(disputes(s).some(r=>r.preview.kind==='Resolución'&&resolutionInput(r).disputeId===original.id&&resolutionInput(r).reference.toLocaleLowerCase()===reference.toLocaleLowerCase()))throw new Error('Esa referencia de resolución ya se utilizó en el reclamo.')
 const uncertain=disputeInput(original).treatment==='Reclamo contingente',memoOnly=uncertain&&input.outcome==='Pérdida',creditAccount=input.outcome==='Recupero posterior'||uncertain?p.recoveryAccountId:p.claimAccountId
 const debitAccount=input.outcome==='Pérdida'?p.lossAccountId:p.sourceAccountId
 if(!memoOnly)account(s,creditAccount,creditAccount===p.recoveryAccountId?'Ingresos':'Activo',historical);account(s,debitAccount,input.outcome==='Pérdida'?'Gastos':'Activo',historical)
 return {...structuredClone(p),kind:'Resolución',input:{disputeId:original.id,date:input.date,reference,reason,amount,outcome:input.outcome},settlementPrefixIds:(s.cardSettlements||[]).map(r=>r.id),available,lines:memoOnly?[]:[{accountId:debitAccount,debit:amount,credit:0},{accountId:creditAccount,debit:0,credit:amount}],treasuryAmount:input.outcome!=='Pérdida'&&p.treasuryId?amount:0}
}
function post(s:State,p:CardPreview,review:string|undefined,actor:Session){
 if(!canAccess(actor,'/finanzas/liquidaciones-tarjetas'))throw new Error('Tu perfil no permite gestionar contracargos.')
 if(review!==cardDisputeReview(p))throw new Error('La revisión del contracargo cambió. Preparala nuevamente.')
 const id=uid(),sequence=disputes(s).length+1,number=`INT-T${p.kind==='Contracargo'?'C':'R'}-${String(sequence).padStart(8,'0')}`,entryId=p.lines.length?uid():undefined,treasuryMoveId=p.treasuryAmount?uid():undefined
 const r:CardDisputeRecord={id,sequence,number,responsible:actor.name,createdAt:new Date().toISOString(),review:cardDisputeReview(p),preview:p,...(entryId?{entryId}:{}),...(treasuryMoveId?{treasuryMoveId}:{})}
 const entry:Entry={id:entryId!,date:p.input.date,concept:number,branchId:p.branchId,documentId:id,cardDisputeRecordId:id,lines:structuredClone(p.lines)}
 if(entryId)s.entries.push(entry);if(treasuryMoveId)s.treasuryMoves.push({id:treasuryMoveId,date:p.input.date,treasuryId:p.treasuryId,amount:p.treasuryAmount,reason:number,documentId:id,branchId:p.branchId,reconciled:false,cardDisputeRecordId:id})
 ;(s.cardDisputes??=[]).push(r);return r
}
export function registerCardDispute(s:State,input:CardDisputeInput,actor:Session){return post(s,previewCardDispute(s,input,false,false),input.review,actor)}
export function resolveCardDispute(s:State,input:CardResolutionInput,actor:Session){return post(s,previewCardResolution(s,input,false,false),input.review,actor)}
export function prepareCardClaimAccounts(s:State,actor:Session){requireAdmin(actor.role);for(const [id,code,,group] of [['card-dispute-asset','1.1.90','Reclamos a procesadoras de tarjetas','Activo'],['card-dispute-loss','5.90','Pérdidas por contracargos de tarjetas','Gastos'],['card-dispute-recovery','4.90','Recuperos de pérdidas por contracargos','Ingresos']]){const old=s.masters.accounts.find(a=>a.id===id||a.code===code);if(old&&(old.id!==id||old.group!==group||!old.postable))throw new Error('Las cuentas sugeridas ya están ocupadas. Seleccioná cuentas propias de activo y gastos.')}for(const [id,code,name,group] of [['card-dispute-asset','1.1.90','Reclamos a procesadoras de tarjetas','Activo'],['card-dispute-loss','5.90','Pérdidas por contracargos de tarjetas','Gastos'],['card-dispute-recovery','4.90','Recuperos de pérdidas por contracargos','Ingresos']])if(!s.masters.accounts.some(a=>a.id===id))s.masters.accounts.push({id,code,name,group,postable:true})}
export function validateCardDisputes(s:State){
 if(s.cardDisputes!==undefined&&!Array.isArray(s.cardDisputes))throw new Error('Contracargos de tarjetas inválidos.')
 const records=disputes(s),ids=new Set<string>(),view={...s,cardDisputes:[] as CardDisputeRecord[]}
 for(const [index,r] of records.entries()){
  if(!r.id||ids.has(r.id)||r.sequence!==index+1||!r.responsible||!r.createdAt||Number.isNaN(Date.parse(r.createdAt))||!['Contracargo','Resolución'].includes(r.preview?.kind))throw new Error('Constancia de contracargo inválida.')
  ids.add(r.id);const prefix=r.preview.settlementPrefixIds
  if(!Array.isArray(prefix)||JSON.stringify(prefix)!==JSON.stringify((s.cardSettlements||[]).slice(0,prefix.length).map(x=>x.id)))throw new Error('El contracargo perdió la secuencia de liquidaciones conservadas.')
  const previous={...view,cardSettlements:(s.cardSettlements||[]).slice(0,prefix.length)}
  const p=r.preview.kind==='Contracargo'?previewCardDispute(previous,disputeInput(r),true,false):previewCardResolution(previous,resolutionInput(r),true,false)
  if(r.review!==cardDisputeReview(p)||r.review!==cardDisputeReview(r.preview)||r.number!==`INT-T${p.kind==='Contracargo'?'C':'R'}-${String(index+1).padStart(8,'0')}`)throw new Error('La revisión o las fuentes de un contracargo cambiaron.')
  const entries=s.entries.filter(e=>e.cardDisputeRecordId===r.id),e=entries[0],moves=s.treasuryMoves.filter(m=>m.cardDisputeRecordId===r.id)
  if(entries.length!==(p.lines.length?1:0)||p.lines.length&&(!e||e.id!==r.entryId||e.documentId!==r.id||e.concept!==r.number||e.date!==p.input.date||e.branchId!==p.branchId||e.manual||JSON.stringify(e.lines)!==JSON.stringify(p.lines))||!p.lines.length&&r.entryId)throw new Error('El asiento no coincide con el contracargo conservado.')
  if(moves.length!==(p.treasuryAmount?1:0)||p.treasuryAmount&&(!moves[0]||moves[0].id!==r.treasuryMoveId||moves[0].amount!==p.treasuryAmount||moves[0].date!==p.input.date||moves[0].treasuryId!==p.treasuryId||moves[0].branchId!==p.branchId||moves[0].documentId!==r.id||moves[0].reason!==r.number)||!p.treasuryAmount&&r.treasuryMoveId)throw new Error('El movimiento bancario no coincide con el contracargo.')
  view.cardDisputes.push(r)
 }
 if(s.entries.some(e=>e.cardDisputeRecordId&&!ids.has(e.cardDisputeRecordId))||s.treasuryMoves.some(m=>m.cardDisputeRecordId&&!ids.has(m.cardDisputeRecordId)))throw new Error('Falta la constancia de un contracargo.')
 for(const receipt of s.documents.filter(d=>d.kind==='cobro'))for(const [paymentIndex,p] of receipt.payments.entries())if(p.cardId){const held=cardPendingDisputed(s,receipt.id,paymentIndex),settled=sumMoney((s.cardSettlements||[]).flatMap(r=>r.items.filter(i=>coupon(i,{receiptId:receipt.id,paymentIndex})).map(i=>i.amount)));if(sumMoney([held,settled])>p.amount)throw new Error('Las liquidaciones consumen un cupón apartado por contracargo.')}
}
