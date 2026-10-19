import {activeMaterialReservation,consumeProductionReservation} from './production-reservations'
import type { State, Role } from './types'
import { assertDate,assertStockCostDate } from './engine'
import { assertStockOutflow } from './stock-transfers'
import { uid } from './constants'
export function finishProduction(state: State, orderId: string, depositId: string, date: string, role: Role,responsible:string=role) {
 if(!['Administrador General','Producción','Personalizado'].includes(role))throw new Error('La finalización requiere un perfil habilitado para Producción.')
 assertDate(state,date);assertStockCostDate(state,date)
 const order=state.masters.production.find(o=>o.id===orderId),deposit=state.masters.deposits.find(d=>d.id===depositId)
 if(!order||!deposit||deposit.active===false||order.branchId!==deposit.branchId||!state.masters.branches.some(b=>b.id===order.branchId&&b.active))throw new Error('Elegí una orden y un depósito de su sucursal activa.')
 if(['Terminada','Cancelada'].includes(String(order.status))||state.stockMoves.some(m=>m.documentId===orderId))throw new Error('La orden ya está terminada o cancelada.')
 const plan=state.productionPlans?.find(p=>p.orderId===orderId)
 if(order.routeId&&!plan)throw new Error('Prepará la ruta antes de finalizar la orden.')
 if(plan&&plan.operations.some(o=>o.status!=='Completada'||!o.finishedAt||o.finishedAt>date))throw new Error('Completá todas las operaciones de la ruta antes de finalizar la orden.')
 if(state.masters.tasks.some(t=>t.orderId===orderId&&t.status!=='Completada'))throw new Error('Completá las tareas pendientes de la orden antes de finalizar.')
 const finished=state.products.find(p=>p.id===order.productId)
 if((order.start&&date<String(order.start))||(plan&&finished?.unit!==plan.productUnit))throw new Error('Respetá el inicio de la orden y la unidad del producto conservada en el plan.')
 if(!finished||finished.kind!=='Producto'||!Number.isFinite(Number(order.quantity))||Number(order.quantity)<=0||Number(order.quantity)>1_000_000)throw new Error('La orden debe producir un artículo y una cantidad positiva.')
 const materials=plan?.materials||state.masters.materials.filter(m=>m.orderId===orderId)
 if(!materials.length)throw new Error('Definí los materiales requeridos antes de finalizar.')
 const amounts=new Map<string,{productId:string;depositId:string;quantity:number}>()
 for(const m of materials) {
  const product=state.products.find(p=>p.id===m.productId),sourceDeposit=state.masters.deposits.find(d=>d.id===m.depositId)
  if(!product||product.kind!=='Producto'||!sourceDeposit||sourceDeposit.branchId!==order.branchId||!Number.isFinite(Number(m.quantity))||Number(m.quantity)<=0||(m.unit&&m.unit!==product.unit))throw new Error('Material o depósito de origen inválido.')
  const key=JSON.stringify([m.productId,m.depositId]),previous=amounts.get(key)
  amounts.set(key,{productId:String(m.productId),depositId:String(m.depositId),quantity:Number(m.quantity)+(previous?.quantity||0)})
 }
 const reservation=activeMaterialReservation(state,orderId);if(reservation&&date<reservation.preview.date)throw new Error('La finalización debe respetar la fecha de reserva de materiales.')
 let cost=0
 for(const m of amounts.values()) {
  const product=state.products.find(p=>p.id===m.productId)!
  assertStockOutflow(state,m.productId,m.depositId,date,m.quantity,product.negative,product.sku,orderId)
  if(!Number.isSafeInteger(product.cost)||product.cost<0)throw new Error('El material necesita un costo de referencia válido.')
  cost+=Math.round(m.quantity*product.cost)
 }
 if(!Number.isSafeInteger(cost)||!Number.isFinite(Number(order.actualCost||0)))throw new Error('El costo de fabricación supera el rango admitido.')
 assertStockOutflow(state,finished.id,depositId,date,-Number(order.quantity),true,finished.sku)
 consumeProductionReservation(state,orderId,date,responsible)
 for(const m of amounts.values())state.stockMoves.push({id:uid(),date,productId:m.productId,depositId:m.depositId,quantity:-m.quantity,reason:`Consumo de producción ${order.name}`,documentId:orderId,branchId:String(order.branchId)})
 state.stockMoves.push({id:uid(),date,productId:finished.id,depositId,quantity:Number(order.quantity),reason:`Producción terminada ${order.name}`,documentId:orderId,branchId:String(order.branchId)})
 order.status='Terminada';order.finishedAt=date;order.materialCost=cost;order.actualCost=Math.max(Number(order.actualCost||0),cost/100);order.outputDeposit=depositId
}
