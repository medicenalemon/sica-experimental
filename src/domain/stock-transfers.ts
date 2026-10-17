import {reservedMaterialQuantity,materialReservationDays} from './production-reservations'
import type { State, Session, StockTransferInput, StockTransfer, StockMove } from './types'
import { assertDate,assertStockCostDate } from './engine'
import { uid } from './constants'
import { canAccess } from './permissions'

export function validTransferQuantity(value:number) {
 return Number.isFinite(value)&&value>=0.000001&&value<=1_000_000&&Math.abs(value*1_000_000-Math.round(value*1_000_000))<0.0001
}

// Check each day's balance after the proposed outflow, including later dated operations.
export function assertStockOutflow(state:State,productId:string,depositId:string,date:string,quantity:number,negative:boolean,name:string,exceptOrder?:string) {
 const daily=new Map<string,number>()
 for(const m of state.stockMoves.filter(m=>m.productId===productId&&m.depositId===depositId))daily.set(m.date,(daily.get(m.date)||0)+m.quantity)
 for(const day of materialReservationDays(state))if(!daily.has(day))daily.set(day,0)
 daily.set(date,(daily.get(date)||0)-quantity)
 let balance=0
 for(const [day,change] of [...daily].sort(([a],[b])=>a.localeCompare(b))) {
  balance+=change
  if(!Number.isFinite(balance)||Math.abs(balance)>Number.MAX_SAFE_INTEGER)throw new Error(`Existencias fuera de rango para ${name}.`)
  const held=reservedMaterialQuantity(state,productId,depositId,day,exceptOrder)
  if(day>=date&&held>0&&balance+0.000000001<held)throw new Error(`Material reservado de ${name} al ${day}; liberá la reserva o usá existencias disponibles.`)
  if(day>=date&&!negative&&balance< -0.000000001)throw new Error(`Stock insuficiente de ${name} en el origen al ${day}; el artículo no admite stock negativo. Revisá la fecha y las salidas posteriores.`)
 }
}

export function transferStock(state:State,input:StockTransferInput,actor:Session):StockTransfer {
 if(!canAccess(actor,'/stock/traslados'))throw new Error('Tu perfil no permite registrar traslados.')
 assertDate(state,input.date)
 assertStockCostDate(state,input.date)
 const from=state.masters.deposits.find(d=>d.id===input.fromId),to=state.masters.deposits.find(d=>d.id===input.toId)
 const active=(d:typeof from)=>d&&d.active!==false&&state.masters.branches.some(b=>b.id===d.branchId&&b.active)
 if(!active(from)||!active(to))throw new Error('Seleccioná depósitos existentes de sucursales activas.')
 if(from!.id===to!.id)throw new Error('El origen y el destino deben ser distintos.')
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)throw new Error('Indicá un motivo de hasta 1000 caracteres.')
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)throw new Error('El traslado necesita entre 1 y 100 artículos.')
 if(new Set(input.lines.map(l=>l.productId)).size!==input.lines.length)throw new Error('Agrupá cada SKU en una sola línea.')
 const lines=input.lines.map(line=>{
  const p=state.products.find(p=>p.id===line.productId&&p.kind==='Producto')
  if(!p)throw new Error('Seleccioná un SKU de mercadería existente; los servicios no se trasladan.')
  if(!validTransferQuantity(line.quantity))throw new Error('La cantidad debe ser positiva, hasta 1.000.000, con hasta seis decimales.')
  assertStockOutflow(state,p.id,from!.id,input.date,line.quantity,p.negative,p.sku)
  assertStockOutflow(state,p.id,to!.id,input.date,-line.quantity,true,p.sku)
  return {productId:p.id,quantity:line.quantity,sku:p.sku,description:p.name,unit:p.unit}
 })
 const next=(state.stockTransfers||[]).reduce((n,t)=>Math.max(n,Number(t.number.slice(7))||0),0)+1
 if(next>99_999_999)throw new Error('Se agotó la numeración de traslados internos.')
 const transfer:StockTransfer={id:uid(),number:`INT-TR-${String(next).padStart(8,'0')}`,date:input.date,fromId:from!.id,toId:to!.id,fromName:String(from!.name),toName:String(to!.name),fromBranchId:String(from!.branchId),toBranchId:String(to!.branchId),responsible:actor.name,reason:input.reason.trim(),lines}
 const moves:StockMove[]=lines.flatMap(l=>[
  {id:uid(),date:transfer.date,productId:l.productId,depositId:transfer.fromId,quantity:-l.quantity,reason:`${transfer.number} · Salida a ${transfer.toName}`,documentId:'',branchId:transfer.fromBranchId,transferId:transfer.id},
  {id:uid(),date:transfer.date,productId:l.productId,depositId:transfer.toId,quantity:l.quantity,reason:`${transfer.number} · Entrada desde ${transfer.fromName}`,documentId:'',branchId:transfer.toBranchId,transferId:transfer.id},
 ])
 // Mutate only after validating every line; both sides belong to the same command/transaction.
 state.stockMoves.push(...moves)
 ;(state.stockTransfers??=[]).push(transfer)
 return transfer
}

export function validateStockTransfers(state:State) {
 if(state.stockTransfers!==undefined&&!Array.isArray(state.stockTransfers))throw new Error('La colección de traslados debe ser una lista.')
 const transfers=state.stockTransfers||[]
 if(!Array.isArray(transfers)||new Set(transfers.map(t=>t.id)).size!==transfers.length||new Set(transfers.map(t=>t.number)).size!==transfers.length)throw new Error('Identificadores o números de traslado inválidos.')
 const ids=new Set(transfers.map(t=>t.id))
 if(state.stockMoves.some(m=>m.transferId!==undefined&&!ids.has(m.transferId)))throw new Error('La copia contiene movimientos sin su traslado.')
 const linked=new Map<string,StockMove[]>()
 for(const m of state.stockMoves)if(m.transferId){const group=linked.get(m.transferId)||[];group.push(m);linked.set(m.transferId,group)}
 for(const t of transfers) {
  if(typeof t.id!=='string'||!t.id||!/^INT-TR-\d{8}$/.test(t.number)||Number(t.number.slice(7))<1||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||Number.isNaN(Date.parse(t.date))||new Date(`${t.date}T12:00:00Z`).toISOString().slice(0,10)!==t.date||t.fromId===t.toId||![t.fromId,t.toId].every(id=>state.masters.deposits.some(d=>d.id===id))||![t.fromBranchId,t.toBranchId].every(id=>state.masters.branches.some(b=>b.id===id))||![t.responsible,t.reason,t.fromName,t.toName].every(s=>typeof s==='string'&&s.trim())||!Array.isArray(t.lines)||!t.lines.length||t.lines.length>100||new Set(t.lines.map(l=>l.productId)).size!==t.lines.length)throw new Error('La copia contiene un traslado inválido.')
  const moves=linked.get(t.id)||[]
  if(moves.length!==t.lines.length*2)throw new Error('El traslado necesita una salida y una entrada por artículo.')
  for(const l of t.lines) {
   if(!state.products.some(p=>p.id===l.productId)||!validTransferQuantity(l.quantity)||![l.sku,l.description,l.unit].every(s=>typeof s==='string'&&s.trim()))throw new Error('El traslado contiene un artículo inválido.')
   for(const [depositId,branchId,quantity] of [[t.fromId,t.fromBranchId,-l.quantity],[t.toId,t.toBranchId,l.quantity]] as const) {
    if(moves.filter(m=>m.productId===l.productId&&m.depositId===depositId&&m.branchId===branchId&&m.date===t.date&&m.quantity===quantity&&m.documentId==='').length!==1)throw new Error('Las cantidades, fechas o depósitos del traslado no concilian con sus movimientos.')
   }
  }
 }
}
