import {inventoryCostDate} from './inventory-dates'
import type {State,Session,StockReturnInput,StockReturn} from './types'
import {assertDate,assertStockCostDate} from './engine'
import {validTransferQuantity,assertStockOutflow} from './stock-transfers'
import {canAccess} from './permissions'
import {uid} from './constants'
const micros=(q:number)=>Math.round(q*1_000_000)
export function remainingReturnLines(state:State,sourceId:string){
 const source=state.documents.find(d=>d.id===sourceId&&d.kind==='remito')
 if(!source)return []
 return source.lines.filter(l=>state.stockMoves.some(m=>m.documentId===source.id&&m.productId===l.productId)).map(l=>({...l,quantity:(micros(l.quantity)-(state.stockReturns||[]).filter(r=>r.sourceId===sourceId).flatMap(r=>r.lines).filter(r=>r.productId===l.productId).reduce((n,r)=>n+micros(r.quantity),0))/1_000_000})).filter(l=>l.quantity>0)
}
function checkNote(state:State,r:Pick<StockReturn,'id'|'date'|'sourceId'|'side'|'branchId'|'lines'>,noteId:string){
 const note=state.documents.find(d=>d.id===noteId&&d.kind==='credito'),invoice=note&&state.documents.find(d=>d.id===note.sourceId&&d.kind==='factura'),source=state.documents.find(d=>d.id===r.sourceId)
 if(!note||!invoice||invoice.sourceId!==r.sourceId||note.side!==r.side||note.branchId!==r.branchId||note.partyId!==source?.partyId||note.letter!==invoice.letter||note.date<invoice.date)throw new Error('La devolución requiere una nota de crédito de la factura vinculada al remito, con la misma contraparte, sucursal y clase.')
 if((state.stockReturns||[]).some(x=>x.id!==r.id&&x.noteId===noteId))throw new Error('La nota ya está vinculada a otra devolución.')
 const physical=note.lines.filter(l=>state.stockMoves.some(m=>m.documentId===r.sourceId&&m.productId===l.productId))
 if(physical.length!==r.lines.length||r.lines.some(l=>!physical.some(n=>n.productId===l.productId&&micros(n.quantity)===micros(l.quantity))))throw new Error('Los artículos y cantidades físicos de la nota deben coincidir exactamente con la devolución.')
 if(note.lines.some(l=>!invoice.lines.some(i=>i.productId===l.productId)))throw new Error('La nota de devolución contiene artículos ajenos a la factura original.')
 return note
}
export function registerStockReturn(state:State,input:StockReturnInput,actor:Session){
 if(!canAccess(actor,'/stock/devoluciones'))throw new Error('Tu perfil no permite registrar devoluciones.')
 assertDate(state,input.date);assertStockCostDate(state,input.date)
 const source=state.documents.find(d=>d.id===input.sourceId&&d.kind==='remito'),deposit=state.masters.deposits.find(d=>d.id===input.depositId&&d.active!==false)
 if(!source||!deposit||deposit.branchId!==source.branchId||!state.masters.branches.some(b=>b.id===source.branchId&&b.active)||input.date<source.date)throw new Error('Elegí un remito y depósito de su sucursal activa; la devolución no puede ser anterior al remito.')
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100||new Set(input.lines.map(l=>l.productId)).size!==input.lines.length)throw new Error('La devolución necesita motivo y entre 1 y 100 artículos sin repeticiones.')
 const remaining=remainingReturnLines(state,source.id),lines=input.lines.map(l=>{
  const p=state.products.find(p=>p.id===l.productId&&p.kind==='Producto'),pending=remaining.find(x=>x.productId===l.productId)
  if(!p||!pending||!validTransferQuantity(l.quantity)||micros(l.quantity)>micros(pending.quantity))throw new Error('La cantidad devuelta debe ser positiva, hasta seis decimales y no superar lo recibido o entregado pendiente de devolución.')
  assertStockOutflow(state,p.id,deposit.id,input.date,source.side==='proveedor'?l.quantity:-l.quantity,source.side==='cliente'||p.negative,p.sku)
  return {productId:p.id,quantity:l.quantity,sku:p.sku,description:p.name,unit:p.unit}
 })
 const r:StockReturn={id:uid(),number:`INT-DV-${String((state.stockReturns||[]).length+1).padStart(8,'0')}`,date:input.date,sourceId:source.id,sourceNumber:source.number,side:source.side,branchId:source.branchId,depositId:deposit.id,depositName:String(deposit.name),partyName:state.parties.find(p=>p.id===source.partyId)?.name||'',responsible:actor.name,reason:input.reason.trim(),lines}
 if(input.noteId){const note=checkNote(state,r,input.noteId);if(r.side==='proveedor'&&state.inventoryCostBatches?.at(-1)&&inventoryCostDate(note)<=state.inventoryCostBatches.at(-1)!.date)throw new Error('La nota ya está cubierta por un corte de costos; no puede reclasificarse como devolución.');r.noteId=note.id;r.noteNumber=note.number;r.noteDate=note.date}
 state.stockMoves.push(...lines.map(l=>({id:uid(),date:r.date,productId:l.productId,depositId:r.depositId,quantity:r.side==='cliente'?l.quantity:-l.quantity,reason:r.number,documentId:'',branchId:r.branchId,returnId:r.id})))
 ;(state.stockReturns??=[]).push(r);return r
}
export function linkStockReturnNote(state:State,id:string,noteId:string,actor:Session){
 if(!canAccess(actor,'/stock/devoluciones'))throw new Error('Tu perfil no permite vincular devoluciones.')
 const r=state.stockReturns?.find(r=>r.id===id);if(!r||r.noteId)throw new Error('Elegí una devolución pendiente de nota; un vínculo conservado no se reemplaza.')
 assertDate(state,r.date);assertStockCostDate(state,r.date);const note=checkNote(state,r,noteId)
 if(r.side==='proveedor'&&state.inventoryCostBatches?.at(-1)&&inventoryCostDate(note)<=state.inventoryCostBatches.at(-1)!.date)throw new Error('La nota ya está cubierta por un corte de costos; no puede reclasificarse como devolución.')
 r.noteId=note.id;r.noteNumber=note.number;r.noteDate=note.date;return r
}
export function validateStockReturns(state:State){
 if(state.stockReturns!==undefined&&!Array.isArray(state.stockReturns))throw new Error('Las devoluciones deben ser una lista.')
 const returns=state.stockReturns||[],ids=new Set(returns.map(r=>r.id)),totals=new Map<string,number>()
 if(ids.size!==returns.length||state.stockMoves.some(m=>m.returnId!==undefined&&(!m.returnId||!ids.has(m.returnId))))throw new Error('La copia perdió o repitió una devolución de stock.')
 for(const [i,r] of returns.entries()){
  const source=state.documents.find(d=>d.id===r.sourceId&&d.kind==='remito'),deposit=state.masters.deposits.find(d=>d.id===r.depositId)
  if(!r.id||r.number!==`INT-DV-${String(i+1).padStart(8,'0')}`||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date))||new Date(`${r.date}T12:00:00Z`).toISOString().slice(0,10)!==r.date||!source||!deposit||r.side!==source.side||r.branchId!==source.branchId||deposit.branchId!==r.branchId||r.date<source.date||![r.sourceNumber,r.depositName,r.partyName,r.responsible,r.reason].every(v=>typeof v==='string'&&v.trim())||!Array.isArray(r.lines)||!r.lines.length||r.lines.length>100||new Set(r.lines.map(l=>l.productId)).size!==r.lines.length)throw new Error('Devolución de stock inválida en la copia.')
  const moves=state.stockMoves.filter(m=>m.returnId===r.id);if(moves.length!==r.lines.length)throw new Error('La devolución perdió sus movimientos de stock.')
  for(const l of r.lines){const original=source.lines.find(x=>x.productId===l.productId),k=JSON.stringify([r.sourceId,l.productId]),q=(totals.get(k)||0)+micros(l.quantity);if(!original||!validTransferQuantity(l.quantity)||q>micros(original.quantity)||![l.sku,l.description,l.unit].every(v=>typeof v==='string'&&v.trim())||!state.products.some(p=>p.id===l.productId&&p.kind==='Producto'&&p.unit===l.unit)||!state.stockMoves.some(m=>m.documentId===source.id&&m.productId===l.productId)||moves.filter(m=>m.productId===l.productId&&m.depositId===r.depositId&&m.branchId===r.branchId&&m.date===r.date&&m.quantity===(r.side==='cliente'?l.quantity:-l.quantity)&&m.documentId===''&&!m.transferId).length!==1)throw new Error('Los artículos, cantidades o movimientos de la devolución no concilian con el remito original.');totals.set(k,q)}
  if(r.noteId){const note=checkNote(state,r,r.noteId);if(r.noteNumber!==note.number||r.noteDate!==note.date)throw new Error('La nota vinculada cambió después de la devolución.')}else if(r.noteDate||r.noteNumber)throw new Error('La devolución perdió la nota que identificaba.')
 }
}
