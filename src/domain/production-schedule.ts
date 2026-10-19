import type {State,ProductionPlan,ProductionOperation,ProductionCalendar,ProductionShift,Master} from './types'

export function validateProductionShifts(value:unknown):ProductionShift[]{
 if(!Array.isArray(value)||!value.length||value.length>8)throw new Error('Definí entre uno y ocho turnos por centro.')
 const names=new Set<string>()
 const rows=value.map(s=>{
  if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.trim().length>80||Array.from(s.name as string).some(c=>c.charCodeAt(0)<32))throw new Error('Cada turno necesita un nombre de hasta 80 caracteres.')
  const name=s.name.trim(),key=name.toLocaleLowerCase('es-AR')
  if(names.has(key))throw new Error('Los nombres de turnos no pueden repetirse.');names.add(key)
  if(![s.startHour,s.endHour].every(h=>typeof h==='number'&&Number.isFinite(h)&&h>=0&&h<=24&&Math.abs(h*60-Math.round(h*60))<0.000001)||s.endHour<=s.startHour)throw new Error('Cada turno debe comenzar antes de terminar, con minutos completos, dentro del mismo día. Dividí un turno nocturno a la medianoche.')
  return {name,startHour:s.startHour,endHour:s.endHour}
 }).sort((a,b)=>a.startHour-b.startHour)
 for(let i=1;i<rows.length;i++)if(rows[i].startHour<rows[i-1].endHour)throw new Error('Los turnos del centro no pueden superponerse.')
 return rows
}
export function centerProductionShifts(center:Master):ProductionShift[]{
 if(center.shifts!==undefined&&center.shifts!==''){
  if(typeof center.shifts!=='string'||center.shifts.length>10000)throw new Error('Turnos del centro inválidos.')
  let rows:unknown;try{rows=JSON.parse(center.shifts)}catch{throw new Error('Turnos del centro inválidos.')}
  return validateProductionShifts(rows)
 }
 const start=dayStart(center.startTime),hours=Number(center.hours)
 if(!Number.isFinite(hours)||hours<=0||hours>24||start+hours>24+0.000001)throw new Error('La jornada del centro admite hasta 24 horas sin superar la medianoche. Revisá inicio y horas diarias.')
 return [{name:'Jornada',startHour:start,endHour:start+hours}]
}
export function shiftDailyHours(shifts:ProductionShift[]){return shifts.reduce((n,s)=>n+Math.round(s.endHour*1_000_000)-Math.round(s.startHour*1_000_000),0)/1_000_000}
export function calendarProductionShifts(calendar:ProductionCalendar){return calendar.shifts||[{name:'Jornada',startHour:calendar.dayStart,endHour:calendar.dayStart+calendar.dailyHours}]}
export function withinProductionShift(shifts:ProductionShift[],start:number,hours:number){return shifts.some(s=>start>=s.startHour-0.000001&&start+hours<=s.endHour+0.000001)}

export function productionMicros(hours:number){
 const n=Math.round(hours*1_000_000)
 if(!Number.isFinite(hours)||hours<0.000001||hours>100_000||Math.abs(hours*1_000_000-n)>0.0001)throw new Error('Las horas deben ser positivas, hasta 100.000 y con hasta seis decimales.')
 return n
}
export function dayStart(value:unknown){
 if(value===undefined||value==='')return 0
 if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Indicá un inicio de jornada válido en formato HH:MM.')
 const [h,m]=value.split(':').map(Number);return h+m/60
}
export function operationCalendar(plan:ProductionPlan,op:ProductionOperation):ProductionCalendar {
 return op.calendar||{workCenterId:plan.workCenterId,workCenterName:plan.workCenterName,dailyHours:plan.dailyHours,dayStart:0,workDays:plan.workDays,nonWorkingDates:plan.nonWorkingDates}
}
export function productionSlots(state:State){
 const slots=new Map<string,{start:number;end:number}[]>(),legacy=new Map<string,number>()
 for(const p of state.productionPlans||[]){
  if(state.masters.production.find(o=>o.id===p.orderId)?.status==='Cancelada')continue
  for(const o of p.operations){const c=operationCalendar(p,o);for(const b of o.bookings){const key=`${c.workCenterId}:${b.date}`
   if(b.startHour===undefined)legacy.set(key,(legacy.get(key)||0)+Math.round(b.hours*1_000_000))
   else {const rows=slots.get(key)||[];rows.push({start:Math.round(b.startHour*1_000_000),end:Math.round((b.startHour+b.hours)*1_000_000)});slots.set(key,rows)}
  }}
 }
 for(const [key,hours] of legacy){const rows=slots.get(key)||[];rows.push({start:0,end:hours});slots.set(key,rows)}
 for(const rows of slots.values())rows.sort((a,b)=>a.start-b.start)
 return slots
}
export function firstProductionGap(slots:{start:number;end:number}[],cursor:number,start:number,end:number){
 let position=Math.max(cursor,start)
 for(const slot of slots){if(slot.end<=position)continue;if(slot.start>position)return {start:position,end:Math.min(slot.start,end)};position=Math.max(position,slot.end);if(position>=end)return null}
 return position<end?{start:position,end}:null
}
