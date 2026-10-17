import {inventoryCurrencyView} from './inventory-inflation-model'
import {inventoryCostDate} from './inventory-dates'
import type {State,Document,InventoryCostInput,InventoryCostBatch,InventoryReceiptEstimate,InventoryReceiptPosition,InventoryOpeningNote} from './types'
import {lineTotals} from './engine'

const cents=(v:number)=>{if(!Number.isSafeInteger(v)||v<0)throw new Error('La estimación requiere importes no negativos en centavos seguros.');return v}
const add=(a:number,b:number)=>{const v=a+b;if(!Number.isSafeInteger(v))throw new Error('La estimación supera el rango de importes.');return v}
export function originalPurchaseExpense(state:State,doc:Document,posting:boolean){
 const entry=state.entries.find(e=>e.documentId===doc.id&&!e.inventoryBatchId),line=entry?.lines[0],credit=doc.kind==='credito',value=line?.[credit?'credit':'debit']
 if(!line||value!==doc.net&&value!==doc.net+doc.vat||line[credit?'debit':'credit']!==0||!state.masters.accounts.some(a=>a.id===line.accountId&&(!posting||a.postable)))throw new Error('La compra o nota necesita su asiento original coherente para corregir costos.')
 return {accountId:line.accountId,amount:value,includeVat:doc.vat>0&&value===doc.net+doc.vat}
}
export function receivedLines(state:State,receipt:Document){return receipt.lines.filter(l=>state.stockMoves.some(m=>m.documentId===receipt.id&&m.productId===l.productId&&m.quantity>0))}
export function pendingInventoryReceipts(state:State,to:string,from=state.inventoryCostBatches?.at(-1)?.date||''){
 return state.documents.filter(d=>d.side==='proveedor'&&d.kind==='remito'&&d.date>from&&d.date<=to&&receivedLines(state,d).length&&!state.documents.some(i=>i.kind==='factura'&&i.side==='proveedor'&&i.sourceId===d.id&&inventoryCostDate(i)<=to))
}
export interface ReceiptEstimateRecord {estimate:InventoryReceiptEstimate;receipt:Document;segment:InventoryCostInput;position:InventoryReceiptPosition}
export function receiptEstimateRecords(state:State,segments:InventoryCostInput[],originDates?:Map<string,string>):Map<string,ReceiptEstimateRecord>{
 const records=new Map<string,ReceiptEstimateRecord>()
 for(const [index,segment] of segments.entries()){
  if(segment.receiptCosts!==undefined&&(!Array.isArray(segment.receiptCosts)||segment.receiptCosts.length>1000))throw new Error('Las estimaciones de recepciones deben ser una lista de hasta 1000 remitos.')
  if(segment.receiptCosts?.length&&!segment.accounts.unbilled)throw new Error('Prepará y seleccioná una cuenta de pasivo para mercadería recibida sin facturar.')
  const pending=pendingInventoryReceipts(state,segment.date,index?segments[index-1].date:''),saved=(segment as InventoryCostBatch).receipts||[]
  for(const estimate of segment.receiptCosts||[]){
   const receipt=pending.find(d=>d.id===estimate.receiptId)
   if(!receipt||records.has(estimate.receiptId)||typeof estimate.reference!=='string'||!estimate.reference.trim()||estimate.reference.trim().length>200||!Array.isArray(estimate.lines)||estimate.lines.length>100||new Set(estimate.lines.map(l=>l.productId)).size!==estimate.lines.length)throw new Error('La estimación necesita un remito pendiente de factura en ese corte, artículos sin repeticiones y fundamento de hasta 200 caracteres.')
   const physical=receivedLines(state,receipt),old=saved.find(r=>r.receiptId===receipt.id)
   if(physical.length!==estimate.lines.length||estimate.lines.some(l=>!physical.some(p=>p.productId===l.productId)))throw new Error('Estimá exactamente todos los artículos físicos recibidos en ese remito.')
   const lines=estimate.lines.map(l=>{cents(l.value);const source=physical.find(p=>p.productId===l.productId)!,moves=state.stockMoves.filter(m=>m.documentId===receipt.id&&m.productId===l.productId);if(moves.length!==1||moves[0].quantity!==source.quantity||moves[0].date!==receipt.date||moves[0].branchId!==receipt.branchId)throw new Error('La recepción no conserva sus cantidades y movimientos físicos.');return {productId:l.productId,sku:old?.lines.find(p=>p.productId===l.productId)?.sku||state.products.find(p=>p.id===l.productId)!.sku,quantity:source.quantity,estimatedValue:l.value}})
   const estimatedValue=lines.reduce((n,l)=>add(n,l.estimatedValue),0),position:InventoryReceiptPosition={receiptId:receipt.id,number:old?.number||receipt.number,date:receipt.date,branchId:receipt.branchId,partyId:receipt.partyId,partyName:old?.partyName||state.parties.find(p=>p.id===receipt.partyId)?.name||'',estimatedDate:originDates?.get(receipt.id)||segment.date,reference:estimate.reference.trim(),accountId:segment.accounts.unbilled!,lines,estimatedValue}
   records.set(receipt.id,{estimate,receipt,segment,position})
  }
  if((segment.costVersion===5||segment.costVersion===undefined)&&pending.some(r=>!records.has(r.id)))throw new Error('Cada recepción física sin factura dentro del corte necesita una estimación documentada, incluso en la apertura.')
 }
 return records
}
export function invoiceReceiptCosts(state:State,invoice:Document,receipt:Document){
 if(invoice.kind!=='factura'||invoice.side!=='proveedor'||invoice.sourceId!==receipt.id||invoice.partyId!==receipt.partyId||invoice.branchId!==receipt.branchId||invoice.lines.length!==receipt.lines.length||invoice.lines.some(l=>!receipt.lines.some(p=>p.productId===l.productId&&p.quantity===l.quantity)))throw new Error('La factura debe conservar contraparte, sucursal y cantidades del remito estimado.')
 const expense=originalPurchaseExpense(state,invoice,false)
 return receivedLines(state,receipt).map(l=>{const line=invoice.lines.find(p=>p.productId===l.productId)!,t=lineTotals(line,invoice.letter);return {productId:l.productId,value:cents(add(t.net,expense.includeVat?t.vat:0))}})
}
export function receiptPositions(state:State,records:Map<string,ReceiptEstimateRecord>,to:string){
 return [...records.values()].map(({receipt,position})=>{const invoice=state.documents.find(i=>i.side==='proveedor'&&i.kind==='factura'&&i.sourceId===receipt.id&&inventoryCostDate(i)<=to);if(!invoice)return position;const invoiceValue=invoiceReceiptCosts(state,invoice,receipt).reduce((n,l)=>add(n,l.value),0);return {...position,invoiceId:invoice.id,invoiceNumber:invoice.number,invoiceDate:invoice.date,recognitionDate:inventoryCostDate(invoice),invoiceValue,difference:add(invoiceValue,-position.estimatedValue)}})
}
export function openingInvoiceDifferences(state:State,invoice:Document,record:ReceiptEstimateRecord){return invoiceReceiptCosts(state,invoice,record.receipt).map(l=>({productId:l.productId,value:add(l.value,-record.position.lines.find(p=>p.productId===l.productId)!.estimatedValue)}))}
export function pendingOpeningInvoices(state:State,to:string){state=inventoryCurrencyView(state,to,true);const batches=state.inventoryCostBatches||[],first=batches[0],last=batches.at(-1);if(!first||!last)return [];return state.documents.filter(i=>i.kind==='factura'&&i.side==='proveedor'&&inventoryCostDate(i)>last.date&&inventoryCostDate(i)<=to&&(first.receiptCosts||[]).some(r=>r.receiptId===i.sourceId))}
export function openingInvoiceLineDifferences(state:State,invoice:Document){state=inventoryCurrencyView(state,inventoryCostDate(invoice),true);const first=state.inventoryCostBatches?.[0];if(!first)throw new Error('Falta la apertura para conciliar la factura.');const record=receiptEstimateRecords(state,[{...first,costVersion:first.costVersion||1}]).get(invoice.sourceId);if(!record)throw new Error('La factura no tiene una recepción estimada en la apertura.');return openingInvoiceDifferences(state,invoice,record)}
export function validateOpeningDestinations(state:State,lines:InventoryOpeningNote['lines'],expected:{productId:string;value:number}[],opening:InventoryCostBatch,posting:boolean){
 if(!Array.isArray(lines)||lines.length>1000)throw new Error('La asignación requiere líneas válidas, hasta 1000 destinos.')
 const totals=new Map<string,number>(),seen=new Set<string>(),result:InventoryOpeningNote['lines']=[]
 for(const l of lines){
  if(!l||!expected.some(e=>e.productId===l.sourceProductId))throw new Error('El artículo de origen de la asignación debe pertenecer al costo recibido que se corrige.')
  cents(l.value);let unique:string
  if(l.target==='Existencias'){
   if(!opening.balances.some(b=>b.productId===l.productId&&b.depositId===l.depositId&&b.quantity>0))throw new Error('La asignación a existencias necesita un artículo y depósito con saldo positivo en la apertura.')
   unique=JSON.stringify([l.sourceProductId,l.target,l.productId,l.depositId]);result.push({sourceProductId:l.sourceProductId,target:l.target,productId:l.productId,depositId:l.depositId,value:l.value})
  }else if(l.target==='Resultados'){
   if(!state.masters.branches.some(b=>b.id===l.branchId)||!state.masters.accounts.some(c=>c.id===l.accountId&&c.group==='Gastos'&&(!posting||c.postable)))throw new Error('La asignación a resultados requiere sucursal y cuenta de gastos válida.')
   unique=JSON.stringify([l.sourceProductId,l.target,l.branchId,l.accountId]);result.push({sourceProductId:l.sourceProductId,target:l.target,branchId:l.branchId,accountId:l.accountId,value:l.value})
  }else throw new Error('Destino de asignación de apertura no reconocido.')
  if(seen.has(unique))throw new Error('La asignación repite un artículo de origen y destino.');seen.add(unique);totals.set(l.sourceProductId,add(totals.get(l.sourceProductId)||0,l.value))
 }
 if(expected.some(e=>!totals.has(e.productId)||totals.get(e.productId)!==Math.abs(e.value)))throw new Error('Distribuí exactamente la magnitud de cada artículo entre existencias de apertura y resultados.')
 return result
}
