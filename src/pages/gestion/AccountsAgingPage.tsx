import AccountApplicationsPanel from './AccountApplicationsPanel'
import {useState} from 'react'
import {Link} from 'react-router-dom'
import {accountsAging,agingBuckets} from '@/domain/accounts-aging'
import {useStore} from '@/state/context'
import type {Side} from '@/domain/types'
import {canAccess} from '@/domain/permissions'
import {today,money,dateLabel} from '@/domain/constants'
import {Page,Panel,Field,Hint,Metric,DataTable} from '@/components/gestion/UI'

export default function AccountsAgingPage(){
 const {data,branch,session}=useStore(),[date,setDate]=useState(today()),[side,setSide]=useState<Side|'all'>('cliente'),[partyId,setPartyId]=useState('')
 let report:ReturnType<typeof accountsAging>|undefined,error=''
 try{report=accountsAging(data,date,branch,side,partyId)}catch(e){error=e instanceof Error?e.message:'No se pudo calcular el reporte.'}
 const groups=(report?.groups||[]).map(g=>({...g,kind:g.side==='cliente'?'A cobrar':'A pagar',...Object.fromEntries(g.buckets.map((v,i)=>[`bucket${i}`,money(v)])),pending:money(g.pending),overdue:money(g.overdue),unapplied:money(g.unapplied),balance:money(g.balance)}))
 const items=(report?.items||[]).filter(r=>r.pending||r.unapplied).map(r=>({...r,name:data.parties.find(p=>p.id===r.partyId)?.name||r.partyId,branchName:data.masters.branches.find(b=>b.id===r.branchId)?.name||r.branchId,date:dateLabel(r.date),due:r.due?dateLabel(r.due):'Sin informar',days:r.pending&&r.days!==null?Math.max(0,r.days):'—',original:money(r.original),applied:money(r.applied),pending:money(r.pending),unapplied:money(r.unapplied),applications:r.applications.join('; ')}))
 return <Page title="Cuentas por cobrar y pagar" subtitle="Vencimientos y antigüedad conciliados con la cuenta corriente a una fecha de corte.">
  <Panel><div className="form-grid three"><Field label="Fecha de corte"><input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Tipo de cuenta"><select value={side} onChange={e=>{setSide(e.target.value as Side|'all');setPartyId('')}}><option value="cliente">Clientes · a cobrar</option><option value="proveedor">Proveedores · a pagar</option><option value="all">Ambos tipos</option></select></Field><Field label="Contraparte"><select value={partyId} onChange={e=>setPartyId(e.target.value)}><option value="">Todas</option>{data.parties.filter(p=>side==='all'||p.side===side).map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></Field></div>
  <Hint>Se usan las aplicaciones registradas hasta el corte. Los anticipos y créditos sin aplicación se muestran separados; no se compensan automáticamente con los vencimientos. Cada sucursal conserva su saldo. «Vence hoy» se incluye en a vencer; los documentos sin fecha quedan separados. La antigüedad orienta la gestión de cobros y pagos, sin determinar incobrabilidad ni modificar deuda o impuestos.</Hint></Panel>
  {error?<p role="alert" className="form-error">{error}</p>:<>
   <div className="metrics-grid"><Metric label="Pendiente de aplicación" value={money(report!.pending)}/><Metric label="Vencido bruto" value={money(report!.overdue)}/><Metric label="Saldos a favor no aplicados" value={money(report!.unapplied)}/><Metric label="Saldo neto al corte" value={money(report!.balance)} detail={side==='all'?'Suma informativa de ambas clases; no es una compensación entre clientes y proveedores.':'Pendientes menos saldos a favor.'}/><Metric label="Diferencia de conciliación" value={money(report!.difference)}/></div>
   <DataTable title={`Antigüedad de cuentas al ${date}`} rows={groups} columns={[{key:'kind',label:'Tipo'},{key:'code',label:'Código'},{key:'name',label:'Contraparte'},{key:'branchName',label:'Sucursal'},...agingBuckets.map((b,i)=>({key:`bucket${i}`,label:b})),{key:'unapplied',label:'A favor sin aplicar'},{key:'balance',label:'Saldo neto'},{key:'actions',label:'Cuenta',render:r=>canAccess(session,`/${r.side==='cliente'?'clientes':'proveedores'}/cuenta-corriente`)?<Link className="button secondary small" to={`/${r.side==='cliente'?'clientes':'proveedores'}/cuenta-corriente?party=${r.partyId}&to=${date}`}>Ver movimientos</Link>:'Detalle debajo'}]}/>
   <DataTable title={`Comprobantes pendientes al ${date}`} rows={items} columns={[{key:'name',label:'Contraparte'},{key:'branchName',label:'Sucursal'},{key:'number',label:'Comprobante'},{key:'date',label:'Emisión'},{key:'due',label:'Vencimiento'},{key:'days',label:'Días de atraso'},{key:'bucket',label:'Antigüedad'},{key:'original',label:'Efecto original'},{key:'applied',label:'Aplicado al corte'},{key:'pending',label:'Pendiente'},{key:'unapplied',label:'A favor sin aplicar'},{key:'applications',label:'Aplicaciones conservadas'}]}/>
   <AccountApplicationsPanel date={date} side={side} partyId={partyId}/>
  </>}
 </Page>
}
