import {withinExerciseHistory,withinSingleExercise} from './exercise-calendar'
import type { State, Session, ProductionPlan, ProductionOperation } from './types'
import { assertDate } from './engine'
import { canAccess } from './permissions'
import { uid } from './constants'
import { explicitRouteOperations, routeSteps, workDays, nonWorkingDates, validProductionDate } from './production-model'

import {productionMicros,operationCalendar,productionSlots,firstProductionGap,centerProductionShifts,shiftDailyHours,validateProductionShifts,calendarProductionShifts,withinProductionShift} from './production-schedule'

function access(actor:Session){if(!canAccess(actor,'/produccion'))throw new Error('Tu perfil no permite ejecutar operaciones de producción.')}
function nextDay(date:string){const day=new Date(`${date}T12:00:00Z`);day.setUTCDate(day.getUTCDate()+1);return day.toISOString().slice(0,10)}
export function productionLoad(state:State) {
 const daily=new Map<string,{workCenterId:string;date:string;hours:number}>()
 for(const plan of state.productionPlans||[]) {
  if(state.masters.production.find(o=>o.id===plan.orderId)?.status==='Cancelada')continue
  for(const operation of plan.operations)for(const b of operation.bookings){const center=operationCalendar(plan,operation).workCenterId,key=`${center}:${b.date}`,row=daily.get(key)||{workCenterId:center,date:b.date,hours:0};row.hours+=b.hours;daily.set(key,row)}
 }
 return [...daily.values()].sort((a,b)=>a.date.localeCompare(b.date))
}
export function prepareProduction(state:State,orderId:string,actor:Session):ProductionPlan {
 access(actor)
 const order=state.masters.production.find(o=>o.id===orderId)
 if(!order||order.status!=='Planificada')throw new Error('Prepará una orden en estado Planificada.')
 if((state.productionPlans||[]).some(p=>p.orderId===orderId))throw new Error('La orden ya tiene una ruta preparada.')
 assertDate(state,String(order.start));assertDate(state,String(order.end))
 if(String(order.end)<String(order.start))throw new Error('El fin previsto debe ser posterior al inicio.')
 const product=state.products.find(p=>p.id===order.productId&&p.kind==='Producto'),quantity=Number(order.quantity)
 if(!product||!Number.isFinite(quantity)||quantity<=0||quantity>1_000_000||!state.masters.branches.some(b=>b.id===order.branchId&&b.active))throw new Error('Producto, cantidad o sucursal de producción inválidos.')
 const route=order.routeId?state.masters.routes.find(r=>r.id===order.routeId):undefined
 if(order.routeId&&!route)throw new Error('La ruta de la orden no existe.')
 const explicit=route?explicitRouteOperations(state,route):null
 if(order.workCenterId&&(route?.workCenterId||explicit?.[0].workCenterId)&&order.workCenterId!==(route?.workCenterId||explicit?.[0].workCenterId))throw new Error('La orden y la ruta deben usar el mismo centro de trabajo.')
 const center=state.masters.workCenters.find(c=>c.id===(order.workCenterId||route?.workCenterId||explicit?.[0].workCenterId)&&c.branchId===order.branchId)
 if(!center||!Number.isFinite(Number(center.hours))||Number(center.hours)<=0||Number(center.hours)>24||!Number.isFinite(Number(center.capacity))||Number(center.capacity)<=0)throw new Error('Seleccioná un centro de trabajo de la sucursal con capacidad y horas diarias positivas.')
 const names=route?routeSteps(route.steps||explicit?.map(o=>o.name).join(' → ')):[`Fabricar ${product.name}`],hours=route?Number(route.hours):quantity/Number(center.capacity)
 const totalMicros=explicit?explicit.reduce((n,o)=>n+productionMicros(o.hours),0):Math.round(hours*1_000_000)
 if(!Number.isSafeInteger(totalMicros)||totalMicros<names.length||totalMicros>100_000_000_000)throw new Error('Revisá el tiempo de ruta y las horas del centro.')
 const specifications=explicit||names.map((name,i)=>({name,workCenterId:center.id,hours:(Math.floor(totalMicros/names.length)+(i<totalMicros%names.length?1:0))/1_000_000}))
 const materials=state.masters.materials.filter(m=>m.orderId===orderId).map(m=>{
  const p=state.products.find(p=>p.id===m.productId&&p.kind==='Producto'),d=state.masters.deposits.find(d=>d.id===m.depositId)
  if(!p||!d||d.branchId!==order.branchId||!Number.isFinite(Number(m.quantity))||Number(m.quantity)<=0||Number(m.quantity)>1_000_000||(m.unit&&m.unit!==p.unit))throw new Error('Revisá los materiales, sus unidades y depósitos antes de preparar la ruta.')
  return {productId:p.id,depositId:d.id,quantity:Number(m.quantity),unit:p.unit,name:p.name}
 })
 if(!materials.length)throw new Error('Definí los materiales antes de preparar la ruta.')
 const version=specifications.some(spec=>state.masters.workCenters.find(c=>c.id===spec.workCenterId)?.shifts)?3:2
 const slots=productionSlots(state)
 let cursor=String(order.start),cursorHour=0
 const operations:ProductionOperation[]=specifications.map((spec,i)=>{
  const c=state.masters.workCenters.find(c=>c.id===spec.workCenterId&&c.branchId===order.branchId)
  if(!c||c.active===false)throw new Error('Todos los centros de la ruta deben pertenecer a la sucursal de la orden.')
  const shifts=centerProductionShifts(c),dailyHours=shiftDailyHours(shifts),start=shifts[0].startHour,days=workDays(c.workDays),closed=nonWorkingDates(c.nonWorkingDates)
  if(!Number.isFinite(dailyHours)||dailyHours<=0||dailyHours>24||shifts.at(-1)!.endHour>24+0.000001)throw new Error('Revisá las horas y el horario de cada centro.')
  const duration=productionMicros(spec.hours),bookings:ProductionOperation['bookings']=[]
  let remaining=duration
  while(remaining>0){
   if(cursor>String(order.end))throw new Error('La capacidad disponible no alcanza antes del fin previsto. Ampliá las fechas o revisá las horas del centro.')
   const weekday=new Date(`${cursor}T12:00:00Z`).getUTCDay()||7,key=`${c.id}:${cursor}`,occupied=slots.get(key)||[]
   const gap=days.includes(weekday)&&!closed.includes(cursor)?shifts.map(s=>firstProductionGap(occupied,cursorHour,Math.round(s.startHour*1_000_000),Math.round(s.endHour*1_000_000))).find(g=>g&&g.end>g.start)||null:null
   if(gap&&gap.end>gap.start){const assigned=Math.min(remaining,gap.end-gap.start);bookings.push({date:cursor,hours:assigned/1_000_000,startHour:gap.start/1_000_000});occupied.push({start:gap.start,end:gap.start+assigned});occupied.sort((a,b)=>a.start-b.start);slots.set(key,occupied);cursorHour=gap.start+assigned;remaining-=assigned}
   else {cursor=nextDay(cursor);cursorHour=0}
  }
  return {id:uid(),sequence:i+1,name:spec.name,plannedHours:duration/1_000_000,bookings,calendar:{workCenterId:c.id,workCenterName:String(c.name),dailyHours,dayStart:start,workDays:days,nonWorkingDates:closed,...(version===3?{shifts,...(!c.shifts?{singleWindow:true as const}:{})}:{} )},status:'Pendiente',actualHours:0}
 })
 const first=operations[0].calendar!
 const plan:ProductionPlan={id:uid(),scheduleVersion:version,orderId,branchId:String(order.branchId),routeId:route?.id||'',routeName:String(route?.name||'Fabricación directa'),workCenterId:first.workCenterId,workCenterName:first.workCenterName,productId:product.id,productUnit:product.unit,quantity,dailyHours:first.dailyHours,workDays:first.workDays,nonWorkingDates:first.nonWorkingDates,preparedBy:actor.name,preparedAt:new Date().toISOString(),operations,materials}
 ;(state.productionPlans??=[]).push(plan)
 order.productionPlanId=plan.id
 return plan
}
export function productionStep(state:State,orderId:string,operationId:string,action:'iniciar'|'completar',date:string,actualHours:number|undefined,actor:Session) {
 access(actor);assertDate(state,date)
 const order=state.masters.production.find(o=>o.id===orderId),plan=state.productionPlans?.find(p=>p.orderId===orderId),operation=plan?.operations.find(o=>o.id===operationId)
 if(!order||!plan||!operation||['Terminada','Cancelada'].includes(String(order.status)))throw new Error('La operación debe pertenecer a una orden abierta con ruta preparada.')
 if(date<String(order.start)||plan.operations.some(o=>o.sequence<operation.sequence&&(o.status!=='Completada'||String(o.finishedAt)>date)))throw new Error('Respetá el inicio de la orden y completá primero las operaciones anteriores.')
 if(action==='iniciar') {
  if(operation.status!=='Pendiente')throw new Error('La operación ya está iniciada o completada.')
  operation.status='En curso';operation.startedAt=date;operation.startedBy=actor.name;order.status='En proceso'
 }else if(action==='completar') {
  if(operation.status!=='En curso'||date<String(operation.startedAt))throw new Error('Iniciá la operación y respetá su fecha de inicio antes de completarla.')
  if(typeof actualHours!=='number'||!Number.isFinite(actualHours)||actualHours<=0||actualHours>100_000)throw new Error('Indicá horas reales positivas de hasta 100.000.')
  operation.status='Completada';operation.finishedAt=date;operation.finishedBy=actor.name;operation.actualHours=actualHours
 }else throw new Error('Acción de producción inválida.')
 return `${order.name} · ${operation.sequence}. ${operation.name} · ${operation.status}`
}
export function validateProductionPlans(state:State) {
 if(state.productionPlans!==undefined&&!Array.isArray(state.productionPlans))throw new Error('Planes de producción inválidos.')
 if(state.masters.production.some(o=>o.productionPlanId&&!(state.productionPlans||[]).some(p=>p.id===o.productionPlanId&&p.orderId===o.id)))throw new Error('La orden perdió su plan de producción.')
 if(state.productionPlans===undefined)return
 if(!Array.isArray(state.productionPlans)||new Set(state.productionPlans.map(p=>p.id)).size!==state.productionPlans.length||new Set(state.productionPlans.map(p=>p.orderId)).size!==state.productionPlans.length)throw new Error('Planes de producción inválidos o repetidos.')
 for(const p of state.productionPlans) {
  const order=state.masters.production.find(o=>o.id===p.orderId),center=state.masters.workCenters.find(c=>c.id===p.workCenterId)
  if(p.scheduleVersion!==undefined&&p.scheduleVersion!==2&&p.scheduleVersion!==3)throw new Error('Versión del plan de producción inválida.')
  if(!p.productUnit||!Number.isFinite(p.dailyHours)||p.dailyHours<=0||p.dailyHours>24||!Array.isArray(p.workDays)||!Array.isArray(p.nonWorkingDates)||workDays(p.workDays.join(',')).length!==p.workDays.length||nonWorkingDates(p.nonWorkingDates.join(',')).length!==p.nonWorkingDates.length)throw new Error('Calendario o unidad del plan inválidos.')
  if(!p.id||!order||order.productionPlanId!==p.id||!center||p.branchId!==order.branchId||p.productId!==order.productId||p.quantity!==Number(order.quantity)||!p.preparedBy||!p.routeName||!p.workCenterName||!Array.isArray(p.operations)||!p.operations.length||p.operations.length>50||new Set(p.operations.map(o=>o.id)).size!==p.operations.length||!Array.isArray(p.materials)||!p.materials.length)throw new Error('La copia contiene un plan de producción inválido.')
  if(!validProductionDate(order.start)||!validProductionDate(order.end)||order.end<order.start||!withinSingleExercise(state,String(order.start),String(order.end))||!['Planificada','En proceso','Terminada','Cancelada'].includes(String(order.status))||!Number.isFinite(p.quantity)||p.quantity<=0||p.quantity>1_000_000||typeof p.preparedAt!=='string'||Number.isNaN(Date.parse(p.preparedAt)))throw new Error('Fechas o cantidad del plan de producción inválidas.')
  for(const m of p.materials)if(!state.products.some(x=>x.id===m.productId)||!state.masters.deposits.some(d=>d.id===m.depositId&&d.branchId===p.branchId)||!Number.isFinite(m.quantity)||m.quantity<=0||m.quantity>1_000_000||!m.unit||!m.name)throw new Error('Materiales del plan de producción inválidos.')
  if(p.scheduleVersion===3){const first=p.operations[0].calendar;if(!first||p.workCenterId!==first.workCenterId||p.workCenterName!==first.workCenterName||p.dailyHours!==first.dailyHours||JSON.stringify(p.workDays)!==JSON.stringify(first.workDays)||JSON.stringify(p.nonWorkingDates)!==JSON.stringify(first.nonWorkingDates))throw new Error('El resumen no concilia con el calendario del primer centro del plan.')}
  const daily=new Map<string,number>()
  let previousBooking='',previousEnd=0
  for(const [i,o] of p.operations.entries()) {
   const calendar=operationCalendar(p,o),scheduled=p.scheduleVersion===2||p.scheduleVersion===3
   if(scheduled&&(!o.calendar||!state.masters.workCenters.some(c=>c.id===calendar.workCenterId)||!calendar.workCenterName||!Number.isFinite(calendar.dailyHours)||calendar.dailyHours<=0||calendar.dailyHours>24||!Number.isFinite(calendar.dayStart)||calendar.dayStart<0||p.scheduleVersion===2&&calendar.dayStart+calendar.dailyHours>24+0.000001||!Array.isArray(calendar.workDays)||!Array.isArray(calendar.nonWorkingDates)||workDays(calendar.workDays.join(',')).length!==calendar.workDays.length||nonWorkingDates(calendar.nonWorkingDates.join(',')).length!==calendar.nonWorkingDates.length))throw new Error('Calendario del centro por operación inválido en el plan.')
   if(p.scheduleVersion===3){
    if(!calendar.shifts)throw new Error('Calendario de turnos perdido en el plan.')
    const shifts=calendar.singleWindow===true?[{name:'Jornada',startHour:calendar.dayStart,endHour:calendar.dayStart+calendar.dailyHours}]:validateProductionShifts(calendar.shifts)
    if(calendar.singleWindow!==undefined&&calendar.singleWindow!==true||calendar.singleWindow&&calendar.dayStart+calendar.dailyHours>24+0.000001)throw new Error('Jornada única inválida en el calendario del plan.')
    if(JSON.stringify(shifts)!==JSON.stringify(calendar.shifts)||Math.abs(shiftDailyHours(shifts)-calendar.dailyHours)>0.000001||calendar.dayStart!==shifts[0].startHour)throw new Error('Los turnos no concilian con el calendario conservado del plan.')
   }else if(calendar.shifts!==undefined||calendar.singleWindow!==undefined)throw new Error('La versión anterior del plan no contiene turnos.')
   if(scheduled&&Math.abs(calendar.dayStart*60-Math.round(calendar.dayStart*60))>0.000001)throw new Error('El inicio del calendario debe conservar minutos completos.')
   if(!o.id||!o.name||o.sequence!==i+1||!Number.isFinite(o.plannedHours)||o.plannedHours<=0||!Array.isArray(o.bookings)||!o.bookings.length||o.bookings.some(b=>!validProductionDate(b.date)||b.date<String(order.start)||b.date>String(order.end)||!Number.isFinite(b.hours)||b.hours<=0)||!scheduled&&new Set(o.bookings.map(b=>b.date)).size!==o.bookings.length||Math.abs(o.bookings.reduce((n,b)=>n+b.hours,0)-o.plannedHours)>0.000001||!['Pendiente','En curso','Completada'].includes(o.status)||!Number.isFinite(o.actualHours)||o.actualHours<0)throw new Error('Operaciones o reservas del plan de producción inválidas.')
   if(o.status!=='Pendiente'&&(!validProductionDate(o.startedAt)||!o.startedBy||o.startedAt<String(order.start)||p.operations.slice(0,i).some(previous=>previous.status!=='Completada'||String(previous.finishedAt)>String(o.startedAt))))throw new Error('La copia altera la secuencia de operaciones de producción.')
   if(scheduled&&o.bookings.reduce((n,b)=>n+productionMicros(b.hours),0)!==productionMicros(o.plannedHours))throw new Error('Las reservas no conservan las horas exactas del plan.')
   if(o.status==='Completada'&&(!validProductionDate(o.finishedAt)||!o.finishedBy||String(o.finishedAt)<String(o.startedAt)||o.actualHours<=0))throw new Error('La operación completada necesita fecha, responsable y horas reales.')
   if(o.status==='Pendiente'&&(o.startedAt||o.finishedAt||o.startedBy||o.finishedBy||o.actualHours!==0))throw new Error('La operación pendiente contiene una ejecución inválida.')
   if(o.status==='En curso'&&(o.finishedAt||o.finishedBy||o.actualHours!==0))throw new Error('La operación en curso contiene una finalización inválida.')
   if(o.actualHours>100_000||(o.startedAt&&!withinExerciseHistory(state,o.startedAt))||(o.finishedAt&&!withinExerciseHistory(state,o.finishedAt)))throw new Error('Horas o fechas reales de producción fuera del rango admitido.')
   for(const b of o.bookings){
    if(b.date<previousBooking)throw new Error('Las reservas alteran la secuencia prevista de producción.')
    if(scheduled){
     if(typeof b.startHour!=='number'||!Number.isFinite(b.startHour)||Math.abs(b.startHour*1_000_000-Math.round(b.startHour*1_000_000))>0.0001||!withinProductionShift(calendarProductionShifts(calendar),b.startHour,b.hours)||b.date===previousBooking&&b.startHour<previousEnd-0.000001)throw new Error('Los horarios alteran la secuencia prevista o el calendario conservado del plan.')
     previousEnd=b.startHour+b.hours
    }else if(b.startHour!==undefined||o.calendar!==undefined)throw new Error('La copia altera el formato del plan de producción anterior.')
    previousBooking=b.date;const key=`${calendar.workCenterId}:${b.date}`;daily.set(key,(daily.get(key)||0)+b.hours)
    if(!calendar.workDays.includes(new Date(`${b.date}T12:00:00Z`).getUTCDay()||7)||calendar.nonWorkingDates.includes(b.date)||(daily.get(key)||0)>calendar.dailyHours+0.000001)throw new Error('Las reservas no respetan el calendario conservado del plan.')
   }
  }
  if(order.status==='Terminada'&&p.operations.some(o=>o.status!=='Completada'))throw new Error('La orden terminada tiene operaciones pendientes.')
  if(['Planificada','Cancelada'].includes(String(order.status))&&p.operations.some(o=>o.status!=='Pendiente'))throw new Error('El estado de la orden no coincide con la ejecución de la ruta.')
  const moves=state.stockMoves.filter(m=>m.documentId===p.orderId)
  if(order.status!=='Terminada'&&moves.length)throw new Error('La orden abierta contiene movimientos de producción anticipados.')
  if(order.status==='Terminada') {
   if(!validProductionDate(order.finishedAt)||order.finishedAt<order.start||!withinExerciseHistory(state,String(order.finishedAt))||p.operations.some(o=>String(o.finishedAt)>String(order.finishedAt))||!state.masters.deposits.some(d=>d.id===order.outputDeposit&&d.branchId===p.branchId))throw new Error('La finalización del plan de producción es inválida.')
   const expected=new Map<string,number>(),actual=new Map<string,number>(),add=(map:Map<string,number>,key:string,amount:number)=>map.set(key,(map.get(key)||0)+amount)
   for(const m of p.materials)add(expected,JSON.stringify([m.productId,m.depositId,'salida']),-m.quantity)
   add(expected,JSON.stringify([p.productId,order.outputDeposit,'entrada']),p.quantity)
   if(!moves.length||moves.some(m=>m.branchId!==p.branchId||m.date!==order.finishedAt||!Number.isFinite(m.quantity)||m.quantity===0))throw new Error('Faltan movimientos de stock de la producción terminada.')
   for(const m of moves)add(actual,JSON.stringify([m.productId,m.depositId,m.quantity<0?'salida':'entrada']),m.quantity)
   if(expected.size!==actual.size||[...expected].some(([key,amount])=>!actual.has(key)||Math.abs(actual.get(key)!-amount)>0.000001))throw new Error('Los movimientos no concilian con materiales y producto terminado del plan.')
  }
 }
 const capacity=new Map<string,number>()
 for(const plan of state.productionPlans)for(const o of plan.operations)for(const b of o.bookings){const c=operationCalendar(plan,o),key=`${c.workCenterId}:${b.date}`;capacity.set(key,Math.max(capacity.get(key)||0,c.dailyHours))}
 for(const slots of productionSlots(state).values())for(let i=1;i<slots.length;i++)if(slots[i].start<slots[i-1].end)throw new Error('La copia excede la capacidad diaria por superposición de horarios entre planes de producción.')
 if(productionLoad(state).some(b=>b.hours>(capacity.get(`${b.workCenterId}:${b.date}`)||0)+0.000001))throw new Error('La copia excede la capacidad diaria conservada entre planes de producción.')
}
