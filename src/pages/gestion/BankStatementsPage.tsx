import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/state/context'
import type { BankStatement, BankStatementInput } from '@/domain/types'
import { bankCandidates, bankLineGroup, importBankStatement, parseStatementRows, statementHeaders, statementSummary } from '@/domain/bank-reconciliation'
import {readBankStatementCsv} from '@/domain/bank-statement-csv'
import { money, today, dateLabel } from '@/domain/constants'
import { exportXlsx, readXlsx } from '@/domain/files'
import { Page, Panel, Field, Metric, DataTable, Modal, Hint } from '@/components/gestion/UI'

const path='/finanzas/bancos/extractos'
export default function BankStatementsPage() {
 const {data,branch,session,busy,transact,notify}=useStore()
 const accounts=data.masters.treasury.filter(t=>t.type==='Banco'&&(branch==='all'||t.branchId===branch))
 const statements=(data.bankStatements||[]).filter(s=>accounts.some(a=>a.id===s.treasuryId))
 const readVersion=useRef(0)
 const [rowNumbers,setRowNumbers]=useState<string[]>([])
 const [selected,setSelected]=useState(''),[selectedLines,setSelectedLines]=useState<string[]>([]),[adding,setAdding]=useState(false)
 const [account,setAccount]=useState(''),[name,setName]=useState(''),[from,setFrom]=useState(today()),[to,setTo]=useState(today()),[opening,setOpening]=useState('0'),[closing,setClosing]=useState('0'),[text,setText]=useState(''),[error,setError]=useState(''),[reading,setReading]=useState(false)
 const [action,setAction]=useState<{statement:BankStatement;lineId:string;lineIds?:string[];type:'match'|'group'|'unmatch'|'cancel'}|null>(null),[moveIds,setMoveIds]=useState<string[]>([]),[note,setNote]=useState('')
 const current=statements.find(s=>s.id===selected),summary=current?statementSummary(data,current):undefined
 const rows=text.split(/\r?\n/).filter(l=>l.trim()).filter((l,i)=>i!==0||l.split('\t')[0]!=='Fecha').map((l,i)=>{const values=l.split('\t');return {...Object.fromEntries(statementHeaders.map((h,k)=>[h,values[k]||''])),__row:rowNumbers[i]||String(i+2),__columns:String(values.length)}})
 const parsed=parseStatementRows(rows)
 function start(){readVersion.current++;setReading(false);setRowNumbers([]);setAccount(String(accounts[0]?.id||''));setName('');setFrom(today());setTo(today());setOpening('0');setClosing('0');setText('');setError('');setAdding(true)}
 function selectAction(s:BankStatement,lineId:string,type:'match'|'unmatch'|'cancel') {
  setNote('');setAction({statement:s,lineId,type});setMoveIds([])
  if(type==='match'){const line=s.lines.find(l=>l.id===lineId)!,exact=bankCandidates(data,s,line).filter(m=>m.amount===line.amount&&m.distance<=7);if(exact.length===1)setMoveIds([exact[0].id])}
 }
 function ars(value:string){const p=parseStatementRows([{Fecha:today(),Referencia:'saldo',Descripcion:'saldo',Importe:value}]);if(value.trim()==='0'||/^[+-]?0(?:[.,]0{1,2})?$/.test(value.trim()))return 0;if(p.errors.length)throw new Error('Saldos ARS: sin separadores de miles y hasta dos decimales.');return p.lines[0].amount}
 async function save(e:React.FormEvent){e.preventDefault();setError('');try{
  if(reading)throw new Error('Esperá a que termine la lectura del archivo.')
  if(parsed.errors.length)throw new Error('Corregí todas las filas antes de cargar el extracto.')
  const statement:BankStatementInput={treasuryId:account,name,from,to,opening:ars(opening),closing:ars(closing),lines:parsed.lines}
  importBankStatement(structuredClone(data),statement,session!)
  if(await transact(path,'Cargar extracto bancario',name,{type:'bank.import',statement})){setAdding(false);setSelected('')}
 }catch(e){setError(e instanceof Error?e.message:'No se pudo revisar el extracto.')}}
 async function load(file:File){
  const version=++readVersion.current
  setReading(true);setText('');setRowNumbers([]);setError('')
  try{
   if(!/\.(xlsx|csv)$/i.test(file.name))throw new Error('Seleccioná un archivo XLSX o CSV.')
   const x=/\.csv$/i.test(file.name)?await readBankStatementCsv(file):await readXlsx(file)
   if(version!==readVersion.current)return
   if(statementHeaders.some(h=>!x.headers.includes(h)))throw new Error('El archivo necesita Fecha, Referencia, Descripcion e Importe.')
   setRowNumbers(x.rows.map((r,i)=>r.__row||String(i+2)))
   setText(x.rows.map(r=>statementHeaders.map(h=>String(r[h]||'').replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n'))
   setError('');if(!name)setName(file.name)
  }catch(e){if(version===readVersion.current){setText('');setRowNumbers([]);setError(e instanceof Error?e.message:'No se pudo leer el archivo.')}}
  finally{if(version===readVersion.current)setReading(false)}
 }
 function closeImport(){readVersion.current++;setReading(false);setAdding(false)}

 function selectGroup(s:BankStatement){const rows=s.lines.filter(l=>selectedLines.includes(l.id)&&!l.treasuryMoveIds.length);setNote('');setMoveIds([]);setAction({statement:s,lineId:rows[0].id,lineIds:rows.map(l=>l.id),type:'group'})}
 const actionLine=action?.statement.lines.find(l=>l.id===action.lineId)
 const candidates=action&&actionLine?bankCandidates(data,action.statement,actionLine):[]
 const actionRows=action?.type==='group'?action.statement.lines.filter(l=>action.lineIds?.includes(l.id)):actionLine?[actionLine]:[]
 const bankTotal=actionRows.reduce((n,l)=>n+l.amount,0),isMatching=action?.type==='match'||action?.type==='group'
 const selectedRows=current?.lines.filter(l=>selectedLines.includes(l.id)&&!l.treasuryMoveIds.length)||[],sameSign=selectedRows.every(l=>Math.sign(l.amount)===Math.sign(selectedRows[0]?.amount||0))
 const chosen=candidates.filter(m=>moveIds.includes(m.id)).reduce((n,m)=>n+m.amount,0)
 return <Page title="Extractos y conciliación bancaria" subtitle="Revisá saldos, vinculá movimientos y conservá la evidencia de cada conciliación." actions={<><Link className="button secondary" to="/finanzas/bancos">Movimientos bancarios</Link><button className="button" disabled={busy||!accounts.length} onClick={start}>Cargar extracto</button></>}>
  {!accounts.length&&<Hint>Creá primero una cuenta de tipo Banco en <Link to="/finanzas/cuentas-tesoreria">Cajas y cuentas bancarias</Link>.</Hint>}
  <DataTable title="Extractos bancarios" rows={statements.map(s=>({...s,period:`${dateLabel(s.from)} — ${dateLabel(s.to)}`,opening:money(s.opening),closing:money(s.closing),progress:`${s.lines.filter(l=>l.treasuryMoveIds.length).length}/${s.lines.length}`}))} columns={[{key:'name',label:'Referencia'},{key:'accountName',label:'Cuenta'},{key:'period',label:'Período'},{key:'opening',label:'Saldo inicial'},{key:'closing',label:'Saldo final'},{key:'progress',label:'Filas vinculadas'},{key:'status',label:'Estado'},{key:'actions',label:'Acción',render:r=><button className="button secondary small" onClick={()=>{setSelected(String(r.id));setSelectedLines([])}}>Revisar</button>}]}/>
  {current&&summary&&<><Panel title={`${current.name} · ${current.accountName}`} actions={<button className="button secondary small" onClick={()=>setSelected('')}>Cerrar revisión</button>}>
   <p>{dateLabel(current.from)} — {dateLabel(current.to)} · Cargado por {current.importedBy} · {current.status}</p>
   <div className="metrics-grid"><Metric label="Saldo final del extracto" value={money(current.closing)}/><Metric label="Saldo SICA al fin del período" value={money(summary.ledger)}/><Metric label="Diferencia sin ajustar" value={money(summary.difference)}/></div>
   {current.status==='Activo'&&<div className="actions"><button className="button secondary" disabled={busy||selectedRows.length<2||selectedRows.length>100||!sameSign} onClick={()=>selectGroup(current)}>Vincular filas seleccionadas</button><span>{selectedRows.length} filas · {money(selectedRows.reduce((n,l)=>n+l.amount,0))}</span>{!sameSign&&<span role="alert">Seleccioná filas del mismo signo.</span>}</div>}
   <DataTable title={`Conciliación ${current.name}`} rows={current.lines.map(l=>({...l,date:dateLabel(l.date),amount:money(l.amount),group:bankLineGroup(current,l.id)?.lineIds.map(id=>current.lines.find(row=>row.id===id)?.reference).join(', ')||'—',matched:l.treasuryMoveIds.length?l.treasuryMoveIds.map(id=>data.treasuryMoves.find(m=>m.id===id)?.reason||'—').join('; '):'Pendiente',operator:current.events.filter(e=>(e.lineId===l.id||e.lineIds?.includes(l.id))&&e.action==='Vincular').at(-1)?.user||'—'}))} columns={[{key:'select',label:'Agrupar',render:r=>current.status==='Activo'&&!(r.treasuryMoveIds as string[]).length?<input type="checkbox" aria-label={`Seleccionar fila ${r.reference}`} checked={selectedLines.includes(String(r.id))} onChange={e=>setSelectedLines(e.target.checked?[...selectedLines,String(r.id)]:selectedLines.filter(id=>id!==r.id))}/>:null},{key:'date',label:'Fecha bancaria'},{key:'reference',label:'Referencia'},{key:'description',label:'Descripción'},{key:'amount',label:'Importe'},{key:'matched',label:'Movimientos SICA'},{key:'group',label:'Filas del grupo'},{key:'operator',label:'Responsable del último vínculo'},{key:'actions',label:'Acción',render:r=>current.status==='Activo'&&<button disabled={busy} className="button secondary small" aria-label={`${(r.treasuryMoveIds as string[]).length?'Desvincular':'Vincular'} fila ${r.reference}`} onClick={()=>selectAction(current,String(r.id),(r.treasuryMoveIds as string[]).length?'unmatch':'match')}>{(r.treasuryMoveIds as string[]).length?'Desvincular':'Vincular'}</button>}]}/>
   <div className="metrics-grid"><Metric label="Neto pendiente en extracto" value={money(summary.pendingBank)}/><Metric label="Neto pendiente en SICA hasta el cierre" value={money(summary.pendingLedger)}/><Metric label="Diferencia por explicar" value={money(summary.unexplained)} detail="Extracto − pendientes del extracto + pendientes SICA − saldo SICA"/></div>
   <Hint>Los netos pueden ser cero aunque existan filas pendientes. Revisá cada movimiento y los saldos de apertura. Un vínculo requiere la misma cuenta, signo e importe exacto. Cargar o vincular el extracto no crea cobros, pagos, gastos ni asientos.</Hint>
   {current.status==='Activo'&&<button className="button secondary" disabled={busy||current.lines.some(l=>l.treasuryMoveIds.length)} onClick={()=>selectAction(current,'','cancel')}>Anular extracto sin vínculos</button>}
  </Panel><Panel title="Historial de revisión"><DataTable title="Historial de conciliación" rows={current.events.map(e=>({...e,at:new Date(e.at).toLocaleString('es-AR'),reference:(e.lineIds||[e.lineId]).map(id=>current.lines.find(l=>l.id===id)?.reference||'Extracto').join(', '),moves:e.moveIds.length}))} columns={[{key:'at',label:'Fecha'},{key:'action',label:'Acción'},{key:'reference',label:'Referencia'},{key:'moves',label:'Movimientos'},{key:'user',label:'Responsable'},{key:'note',label:'Motivo'}]}/></Panel></>}
  <Hint>Los formatos XLSX y CSV usan Fecha (AAAA-MM-DD), Referencia única de operación, Descripcion e Importe ARS con signo: positivo ingreso, negativo egreso. Adaptá el archivo exportado por tu banco a esas columnas. No hay conexión automática con bancos ni conversión de moneda.</Hint>
  {adding&&<Modal title="Cargar extracto bancario" onClose={closeImport}><form onSubmit={save}><div className="form-grid">
   <Field label="Cuenta bancaria *"><select required value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Referencia del extracto *"><input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></Field>
   <Field label="Desde *"><input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Hasta *"><input type="date" required value={to} onChange={e=>setTo(e.target.value)}/></Field><Field label="Saldo inicial ARS *"><input required value={opening} onChange={e=>setOpening(e.target.value)}/></Field><Field label="Saldo final ARS *"><input required value={closing} onChange={e=>setClosing(e.target.value)}/></Field>
  </div><div className="actions"><button type="button" className="button secondary small" onClick={()=>void exportXlsx('Modelo-extracto-bancario',[],statementHeaders).catch(()=>notify('Error: no se pudo generar el modelo.'))}>Descargar modelo XLSX</button><Field label="Leer archivo XLSX o CSV"><input type="file" disabled={reading} accept=".xlsx,.csv,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f)}}/></Field></div>
  <Hint>CSV en UTF-8, con encabezados Fecha, Referencia, Descripcion e Importe. Se detecta coma, punto y coma o tabulación. Usá comillas para celdas que contienen el separador; la coma decimal necesita comillas en CSV separado por comas. Los saltos de línea dentro de celdas se muestran como espacios.</Hint>
  {reading&&<p role="status">Leyendo archivo…</p>}
  <Field label="Filas del extracto" hint="También podés pegar filas desde una planilla: Fecha, Referencia, Descripcion e Importe, separadas por tabulaciones. No uses separadores de miles."><textarea rows={5} value={text} disabled={reading} onChange={e=>{setRowNumbers([]);setText(e.target.value)}} placeholder={`Fecha\tReferencia\tDescripcion\tImporte\n${today()}\tOP-001\tTransferencia recibida\t10000.00`}/></Field>
  <p>{parsed.lines.length} filas válidas · Neto de movimientos: {money(parsed.lines.reduce((n,l)=>n+l.amount,0))}</p>
  <DataTable title="Vista previa del extracto" rows={parsed.lines.map(l=>({...l,amount:money(l.amount)}))} columns={[{key:'date',label:'Fecha'},{key:'reference',label:'Referencia'},{key:'description',label:'Descripción'},{key:'amount',label:'Importe'}]} exportable={false}/>
  {parsed.errors.map(e=><p className="form-error" key={e.row}>Fila {e.row}: {e.message}</p>)}{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-footer"><button className="button" disabled={busy||reading||!parsed.lines.length||!!parsed.errors.length}>Guardar extracto revisado</button></div></form></Modal>}
  {action&&<Modal title={action.type==='group'?'Vincular grupo bancario':action.type==='match'?'Vincular fila bancaria':action.type==='unmatch'?'Desvincular fila bancaria':'Anular extracto'} onClose={()=>setAction(null)}><form onSubmit={async e=>{e.preventDefault();const a=action;if(await transact(path,'Revisar extracto bancario',a.statement.name,a.type==='group'?{type:'bank.match-group',statementId:a.statement.id,lineIds:a.lineIds!,moveIds,note}:a.type==='match'?{type:'bank.match',statementId:a.statement.id,lineId:a.lineId,moveIds,note}:a.type==='unmatch'?{type:'bank.unmatch',statementId:a.statement.id,lineId:a.lineId,note}:{type:'bank.cancel',statementId:a.statement.id,note})){setAction(null);setSelectedLines([])}}}>
   {actionLine&&<p>{actionLine.reference} · {dateLabel(actionLine.date)} · {actionLine.description} · {money(actionLine.amount)}</p>}
   {action.type==='group'&&<Hint>Se vincularán juntas estas filas: {actionRows.map(l=>`${l.reference} (${money(l.amount)})`).join(', ')}. Total bancario: {money(bankTotal)}. Revisá el fundamento y los movimientos SICA.</Hint>}
   {action.type==='unmatch'&&bankLineGroup(action.statement,action.lineId)&&<Hint>Se deshará el grupo completo: {bankLineGroup(action.statement,action.lineId)!.lineIds.map(id=>action.statement.lines.find(l=>l.id===id)?.reference).join(', ')}. Todos sus movimientos volverán a pendientes.</Hint>}
   {isMatching&&<><p>{action.type==='group'?'Seleccioná los movimientos cuyo total coincide con las filas revisadas. No se propone una agrupación automáticamente.':'Revisá la selección. Sólo se propone un movimiento cuando existe una coincidencia única de importe dentro de siete días.'}</p>{candidates.length?candidates.map(m=><Field key={m.id} label={`${dateLabel(m.date)} · ${m.reason} · ${money(m.amount)}`}><input type="checkbox" checked={moveIds.includes(m.id)} onChange={e=>setMoveIds(e.target.checked?[...moveIds,m.id]:moveIds.filter(id=>id!==m.id))}/></Field>):<p>No hay movimientos pendientes con el mismo signo en esta cuenta.</p>}<p>Total seleccionado: {money(chosen)} · Diferencia: {money(bankTotal-chosen)}</p></>}
   <Field label={action.type==='match'?'Observaciones':'Motivo *'}><textarea required={action.type!=='match'} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></Field>
   <div className="form-footer"><button className="button" disabled={busy||(isMatching&&(!moveIds.length||chosen!==bankTotal||(action.type==='group'&&!note.trim())))}>{isMatching?'Confirmar vínculo':action.type==='unmatch'?'Confirmar desvinculación':'Confirmar anulación'}</button></div></form></Modal>}
 </Page>
}
