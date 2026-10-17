import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '@/state/context'
import { dateLabel, today } from '@/domain/constants'
import type { StockTransferInput, StockTransfer } from '@/domain/types'
import { Page, Panel, Field, DataTable, Hint } from '@/components/gestion/UI'

export default function StockTransfersPage() {
 const {data,branch,transact,busy}=useStore()
 const [draft,setDraft]=useState<StockTransferInput|null>(null),[selected,setSelected]=useState<StockTransfer|null>(null)
 const activeDeposits=data.masters.deposits.filter(d=>d.active!==false&&data.masters.branches.some(b=>b.id===d.branchId&&b.active))
 const products=data.products.filter(p=>p.kind==='Producto')
 const records=(data.stockTransfers||[]).filter(t=>branch==='all'||t.fromBranchId===branch||t.toBranchId===branch)
 const rows=records.map(t=>({...t,dateLabel:dateLabel(t.date),articles:t.lines.map(l=>`${l.sku}: ${l.quantity} ${l.unit}`).join('; ')})).reverse()
 function open(){setSelected(null);setDraft({date:today(),fromId:String(activeDeposits.find(d=>branch==='all'||d.branchId===branch)?.id||''),toId:'',reason:'',lines:[{productId:'',quantity:1}]})}
 function updateLine(i:number,key:'productId'|'quantity',value:string|number){if(draft)setDraft({...draft,lines:draft.lines.map((l,n)=>n===i?{...l,[key]:value}:l)})}
 function available(productId:string){return draft?data.stockMoves.filter(m=>m.productId===productId&&m.depositId===draft.fromId&&m.date<=draft.date).reduce((n,m)=>n+m.quantity,0):0}
 async function submit(e:React.FormEvent){e.preventDefault();if(!draft||busy)return;if(await transact('/stock/traslados','Registrar traslado interno',draft.reason,{type:'stock.transfer',transfer:draft}))setDraft(null)}
 return <Page title="Traslados entre depósitos" subtitle="Salida y entrada de mercadería vinculadas en un único registro." actions={!draft&&<button className="button" onClick={open}><Plus size={16}/>Nuevo traslado</button>}>
  <Hint>El traslado interno descuenta del origen y agrega al destino al guardar. Conserva el stock total de la empresa. Registrá la fecha en que la mercadería ya está recibida; este circuito no administra entregas en tránsito.</Hint>
  {draft&&<Panel title="Registrar traslado interno"><form onSubmit={submit}><div className="form-grid three">
   <Field label="Fecha del traslado *"><input type="date" required min={data.settings.exerciseStart} max={data.settings.exerciseEnd} value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></Field>
   <Field label="Depósito de origen *"><select required value={draft.fromId} onChange={e=>setDraft({...draft,fromId:e.target.value,toId:e.target.value===draft.toId?'':draft.toId})}><option value="">Seleccionar…</option>{activeDeposits.map(d=><option key={d.id} value={d.id}>{d.name} · {data.masters.branches.find(b=>b.id===d.branchId)?.name}</option>)}</select></Field>
   <Field label="Depósito de destino *"><select required value={draft.toId} onChange={e=>setDraft({...draft,toId:e.target.value})}><option value="">Seleccionar…</option>{activeDeposits.filter(d=>d.id!==draft.fromId).map(d=><option key={d.id} value={d.id}>{d.name} · {data.masters.branches.find(b=>b.id===d.branchId)?.name}</option>)}</select></Field>
   <Field label="Motivo *"><input required maxLength={1000} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></Field>
  </div><div className="table-scroll"><table className="erp-table editable"><thead><tr><th>Artículo</th><th>Unidad</th><th>Stock de origen al día</th><th>Cantidad a trasladar</th><th></th></tr></thead><tbody>{draft.lines.map((l,i)=><tr key={i}>
   <td><select aria-label={`SKU del traslado línea ${i+1}`} required value={l.productId} onChange={e=>updateLine(i,'productId',e.target.value)}><option value="">Seleccionar SKU…</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></td>
   <td>{products.find(p=>p.id===l.productId)?.unit||'—'}</td><td>{l.productId?available(l.productId).toLocaleString('es-AR',{maximumFractionDigits:6}):'—'}</td>
   <td><input aria-label={`Cantidad del traslado línea ${i+1}`} type="number" required min="0.000001" max="1000000" step="0.000001" value={l.quantity} onChange={e=>updateLine(i,'quantity',Number(e.target.value))}/></td>
   <td><button className="icon-button" type="button" aria-label={`Quitar artículo ${i+1}`} disabled={draft.lines.length===1} onClick={()=>setDraft({...draft,lines:draft.lines.filter((_,n)=>n!==i)})}><Trash2 size={16}/></button></td>
  </tr>)}</tbody></table></div><button type="button" className="button secondary" disabled={draft.lines.length>=100} onClick={()=>setDraft({...draft,lines:[...draft.lines,{productId:'',quantity:1}]})}><Plus size={16}/>Agregar artículo</button>
  <p className="muted">El control considera la fecha y las salidas posteriores. Se respeta la configuración de stock negativo de cada producto. Los SKU deben aparecer una sola vez.</p>
  <div className="form-footer"><button type="button" className="button secondary" disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button><button className="button" disabled={busy}>{busy?'Guardando…':'Registrar traslado'}</button></div></form></Panel>}
  {selected&&<Panel title={selected.number} actions={<button className="button secondary small" onClick={()=>setSelected(null)}>Cerrar detalle</button>}><p>{dateLabel(selected.date)} · {selected.fromName} → {selected.toName}</p><p>Responsable: {selected.responsible} · Motivo: {selected.reason}</p><DataTable title={`Traslado interno ${selected.number}`} rows={selected.lines} columns={[{key:'sku',label:'SKU'},{key:'description',label:'Descripción'},{key:'unit',label:'Unidad'},{key:'quantity',label:'Cantidad'}]}/><p className="muted">Constancia interna de stock. No reemplaza un remito autorizado para transporte.</p></Panel>}
  <DataTable title="Traslados entre depósitos" rows={rows} columns={[{key:'number',label:'Referencia interna'},{key:'dateLabel',label:'Fecha'},{key:'fromName',label:'Origen'},{key:'toName',label:'Destino'},{key:'articles',label:'Artículos y cantidades'},{key:'responsible',label:'Responsable'},{key:'reason',label:'Motivo'},{key:'actions',label:'Detalle',render:r=><button className="button secondary small" onClick={()=>setSelected(records.find(t=>t.id===r.id)||null)}>Ver</button>}]}/>
 </Page>
}
