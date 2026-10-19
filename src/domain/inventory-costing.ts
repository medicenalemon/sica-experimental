import {productionRecoveryReferences,productionOrderAllowance} from './production-recoverability'
import {assertProductionInflationReady} from './production-inflation'
import {productionCostReferences,productionOrdersForCost} from './production-costs'
import {createInventoryReserveFlow} from './inventory-reserve-flow'
import type {InventoryReserveFlow} from './inventory-reserve-flow'
import {inventoryRecoveryReferences,assertInventoryReserveLedger} from './inventory-recoverability'
import {inventoryCurrencyView,inventoryInflationReferences,assertInventoryInflationReady} from './inventory-inflation-model'
import {withinExerciseHistory} from './exercise-calendar'
import {inventoryCostDate} from './inventory-dates'
import type {State,Session,StockMove,InventoryAccounts,InventoryCostInput,InventoryBalance,InventoryCostRow,InventoryCostBatch,Entry,EntryLine,Document,InventoryCostCorrection,InventoryOpeningNote,InventoryReturnSource,InventoryReceiptPosition,InventoryInvoiceSettlement,InventoryOpeningInvoice} from './types'
import {assertDate,lineTotals} from './engine'
import {uid} from './constants'
import {validJournal} from './trial-balance'
import {canAccess,requireAdmin} from './permissions'
import {receiptEstimateRecords,receiptPositions,invoiceReceiptCosts,openingInvoiceDifferences,validateOpeningDestinations,originalPurchaseExpense} from './inventory-receipts'
import type {ReceiptEstimateRecord} from './inventory-receipts'

const definitions=[['inventory','1.1.9','Existencias de mercadería','Activo'],['cogs','5.4','Costo de mercadería vendida','Gastos'],['adjustments','5.5','Diferencias de inventario','Gastos'],['transit','1.1.10','Traslados de mercadería a conciliar','Activo'],['wip','1.1.11','Producción en proceso','Activo'],['unbilled','2.1.6','Mercadería recibida sin facturar','Pasivo']] as const
export function prepareInventoryAccounts(state:State,actor:Session){
 requireAdmin(actor.role)
 const next=structuredClone(state.masters.accounts),map={...state.settings.accountMap}
 for(const [key,code,name,group] of definitions)if(!map[key]){
  const id=`inventory-${key}`
  const old=next.find(a=>a.id===id||a.code===code)
  if(old&&(!old.postable||old.group!==group||old.name!==name))throw new Error(`Revisá la cuenta ${code}: ya está usada para otro concepto.`)
  if(!old)next.push({id,code,name,group,postable:true})
  map[key]=old?.id||id
 }
 state.masters.accounts=next;state.settings.accountMap=map
}
export function inventoryAccountDefaults(state:State):InventoryAccounts{
 const m=state.settings.accountMap;return {inventory:state.inventoryCostBatches?.at(-1)?.accounts.inventory||m.inventory||'',opening:m.equity||'',cogs:m.cogs||'',adjustments:m.adjustments||'',transit:m.transit||'',wip:m.wip||'',...(m.unbilled?{unbilled:m.unbilled}:{}),...(state.inventoryRecoveries?.length||state.productionRecoveries?.length?{stockAllowance:state.inventoryRecoveries?.[0]?.allowanceAccountId||m.stockAllowance||'',stockRecovery:m.stockRecovery||state.inventoryRecoveries?.at(-1)?.recoveryAccountId||''}:{})}
}
function amount(n:number){if(!Number.isSafeInteger(n)||n<0)throw new Error('La valuación requiere importes no negativos en centavos seguros.');return n}
function sum(a:number,b:number){const n=a+b;if(!Number.isSafeInteger(n))throw new Error('La valuación supera el rango de importes admitido.');return n}
function quantity(n:number){const q=Math.round(n*1_000_000);if(!Number.isFinite(n)||!Number.isSafeInteger(q)||Math.abs(n*1_000_000-q)>0.0001)throw new Error('La valuación requiere cantidades con hasta seis decimales y dentro de rango.');return q}
function prorate(value:number,part:number,total:number){if(part===total)return value;const n=(BigInt(value)*BigInt(part)*2n+BigInt(total))/(BigInt(total)*2n);return amount(Number(n))}
const key=(productId:string,depositId:string)=>JSON.stringify([productId,depositId])
function checkAccounts(state:State,a:InventoryAccounts,posting:boolean){
 const required=['inventory','opening','cogs','adjustments','transit','wip'];if(!a||!required.every(k=>Object.hasOwn(a,k))||Object.keys(a).some(k=>!required.includes(k)&&!['unbilled','stockAllowance','stockRecovery'].includes(k))||new Set(Object.values(a)).size!==Object.keys(a).length)throw new Error('Elegí cuentas distintas para la valuación y sus contrapartidas.')
 for(const [k,id] of Object.entries(a)){const account=state.masters.accounts.find(x=>x.id===id);if(!account||posting&&!account.postable||['inventory','transit','wip','stockAllowance'].includes(k)&&account.group!=='Activo'||['cogs','adjustments'].includes(k)&&account.group!=='Gastos'||k==='unbilled'&&account.group!=='Pasivo'||k==='stockRecovery'&&account.group!=='Ingresos')throw new Error('Las cuentas de valuación deben existir y tener el grupo contable correspondiente.')}
}
function balanceFor(state:State,m:Pick<StockMove,'productId'|'depositId'|'branchId'>):InventoryBalance{
 const p=state.products.find(p=>p.id===m.productId&&p.kind==='Producto'),d=state.masters.deposits.find(d=>d.id===m.depositId)
 if(!p||!d||!state.masters.branches.some(b=>b.id===m.branchId)||d.branchId!==m.branchId)throw new Error('El movimiento necesita artículo, depósito y sucursal coherentes para valuarse.')
 return {productId:p.id,depositId:d.id,branchId:m.branchId,sku:p.sku,name:p.name,unit:p.unit,depositName:String(d.name),quantity:0,value:0}
}
function sortedMoves(state:State,from:string,to:string){return state.stockMoves.map((m,i)=>({m,i})).filter(({m})=>m.date>from&&m.date<=to).sort((a,b)=>a.m.date.localeCompare(b.m.date)||a.i-b.i).map(({m})=>m)}
export function inventoryOpeningBalances(state:State,date:string){
 const pools=new Map<string,InventoryBalance>()
 for(const m of sortedMoves(state,'',date)){const k=key(m.productId,m.depositId),b=pools.get(k)||balanceFor(state,m);b.quantity=(quantity(b.quantity)+quantity(m.quantity))/1_000_000;pools.set(k,b)}
 return [...pools.values()].filter(b=>b.quantity!==0)
}
interface SaleCost {quantity:number;value:number;returned:number;returnedValue:number;accountId:string}
export interface InventoryProductionBridge {recoveryId:string;sourceBatchId:string;productionDate:string;balances:{productId:string;depositId:string;branchId:string;before:number;after:number;difference:number}[];journals:Journal[];returnCosts:{returnId:string;productId:string;sourceMoveId:string;before:number;after:number}[]}
export interface InventoryPreview {productionRecoveries?:InventoryCostBatch['productionRecoveries'];productionBridge?:InventoryProductionBridge;productionCosts?:InventoryCostBatch['productionCosts'];reserve?:import('./inventory-recoverability').InventoryReservePreview;recoveries?:ReturnType<typeof inventoryRecoveryReferences>;inflation?:InventoryCostBatch['inflation'];receipts?:InventoryReceiptPosition[];settlements?:InventoryInvoiceSettlement[];returnSources?:InventoryReturnSource[];corrections?:InventoryCostCorrection[];sourceMoves:StockMove[];rows:InventoryCostRow[];balances:InventoryBalance[];journals:{branchId:string;lines:EntryLine[]}[]}
function calculateSegment(state:State,input:InventoryCostInput,previous?:InventoryCostBatch,posting=true,replay?:{notes:Document[];sales?:Map<string,SaleCost>;openingDate?:string;receipts?:Map<string,ReceiptEstimateRecord>;invoices?:Map<string,Document>;reserve?:InventoryReserveFlow},productionAsOf?:string):InventoryPreview{
 if(posting)assertDate(state,input.date)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||Number.isNaN(Date.parse(input.date))||new Date(`${input.date}T12:00:00Z`).toISOString().slice(0,10)!==input.date||!withinExerciseHistory(state,input.date)||previous&&input.date<=previous.date)throw new Error('La fecha de valuación debe ser válida, del ejercicio y posterior al último cierre de inventario.')
 if(typeof input.reference!=='string'||!input.reference.trim()||input.reference.trim().length>200)throw new Error('Ingresá una referencia de valuación de hasta 200 caracteres.')
 checkAccounts(state,input.accounts,posting)
 if(previous&&input.accounts.inventory!==previous.accounts.inventory)throw new Error('La cuenta de existencias se conserva después de la apertura valorizada.')
 const sourceMoves=sortedMoves(state,previous?.date||'',input.date),returnCosts=new Map<string,{value:number;reference:string}>();
 if(input.returnCosts!==undefined&&!Array.isArray(input.returnCosts))throw new Error('Los costos históricos de devoluciones deben ser una lista.');for(const c of input.returnCosts||[]){const k=key(c.returnId,c.productId),r=state.stockReturns?.find(r=>r.id===c.returnId&&r.side==='cliente'&&r.date>(previous?.date||'')&&r.date<=input.date),source=r&&state.documents.find(d=>d.id===r.sourceId);if(returnCosts.has(k)||!r||!source||source.date>(replay?.openingDate||'')||!r.lines.some(l=>l.productId===c.productId)||typeof c.reference!=='string'||!c.reference.trim()||c.reference.trim().length>200)throw new Error('El costo histórico requiere una devolución pendiente cuya entrega sea anterior a la apertura, sin repeticiones y con referencia.');amount(c.value);returnCosts.set(k,{value:c.value,reference:c.reference.trim()})}
 const rows:InventoryCostRow[]=[],pools=new Map<string,InventoryBalance>(),journals=new Map<string,Map<string,{debit:number;credit:number}>>()
 const journal=(branchId:string,debitAccount:string,creditAccount:string,value:number)=>{if(!Number.isSafeInteger(value))throw new Error('Importe de corrección fuera de rango.');if(value<0){[debitAccount,creditAccount]=[creditAccount,debitAccount];value=-value}if(!value)return;const accounts=journals.get(branchId)||new Map();for(const [id,debit] of [[debitAccount,true],[creditAccount,false]] as const){const old=accounts.get(id)||{debit:0,credit:0};old[debit?'debit':'credit']=sum(old[debit?'debit':'credit'],value);accounts.set(id,old)}journals.set(branchId,accounts)}
 if(!previous){
  if(!Array.isArray(input.opening))throw new Error('La primera valuación requiere una apertura con valores revisados.')
  if(input.adjustments?.length)throw new Error('La apertura no admite costos adicionales de movimientos.')
  const actual=inventoryOpeningBalances(state,input.date),given=new Map<string,typeof input.opening[number]>()
  for(const row of input.opening){const k=key(row.productId,row.depositId);if(given.has(k))throw new Error('La apertura repite un artículo y depósito.');amount(row.value);quantity(row.quantity);given.set(k,row)}
  if(actual.length!==given.size)throw new Error('La apertura debe incluir todos los saldos no nulos al corte.')
  for(const b of actual){const row=given.get(key(b.productId,b.depositId));if(!row||b.quantity<0||row.quantity!==b.quantity)throw new Error('Revisá las cantidades de apertura; no se valúan existencias negativas.');b.value=row.value;pools.set(key(b.productId,b.depositId),b);journal(b.branchId,input.accounts.inventory,input.accounts.opening,b.value)}
  if(replay?.receipts)for(const {receipt,position} of replay.receipts.values())if(receipt.date<=input.date){if(posting&&state.entries.filter(e=>e.date<=input.date).some(e=>e.lines.some(l=>l.accountId===position.accountId&&(l.debit||l.credit))))throw new Error('La cuenta de mercadería sin facturar ya tiene asientos al corte; conciliá su apertura antes de incorporar la deuda.');journal(receipt.branchId,input.accounts.opening,position.accountId,position.estimatedValue)}
  if(posting&&state.entries.filter(e=>e.date<=input.date).some(e=>e.lines.some(l=>l.accountId===input.accounts.inventory&&(l.debit||l.credit))))throw new Error('La cuenta de existencias ya tiene asientos al corte. Conciliá su apertura antes de incorporar esta valuación.')
 }else{
  if(input.opening!==undefined)throw new Error('Los cierres posteriores no admiten otra apertura.')
  if(input.adjustments!==undefined&&!Array.isArray(input.adjustments))throw new Error('Los costos de ajustes deben ser una lista.')
  const adjustmentCosts=new Map<string,{moveId:string;value:number;reference:string}>()
  for(const row of input.adjustments||[]){if(adjustmentCosts.has(row.moveId)||!sourceMoves.some(m=>m.id===row.moveId&&m.quantity>0&&!m.documentId&&!m.transferId&&!m.returnId)||typeof row.reference!=='string'||!row.reference.trim()||row.reference.trim().length>200)throw new Error('El costo de ajuste necesita una entrada pendiente, referencia válida y sin repeticiones.');amount(row.value);adjustmentCosts.set(row.moveId,row)}
  for(const b of previous.balances)pools.set(key(b.productId,b.depositId),structuredClone(b))
  const valuedInvoices=new Set((state.inventoryCostBatches||[]).filter(b=>b.date<=previous.date).flatMap(b=>b.rows.map(r=>r.invoiceId).filter(Boolean)))
  if(!replay&&state.documents.some(d=>d.side==='proveedor'&&['credito','debito'].includes(d.kind)&&valuedInvoices.has(d.sourceId)&&inventoryCostDate(d)>previous.date&&inventoryCostDate(d)<=input.date))throw new Error('Hay notas posteriores de compras valorizadas. El cierre requiere incorporar su corrección de costos antes de contabilizar.')
  const transfers=new Map<string,number>(),production=new Map<string,number>()
  for(const m of sourceMoves){
   if(m.date<=previous.date||!m.quantity)throw new Error('Movimiento de inventario inválido.')
   const k=key(m.productId,m.depositId),b=pools.get(k)||balanceFor(state,m),q=quantity(m.quantity),oldQ=quantity(b.quantity),beforeValue=b.value,doc=state.documents.find(d=>d.id===m.documentId),order=state.masters.production.find(o=>o.id===m.documentId&&o.status==='Terminada')
   const returned=replay?.sales&&m.returnId?state.stockReturns?.find(r=>r.id===m.returnId):undefined
   let conversionValue:number|undefined,creditId:string|undefined,creditValue:number|undefined,costReference:string|undefined
   let value=0,kind:InventoryCostRow['kind']='Ajuste',counterpart=input.accounts.adjustments,invoiceId:string|undefined
   if(q<0){if(oldQ<-q)throw new Error(`Existencias insuficientes para valuar ${b.sku} al ${m.date}. Revisá la secuencia de movimientos.`);value=prorate(b.value,-q,oldQ)
    if(returned){
     if(returned.side!=='proveedor')throw new Error('La salida de devolución no corresponde a un proveedor.');const note=state.documents.find(d=>d.id===returned.noteId)!;if(!note||inventoryCostDate(note)>input.date)throw new Error('La devolución necesita su nota de crédito dentro del corte.');kind='Devolución proveedor';const expense=purchaseExpense(state,note,posting),line=note.lines.find(l=>l.productId===m.productId)!;if(!line)throw new Error('La nota perdió el artículo devuelto.');const t=lineTotals(line,note.letter);creditValue=sum(t.net,expense.includeVat?t.vat:0);creditId=note.id;invoiceId=note.sourceId;counterpart=expense.accountId;if(counterpart===input.accounts.inventory)throw new Error('La nota de devolución requiere una cuenta de compras distinta de existencias.');journal(m.branchId,counterpart,input.accounts.adjustments,creditValue-value)
    }else if(m.transferId){kind='Traslado';counterpart=input.accounts.transit;transfers.set(key(m.transferId,m.productId),value)}
    else if(order){kind='Consumo';counterpart=input.accounts.wip;production.set(order.id,sum(production.get(order.id)||0,value))}
    else if(doc?.kind==='remito'&&doc.side==='cliente'){kind='Venta';counterpart=input.accounts.cogs;replay?.sales?.set(key(doc.id,m.productId),{quantity:-q,value,returned:0,returnedValue:0,accountId:counterpart})}
    else if(m.documentId)throw new Error('Salida de stock sin una clasificación contable reconocida.')
    b.value-=value;journal(m.branchId,counterpart,input.accounts.inventory,value)
   }else{
    if(returned){
     if(returned.side!=='cliente')throw new Error('La entrada de devolución no corresponde a un cliente.');const note=state.documents.find(d=>d.id===returned.noteId);if(!note||inventoryCostDate(note)>input.date)throw new Error('La devolución necesita su nota de crédito dentro del corte.');kind='Devolución cliente';creditId=note.id;const sale=replay!.sales!.get(key(returned.sourceId,m.productId));
     if(sale){if(q>sale.quantity-sale.returned)throw new Error('La devolución supera la cantidad con costo conservado.');value=prorate(sale.value-sale.returnedValue,q,sale.quantity-sale.returned);sale.returned+=q;sale.returnedValue+=value;counterpart=sale.accountId}
     else {const cost=returnCosts.get(key(returned.id,m.productId));if(!cost)throw new Error('La venta anterior a la apertura requiere un costo total devuelto y referencia revisados.');value=cost.value;costReference=cost.reference;counterpart=input.accounts.cogs}
    }else if(m.transferId){kind='Traslado';counterpart=input.accounts.transit;const transferKey=key(m.transferId,m.productId);if(!transfers.has(transferKey))throw new Error('La entrada de traslado necesita su salida valorizada en el mismo cierre.');value=transfers.get(transferKey)!;transfers.delete(transferKey)}
    else if(order){kind='Fabricación';counterpart=input.accounts.wip;if(!production.has(order.id))throw new Error('La fabricación necesita consumos valorizados antes de ingresar el producto terminado.');value=production.get(order.id)!;const conversion=productionCostReferences(state,productionAsOf||input.date).filter(r=>r.allocations.some(a=>a.orderId===order.id));if(conversion.some(r=>r.wipAccountId!==input.accounts.wip&&r.allocations.some(a=>a.orderId===order.id&&a.amount!==0)))throw new Error('El cierre debe conservar la cuenta de producción en proceso de las imputaciones fuente.');if(conversion.length){conversionValue=conversion.flatMap(r=>r.allocations.filter(a=>a.orderId===order.id)).reduce((n,a)=>sum(n,a.amount),0);value=sum(value,conversionValue)}production.delete(order.id)}
    else if(doc?.kind==='remito'&&doc.side==='proveedor'){
     const estimate=replay?.receipts?.get(doc.id),invoice=estimate?replay?.invoices?.get(doc.id):state.documents.find(d=>d.kind==='factura'&&d.side==='proveedor'&&d.sourceId===doc.id);kind=estimate?'Compra estimada':'Compra'
     if(!invoice&&estimate){const estimatedLine=estimate.position.lines.find(l=>l.productId===m.productId);if(!estimatedLine||quantity(estimatedLine.quantity)!==q)throw new Error('La estimación no conserva la cantidad recibida.');value=estimatedLine.estimatedValue;counterpart=estimate.position.accountId;costReference=estimate.position.reference;journal(m.branchId,input.accounts.inventory,counterpart,value)}else{
     if(!invoice||inventoryCostDate(invoice)>input.date&&!estimate)throw new Error(`El remito ${doc.number} necesita factura de compra vinculada o una estimación documentada dentro del corte.`)
     if(!replay&&state.documents.some(d=>d.side==='proveedor'&&['credito','debito'].includes(d.kind)&&d.sourceId===invoice.id&&inventoryCostDate(d)>(state.inventoryCostBatches?.[0]?.date||'')&&inventoryCostDate(d)<=input.date))throw new Error('La compra tiene una nota que modifica su costo. El cierre requiere incorporar esa corrección de costos antes de contabilizar.')
     const line=invoice.lines.find(l=>l.productId===m.productId);if(!line||quantity(line.quantity)!==q)throw new Error('La factura vinculada no conserva la cantidad recibida.')
     const original=replay?purchaseExpense(state,invoice,posting):undefined
     const t=lineTotals(line,invoice.letter);value=sum(t.net,(original?original.includeVat:state.settings.iva!=='Responsable Inscripto')?t.vat:0);amount(value);invoiceId=invoice.id
     const invoiceEntry=state.entries.find(e=>e.documentId===invoice.id&&!e.inventoryBatchId),expense=original?.amount??invoice.net+(state.settings.iva==='Responsable Inscripto'?0:invoice.vat)
     if(!invoiceEntry||expense>0&&invoiceEntry.lines[0]?.debit!==expense)throw new Error('La compra necesita su asiento original coherente para reclasificar el gasto.')
     counterpart=expense?invoiceEntry.lines[0].accountId:state.settings.accountMap.purchases
     if(!state.masters.accounts.some(a=>a.id===counterpart&&(!posting||a.postable))||counterpart===input.accounts.inventory)throw new Error('La contrapartida original de compra no admite la reclasificación a existencias.')
     if(replay){
      journal(m.branchId,input.accounts.inventory,counterpart,value)
      for(const note of replay.notes.filter(n=>n.sourceId===invoice.id)){
       if(note.date<invoice.date)throw new Error('La nota de compra no puede ser anterior a su factura para corregir costos.')
       const correction=note.lines.find(l=>l.productId===m.productId);if(!correction)continue
       const expense=purchaseExpense(state,note,posting),t=lineTotals(correction,note.letter),delta=(note.kind==='credito'?-1:1)*sum(t.net,expense.includeVat?t.vat:0)
       if(expense.accountId===input.accounts.inventory)throw new Error('La nota necesita una contrapartida original distinta de existencias.')
       value=sum(value,delta);amount(value);journal(m.branchId,input.accounts.inventory,expense.accountId,delta)
      }
     }
     if(estimate)costReference=estimate.position.reference
     }
    }else if(m.documentId)throw new Error('Entrada de stock sin una clasificación contable reconocida.')
    else {const cost=adjustmentCosts.get(m.id);if(!cost)throw new Error(`La entrada ${m.reason} requiere un costo documentado y una referencia revisada.`);value=cost.value}
    b.value=sum(b.value,value);if(!replay||kind!=='Compra'&&kind!=='Compra estimada')journal(m.branchId,input.accounts.inventory,counterpart,value)
   }
   b.quantity=(oldQ+q)/1_000_000;if(!b.quantity&&b.value)throw new Error('Quedó valor sin existencias después de la salida completa.')
   const row:InventoryCostRow={...(conversionValue!==undefined?{conversionValue}:{}),moveId:m.id,productId:m.productId,depositId:m.depositId,branchId:m.branchId,date:m.date,quantity:m.quantity,value,kind,counterpart,...(invoiceId?{invoiceId}:{}),...(creditId?{creditId}:{}),...(creditValue!==undefined?{creditValue}:{}),...(costReference?{costReference}:{})};if(replay?.reserve)replay.reserve.process(m,row,{quantity:oldQ/1_000_000,value:beforeValue},b,input);rows.push(row);pools.set(k,b)
  }
  if(transfers.size||production.size)throw new Error('El cierre contiene traslados o fabricación sin sus movimientos completos.')
 }
 const balances=[...pools.values()];balances.reduce((total,b)=>sum(total,b.value),0)
 return {sourceMoves:structuredClone(sourceMoves),rows,balances,journals:[...journals].map(([branchId,accounts])=>({branchId,lines:[...accounts].map(([accountId,a])=>({accountId,debit:Math.max(0,a.debit-a.credit),credit:Math.max(0,a.credit-a.debit)})).filter(l=>l.debit||l.credit)})).filter(j=>j.lines.length)}
}
// Reproduce los costos desde la apertura; los asientos anteriores se conservan.
const purchaseExpense=originalPurchaseExpense
type Journal=InventoryPreview['journals'][number]
function netJournals(journals:Journal[]){
 const amounts=new Map<string,{branchId:string;accountId:string;amount:number}>()
 for(const j of journals)for(const l of j.lines){const k=key(j.branchId,l.accountId),old=amounts.get(k)||{branchId:j.branchId,accountId:l.accountId,amount:0};old.amount=sum(old.amount,l.debit-l.credit);amounts.set(k,old)}
 return amounts
}
function differenceJournals(after:Journal[],before:Journal[]):Journal[]{
 const amounts=netJournals(after),old=netJournals(before),groups=new Map<string,EntryLine[]>()
 for(const [k,a] of old){const n=amounts.get(k)||{...a,amount:0};n.amount=sum(n.amount,-a.amount);amounts.set(k,n)}
 for(const a of amounts.values())if(a.amount){const lines=groups.get(a.branchId)||[];lines.push({accountId:a.accountId,debit:Math.max(0,a.amount),credit:Math.max(0,-a.amount)});groups.set(a.branchId,lines)}
 return [...groups].map(([branchId,lines])=>({branchId,lines}))
}
function noteAffectsReceivedProducts(state:State,note:Document,invoice:Document,receiptId:string){
 const products=new Set(state.stockMoves.filter(m=>m.documentId===receiptId).map(m=>m.productId))
 return products.size>0&&(note.lines.some(l=>products.has(l.productId))||note.lines.some(l=>!invoice.lines.some(i=>i.productId===l.productId)))
}
function openingNoteCandidates(state:State,openingDate:string,to:string){
 return state.documents.filter(n=>{
  if(n.side!=='proveedor'||!['credito','debito'].includes(n.kind)||inventoryCostDate(n)<=openingDate||inventoryCostDate(n)>to)return false
  const invoice=state.documents.find(d=>d.id===n.sourceId&&d.kind==='factura'&&d.side==='proveedor'),receipt=invoice&&state.documents.find(d=>d.id===invoice.sourceId&&d.kind==='remito'&&d.side==='proveedor')
  return !!receipt&&receipt.date<=openingDate&&noteAffectsReceivedProducts(state,n,invoice!,receipt.id)
 })
}
export function pendingOpeningNotes(state:State,to:string){state=inventoryCurrencyView(state,to,true);const batches=state.inventoryCostBatches||[],opening=batches[0],last=batches.at(-1);return opening?openingNoteCandidates(state,opening.date,to).filter(n=>inventoryCostDate(n)>last!.date&&!state.stockReturns?.some(r=>r.noteId===n.id)):[]}
export function openingNoteLineCosts(state:State,note:Document){
 const invoice=state.documents.find(d=>d.id===note.sourceId&&d.kind==='factura'&&d.side==='proveedor')
 if(!invoice)throw new Error('La nota necesita su factura original para asignar el costo de apertura.')
 const stockProducts=new Set(state.stockMoves.filter(m=>m.documentId===invoice.sourceId).map(m=>m.productId)),expense=purchaseExpense(state,note,false)
 return note.lines.filter(l=>stockProducts.has(l.productId)).map(l=>{const t=lineTotals(l,note.letter);return {productId:l.productId,value:sum(t.net,expense.includeVat?t.vat:0)}})
}
function assertOpeningPurchaseCost(state:State,invoice:Document,to:string){
 const original=purchaseExpense(state,invoice,false),received=new Set(state.stockMoves.filter(m=>m.documentId===invoice.sourceId).map(m=>m.productId)),values=new Map(invoice.lines.filter(l=>received.has(l.productId)).map(l=>{const t=lineTotals(l,invoice.letter);return [l.productId,sum(t.net,original.includeVat?t.vat:0)]}))
 for(const note of state.documents.filter(d=>d.side==='proveedor'&&['credito','debito'].includes(d.kind)&&d.sourceId===invoice.id&&inventoryCostDate(d)<=to).map((d,i)=>({d,i})).sort((a,b)=>inventoryCostDate(a.d).localeCompare(inventoryCostDate(b.d))||a.i-b.i).map(({d})=>d)){
  const expense=purchaseExpense(state,note,false)
  for(const l of note.lines.filter(l=>received.has(l.productId))){const t=lineTotals(l,note.letter),value=(note.kind==='credito'?-1:1)*sum(t.net,expense.includeVat?t.vat:0);values.set(l.productId,amount(sum(values.get(l.productId)!,value)))}
 }
}
function validateOpeningAssignment(state:State,a:InventoryOpeningNote,opening:InventoryCostBatch,posting:boolean):InventoryOpeningNote{
 if(!a||typeof a.noteId!=='string'||typeof a.reference!=='string'||!a.reference.trim()||a.reference.trim().length>200||!Array.isArray(a.lines))throw new Error('La asignación de apertura requiere nota, líneas y fundamento de hasta 200 caracteres.')
 const note=state.documents.find(n=>n.id===a.noteId)!,invoice=state.documents.find(d=>d.id===note.sourceId)!,expected=openingNoteLineCosts(state,note)
 if(inventoryCostDate(invoice)>opening.date&&!opening.receiptCosts?.some(r=>r.receiptId===invoice.sourceId))throw new Error('La factura posterior a la apertura necesita conciliar primero la recepción y su devengamiento; no se asigna como una compra anterior.')
 const lines=validateOpeningDestinations(state,a.lines,expected,opening,posting)
 return {noteId:a.noteId,reference:a.reference.trim(),lines}
}
function applyOpeningAssignment(state:State,note:Document,a:Pick<InventoryOpeningNote,'lines'>,balances:InventoryBalance[],journals:Journal[],accounts:InventoryAccounts,signedProducts?:Map<string,number>){
 const expense=purchaseExpense(state,note,false),sign=note.kind==='credito'?-1:1
 if(expense.accountId===accounts.inventory)throw new Error('La nota necesita una contrapartida original distinta de existencias.')
 const balanceChanges=new Map<InventoryBalance,number>()
 const append=(branchId:string,debitId:string,creditId:string,value:number)=>{if(!value)return;journals.push({branchId,lines:[{accountId:debitId,debit:Math.max(0,value),credit:Math.max(0,-value)},{accountId:creditId,debit:Math.max(0,-value),credit:Math.max(0,value)}]})}
 for(const l of a.lines){const value=(signedProducts?Math.sign(signedProducts.get(l.sourceProductId)!):sign)*l.value;let branchId:string,accountId:string
  if(l.target==='Existencias'){const b=balances.find(b=>b.productId===l.productId&&b.depositId===l.depositId)!;balanceChanges.set(b,sum(balanceChanges.get(b)||0,value));branchId=b.branchId;accountId=accounts.inventory}
  else {branchId=l.branchId;accountId=l.accountId}
  if(branchId===note.branchId)append(branchId,accountId,expense.accountId,value)
  else {append(note.branchId,accounts.transit,expense.accountId,value);append(branchId,accountId,accounts.transit,value)}
 }
 for(const [balance,delta] of balanceChanges)balance.value=amount(sum(balance.value,delta))
}
function previewInventoryCostBase(state:State,input:InventoryCostInput,previous?:InventoryCostBatch,posting=true,originDates?:Map<string,string>,withReserve=false,originalBatches?:InventoryCostBatch[],productionAsOf?:string):InventoryPreview{
 const receiptsEnabled=input.costVersion===undefined||input.costVersion===5;if(!receiptsEnabled&&(input.receiptCosts!==undefined||input.openingInvoices!==undefined))throw new Error('La versión anterior no admite estimaciones o conciliaciones de recepción.');
 if(input.costVersion===1){if(input.returnCosts!==undefined)throw new Error('La versión anterior no admite costos de devoluciones.');if(input.openingNotes!==undefined)throw new Error('La versión anterior no admite asignaciones de notas de apertura.');return calculateSegment(state,input,previous,posting,undefined,productionAsOf)}
 if(input.costVersion!==undefined&&input.costVersion!==2&&input.costVersion!==3&&input.costVersion!==4&&input.costVersion!==5)throw new Error('Versión de valuación desconocida.')
 const returnsEnabled=input.costVersion===undefined||input.costVersion===4||input.costVersion===5
 if(!returnsEnabled&&input.returnCosts!==undefined)throw new Error('La versión anterior no admite costos de devoluciones.');const returnSources=returnsEnabled?(state.stockReturns||[]).filter(r=>r.date<=input.date).map(r=>{const note=state.documents.find(d=>d.id===r.noteId);if(!r.noteId||!note||inventoryCostDate(note)>input.date)throw new Error('Cada devolución física necesita su nota de crédito dentro del corte para contabilizar costos.');return {id:r.id,side:r.side,date:r.date,sourceId:r.sourceId,depositId:r.depositId,noteId:note.id,noteDate:note.date,...(note.inventoryCostDate?{noteCostDate:note.inventoryCostDate}:{}),lines:r.lines.map(l=>({productId:l.productId,quantity:l.quantity}))}}):[]
 const excludedNotes=returnsEnabled?new Set((state.stockReturns||[]).filter(r=>r.noteId).map(r=>r.noteId)):new Set<string>();if(returnsEnabled&&(state.stockReturns||[]).some(r=>r.side==='proveedor'&&r.noteId&&r.date>input.date&&state.documents.some(d=>d.id===r.noteId&&inventoryCostDate(d)<=input.date)))throw new Error('La nota de devolución necesita el movimiento físico dentro del corte.');
 const openingEnabled=input.costVersion!==2
 if(!openingEnabled&&input.openingNotes!==undefined)throw new Error('La versión anterior no admite asignaciones de notas de apertura.')
 if(!previous){if(input.openingNotes!==undefined&&(!Array.isArray(input.openingNotes)||input.openingNotes.length)||input.openingInvoices!==undefined&&(!Array.isArray(input.openingInvoices)||input.openingInvoices.length))throw new Error('Las asignaciones se incorporan después de la apertura.');const records=receiptsEnabled?receiptEstimateRecords(state,[{...input,costVersion:5}],originDates):undefined,preview=calculateSegment(state,input,undefined,posting,records?{notes:[],receipts:records}:undefined,productionAsOf),receipts=records?receiptPositions(state,records,input.date):[];return {...preview,...(receipts.length?{receipts,settlements:[]} :{}),...(returnSources.length?{returnSources}:{})}}
 if(posting)assertDate(state,input.date)
 const history=(state.inventoryCostBatches||[]).filter(b=>b.date<=previous.date),opening=history[0]
 if(!opening||history.at(-1)?.id!==previous.id)throw new Error('Falta el historial de apertura para reproducir los costos.')
 if(receiptsEnabled&&state.documents.some(i=>i.side==='proveedor'&&i.kind==='factura'&&inventoryCostDate(i)>opening.date&&inventoryCostDate(i)<=input.date&&!opening.receiptCosts?.some(r=>r.receiptId===i.sourceId)&&state.documents.some(r=>r.id===i.sourceId&&r.kind==='remito'&&r.date<=opening.date&&state.stockMoves.some(m=>m.documentId===r.id&&m.quantity>0))))throw new Error('La recepción anterior a la apertura no conserva su devengamiento estimado. Conciliá primero la migración; no se reclasifica automáticamente esta factura.');
 const records=receiptsEnabled?receiptEstimateRecords(state,[...history.map(b=>({...b,costVersion:b.costVersion||1})),{...input,costVersion:5}],originDates):undefined,positions=records?receiptPositions(state,records,input.date):[]
 const invoices=new Map<string,Document>(),newInvoices:Document[]=[],invoiceAssignments=new Map<string,InventoryOpeningInvoice>()
 if(records)for(const record of records.values()){const invoice=state.documents.find(i=>i.kind==='factura'&&i.side==='proveedor'&&i.sourceId===record.receipt.id&&inventoryCostDate(i)<=input.date);if(invoice){invoiceReceiptCosts(state,invoice,record.receipt);if(inventoryCostDate(invoice)>previous.date)newInvoices.push(invoice);else invoices.set(record.receipt.id,invoice)}}
 for(const segment of [...history.slice(1),input]){if(segment.openingInvoices!==undefined&&!Array.isArray(segment.openingInvoices))throw new Error('Las conciliaciones de facturas de apertura deben ser una lista.');const from=segment===input?previous.date:history[history.findIndex(b=>b.id===(segment as InventoryCostBatch).id)-1].date;for(const a of segment.openingInvoices||[]){const invoice=state.documents.find(i=>i.id===a.invoiceId&&i.kind==='factura'&&i.side==='proveedor'),record=invoice&&records?.get(invoice.sourceId);if(!record||record.receipt.date>opening.date||!invoice||inventoryCostDate(invoice)<=from||inventoryCostDate(invoice)>segment.date||invoiceAssignments.has(a.invoiceId)||typeof a.reference!=='string'||!a.reference.trim()||a.reference.trim().length>200)throw new Error('La conciliación de apertura necesita una factura pendiente de recepción estimada y fundamento, sin repeticiones.');const expected=openingInvoiceDifferences(state,invoice,record);invoiceAssignments.set(invoice.id,{invoiceId:invoice.id,reference:a.reference.trim(),lines:validateOpeningDestinations(state,a.lines,expected,opening,posting&&segment===input)})}}
 if(records)for(const r of records.values()){const invoice=state.documents.find(i=>i.kind==='factura'&&i.side==='proveedor'&&i.sourceId===r.receipt.id&&inventoryCostDate(i)<=input.date);if(r.receipt.date<=opening.date&&invoice&&!invoiceAssignments.has(invoice.id))throw new Error('La factura de recepción estimada en la apertura necesita su reparto revisado de diferencias, incluso si la diferencia es cero.')}

 const invoiceIds=new Set(sortedMoves(state,opening.date,input.date).filter(m=>m.quantity>0&&m.documentId&&state.documents.some(d=>d.id===m.documentId&&d.kind==='remito'&&d.side==='proveedor')).map(m=>state.documents.find(d=>d.kind==='factura'&&d.side==='proveedor'&&d.sourceId===m.documentId)?.id).filter(Boolean))
 for(const note of state.documents.filter(d=>d.side==='proveedor'&&['credito','debito'].includes(d.kind)&&inventoryCostDate(d)>opening.date&&inventoryCostDate(d)<=input.date)){
  const invoice=state.documents.find(d=>d.id===note.sourceId&&d.kind==='factura'&&d.side==='proveedor'),receipt=invoice&&state.documents.find(d=>d.id===invoice.sourceId&&d.kind==='remito'&&d.side==='proveedor')
  if(!openingEnabled&&receipt&&receipt.date<=opening.date&&state.stockMoves.some(m=>m.documentId===receipt.id))throw new Error('La nota afecta una compra anterior a la apertura. Falta una asignación revisada del costo de apertura para corregirla.')
 }
 const openingNotes=openingEnabled?openingNoteCandidates(state,opening.date,input.date).filter(n=>!excludedNotes.has(n.id)):[]
 for(const n of openingNotes)invoiceIds.add(n.sourceId)
 const notes=state.documents.filter(d=>d.side==='proveedor'&&['credito','debito'].includes(d.kind)&&invoiceIds.has(d.sourceId)&&!excludedNotes.has(d.id)&&inventoryCostDate(d)>opening.date&&inventoryCostDate(d)<=input.date).map((d,i)=>({d,i})).sort((a,b)=>inventoryCostDate(a.d).localeCompare(inventoryCostDate(b.d))||a.i-b.i).map(({d})=>d)
 for(const note of notes){const invoice=state.documents.find(d=>d.id===note.sourceId)!;if(openingNotes.some(n=>n.sourceId===invoice.id))assertOpeningPurchaseCost(state,invoice,input.date);if(note.branchId!==invoice.branchId||note.partyId!==invoice.partyId||note.letter!==invoice.letter||note.date<invoice.date||note.lines.some(l=>!invoice.lines.some(i=>i.productId===l.productId)))throw new Error('La corrección requiere una nota vinculada con artículos, clase, sucursal y proveedor de la factura original.');purchaseExpense(state,note,false)}
 const assignments=new Map<string,InventoryOpeningNote>()
 for(const segment of [...history.slice(1),input]){
  if(segment.openingNotes!==undefined&&!Array.isArray(segment.openingNotes))throw new Error('Las asignaciones de notas de apertura deben ser una lista.')
  const from=segment===input?previous.date:history[history.findIndex(b=>b.id===(segment as InventoryCostBatch).id)-1].date
  for(const a of segment.openingNotes||[]){if(assignments.has(a.noteId)||!openingNotes.some(n=>n.id===a.noteId&&inventoryCostDate(n)>from&&inventoryCostDate(n)<=segment.date))throw new Error('La asignación necesita una nota de compra anterior a la apertura pendiente en ese corte, sin repeticiones.');assignments.set(a.noteId,validateOpeningAssignment(state,a,opening,posting&&segment===input))}
 }
 for(const n of openingNotes)if(!assignments.has(n.id))throw new Error('La nota afecta una compra anterior a la apertura. Completá su asignación revisada entre existencias de apertura y resultados anteriores.')
 const replay=(recognized:Document[])=>{
  const first=calculateSegment(state,opening,undefined,false,records?{notes:[],receipts:records}:undefined,productionAsOf),journals=[...first.journals],sales=returnsEnabled?new Map<string,SaleCost>():undefined;
  if(records)for(const r of records.values())if(r.receipt.date<=opening.date){const invoice=invoices.get(r.receipt.id);if(invoice){const expense=purchaseExpense(state,invoice,false);if(expense.accountId===opening.accounts.inventory)throw new Error('La factura requiere una cuenta de compras distinta de existencias.');journals.push({branchId:r.receipt.branchId,lines:[{accountId:r.position.accountId,debit:r.position.estimatedValue,credit:0},{accountId:expense.accountId,debit:0,credit:r.position.estimatedValue}].filter(l=>l.debit||l.credit)});const a=invoiceAssignments.get(invoice.id)!;applyOpeningAssignment(state,invoice,a,first.balances,journals,opening.accounts,new Map(openingInvoiceDifferences(state,invoice,r).map(l=>[l.productId,l.value])))}}
  for(const n of recognized.filter(n=>assignments.has(n.id)))applyOpeningAssignment(state,n,assignments.get(n.id)!,first.balances,journals,opening.accounts)
  const reserve=withReserve?createInventoryReserveFlow({...state,inventoryCostBatches:originalBatches||state.inventoryCostBatches},input,opening.balances,opening.reserve?.balances||[],input.accounts):undefined;if(reserve){journals.push(...reserve.openingJournals);reserve.sync(first.balances)}
  let balance=first.balances,last:InventoryPreview=first
  for(const segment of [...history.slice(1),input]){const prior={...opening,date:segment===input?previous.date:history[history.findIndex(b=>b.id===(segment as InventoryCostBatch).id)-1].date,balances:balance};last=calculateSegment(state,segment,prior,segment===input&&posting,{notes:recognized,sales,openingDate:opening.date,receipts:records,invoices,reserve},productionAsOf);balance=last.balances;journals.push(...last.journals)}
  if(reserve){const proof=reserve.snapshot(balance);journals.push(...reserve.journalRows());last={...last,reserve:proof,rows:last.rows.map(r=>{const v=proof.rows.find(v=>v.moveId===r.moveId)!;return {...r,allowanceUsed:v.used,allowanceRestored:v.restored,netValue:v.netValue}})}}
  return {last,journals}
 }
 let recognized=notes.filter(n=>inventoryCostDate(n)<=previous.date),result=replay(recognized)
 const settlements:InventoryInvoiceSettlement[]=[]
 for(const invoice of newInvoices.sort((a,b)=>inventoryCostDate(a).localeCompare(inventoryCostDate(b)))){const record=records!.get(invoice.sourceId)!;invoices.set(record.receipt.id,invoice);const next=replay(recognized),invoiceValue=invoiceReceiptCosts(state,invoice,record.receipt).reduce((n,l)=>sum(n,l.value),0),lines=differenceJournals(next.journals,result.journals).flatMap(j=>j.lines.map(l=>({branchId:j.branchId,accountId:l.accountId,amount:l.debit-l.credit})));settlements.push({receiptId:record.receipt.id,invoiceId:invoice.id,date:invoice.date,recognitionDate:inventoryCostDate(invoice),estimatedValue:record.position.estimatedValue,invoiceValue,difference:sum(invoiceValue,-record.position.estimatedValue),...(invoiceAssignments.has(invoice.id)?{openingAssignment:invoiceAssignments.get(invoice.id)}:{}),lines});result=next}
 const corrections:InventoryCostCorrection[]=[]
 for(const note of notes.filter(n=>inventoryCostDate(n)>previous.date)){
  recognized=[...recognized,note];const next=replay(recognized),lines=differenceJournals(next.journals,result.journals).flatMap(j=>j.lines.map(l=>({branchId:j.branchId,accountId:l.accountId,amount:l.debit-l.credit}))),invoice=state.documents.find(d=>d.id===note.sourceId)!,expense=purchaseExpense(state,note,false)
  const stockProducts=new Set(state.stockMoves.filter(m=>m.documentId===invoice.sourceId).map(m=>m.productId)),value=note.lines.filter(l=>stockProducts.has(l.productId)).reduce((n,l)=>{const t=lineTotals(l,note.letter);return sum(n,sum(t.net,expense.includeVat?t.vat:0))},0)
  corrections.push({noteId:note.id,invoiceId:invoice.id,date:note.date,...(note.inventoryCostDate?{recognitionDate:note.inventoryCostDate}:{}),kind:note.kind as 'credito'|'debito',...(assignments.has(note.id)?{openingAssignment:assignments.get(note.id)}:{}),amount:(note.kind==='credito'?-1:1)*value,lines});result=next
 }
 const priorIds=new Set(history.map(b=>b.id)),priorJournals=state.entries.filter(e=>e.inventoryBatchId&&priorIds.has(e.inventoryBatchId)).map(e=>({branchId:e.branchId,lines:e.lines})),journals=differenceJournals(result.journals,priorJournals)
 if(posting&&journals.some(j=>j.lines.some(l=>!state.masters.accounts.some(a=>a.id===l.accountId&&a.postable))))throw new Error('Las cuentas que reciben la corrección deben admitir imputaciones.')
 return {...result.last,journals,corrections,...(positions.length?{receipts:positions,settlements}:{}),...(returnSources.length?{returnSources}:{})}
}
function productionGrossBatch(state:State,batch:InventoryCostBatch,date:string,memo:Map<string,InventoryPreview>){
 const k=key(batch.id,date),cached=memo.get(k);if(cached)return cached
 const index=(state.inventoryCostBatches||[]).findIndex(b=>b.id===batch.id);if(index<0)throw new Error('Falta el corte histórico para conciliar conversión.')
 const result=inventoryProductionPreview(state,{...batch,costVersion:10},state.inventoryCostBatches![index-1],false,date,true,memo);memo.set(k,result);return result
}
export function productionHistoricalReturnValue(state:State,returnId:string,productId:string,date:string,allowLegacy=false,memo=new Map<string,InventoryPreview>()){
 if(!allowLegacy&&!productionCostReferences(state,date).some(r=>r.corrections?.some(c=>c.version===3)))return undefined
 const returned=state.stockReturns?.find(r=>r.id===returnId),batch=returned&&state.inventoryCostBatches?.find(b=>b.rows.some(row=>row.kind==='Venta'&&row.productId===productId&&state.stockMoves.find(m=>m.id===row.moveId)?.documentId===returned.sourceId)),original=batch?.rows.find(row=>row.kind==='Venta'&&row.productId===productId&&state.stockMoves.find(m=>m.id===row.moveId)?.documentId===returned!.sourceId)
 if(!returned||!batch||!original)return undefined
 const source=productionGrossBatch(state,batch,date,memo).rows.find(r=>r.moveId===original.moveId);if(!source)throw new Error('Falta el costo actualizado de la entrega histórica.')
 const all=(state.stockReturns||[]).filter(r=>r.side==='cliente'&&r.sourceId===returned.sourceId&&r.lines.some(l=>l.productId===productId)).map((r,i)=>({r,i})).sort((a,b)=>a.r.date.localeCompare(b.r.date)||a.i-b.i),index=all.findIndex(v=>v.r.id===returned.id),part=(value:number,q:number,total:number)=>q===total?value:Number((BigInt(value)*BigInt(q)*2n+BigInt(total))/(2n*BigInt(total)))
 let quantityLeft=-quantity(original.quantity),valueLeft=source.value,allowanceLeft=original.allowanceUsed||0
 for(const {r}of all.slice(0,index)){const q=quantity(r.lines.find(l=>l.productId===productId)!.quantity),prior=state.inventoryCostBatches?.find(b=>b.date<=date&&b.rows.some(row=>row.kind==='Devolución cliente'&&row.productId===productId&&state.stockMoves.find(m=>m.id===row.moveId)?.returnId===r.id)),old=prior?.rows.find(row=>row.kind==='Devolución cliente'&&row.productId===productId&&state.stockMoves.find(m=>m.id===row.moveId)?.returnId===r.id),updated=prior&&productionGrossBatch(state,prior,date,memo).rows.find(row=>row.moveId===old!.moveId);if(q>quantityLeft)throw new Error('La devolución excede las cantidades de su entrega.');valueLeft=amount(sum(valueLeft,-(updated?.value??part(valueLeft,q,quantityLeft))));allowanceLeft=amount(sum(allowanceLeft,-(old?.allowanceRestored??part(allowanceLeft,q,quantityLeft))));quantityLeft-=q}
 const q=quantity(returned.lines.find(l=>l.productId===productId)!.quantity);if(index<0||q>quantityLeft||!quantityLeft)throw new Error('La devolución no conserva cantidades disponibles de su entrega.')
 return {value:part(valueLeft,q,quantityLeft),allowance:part(allowanceLeft,q,quantityLeft),reference:`${batch.number} · Costo de entrega actualizado al ${date}`,allowanceReference:`${batch.number} · Pérdida consumida en la entrega original`,sourceMoveId:original.moveId}
}
function productionReturnCosts(state:State,input:InventoryCostInput,date:string,memo:Map<string,InventoryPreview>){
 if(!input.returnCosts?.length||date<=input.date)return undefined
 const proof:InventoryProductionBridge['returnCosts']=[],costs=input.returnCosts.map(c=>{
  const returned=state.stockReturns?.find(r=>r.id===c.returnId),batch=returned&&state.inventoryCostBatches?.find(b=>b.date<input.date&&b.rows.some(row=>row.kind==='Venta'&&row.productId===c.productId&&state.stockMoves.find(m=>m.id===row.moveId)?.documentId===returned.sourceId)),original=batch?.rows.find(row=>row.kind==='Venta'&&row.productId===c.productId&&state.stockMoves.find(m=>m.id===row.moveId)?.documentId===returned!.sourceId)
  if(!returned||!batch||!original)return c
  const known=productionHistoricalReturnValue(state,c.returnId,c.productId,input.date,true,memo);if(known&&known.value!==c.value)throw new Error('El costo devuelto anterior no coincide con su entrega conservada. Conciliá esa fuente antes de reestimar conversión.')
  const before=productionGrossBatch(state,batch,input.date,memo).rows.find(r=>r.moveId===original.moveId),after=productionGrossBatch(state,batch,date,memo).rows.find(r=>r.moveId===original.moveId);if(!before||!after)throw new Error('La devolución perdió el costo bruto de su entrega histórica.')
  const all=(state.stockReturns||[]).filter(r=>r.side==='cliente'&&r.sourceId===returned.sourceId&&r.lines.some(l=>l.productId===c.productId)).map((r,i)=>({r,i})).sort((a,b)=>a.r.date.localeCompare(b.r.date)||a.i-b.i),index=all.findIndex(v=>v.r.id===returned.id),earlier=all.slice(0,index).reduce((n,v)=>sum(n,quantity(v.r.lines.find(l=>l.productId===c.productId)!.quantity)),0),q=quantity(returned.lines.find(l=>l.productId===c.productId)!.quantity),total=-quantity(original.quantity)
  if(index<0||earlier+q>total)throw new Error('La devolución histórica excede la entrega conservada.')
  const part=(value:number,units:number)=>units===total?value:Number((BigInt(value)*BigInt(units)*2n+BigInt(total))/(2n*BigInt(total))),delta=sum(part(after.value,earlier+q)-part(before.value,earlier+q),-(part(after.value,earlier)-part(before.value,earlier))),value=amount(sum(c.value,delta))
  if(delta)proof.push({returnId:c.returnId,productId:c.productId,sourceMoveId:original.moveId,before:c.value,after:value})
  return {...c,value}
 });return {input:{...input,returnCosts:costs},proof}
}
function productionRecoveryBridge(state:State,input:InventoryCostInput,view:State,date:string,memo:Map<string,InventoryPreview>){
 const opening=view.inventoryCostBatches?.[0],recovery=opening&&(state.inventoryRecoveries||[]).find(r=>opening.id===`inventory-currency-base:${r.id}`)
 if(!opening||!recovery)return undefined
 const source=state.inventoryCostBatches?.find(b=>b.id===recovery.preview.source.batchId);if(!source||source.date>recovery.date||source.date>=input.date)throw new Error('La base de VNR no conserva un corte anterior para conciliar conversión.')
 const before=productionGrossBatch(state,source,source.date,memo),after=productionGrossBatch(state,source,date,memo),lookup=new Map(after.balances.map(b=>[key(b.productId,b.depositId),b])),original=new Map(source.balances.map(b=>[key(b.productId,b.depositId),b]))
 if(before.balances.length!==source.balances.length||before.balances.some(b=>{const old=original.get(key(b.productId,b.depositId));return !old||old.quantity!==b.quantity||old.value!==b.value}))throw new Error('El costo bruto anterior no reproduce la base de VNR conservada.')
 const balances=opening.balances.map(b=>{const old=original.get(key(b.productId,b.depositId)),next=lookup.get(key(b.productId,b.depositId));if(!old||!next||next.quantity!==old.quantity||b.quantity!==old.quantity)throw new Error('El puente de VNR debe conservar las cantidades por artículo y depósito.');return {productId:b.productId,depositId:b.depositId,branchId:b.branchId,before:b.value,after:amount(sum(b.value,next.value-old.value)),difference:next.value-old.value}}),journals=differenceJournals(after.journals,before.journals),inventoryDelta=journals.flatMap(j=>j.lines).filter(l=>l.accountId===opening.accounts.inventory).reduce((n,l)=>sum(n,l.debit-l.credit),0)
 if(inventoryDelta!==balances.reduce((n,b)=>sum(n,b.difference),0))throw new Error('El puente no concilia el costo bruto del inventario con su diario histórico.')
 const updated={...opening,balances:opening.balances.map(b=>({...b,value:balances.find(v=>v.productId===b.productId&&v.depositId===b.depositId)!.after})),opening:opening.opening!.map(b=>({...b,value:balances.find(v=>v.productId===b.productId&&v.depositId===b.depositId)!.after}))},openingJournals=differenceJournals(journals.map(j=>({...j,lines:j.lines.map(l=>({...l,accountId:l.accountId===opening.accounts.inventory?opening.accounts.opening:l.accountId}))})),[])
 return {view:{...view,inventoryCostBatches:[updated,...view.inventoryCostBatches!.slice(1)]},openingJournals,proof:{recoveryId:recovery.id,sourceBatchId:source.id,productionDate:date,balances,journals,returnCosts:after.productionBridge?.returnCosts||[]}}
}
function productionCurrentReserve(state:State,view:State,input:InventoryCostInput,prior:InventoryCostBatch,result:InventoryPreview,date:string,memo:Map<string,InventoryPreview>,productionLoss=false):InventoryPreview{
 const actual=state.inventoryCostBatches?.find(b=>b.id===prior.id),before=actual?productionGrossBatch(state,actual,date,memo).balances:prior.balances,flow=createInventoryReserveFlow(state,input,before,prior.reserve?.balances||[],input.accounts),historical=actual?differenceJournals(state.entries.filter(e=>e.inventoryBatchId===actual.id).map(e=>({branchId:e.branchId,lines:e.lines})),productionGrossBatch(state,actual,actual.date,memo).journals):flow.openingJournals
 for(const b of state.inventoryCostBatches||[])if(b.date<=prior.date)for(const row of b.rows.filter(r=>r.kind==='Venta')){const move=state.stockMoves.find(m=>m.id===row.moveId);if(!move)throw new Error('La desvalorización perdió su entrega histórica.');const returns=(state.inventoryCostBatches||[]).filter(v=>v.date<=prior.date).flatMap(v=>v.rows.filter(r=>r.kind==='Devolución cliente'&&r.productId===row.productId&&state.stockReturns?.find(s=>s.id===state.stockMoves.find(m=>m.id===r.moveId)?.returnId)?.sourceId===move.documentId));flow.seedSale(move.documentId,row.productId,-quantity(row.quantity),row.allowanceUsed||0,returns.reduce((n,r)=>sum(n,quantity(r.quantity)),0),returns.reduce((n,r)=>sum(n,r.allowanceRestored||0),0))}
 const pools=new Map(before.map(b=>[key(b.productId,b.depositId),structuredClone(b)]));flow.sync(before)
 for(const row of result.rows){const move=result.sourceMoves.find(m=>m.id===row.moveId)!;if(!move)throw new Error('La desvalorización perdió el movimiento del corte.');const k=key(row.productId,row.depositId),old=pools.get(k)||balanceFor(state,move),next={...old,quantity:(quantity(old.quantity)+quantity(row.quantity))/1e6,value:amount(sum(old.value,row.quantity<0?-row.value:row.value))};flow.process(move,row,old,next,input,productionLoss&&row.kind==='Fabricación'?productionOrderAllowance(state,move.documentId,input.date):undefined);pools.set(k,next)}
 const proof=flow.snapshot(result.balances),journals=differenceJournals([...result.journals,...historical,...flow.journalRows()],[])
 for(const j of journals)validJournal(view,{id:'production-reserve-proposal',date:input.date,concept:input.reference,branchId:j.branchId,documentId:'',lines:j.lines})
 return {...result,journals,reserve:proof,rows:result.rows.map(r=>{const v=proof.rows.find(v=>v.moveId===r.moveId)!;return {...r,allowanceUsed:v.used,allowanceRestored:v.restored,netValue:v.netValue}})}
}
export function previewInventoryCost(state:State,input:InventoryCostInput,previous?:InventoryCostBatch,posting=true):InventoryPreview{return inventoryProductionPreview(state,input,previous,posting,input.date,false,new Map())}
function inventoryProductionPreview(state:State,input:InventoryCostInput,previous:InventoryCostBatch|undefined,posting:boolean,productionDate:string,grossOnly:boolean,memo:Map<string,InventoryPreview>):InventoryPreview{
 const references=inventoryInflationReferences(state,input.date),recoveries=inventoryRecoveryReferences(state,input.date,false),conversion=productionCostReferences(state,productionDate),version=input.costVersion??(productionRecoveryReferences(state,input.date).length?11:conversion.some(r=>r.corrections?.some(c=>c.version===3))?10:conversion.some(r=>r.corrections?.length)?9:conversion.length||productionOrdersForCost(state,input.date,previous?.date||'').length?8:recoveries.length?7:references.length?6:5);state={...state,productionCosts:version>=8?(state.productionCosts||[]).filter(r=>r.date<=productionDate):[]}
 if(posting){assertInventoryInflationReady(state,input.date);assertProductionInflationReady(state,input.date)}
 if(version!==6&&version!==7&&version!==8&&version!==9&&version!==10&&version!==11)return previewInventoryCostBase(state,input,previous,posting)
 if(version>=8&&productionOrdersForCost(state,input.date,previous?.date||'').some(id=>!state.productionCosts?.some(r=>r.date<=input.date&&r.preview.orders.some(o=>o.id===id))))throw new Error('Revisá y conservá la imputación completa de conversión de cada lote terminado antes de valuarlo, incluso si no tuvo costos adicionales.');
 if(version===6&&!references.length)throw new Error('La valuación en moneda de cierre perdió su conciliación fuente.')
 if((version===7||version>=8&&recoveries.length>0)&&(!recoveries.length||input.accounts.stockAllowance!==state.inventoryRecoveries![0].allowanceAccountId))throw new Error('La valuación neta necesita la cuenta y evaluación de desvalorización conservadas.');const reserveEnabled=version===11||version===7||version>=8&&recoveries.length>0;let view=inventoryCurrencyView(state,input.date,reserveEnabled);const bridge=version>=10?productionRecoveryBridge(state,input,view,productionDate,memo):undefined;if(bridge)view=bridge.view;const prior=previous&&view.inventoryCostBatches?.find(b=>b.id===previous.id)||view.inventoryCostBatches?.filter(b=>b.date<input.date).at(-1)
 const returns=version>=10?productionReturnCosts(state,input,productionDate,memo):undefined,returnProofs=[...(bridge?.proof.returnCosts||[]),...(returns?.proof||[])];if(version>=10)view={...view,inventoryCostBatches:(view.inventoryCostBatches||[]).map(b=>{if(b.date>input.date)return b;const change=productionReturnCosts(state,b,productionDate,memo);returnProofs.push(...(change?.proof||[]));return {...b,...change?.input}})};const calculation=returns?.input||input
 if(posting&&version>=10)for(const c of input.returnCosts||[]){const known=productionHistoricalReturnValue(state,c.returnId,c.productId,input.date);if(known&&(known.value!==c.value||c.allowance!==undefined&&known.allowance!==c.allowance))throw new Error('El costo o la pérdida de la devolución no coinciden con la entrega actualizada. Revisá la propuesta histórica antes de conservarla.')}
 let result=previewInventoryCostBase(view,{...calculation,costVersion:5},prior,posting,new Map((view.inventoryCostBatches?.[0].receipts||[]).map(r=>[r.receiptId,r.estimatedDate])),version>=10?false:reserveEnabled,state.inventoryCostBatches,version>=9?productionDate:undefined)
 if(bridge)result={...result,journals:differenceJournals([...result.journals,...bridge.openingJournals],[]),productionBridge:{...bridge.proof,returnCosts:[...new Map(returnProofs.map(r=>[key(r.returnId,r.productId),r])).values()]}}
 if(version>=10&&reserveEnabled&&!grossOnly)result=productionCurrentReserve(state,view,input,prior!,result,productionDate,memo,version===11)
 return {...result,...(version===11?{productionRecoveries:productionRecoveryReferences(state,input.date)}:{}),...(references.length?{inflation:references}:{}),...(recoveries.length?{recoveries}:{}),...(version>=8?{productionCosts:conversion}:{})}
}
export function postInventoryCost(state:State,input:InventoryCostInput,actor:Session){
 if(!canAccess(actor,'/contabilidad/inventario'))throw new Error('Tu perfil no permite contabilizar inventario.')
 const batches=state.inventoryCostBatches||[],previous=batches.at(-1)
 if(batches.some(b=>b.reference===input.reference?.trim()))throw new Error('La referencia de valuación ya existe.')
 const version=productionRecoveryReferences(state,input.date).length?11:productionCostReferences(state,input.date).some(r=>r.corrections?.some(c=>c.version===3))?10:productionCostReferences(state,input.date).some(r=>r.corrections?.length)?9:productionCostReferences(state,input.date).length||productionOrdersForCost(state,input.date,previous?.date||'').length?8:inventoryRecoveryReferences(state,input.date,false).length?7:inventoryInflationReferences(state,input.date).length?6:5;if(input.costVersion!==undefined&&input.costVersion!==version)throw new Error('Las nuevas valuaciones requieren la versión vigente del cálculo y su base conciliada.');input={...input,costVersion:version}
 const preview=previewInventoryCost(state,input,previous)
 if(typeof input.review!=='string'||input.review!==inventoryCostReview(preview))throw new Error('La revisión de costos falta o cambió. Prepará nuevamente la valuación antes de contabilizar.')
 const id=uid(),number=`INT-VC-${String(batches.length+1).padStart(8,'0')}`
 const entries:Entry[]=preview.journals.map(j=>({id:uid(),date:input.date,concept:`${number} · ${input.reference.trim()} · CPP`,branchId:j.branchId,documentId:id,inventoryBatchId:id,lines:j.lines}))
 for(const e of entries)if(e.lines.length<2||e.lines.reduce((n,l)=>sum(n,l.debit)-l.credit,0)!==0)throw new Error('La valuación produjo un asiento inválido.')
 const batch:InventoryCostBatch={...structuredClone(input),reference:input.reference.trim(),id,number,method:'CPP',...(preview.productionRecoveries?{productionRecoveries:preview.productionRecoveries}:{}),...(preview.productionCosts?{productionCosts:preview.productionCosts}:{}),...(preview.productionBridge?{productionBridge:preview.productionBridge}:{}),...(preview.reserve?{reserve:preview.reserve,recoveries:preview.recoveries}:{}),...(preview.inflation?{inflation:preview.inflation}:{}),responsible:actor.name,createdAt:new Date().toISOString(),sourceMoves:preview.sourceMoves,...(preview.receipts?{receipts:preview.receipts,settlements:preview.settlements}:{}),...(preview.returnSources?{returnSources:preview.returnSources}:{}),rows:preview.rows,...(preview.corrections?{corrections:preview.corrections}:{}),balances:preview.balances,entryIds:entries.map(e=>e.id)}
 state.entries.push(...entries);(state.inventoryCostBatches??=[]).push(batch);return batch
}
function sameMove(a:StockMove,b:StockMove){return ['id','date','productId','depositId','quantity','documentId','branchId','transferId','returnId'].every(k=>a[k as keyof StockMove]===b[k as keyof StockMove])}
const financialBalances=(rows:InventoryBalance[])=>rows.map(b=>({productId:b.productId,depositId:b.depositId,branchId:b.branchId,quantity:b.quantity,value:b.value}))
const financialLines=(lines:EntryLine[])=>lines.map(l=>({accountId:l.accountId,debit:l.debit,credit:l.credit})).sort((a,b)=>a.accountId.localeCompare(b.accountId))
export function inventoryCostReview(preview:InventoryPreview){return JSON.stringify({moves:preview.sourceMoves.map(m=>({id:m.id,date:m.date,productId:m.productId,depositId:m.depositId,quantity:m.quantity,branchId:m.branchId,documentId:m.documentId,transferId:m.transferId,returnId:m.returnId})),rows:preview.rows,balances:financialBalances(preview.balances),journals:preview.journals,...(preview.productionRecoveries?{productionRecoveries:preview.productionRecoveries}:{}),...(preview.productionCosts?{productionCosts:preview.productionCosts}:{}),...(preview.productionBridge?{productionBridge:preview.productionBridge}:{}),...(preview.reserve?{reserve:preview.reserve,recoveries:preview.recoveries}:{}),...(preview.inflation?{inflation:preview.inflation}:{}),...(preview.receipts?{receipts:preview.receipts,settlements:preview.settlements}:{}),...(preview.corrections?{corrections:preview.corrections}:{}),...(preview.returnSources?{returnSources:preview.returnSources}:{})})}
export function validateInventoryCosts(state:State){
 if(state.inventoryCostBatches!==undefined&&!Array.isArray(state.inventoryCostBatches))throw new Error('Las valuaciones de inventario deben ser una lista.')
 const batches=state.inventoryCostBatches||[],ids=new Set(batches.map(b=>b.id)),references=new Set(batches.map(b=>b.reference))
 if(ids.size!==batches.length||references.size!==batches.length)throw new Error('Valuaciones de inventario repetidas.')
 if(state.entries.some(e=>e.inventoryBatchId&&!ids.has(e.inventoryBatchId)))throw new Error('La copia perdió una valuación de inventario vinculada al diario.')
 for(const [i,b] of batches.entries()){
  if(!b.id||b.number!==`INT-VC-${String(i+1).padStart(8,'0')}`||b.method!=='CPP'||!b.responsible||typeof b.createdAt!=='string'||Number.isNaN(Date.parse(b.createdAt))||!Array.isArray(b.sourceMoves)||!Array.isArray(b.rows)||!Array.isArray(b.balances)||!Array.isArray(b.entryIds)||b.balances.some(r=>![r.sku,r.name,r.unit,r.depositName].every(s=>typeof s==='string'&&s.trim())))throw new Error('Valuación de inventario inválida en la copia.')
  if(b.costVersion!==undefined&&b.costVersion!==1&&b.costVersion!==2&&b.costVersion!==3&&b.costVersion!==4&&b.costVersion!==5&&b.costVersion!==6&&b.costVersion!==7&&b.costVersion!==8&&b.costVersion!==9&&b.costVersion!==10&&b.costVersion!==11)throw new Error('Versión de valuación desconocida.');const expected=previewInventoryCost(state,{...b,costVersion:b.costVersion||1},batches[i-1],false)
  if(JSON.stringify(b.productionRecoveries)!==JSON.stringify(expected.productionRecoveries))throw new Error('La pérdida de producción no coincide con las fuentes conservadas.');
  if(JSON.stringify(b.productionBridge)!==JSON.stringify(expected.productionBridge))throw new Error('El puente de conversión y VNR no coincide con las fuentes conservadas.');
  if(b.costVersion===10||b.costVersion===11)for(const c of b.returnCosts||[]){const known=productionHistoricalReturnValue(state,c.returnId,c.productId,b.date);if(known&&(known.value!==c.value||c.allowance!==undefined&&known.allowance!==c.allowance))throw new Error('La devolución perdió el costo o la pérdida de su entrega actualizada.')}
  if(JSON.stringify(b.productionCosts)!==JSON.stringify(expected.productionCosts))throw new Error('No se conservan las imputaciones fuente de conversión.');
  if(JSON.stringify(b.reserve)!==JSON.stringify(expected.reserve)||JSON.stringify(b.recoveries)!==JSON.stringify(expected.recoveries))throw new Error('La desvalorización y el costo neto no coinciden con la valuación.');
  if(JSON.stringify(b.inflation)!==JSON.stringify(expected.inflation))throw new Error('La base conciliada de inventario no coincide con la valuación.');
  if(JSON.stringify(b.receipts)!==JSON.stringify(expected.receipts)||JSON.stringify(b.settlements)!==JSON.stringify(expected.settlements))throw new Error('Las recepciones estimadas o conciliaciones no coinciden con los costos conservados.');
  if(JSON.stringify(b.returnSources)!==JSON.stringify(expected.returnSources))throw new Error('La devolución o nota conservada cambió después de valuar costos.');
  if(JSON.stringify(b.corrections)!==JSON.stringify(expected.corrections))throw new Error('Las correcciones de notas no concilian con la valuación.')
  if(expected.sourceMoves.length!==b.sourceMoves.length||expected.sourceMoves.some((m,n)=>!sameMove(m,b.sourceMoves[n])))throw new Error('Cambió el historial de stock cubierto por una valuación. Registrá los nuevos movimientos después del último corte.')
  if(expected.rows.length!==b.rows.length||expected.rows.some((r,n)=>!['moveId','productId','depositId','branchId','date','quantity','value','kind','counterpart','invoiceId','creditId','creditValue','costReference','allowanceUsed','allowanceRestored','netValue','conversionValue'].every(k=>r[k as keyof InventoryCostRow]===b.rows[n][k as keyof InventoryCostRow]))||JSON.stringify(financialBalances(expected.balances))!==JSON.stringify(financialBalances(b.balances)))throw new Error('Los costos y saldos de la valuación no concilian con los movimientos y compras originales.')
  if(b.review!==inventoryCostReview(expected))throw new Error('La copia perdió o alteró la revisión conservada de la valuación.')
  const entries=state.entries.filter(e=>e.inventoryBatchId===b.id)
  if(entries.length!==expected.journals.length||new Set(entries.map(e=>e.branchId)).size!==entries.length||new Set(b.entryIds).size!==b.entryIds.length||entries.length!==b.entryIds.length||entries.some(e=>!b.entryIds.includes(e.id)||e.date!==b.date||e.documentId!==b.id||!expected.journals.some(j=>j.branchId===e.branchId&&JSON.stringify(financialLines(j.lines))===JSON.stringify(financialLines(e.lines)))))throw new Error('Los asientos no concilian con la valuación de inventario.')
  if(b.reserve)assertInventoryReserveLedger({...state,entries:state.entries.filter(e=>e.date<=b.date&&(!e.inventoryRecoveryId||state.inventoryRecoveries?.find(r=>r.id===e.inventoryRecoveryId)?.date!==b.date)&&(!e.reexpressionPostingId||state.reexpressionPostings?.find(p=>p.id===e.reexpressionPostingId)?.preview.date!==b.date))},b.reserve.balances,b.reserve.allowanceAccountId);
  const ledger=new Map<string,number>(),values=new Map<string,number>()
  for(const e of state.entries.filter(e=>e.date<=b.date&&(!e.reexpressionPostingId||state.reexpressionPostings?.find(p=>p.id===e.reexpressionPostingId)?.preview.date!==b.date)))for(const l of e.lines.filter(l=>l.accountId===b.accounts.inventory))ledger.set(e.branchId,sum(ledger.get(e.branchId)||0,l.debit-l.credit))
  for(const r of b.balances)values.set(r.branchId,sum(values.get(r.branchId)||0,r.value))
  if(b.receipts?.length){const liabilities=new Map<string,number>(),expectedLiabilities=new Map<string,number>();for(const r of b.receipts){const k=key(r.branchId,r.accountId);expectedLiabilities.set(k,sum(expectedLiabilities.get(k)||0,r.invoiceId?0:-r.estimatedValue))}for(const k of expectedLiabilities.keys()){const [branchId,accountId]=JSON.parse(k);for(const e of state.entries.filter(e=>e.date<=b.date&&e.branchId===branchId))for(const l of e.lines.filter(l=>l.accountId===accountId))liabilities.set(k,sum(liabilities.get(k)||0,l.debit-l.credit));if((liabilities.get(k)||0)!==expectedLiabilities.get(k))throw new Error('La deuda contable por mercadería sin facturar no concilia con las recepciones pendientes.')}}
  if([...new Set([...ledger.keys(),...values.keys()])].some(branch=>(ledger.get(branch)||0)!==(values.get(branch)||0)))throw new Error('El saldo contable de existencias no concilia con la valuación por sucursal.')
 }
}
