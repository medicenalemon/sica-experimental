import { useId, useState } from 'react'
import { useStore } from '@/state/context'

const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-AR')
export default function BankSelect({label='Banco',value,onChange,required=false,empty='Seleccionar…',hint}:{label?:string;value:string;onChange:(id:string)=>void;required?:boolean;empty?:string;hint?:string}) {
 const {data}=useStore(),[search,setSearch]=useState(''),id=useId()
 const banks=data.masters.banks,query=normalize(search.trim())
 const matches=banks.filter(b=>normalize(`${b.code||''} ${b.name} ${b.bcraName||''}`).includes(query)),selected=banks.find(b=>b.id===value)
 const options=[...(selected&&!matches.some(b=>b.id===value)?[selected]:[]),...matches].sort((a,b)=>String(a.name).localeCompare(String(b.name),'es-AR'))
 return <div className="erp-field"><label htmlFor={`${id}-select`}>{label}</label><input type="search" aria-label={`Buscar ${label.replace(/ \*$/,'').toLowerCase()}`} placeholder="Buscar por nombre o código…" value={search} onChange={e=>setSearch(e.target.value)} aria-controls={`${id}-select`}/><select id={`${id}-select`} aria-label={label} required={required} value={value} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{options.map(b=><option key={b.id} value={b.id}>{b.code?`${b.code} · `:''}{b.name}</option>)}</select>{query&&<small role="status">{matches.length} coincidencias{selected&&!matches.some(b=>b.id===value)?'; se conserva la selección actual':''}.</small>}{hint&&<small>{hint}</small>}</div>
}
