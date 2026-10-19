import type {State,Session} from './types'
import {assertDate} from './engine'
import {canAccess} from './permissions'
import {uid} from './constants'
import {withinExerciseHistory} from './exercise-calendar'

type Material={productId:string;depositId:string;quantity:number;unit:string;name:string}
type Release={date:string;reason:string;kind:'Liberada'|'Consumida';by:string;at:string}
export interface ReservationInput {orderId:string;date:string;reason:string;review?:string}
export interface ReservationPreview {
 orderId:string;planId:string;branchId:string;date:string;reason:string;
 lines:(Material&{physical:number;reserved:number;available:number;minimumAvailable:number})[];
 stockPrefixIds:string[];stockSources:{id:string;productId:string;depositId:string;date:string;quantity:number}[];
 previous:{id:string;orderId:string;date:string;lines:Material[];release?:Release}[];
}
export interface ProductionReservation {id:string;number:string;createdAt:string;responsible:string;preview:ReservationPreview;review:string;release?:Release}
const key=(m:{productId:string;depositId:string})=>JSON.stringify([m.productId,m.depositId])
const base=(m:Material):Material=>({productId:m.productId,depositId:m.depositId,quantity:m.quantity,unit:m.unit,name:m.name})
const day=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s
export function activeMaterialReservation(state:State,orderId:string){return state.productionReservations?.find(r=>r.preview.orderId===orderId&&!r.release)}
export function reservedMaterialQuantity(state:State,productId:string,depositId:string,date:string,exceptOrder?:string){return (state.productionReservations||[]).filter(r=>r.preview.orderId!==exceptOrder&&r.preview.date<=date&&(!r.release||r.release.date>date)).reduce((n,r)=>n+r.preview.lines.filter(l=>l.productId===productId&&l.depositId===depositId).reduce((a,l)=>a+l.quantity,0),0)}
export function materialAvailable(state:State,productId:string,depositId:string,date:string,exceptOrder?:string){return state.stockMoves.filter(m=>m.productId===productId&&m.depositId===depositId&&m.date<=date).reduce((n,m)=>n+m.quantity,0)-reservedMaterialQuantity(state,productId,depositId,date,exceptOrder)}
export function materialReservationDays(state:State){return (state.productionReservations||[]).flatMap(r=>[r.preview.date,...(r.release?[r.release.date]:[])])}
function access(actor:Session){if(!canAccess(actor,'/produccion'))throw new Error('Tu perfil no permite reservar materiales de producción.')}
function materials(state:State,orderId:string){
 const plan=state.productionPlans?.find(p=>p.orderId===orderId)
 if(!plan)throw new Error('Prepará la ruta antes de reservar sus materiales.')
 const grouped=new Map<string,Material>()
 for(const m of plan.materials){const old=grouped.get(key(m));grouped.set(key(m),{...base(m),quantity:m.quantity+(old?.quantity||0)})}
 return {plan,lines:[...grouped.values()].sort((a,b)=>key(a).localeCompare(key(b)))}
}
function projection(state:State,input:ReservationInput):ReservationPreview{
 const {plan,lines}=materials(state,input.orderId),keys=new Set(lines.map(key))
 const stockSources=state.stockMoves.filter(m=>keys.has(key(m))).map(({id,productId,depositId,date,quantity})=>({id,productId,depositId,date,quantity}))
 const previous=(state.productionReservations||[]).filter(r=>r.preview.lines.some(l=>keys.has(key(l)))).map(r=>({id:r.id,orderId:r.preview.orderId,date:r.preview.date,lines:r.preview.lines.map(base),...(r.release?{release:{...r.release}}:{})}))
 const dates=[...new Set([input.date,...stockSources.map(m=>m.date),...materialReservationDays(state)])].filter(d=>d>=input.date).sort()
 return {orderId:input.orderId,planId:plan.id,branchId:plan.branchId,date:input.date,reason:input.reason.trim(),stockPrefixIds:state.stockMoves.map(m=>m.id),stockSources,previous,lines:lines.map(l=>{const physical=stockSources.filter(m=>key(m)===key(l)&&m.date<=input.date).reduce((n,m)=>n+m.quantity,0),reserved=reservedMaterialQuantity(state,l.productId,l.depositId,input.date),minimumAvailable=Math.min(...dates.map(d=>materialAvailable(state,l.productId,l.depositId,d)));return {...l,physical,reserved,available:physical-reserved,minimumAvailable}})}
}
export function previewMaterialReservation(state:State,input:ReservationInput){
 assertDate(state,input.date)
 const order=state.masters.production.find(o=>o.id===input.orderId)
 if(!order||!['Planificada','En proceso'].includes(String(order.status))||activeMaterialReservation(state,input.orderId))throw new Error('Seleccioná una orden abierta sin reserva activa.')
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)throw new Error('Indicá un fundamento de hasta 500 caracteres.')
 const p=projection(state,input)
 for(const l of p.lines){const d=state.masters.deposits.find(d=>d.id===l.depositId);if(!d||d.active===false||d.branchId!==p.branchId||!state.masters.branches.some(b=>b.id===p.branchId&&b.active)||(!Number.isFinite(l.quantity)||l.quantity<0.000001||l.quantity>1_000_000||Math.abs(l.quantity*1_000_000-Math.round(l.quantity*1_000_000))>0.0001)||l.minimumAvailable+0.000000001<l.quantity)throw new Error(`Material insuficiente o depósito inactivo: ${l.name}. Revisá las reservas y salidas posteriores.`)}
 return p
}
export const materialReservationReview=(p:ReservationPreview)=>JSON.stringify(p)
export function reserveProductionMaterials(state:State,input:ReservationInput,actor:Session){
 access(actor);const preview=previewMaterialReservation(state,input)
 if(input.review!==materialReservationReview(preview))throw new Error('Revisá nuevamente los materiales y su disponibilidad antes de reservar.')
 const r:ProductionReservation={id:uid(),number:`INT-RM-${String((state.productionReservations?.length||0)+1).padStart(8,'0')}`,createdAt:new Date().toISOString(),responsible:actor.name,preview,review:input.review}
 ;(state.productionReservations??=[]).push(r);return r
}
export function releaseProductionMaterials(state:State,id:string,date:string,reason:string,actor:Session){
 access(actor);assertDate(state,date);const r=state.productionReservations?.find(r=>r.id===id&&!r.release)
 if(!r||date<r.preview.date||typeof reason!=='string'||!reason.trim()||reason.length>500)throw new Error('Elegí una reserva activa, respetá su fecha e indicá un motivo de hasta 500 caracteres.')
 r.release={date,reason:reason.trim(),kind:'Liberada',by:actor.name,at:new Date().toISOString()};return r.number
}
export function consumeProductionReservation(state:State,orderId:string,date:string,responsible:string){const r=activeMaterialReservation(state,orderId);if(r){if(date<r.preview.date)throw new Error('La finalización debe respetar la fecha de reserva de materiales.');r.release={date,reason:'Materiales consumidos al finalizar la orden.',kind:'Consumida',by:responsible,at:new Date().toISOString()}}}
export function validateProductionReservations(state:State){
 if(state.productionReservations!==undefined&&!Array.isArray(state.productionReservations))throw new Error('Reservas de materiales inválidas.')
 const records=state.productionReservations||[]
 if(!Array.isArray(records)||new Set(records.map(r=>r.id)).size!==records.length||new Set(records.map(r=>r.number)).size!==records.length)throw new Error('Reservas de materiales inválidas o repetidas.')
 const open=new Set<string>()
 for(const [i,r] of records.entries()){
  if(!r.id||!/^INT-RM-\d{8}$/.test(r.number)||!r.responsible||!r.createdAt||Number.isNaN(Date.parse(r.createdAt))||!r.preview||!day(r.preview.date)||!withinExerciseHistory(state,r.preview.date)||typeof r.preview.reason!=='string'||!r.preview.reason.trim()||!Array.isArray(r.preview.stockPrefixIds)||!Array.isArray(r.preview.stockSources)||!Array.isArray(r.preview.previous))throw new Error('Constancia de reserva inválida.')
  const order=state.masters.production.find(o=>o.id===r.preview.orderId),{plan,lines}=materials(state,r.preview.orderId)
  if(!order||plan.id!==r.preview.planId||plan.branchId!==r.preview.branchId||!Array.isArray(r.preview.lines)||JSON.stringify(r.preview.lines.map(base))!==JSON.stringify(lines))throw new Error('La reserva perdió los materiales conservados del plan.')
  const keys=new Set(lines.map(key)),before=records.slice(0,i).filter(p=>p.preview.lines.some(l=>keys.has(key(l))))
  if(JSON.stringify(before.map(p=>p.id))!==JSON.stringify(r.preview.previous.map(p=>p.id)))throw new Error('La reserva perdió su revisión de reservas anteriores.')
  const historical=structuredClone(state),ids=new Set(r.preview.stockSources.map(m=>m.id))
  if(ids.size!==r.preview.stockSources.length)throw new Error('Fuentes de stock de reserva repetidas.')
  const prefix=state.stockMoves.slice(0,r.preview.stockPrefixIds.length)
  if(JSON.stringify(prefix.map(m=>m.id))!==JSON.stringify(r.preview.stockPrefixIds))throw new Error('La reserva perdió la secuencia de stock revisada.')
  historical.stockMoves=prefix
  const sources=prefix.filter(m=>keys.has(key(m)))
  if(JSON.stringify(sources.map(({id,productId,depositId,date,quantity})=>({id,productId,depositId,date,quantity})))!==JSON.stringify(r.preview.stockSources))throw new Error('La reserva perdió o alteró sus fuentes de stock.')
  historical.productionReservations=before.map((p,j)=>{const saved=r.preview.previous[j];if(saved.orderId!==p.preview.orderId||saved.date!==p.preview.date||JSON.stringify(saved.lines)!==JSON.stringify(p.preview.lines.map(base))||saved.release&&JSON.stringify(saved.release)!==JSON.stringify(p.release))throw new Error('Antecedentes de reserva alterados.');return {...p,release:saved.release}})
  const expected=projection(historical,{orderId:r.preview.orderId,date:r.preview.date,reason:r.preview.reason})
  if(materialReservationReview(expected)!==r.review||JSON.stringify(expected)!==JSON.stringify(r.preview)||expected.lines.some(l=>l.minimumAvailable+0.000000001<l.quantity))throw new Error('La revisión de disponibilidad de materiales no coincide.')
  if(r.release){const e=r.release;if(!day(e.date)||e.date<r.preview.date||!withinExerciseHistory(state,e.date)||!['Liberada','Consumida'].includes(e.kind)||!e.by||!e.reason||!e.at||Number.isNaN(Date.parse(e.at))||e.kind==='Consumida'&&(order.status!=='Terminada'||order.finishedAt!==e.date))throw new Error('Liberación o consumo de reserva inválido.')}
  else{if(open.has(r.preview.orderId)||!['Planificada','En proceso'].includes(String(order.status)))throw new Error('Una orden cerrada o repetida conserva reserva activa.');open.add(r.preview.orderId)}
 }
 const dates=[...new Set([...state.stockMoves.map(m=>m.date),...materialReservationDays(state)])].sort(),keys=new Map<string,Material>()
 for(const r of records)for(const l of r.preview.lines)keys.set(key(l),l)
 for(const l of keys.values())for(const date of dates){const held=reservedMaterialQuantity(state,l.productId,l.depositId,date);if(held>0&&materialAvailable(state,l.productId,l.depositId,date)<-0.000000001)throw new Error('Las existencias no alcanzan para los materiales reservados en su fecha.')}
}
