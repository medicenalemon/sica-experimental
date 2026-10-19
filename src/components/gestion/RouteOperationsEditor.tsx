import type {RecordData} from '@/domain/types'
import {useStore} from '@/state/context'
import {routeSteps} from '@/domain/production-model'
import {Field,Hint} from './UI'

type Row={name:string;workCenterId:string;hours:number}
export default function RouteOperationsEditor({value,setValue}:{value:RecordData;setValue:(v:RecordData)=>void}){
 const {data}=useStore()
 let rows:Row[]=[]
 try{if(value.operations)rows=JSON.parse(String(value.operations));else if(value.steps){const names=routeSteps(value.steps),total=Math.round(Number(value.hours||1)*1_000_000);rows=names.map((name,i)=>({name,workCenterId:String(value.workCenterId||''),hours:(Math.floor(total/names.length)+(i<total%names.length?1:0))/1_000_000}))}}catch{rows=[]}
 if(!rows.length)rows=[{name:'',workCenterId:'',hours:1}]
 function update(next:Row[]){setValue({...value,operations:JSON.stringify(next),steps:next.map(o=>o.name).join(' → '),workCenterId:next[0]?.workCenterId||'',hours:next.reduce((n,o)=>n+Math.round(o.hours*1_000_000),0)/1_000_000})}
 const branch=data.masters.workCenters.find(c=>c.id===rows[0].workCenterId)?.branchId
 return <><Hint>Definí las operaciones en orden, con centro y horas para el lote completo. Los centros deben pertenecer a una misma sucursal. La orden conservará estos datos al preparar la ruta.</Hint>
 {rows.map((row,i)=><fieldset key={i}><legend>Operación {i+1}</legend><div className="form-grid"><Field label={`Nombre de operación ${i+1} *`}><input required maxLength={120} value={row.name} onChange={e=>update(rows.map((r,n)=>n===i?{...r,name:e.target.value}:r))}/></Field><Field label={`Centro de operación ${i+1} *`}><select required value={row.workCenterId} onChange={e=>update(rows.map((r,n)=>n===i?{...r,workCenterId:e.target.value}:r))}><option value="">Seleccionar…</option>{data.masters.workCenters.filter(c=>c.active!==false&&(!branch||c.branchId===branch||c.id===row.workCenterId)).map(c=><option key={c.id} value={c.id}>{c.name} · {data.masters.branches.find(b=>b.id===c.branchId)?.name}</option>)}</select></Field><Field label={`Horas del lote en operación ${i+1} *`}><input type="number" required min="0.000001" max="100000" step="0.000001" value={row.hours} onChange={e=>update(rows.map((r,n)=>n===i?{...r,hours:Number(e.target.value)}:r))}/></Field></div><div className="actions"><button type="button" className="button secondary small" disabled={i===0} onClick={()=>{const next=[...rows];[next[i-1],next[i]]=[next[i],next[i-1]];update(next)}}>Subir operación {i+1}</button><button type="button" className="button secondary small" disabled={i===rows.length-1} onClick={()=>{const next=[...rows];[next[i+1],next[i]]=[next[i],next[i+1]];update(next)}}>Bajar operación {i+1}</button><button type="button" className="button secondary small" disabled={rows.length===1} onClick={()=>update(rows.filter((_,n)=>n!==i))}>Quitar operación {i+1}</button></div></fieldset>)}
 <p>Total previsto del lote: {(rows.reduce((n,r)=>n+Math.round(r.hours*1_000_000),0)/1_000_000).toLocaleString('es-AR',{maximumFractionDigits:6})} horas.</p><button type="button" className="button secondary" disabled={rows.length>=50} onClick={()=>update([...rows,{name:'',workCenterId:rows.at(-1)?.workCenterId||'',hours:1}])}>Agregar operación</button></>
}
