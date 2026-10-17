import type {RecordData} from '@/domain/types'
import {Field,Hint} from './UI'

type Row={name:string;startHour:number;endHour:number}
const clock=(hour:number)=>{if(!Number.isFinite(hour))return '';const minutes=Math.round(hour*60);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
const hour=(time:string)=>{if(!/^\d{2}:\d{2}$/.test(time))return -1;const [h,m]=time.split(':').map(Number);return h<=24&&m<60&&(h<24||m===0)?h+m/60:-1}
export default function ProductionShiftsEditor({value,setValue}:{value:RecordData;setValue:(value:RecordData)=>void}){
 let rows:Row[]=[]
 try{if(value.shifts)rows=JSON.parse(String(value.shifts))}catch{ /* Invalid imported definitions stay visible for correction. */ }
 const enabled=Boolean(value.shifts)
 function update(next:Row[]){setValue({...value,shifts:JSON.stringify(next)})}
 if(!enabled)return <p><button type="button" className="button secondary" onClick={()=>{const start=hour(String(value.startTime||'00:00'));update([{name:'Primer turno',startHour:start,endHour:Math.min(24,start+Number(value.hours||8))}])}}>Definir turnos separados</button></p>
 return <><Hint>La capacidad diaria es la suma de los turnos. Los intervalos quedan libres de actividad. Se aplican los mismos días laborables y cierres a todos los turnos; para atravesar medianoche, cargá dos franjas dentro de cada día.</Hint>
 {rows.map((row,i)=><fieldset key={i}><legend>Turno {i+1}</legend><div className="form-grid">
  <Field label={`Nombre de turno ${i+1} *`}><input required maxLength={80} value={row.name} onChange={e=>update(rows.map((r,n)=>n===i?{...r,name:e.target.value}:r))}/></Field>
  <Field label={`Inicio de turno ${i+1} *`}><input type="time" required value={clock(row.startHour)} onChange={e=>update(rows.map((r,n)=>n===i?{...r,startHour:hour(e.target.value)}:r))}/></Field>
  <div><Field label={`Fin de turno ${i+1} *`} hint="HH:MM. Se admite 24:00 para medianoche."><input type="time" required disabled={row.endHour===24} value={row.endHour===24?'00:00':clock(row.endHour)} onChange={e=>update(rows.map((r,n)=>n===i?{...r,endHour:hour(e.target.value)}:r))}/></Field><label className="checkbox-container"><input type="checkbox" checked={row.endHour===24} onChange={e=>update(rows.map((r,n)=>n===i?{...r,endHour:e.target.checked?24:18}:r))}/>Termina a las 24:00</label></div>
 </div><button type="button" className="button secondary small" disabled={rows.length===1} onClick={()=>update(rows.filter((_,n)=>n!==i))}>Quitar turno {i+1}</button></fieldset>)}
 {!rows.length&&<p role="alert">Revisá la definición de turnos y agregá al menos uno.</p>}
 <p>Horas disponibles por día: {rows.reduce((n,s)=>n+Math.max(0,s.endHour-s.startHour),0).toLocaleString('es-AR',{maximumFractionDigits:6})}.</p>
 <div className="actions"><button type="button" className="button secondary" disabled={rows.length>=8} onClick={()=>update([...rows,{name:`Turno ${rows.length+1}`,startHour:14,endHour:18}])}>Agregar turno</button><button type="button" className="button secondary" onClick={()=>setValue({...value,shifts:''})}>Usar jornada única</button></div></>
}
