import {useCallback,useEffect,useRef,useState} from 'react'
import {useStore,type ActiveSession} from '@/state/context'
import {Page,Panel,DataTable,Field,Hint,Modal,Metric} from '@/components/gestion/UI'

const date=(value:string|null)=>value?new Date(value).toLocaleString('es-AR',{timeZone:'America/Argentina/Tucuman',hourCycle:'h23'}):'Sin registro anterior'
export default function SessionsPage(){
 const {mode,session,activeSessions,transact,busy,notify}=useStore()
 const [rows,setRows]=useState<ActiveSession[]>([]),[loading,setLoading]=useState(mode==='server'),[error,setError]=useState(''),[target,setTarget]=useState<ActiveSession|null>(null),[reason,setReason]=useState('')
 const loader=useRef(activeSessions)
 useEffect(()=>{loader.current=activeSessions},[activeSessions])
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{setRows(await loader.current())}catch(e){setError(e instanceof Error?e.message:'No se pudo consultar las sesiones.')}finally{setLoading(false)}},[])
 useEffect(()=>{if(mode==='server')void refresh()},[mode,session?.userId,refresh])
 return <Page title="Sesiones y terminales" subtitle="Consultá los accesos vigentes y cerrá sesiones de otros equipos con un motivo registrado." actions={mode==='server'&&<button className="button secondary" disabled={loading||busy} onClick={()=>void refresh()}>{loading?'Actualizando…':'Actualizar sesiones'}</button>}>
  {mode==='local'?<Hint>Esta instalación usa el modo local del navegador. La gestión de sesiones y terminales está disponible en el modo compartido con servidor.</Hint>:<>
   <div className="metrics-grid"><Metric label="Sesiones vigentes" value={loading&&!rows.length?'—':String(rows.length)}/><Metric label="Usuarios con sesiones" value={loading&&!rows.length?'—':String(new Set(rows.map(r=>r.userId)).size)}/></div>
   <Hint>El nombre de terminal es el indicado al ingresar. Varias sesiones pueden pertenecer al mismo equipo; esta lista no acredita cantidad de máquinas ni activación de licencias. Las sesiones duran ocho horas, o treinta días si se eligió mantener sesión, y no renuevan su vencimiento al consultar datos.</Hint>
   {error&&<p role="alert" className="form-error">{error}</p>}
   <Panel title="Accesos activos">{loading&&!rows.length?<p role="status">Consultando sesiones…</p>:<DataTable title="Sesiones activas" exportable={false} rows={rows.map(r=>({...r,created:date(r.created),lastSeen:date(r.lastSeen),expires:date(r.expires),status:r.current?'Sesión actual':'Otra sesión'}))} columns={[{key:'terminal',label:'Terminal'},{key:'name',label:'Nombre'},{key:'username',label:'Usuario'},{key:'role',label:'Perfil'},{key:'created',label:'Inicio'},{key:'lastSeen',label:'Última consulta'},{key:'expires',label:'Vencimiento'},{key:'status',label:'Estado'},{key:'action',label:'Acción',render:r=><button className="button secondary small" disabled={busy||!!r.current} aria-label={`Cerrar sesión de ${r.terminal} · ${r.username}`} onClick={()=>{setReason('');setTarget(rows.find(s=>s.id===r.id)!)} }>{r.current?'Sesión actual':'Cerrar sesión'}</button>}]}/>}</Panel>
  </>}
  {target&&<Modal title="Cerrar sesión de otra terminal" onClose={()=>setTarget(null)}><form onSubmit={async e=>{e.preventDefault();if(await transact('/administracion/sesiones','Cerrar sesión de otra terminal',target.terminal,{type:'sessions.revoke',sessionId:target.id,reason})){notify('La sesión seleccionada fue cerrada.');setTarget(null);await refresh()}}}>
   <p>{target.terminal} · {target.name} ({target.username})</p><p>La próxima consulta u operación de esa sesión requerirá ingresar nuevamente. Su usuario conservará el acceso y los comprobantes registrados.</p>
   <Field label="Motivo *"><textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
   <div className="form-footer"><button className="button secondary" type="button" onClick={()=>setTarget(null)}>Cancelar</button><button className="button" disabled={busy||!reason.trim()}>Cerrar esta sesión</button></div>
  </form></Modal>}
 </Page>
}
