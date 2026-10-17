import {assertProductionClosingReady} from './production-closing-model'
import {productionRecoveryPositions} from './production-recoverability'
import {assertProductionInflationReady} from './production-inflation'
import {serviceAccrualActive} from './service-accruals'
import {depreciationRows} from './fixed-assets'
import type {State,Session,AccountingCloseInput,AccountingClose,Entry,Document,StockMove,TreasuryMove} from './types'
import {uid} from './constants'
import {requireAdmin} from './permissions'
import {trialBalance,accountingDate} from './trial-balance'
import type {TrialBalance} from './trial-balance'
import {nextInventoryDate,inventoryCostDate} from './inventory-dates'

export interface AccountingClosePreview {
 productionRecoveries?:State['productionRecoveries'];productionInflations?:State['productionInflations'];inventoryRecoveries?:State['inventoryRecoveries'];inventoryInflations?:State['inventoryInflations'];
 reexpressionPostings?:{id:string;number:string;review:string;entryIds:string[]}[];
 resultsClose?:{id:string;number:string;resultsAccountId:string;result:number;entryIds:string[]};
 revenues?:{accruals:State['revenueAccruals'];settlements:State['revenueSettlements']};
 fixedAssets?:{inflations?:State['assetInflations'];impairments?:State['assetImpairments'];disposals?:State['assetDisposals'];reestimates?:State['assetReestimates'];assets:State['fixedAssets'];commissions:State['assetCommissions'];batches:State['depreciationBatches']};
 services?:{accruals:State['serviceAccruals'];settlements:State['serviceSettlements'];reestimates?:State['serviceReestimates'];cancellations?:State['serviceCancellations']};
 reference:string;reason:string;
 balance:TrialBalance;branches:{id:string;balance:TrialBalance}[];inventoryBatchId:string;
 warnings:{id:string;message:string;reference:string}[];
 sources:{applications?:State['accountApplications'];entries:Pick<Entry,'id'|'date'|'concept'|'branchId'|'documentId'|'lines'>[];documents:Pick<Document,'id'|'number'|'date'|'kind'|'side'|'branchId'|'net'|'vat'|'total'|'perceptions'|'sourceId'|'lines'|'payments'|'allocations'>[];stock:StockMove[];treasury:Omit<TreasuryMove,'reconciled'|'bankStatementLineId'>[]}
}
function cutSources(state:State,to:string):AccountingClosePreview['sources'] {
 for(const record of [...state.documents,...state.stockMoves,...state.treasuryMoves])accountingDate(record.date)
 return {
  ...((state.accountApplications||[]).some(r=>r.preview.date<=to)?{applications:structuredClone(state.accountApplications!.filter(r=>r.preview.date<=to))}:{}),
  entries:state.entries.filter(e=>e.date<=to).map(e=>({id:e.id,date:e.date,concept:e.concept,branchId:e.branchId,documentId:e.documentId,lines:structuredClone(e.lines)})),
  documents:state.documents.filter(d=>d.date<=to).map(d=>({id:d.id,number:d.number,date:d.date,kind:d.kind,side:d.side,branchId:d.branchId,net:d.net,vat:d.vat,total:d.total,perceptions:d.perceptions,sourceId:d.sourceId,lines:d.lines.map(l=>({...l,description:''})),payments:structuredClone(d.payments),allocations:structuredClone(d.allocations)})),
  stock:structuredClone(state.stockMoves.filter(m=>m.date<=to)),
  treasury:state.treasuryMoves.filter(m=>m.date<=to).map(m=>({id:m.id,date:m.date,treasuryId:m.treasuryId,amount:m.amount,reason:m.reason,documentId:m.documentId,branchId:m.branchId,...(m.cashClosingId?{cashClosingId:m.cashClosingId,cashClosingLineId:m.cashClosingLineId}:{})})),
 }
}
export function previewAccountingClose(state:State,input:AccountingCloseInput,previousClosedUntil=state.settings.closedUntil):AccountingClosePreview {
 accountingDate(input.date)
 if(input.date<state.settings.exerciseStart||input.date>state.settings.exerciseEnd||previousClosedUntil&&input.date<=previousClosedUntil)throw new Error('El cierre debe ser posterior al bloqueo existente y pertenecer al ejercicio.')
 if(typeof input.reference!=='string'||!input.reference.trim()||input.reference.trim().length>200||typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)throw new Error('El cierre necesita referencia de hasta 200 caracteres y fundamento de hasta 1000.')
 const from=previousClosedUntil?nextInventoryDate(previousClosedUntil):state.settings.exerciseStart,balance=trialBalance(state,from,input.date),branchIds=state.masters.branches.filter(b=>state.entries.some(e=>e.branchId===b.id&&e.date<=input.date)).map(b=>b.id),branches=branchIds.map(id=>({id,balance:trialBalance(state,from,input.date,id)}))
 const inventoryRecoveries=(state.inventoryRecoveries||[]).filter(r=>r.date<=input.date);
 const productionRecoveries=(state.productionRecoveries||[]).filter(r=>r.date<=input.date)
 const productionInflations=(state.productionInflations||[]).filter(r=>r.date<=input.date)
 const inventoryInflations=(state.inventoryInflations||[]).filter(r=>r.date<=input.date)
 const stock=state.stockMoves.some(m=>m.date<=input.date),inventory=state.inventoryCostBatches?.find(b=>b.date===input.date)
 if(stock&&!inventory)throw new Error('Contabilizá primero la valuación de inventario exactamente en la fecha de cierre, con todas las recepciones y salidas revisadas.')
 const warnings:AccountingClosePreview['warnings']=[]
 if(productionRecoveries.length&&productionRecoveryPositions(state,input.date).length)warnings.push({id:'production-recoverability',message:'Revisá la recuperabilidad de cada orden pendiente, la moneda de costos y los materiales y trabajos restantes. Las comparaciones de proceso no reemplazan la revisión del inventario físico ni su comparación actual al cierre.',reference:productionRecoveries.at(-1)?.number||'Producción pendiente'})
 const assets=(state.fixedAssets||[]).filter(a=>a.date<=input.date),commissions=(state.assetCommissions||[]).filter(c=>c.date<=input.date),batches=(state.depreciationBatches||[]).filter(b=>b.date<=input.date),assetReestimates=(state.assetReestimates||[]).filter(r=>r.date<=input.date),disposals=(state.assetDisposals||[]).filter(b=>b.date<=input.date),impairments=(state.assetImpairments||[]).filter(c=>c.date<=input.date),assetRows=depreciationRows(state,input.date)
 for(const d of state.documents.filter(d=>inventoryCostDate(d)<=input.date&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'))){
  if(d.kind==='factura'&&d.side==='proveedor'&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'&&!assets.some(a=>a.invoiceId===d.id&&a.productId===l.productId)))throw new Error('Capitalizá las compras de bienes de uso antes del cierre: su gasto original sigue pendiente de reclasificación.')
  if(['credito','debito'].includes(d.kind)||d.kind==='factura'&&d.side==='cliente'&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'&&!disposals.some(b=>b.kind==='Venta'&&b.invoiceId===d.id&&assets.find(a=>a.id===b.assetId)?.productId===l.productId)))throw new Error('Las notas y ventas de bienes de uso requieren revisar costo, baja y depreciaciones en su circuito específico antes de cerrar.')
  if(d.kind==='remito'&&d.side==='cliente'&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'&&!disposals.some(b=>b.kind==='Venta'&&assets.find(a=>a.id===b.assetId)?.productId===l.productId&&state.documents.find(i=>i.id===b.invoiceId)?.sourceId===d.id)))throw new Error('Revisá la transferencia y baja de bienes de uso entregados antes de cerrar; las ventas sin factura requieren su propio circuito.')
  if(d.kind==='remito'&&d.side==='proveedor'&&!state.documents.some(i=>i.kind==='factura'&&i.sourceId===d.id&&inventoryCostDate(i)<=input.date))warnings.push({id:`fixed-receipt:${d.id}`,message:'Bien de uso recibido sin factura: revisá el reconocimiento del costo y del pasivo antes del cierre.',reference:d.number})
 }
 if(assetRows.some(r=>r.charge>0))throw new Error('Contabilizá la depreciación de los bienes de uso hasta la fecha exacta del cierre.')
 if(assets.length)warnings.push({id:'fixed-asset-policy',message:'Bienes de uso al costo nominal y depreciación lineal diaria. Revisá vida útil, residual, valor recuperable, inflación y su función antes de emitir estados contables.',reference:'Bienes de uso registrados'})
 for(const r of assetRows.filter(r=>r.method==='Lineal diaria'&&!r.commissionedOn&&!disposals.some(b=>b.assetId===r.assetId)))warnings.push({id:`fixed-commission:${r.assetId}`,message:'Bien de uso sin puesta en marcha registrada. Revisá su disponibilidad, ubicación y estimaciones antes del cierre.',reference:r.number})
 if(stock)warnings.push({id:'inventory-policy',message:inventoryInflations.length?'La valuación incorpora la base conciliada de moneda de cierre. Revisá costos adicionales, conversión, valor recuperable y la moneda de las operaciones posteriores.':'La valuación incorpora costos históricos nominales. Revisá costos adicionales, conversión, valor recuperable y ajuste por inflación antes de preparar estados contables.',reference:inventory!.number})
 for(const receipt of inventory?.receipts?.filter(r=>!r.invoiceId)||[])warnings.push({id:`unbilled:${receipt.receiptId}`,message:'La recepción conserva deuda estimada sin factura. Revisá su fundamento y su conciliación posterior.',reference:receipt.number})
 for(const a of state.serviceAccruals?.filter(a=>a.date<=input.date&&serviceAccrualActive(state,a.id,input.date))||[]){const settlement=state.serviceSettlements?.find(s=>s.accrualId===a.id&&s.date<=input.date),invoice=state.documents.find(d=>d.kind==='factura'&&d.sourceId===a.sourceId&&inventoryCostDate(d)<=input.date);if(invoice&&!settlement)throw new Error('Conciliá los servicios devengados con sus facturas antes de cerrar: el gasto y el pasivo estimado siguen pendientes de reclasificación.');if(!settlement)warnings.push({id:`service-accrual:${a.id}`,message:'Servicios recibidos sin factura con gasto y pasivo estimados. Revisá su fundamento y conciliación posterior.',reference:a.number})}
 for(const d of state.documents.filter(d=>d.side==='proveedor'&&d.kind==='remito'&&d.date<=input.date&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Servicio'&&!state.serviceAccruals?.some(a=>a.sourceId===d.id&&a.date<=input.date&&serviceAccrualActive(state,a.id,input.date)&&a.lines.some(x=>x.productId===l.productId)))&&!state.documents.some(i=>i.kind==='factura'&&i.sourceId===d.id&&i.date<=input.date)))warnings.push({id:`service:${d.id}`,message:'Servicio recibido sin factura: su devengamiento no está automatizado. Revisá y registrá el ajuste contable que corresponda antes del cierre.',reference:d.number})
 for(const a of state.revenueAccruals?.filter(a=>a.date<=input.date)||[]){const settlement=state.revenueSettlements?.find(s=>s.accrualId===a.id&&s.date<=input.date),invoice=state.documents.find(d=>d.kind==='factura'&&d.sourceId===a.sourceId&&inventoryCostDate(d)<=input.date);if(invoice&&!settlement)throw new Error('Conciliá los ingresos devengados con sus facturas antes de cerrar: el ingreso y el IVA facturados siguen duplicados.');if(!settlement)warnings.push({id:`revenue-accrual:${a.id}`,message:'Ingreso y activo sin factura, con IVA revisado. Verificá aceptación, precio acordado, nacimiento fiscal, facturación pendiente y eventuales devoluciones.',reference:a.number})}
 for(const d of state.documents.filter(d=>d.side==='cliente'&&d.kind==='remito'&&d.date<=input.date&&!state.documents.some(i=>i.kind==='factura'&&i.sourceId===d.id&&i.date<=input.date)&&d.lines.some(l=>!state.revenueAccruals?.some(a=>a.sourceId===d.id&&a.date<=input.date&&a.lines.some(x=>x.productId===l.productId)))))warnings.push({id:`delivery:${d.id}`,message:'Entrega sin factura: revisá la transferencia de control y el reconocimiento del ingreso. El costo del remito no registra automáticamente un ingreso devengado.',reference:d.number})
 if(state.documents.some(d=>d.side==='cliente'&&['factura','credito','debito'].includes(d.kind)&&d.date<=input.date))warnings.push({id:'fiscal-review',message:'El cierre no autoriza comprobantes ni declara impuestos. Revisá emisión, libros fiscales y obligaciones del período.',reference:'Comprobantes de venta del período acumulado'})
 const resultsClose=state.yearEndCloses?.find(c=>c.exerciseStart===state.settings.exerciseStart&&c.exerciseEnd===input.date)
 if(input.date===state.settings.exerciseEnd)warnings.push({id:'year-end',message:resultsClose?'Las cuentas de resultados quedaron cerradas. Todavía requiere estados contables, notas y ajustes normativos revisados.':'Es un bloqueo operativo de fin de ejercicio. Todavía requiere cierre de resultados, estados contables, notas y ajustes normativos revisados.',reference:input.date})
 const revenueAccruals=state.revenueAccruals?.filter(a=>a.date<=input.date)||[],revenueSettlements=state.revenueSettlements?.filter(s=>s.date<=input.date)||[]
 const accruals=state.serviceAccruals?.filter(a=>a.date<=input.date)||[],settlements=state.serviceSettlements?.filter(s=>s.date<=input.date)||[],reestimates=state.serviceReestimates?.filter(r=>r.date<=input.date)||[],cancellations=state.serviceCancellations?.filter(c=>c.date<=input.date)||[]
 const inflation=state.reexpressionPostings?.filter(p=>p.preview.from===state.settings.exerciseStart&&p.preview.date<=input.date)||[]
 return {reference:input.reference.trim(),reason:input.reason.trim(),...(productionRecoveries.length?{productionRecoveries:structuredClone(productionRecoveries)}:{}),...(productionInflations.length?{productionInflations:structuredClone(productionInflations)}:{}),...(inventoryInflations.length?{inventoryInflations}:{}),...(inventoryRecoveries.length?{inventoryRecoveries:structuredClone(inventoryRecoveries)}:{}),balance,branches,...(inflation.length?{reexpressionPostings:inflation.map(p=>({id:p.id,number:p.number,review:p.review!,entryIds:[...p.entryIds]}))}:{}),...(assets.length||commissions.length||batches.length?{fixedAssets:structuredClone({assets,commissions,batches,...((state.assetInflations||[]).some(r=>r.date<=input.date)?{inflations:structuredClone(state.assetInflations!.filter(r=>r.date<=input.date))}:{}),...(impairments.length?{impairments}:{}),...(disposals.length?{disposals}:{}),...(assetReestimates.length?{reestimates:assetReestimates}:{})})}:{}),inventoryBatchId:inventory?.id||'',warnings,sources:cutSources(state,input.date),...(revenueAccruals.length||revenueSettlements.length?{revenues:structuredClone({accruals:revenueAccruals,settlements:revenueSettlements})}:{}),...(accruals.length||settlements.length?{services:structuredClone({accruals,settlements,...(reestimates.length?{reestimates}:{}),...(cancellations.length?{cancellations}:{})})}:{}),...(resultsClose?{resultsClose:{id:resultsClose.id,number:resultsClose.number,resultsAccountId:resultsClose.resultsAccountId,result:resultsClose.preview.result,entryIds:structuredClone(resultsClose.entryIds)}}:{})}
}
function financialBalance(b:TrialBalance){return {...b,rows:b.rows.filter(r=>r.opening||r.debit||r.credit||r.closing).map(({name,code,...r})=>{void name;void code;return r})}}
export function accountingCloseReview(p:AccountingClosePreview){return JSON.stringify({...p,balance:financialBalance(p.balance),branches:p.branches.map(b=>({id:b.id,balance:financialBalance(b.balance)}))})}
function acknowledgments(input:AccountingCloseInput,preview:AccountingClosePreview){if(!Array.isArray(input.acknowledged)||input.acknowledged.some(id=>typeof id!=='string')||new Set(input.acknowledged).size!==input.acknowledged.length||input.acknowledged.length!==preview.warnings.length||preview.warnings.some(w=>!input.acknowledged.includes(w.id)))throw new Error('Revisá y reconocé exactamente todas las observaciones antes de bloquear el período.');return [...input.acknowledged].sort()}
export function closeAccountingPeriod(state:State,input:AccountingCloseInput,actor:Session):AccountingClose {
 requireAdmin(actor.role)
 assertProductionInflationReady(state,input.date,true)
 assertProductionClosingReady(state,input.date)
 const pending=state.reexpressionPostings?.find(p=>p.preview.inventoryClosingRequired&&p.preview.date<=input.date&&!state.inventoryRecoveries?.some(r=>r.closing?.postingId===p.id&&r.scope==='Inventario completo'&&r.date===p.preview.date));if(pending)throw new Error('Conservá la comparación completa con el VNR actual al cierre antes de bloquear el período ajustado.')
 const preview=previewAccountingClose(state,input),acknowledged=acknowledgments(input,preview),review=accountingCloseReview(preview)
 if(input.review!==review)throw new Error('La revisión del cierre cambió. Prepará nuevamente el balance y sus observaciones.')
 if(state.accountingCloses?.some(c=>c.reference===input.reference.trim()))throw new Error('La referencia del cierre ya se utilizó.')
 const record:AccountingClose={id:uid(),number:`INT-CC-${String((state.accountingCloses?.length||0)+1).padStart(8,'0')}`,date:input.date,reference:input.reference.trim(),reason:input.reason.trim(),acknowledged,review,createdAt:new Date().toISOString(),responsible:actor.name,previousClosedUntil:state.settings.closedUntil,exerciseStart:state.settings.exerciseStart,exerciseEnd:state.settings.exerciseEnd,preview:structuredClone(preview)}
 state.accountingCloses=[...(state.accountingCloses||[]),record];state.settings.closedUntil=input.date;state.settings.accountingCloseId=record.id;return record
}
export function validateAccountingCloses(state:State){
 if(state.accountingCloses===undefined){if(state.settings.accountingCloseId)throw new Error('Falta la constancia del bloqueo contable.');return}
 if(!Array.isArray(state.accountingCloses))throw new Error('Los cierres contables deben ser una lista.')
 const ids=new Set<string>(),references=new Set<string>()
 for(const [index,c] of state.accountingCloses.entries()){
  if(!c.id||ids.has(c.id)||c.number!==`INT-CC-${String(index+1).padStart(8,'0')}`||references.has(c.reference)||!c.responsible||typeof c.createdAt!=='string'||Number.isNaN(Date.parse(c.createdAt))||!c.preview)throw new Error('Constancia de cierre contable inválida.')
  ids.add(c.id);references.add(c.reference);accountingDate(c.exerciseStart);accountingDate(c.exerciseEnd);if(c.previousClosedUntil)accountingDate(c.previousClosedUntil)
  if(index&&c.previousClosedUntil!==state.accountingCloses[index-1].date||c.previousClosedUntil&&c.previousClosedUntil<c.exerciseStart&&!state.exerciseOpenings?.some(o=>o.exerciseStart===c.exerciseStart&&o.exerciseEnd===c.exerciseEnd&&o.previousEnd===c.previousClosedUntil)||c.exerciseEnd<c.exerciseStart)throw new Error('La secuencia de períodos cerrados no se conserva.')
  const view={...state,productionRecoveries:(state.productionRecoveries||[]).filter(r=>c.preview.productionRecoveries?.some(p=>p.id===r.id)),productionInflations:(state.productionInflations||[]).filter(r=>c.preview.productionInflations?.some(p=>p.id===r.id)),inventoryRecoveries:(state.inventoryRecoveries||[]).filter(r=>c.preview.inventoryRecoveries?.some(p=>p.id===r.id)),inventoryInflations:(state.inventoryInflations||[]).filter(r=>c.preview.inventoryInflations?.some(p=>p.id===r.id)),assetInflations:(state.assetInflations||[]).filter(r=>c.preview.fixedAssets?.inflations?.some(p=>p.id===r.id)),settings:{...state.settings,exerciseStart:c.exerciseStart,exerciseEnd:c.exerciseEnd}},expected=previewAccountingClose(view,c,c.previousClosedUntil)
  acknowledgments(c,expected)
  if(accountingCloseReview(expected)!==c.review||accountingCloseReview(c.preview)!==c.review)throw new Error('Cambió el balance, las observaciones o las fuentes de un período cerrado.')
 }
 const last=state.accountingCloses.at(-1)
 if(last&&(state.settings.closedUntil!==last.date||state.settings.accountingCloseId!==last.id)||!last&&state.settings.accountingCloseId)throw new Error('El bloqueo contable no coincide con la última constancia de cierre.')
}
