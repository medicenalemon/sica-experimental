import {withinSingleExercise} from './exercise-calendar'
import type { State, Master } from './types'
import {productionMicros,operationCalendar,centerProductionShifts,shiftDailyHours,withinProductionShift} from './production-schedule'
import { today } from './constants'

export function routeSteps(value:unknown):string[] {
 if(typeof value!=='string')throw new Error('Definí la secuencia de operaciones de la ruta.')
 const steps=value.split(/[\n;>|→]+/).map(s=>s.trim()).filter(Boolean)
 if(!steps.length||steps.length>50||steps.some(s=>s.length>120))throw new Error('La ruta admite entre 1 y 50 operaciones de hasta 120 caracteres, separadas por → o punto y coma.')
 return steps
}
export function explicitRouteOperations(state:State,item:Master){
 if(item.operations===undefined||item.operations==='')return null
 if(typeof item.operations!=='string'||item.operations.length>30000)throw new Error('Las operaciones de la ruta son inválidas.')
 let rows:unknown;try{rows=JSON.parse(item.operations)}catch{throw new Error('Las operaciones de la ruta son inválidas.')}
 if(!Array.isArray(rows)||!rows.length||rows.length>50)throw new Error('La ruta necesita entre 1 y 50 operaciones.')
 let total=0;const branches=new Set<string>()
 const operations=rows.map(o=>{
  if(!o||typeof o.name!=='string'||!o.name.trim()||o.name.trim().length>120||typeof o.hours!=='number')throw new Error('Cada operación necesita un nombre y horas positivas.')
  const center=state.masters.workCenters.find(c=>c.id===o.workCenterId)
  if(!center)throw new Error('Cada operación necesita un centro de trabajo existente.')
  branches.add(String(center.branchId));total+=productionMicros(o.hours)
  return {name:o.name.trim(),workCenterId:center.id,hours:o.hours}
 })
 if(branches.size!==1)throw new Error('Los centros de la ruta deben pertenecer a la misma sucursal.')
 if(total>100_000_000_000)throw new Error('El tiempo total de la ruta no puede superar 100.000 horas.')
 return operations
}
export function workDays(value:unknown):number[] {
 const days=String(value??'1,2,3,4,5').split(',').map(s=>Number(s.trim()))
 if(!days.length||days.some(n=>!Number.isInteger(n)||n<1||n>7)||new Set(days).size!==days.length)throw new Error('Días laborables: indicá números únicos del 1 (lunes) al 7 (domingo), separados por coma.')
 return days
}
export function validProductionDate(value:unknown):value is string {
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value
}
export function nonWorkingDates(value:unknown):string[] {
 const dates=String(value??'').split(',').map(s=>s.trim()).filter(Boolean)
 if(dates.length>1000||dates.some(d=>!validProductionDate(d))||new Set(dates).size!==dates.length)throw new Error('Fechas no laborables: indicá fechas únicas AAAA-MM-DD separadas por coma.')
 return dates
}
export function validateProductionMaster(state:State,key:string,item:Master) {
 const plans=state.productionPlans||[],old=state.masters[key]?.find(m=>m.id===item.id)
 if(key==='production') {
  const plan=plans.find(p=>p.orderId===item.id)
  if(item.status==='Cancelada'&&state.productionReservations?.some(r=>r.preview.orderId===item.id&&!r.release))throw new Error('Liberá los materiales reservados antes de cancelar la orden.')
  if(plan) {
   const cancelled:Master={...old,id:item.id,status:'Cancelada'}
   if(item.status!=='Cancelada'||old?.status!=='Planificada'||plan.operations.some(o=>o.status!=='Pendiente')||Object.keys({...old,...item}).some(k=>item[k]!==cancelled[k]))throw new Error('La orden con ruta preparada conserva sus datos. Solo se puede cancelar antes de iniciar sus operaciones.')
  }
  if(!state.products.some(p=>p.id===item.productId&&p.kind==='Producto')||!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0||Number(item.quantity)>1_000_000)throw new Error('La orden requiere mercadería y una cantidad positiva de hasta 1.000.000.')
  if(!validProductionDate(item.start)||!validProductionDate(item.end)||item.end<item.start||(plan&&item.status==='Cancelada'?!withinSingleExercise(state,String(item.start),String(item.end)):item.start<state.settings.exerciseStart||item.end>state.settings.exerciseEnd))throw new Error('Fechas previstas inválidas o fuera del ejercicio.')
  if(item.workCenterId&&!state.masters.workCenters.some(c=>c.id===item.workCenterId&&c.branchId===item.branchId))throw new Error('El centro de trabajo debe pertenecer a la sucursal de la orden.')
 }
 if(key==='materials') {
  const order=state.masters.production.find(o=>o.id===item.orderId),oldOrder=state.masters.production.find(o=>o.id===old?.orderId)
  if([order,oldOrder].some(o=>o&&(['Terminada','Cancelada'].includes(String(o.status))||plans.some(p=>p.orderId===o.id))))throw new Error('Los materiales de una orden preparada, terminada o cancelada conservan sus datos.')
  const product=state.products.find(p=>p.id===item.productId&&p.kind==='Producto'),deposit=state.masters.deposits.find(d=>d.id===item.depositId)
  if(!order||!product||!deposit||deposit.branchId!==order.branchId||!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0||Number(item.quantity)>1_000_000||item.unit!==product.unit)throw new Error('Material inválido: mercadería, cantidad positiva, unidad del SKU y depósito de la sucursal de la orden.')
 }
 if(key==='routes'){const explicit=explicitRouteOperations(state,item);if(explicit){item.steps=explicit.map(o=>o.name).join(' → ');item.hours=explicit.reduce((n,o)=>n+productionMicros(o.hours),0)/1_000_000;item.workCenterId=explicit[0].workCenterId;item.operations=JSON.stringify(explicit)}else{routeSteps(item.steps);if(!Number.isFinite(Number(item.hours))||Number(item.hours)<0.000001||Number(item.hours)>100_000)throw new Error('La ruta necesita un tiempo previsto positivo de hasta 100.000 horas para el lote completo.')}}
 if(key==='workCenters') {
  const shifts=centerProductionShifts(item),hours=shiftDailyHours(shifts)
  if(!Number.isFinite(hours)||hours<=0||hours>24||!Number.isFinite(Number(item.capacity))||Number(item.capacity)<=0)throw new Error('El centro necesita hasta 24 horas diarias y una capacidad positiva.')
  const days=workDays(item.workDays),closed=nonWorkingDates(item.nonWorkingDates),reserved=new Map<string,number>()
  for(const p of plans.filter(p=>state.masters.production.find(o=>o.id===p.orderId)?.status!=='Cancelada'))for(const o of p.operations.filter(o=>operationCalendar(p,o).workCenterId===item.id))for(const b of o.bookings){reserved.set(b.date,(reserved.get(b.date)||0)+b.hours);if(b.date>=today()&&!withinProductionShift(shifts,b.startHour??0,b.hours))throw new Error('El cambio de horario reduciría capacidad ya reservada. Conservá el horario o cancelá las órdenes sin iniciar.')}
  for(const [date,hours] of reserved)if(date>=today()&&(!days.includes(new Date(`${date}T12:00:00Z`).getUTCDay()||7)||closed.includes(date)||hours>shiftDailyHours(shifts)+0.000001))throw new Error('El cambio de calendario reduciría capacidad ya reservada. Conservá esas fechas y horas o cancelá las órdenes sin iniciar.')
  if(plans.some(p=>p.operations.some(o=>operationCalendar(p,o).workCenterId===item.id)&&p.branchId!==item.branchId&&!['Terminada','Cancelada'].includes(String(state.masters.production.find(o=>o.id===p.orderId)?.status))))throw new Error('El centro tiene órdenes abiertas en su sucursal actual.')
  if(item.shifts){item.shifts=JSON.stringify(shifts);item.hours=hours;const minutes=Math.round(shifts[0].startHour*60);item.startTime=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
 }
 if(key==='tasks') {
  const order=state.masters.production.find(o=>o.id===item.orderId)
  if(old&&state.masters.production.some(o=>o.id===old.orderId&&['Terminada','Cancelada'].includes(String(o.status))))throw new Error('La tarea de una orden cerrada conserva sus datos.')
  if(!order||['Terminada','Cancelada'].includes(String(order.status)))throw new Error('La tarea requiere una orden abierta.')
  if(!validProductionDate(item.due)||item.due<state.settings.exerciseStart||item.due>state.settings.exerciseEnd)throw new Error('La fecha límite de la tarea debe pertenecer al ejercicio.')
  if(!state.masters.users.some(u=>u.id===item.responsible&&u.active))throw new Error('La tarea necesita un responsable activo.')
 }
}
