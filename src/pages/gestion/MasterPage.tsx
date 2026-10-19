import { useState } from 'react'
import { Pencil, Plus, Save } from 'lucide-react'
import { useStore } from '@/state/context'
import {stock} from '@/domain/engine'
import { modules, productFields } from '@/domain/modules'
import type { InputSpec } from '@/domain/modules'
import type { Master, Product, RecordData } from '@/domain/types'
import { cents, money, uid, today } from '@/domain/constants'
import {validateTaxRule,taxRuleStatus} from '@/domain/tax-rules'
import { Page, Field, DataTable, Modal, Hint } from '@/components/gestion/UI'
import ProductionShiftsEditor from '@/components/gestion/ProductionShiftsEditor'
import {centerProductionShifts} from '@/domain/production-schedule'
import RouteOperationsEditor from '@/components/gestion/RouteOperationsEditor'
import BankSelect from '@/components/gestion/BankSelect'
import { bankCatalogInfo, bankCatalogPlan } from '@/domain/bank-catalog'
import { canAccess } from '@/domain/permissions'

export function DynamicFields({fields,value,setValue}:{fields:InputSpec[];value:RecordData;setValue:(next:RecordData)=>void}) {
 const {data}=useStore()
 return <div className="form-grid">{fields.map(f=>{
  let options:{id:string;name:string}[]=[]
  if(f.source) { const source=f.source==='products'?data.products:f.source==='suppliers'||f.source==='sellers'?data.parties.filter(p=>p.side==='proveedor'&&(f.source!=='sellers'||p.isSeller)):data.masters[f.source]||[];options=source.map(x=>({id:x.id,name:String(x.sku ? `${x.sku} · ${x.name}` : x.code ? `${x.code} · ${x.name}` : x.name)})) }
  if(f.source==='banks')return <BankSelect key={f.key} label={`${f.label}${f.required?' *':''}`} hint={f.hint} required={f.required} value={String(value[f.key]||'')} onChange={id=>setValue({...value,[f.key]:id})}/>
  return <Field key={f.key} label={`${f.label}${f.required?' *':''}`} hint={f.hint}>{f.type==='checkbox'?<input type="checkbox" checked={Boolean(value[f.key])} onChange={e=>setValue({...value,[f.key]:e.target.checked})}/>:f.type==='select'?<select required={f.required} value={String(f.source?options.find(o=>o.id===value[f.key]||o.name===value[f.key])?.id??value[f.key]??'':value[f.key]??'')} onChange={e=>setValue({...value,[f.key]:e.target.value})}><option value="">Seleccionar…</option>{f.source?options.map(o=><option key={o.id} value={o.id}>{o.name}</option>):f.options?.map(o=><option key={o}>{o}</option>)}</select>:<input type={f.type||'text'} required={f.required} step={f.type==='number'?'any':undefined} value={String(value[f.key]??'')} onChange={e=>setValue({...value,[f.key]:f.type==='number'?Number(e.target.value):e.target.value})}/>}</Field>
 })}</div>
}
export default function MasterPage({path,products=false,service=false}:{path:string;products?:boolean;service?:boolean}) {
 const {data,session,branch,transact}=useStore()
 const spec=modules.find(m=>m.path===path)
 const fields=products?productFields:spec!.fields
 const title=products?(service?'Servicios':'Productos y artículos (SKU)'):spec!.title
 const key=products?'products':spec!.key
 const [editing,setEditing]=useState<RecordData|null>(null)
 const [formError,setError]=useState('')
 const [catalogOpen,setCatalogOpen]=useState(false)
 let catalog:ReturnType<typeof bankCatalogPlan>|undefined,catalogError=''
 if(key==='banks')try{catalog=bankCatalogPlan(data.masters.banks)}catch(error){catalogError=(error as Error).message}
 const admin=session?.role==='Administrador General'
 const rows=(products?data.products.filter(p=>!service||p.kind==='Servicio'):data.masters[key]||[]).filter(r=>branch==='all'||!r.branchId||r.branchId===branch)
 function open(item?:Master) {setError('');setEditing(item?{...item,...(products?{price:Number(item.price)/100,cost:Number(item.cost)/100}:key==='prices'?{price:Number(item.price)/100}:{})}:Object.fromEntries(fields.map(f=>[f.key,f.default??(f.type==='checkbox'?false:'')])))}
 async function save(e:React.FormEvent) {e.preventDefault();if(!editing)return
  const item={...editing,id:String(editing.id||uid())} as Master
  if(products) {item.price=cents(Number(item.price));item.cost=cents(Number(item.cost))}
  if(key==='prices')item.price=cents(Number(item.price))
  if(['production','materials'].includes(key)&&Number(item.quantity)<=0) {setError('La cantidad debe ser mayor que cero.');return}
  if(key==='production'&&String(item.end)<String(item.start)) {setError('La fecha de fin debe ser posterior al inicio.');return}
  if(key==='taxRules')try{validateTaxRule(item)}catch(error){setError((error as Error).message);return}
  if(fields.some(f=>f.required&&String(item[f.key]??'').trim()==='')) {setError('Completá los campos obligatorios.');return}
  const ok=await transact(path,'Guardar registro',title,products?{type:'product.save',product:item as Product}:{type:'master.save',key,item})
  if(ok)setEditing(null)
 }
 const displayRows=rows.map(r=>{const out:Record<string,unknown>={...r};fields.forEach(f=>{if(f.source){const source=f.source==='products'?data.products:f.source==='suppliers'?data.parties:data.masters[f.source]||[];out[f.key]=source.find(x=>x.id===r[f.key])?.name||'—'}if(f.type==='checkbox')out[f.key]=r[f.key]?'Sí':'No'});if(products)out.price=money(Number(r.price));if(products)out.stock=r.kind==='Producto'?stock(data,r.id):'No aplica';if(key==='prices')out.price=money(Number(r.price));if(key==='combos')out.price=money(cents(Number(r.price)));if(key==='workCenters')try{out.schedule=centerProductionShifts(r).map(t=>`${t.name}: ${String(Math.floor(t.startHour)).padStart(2,'0')}:${String(Math.round(t.startHour*60)%60).padStart(2,'0')} a ${String(Math.floor(t.endHour)).padStart(2,'0')}:${String(Math.round(t.endHour*60)%60).padStart(2,'0')}`).join('; ')}catch{out.schedule='Revisar turnos'};if(key==='taxRules'){out.scope=`${r.type} · ${r.tax}${r.jurisdiction?' · '+r.jurisdiction:''}`;out.validity=`${r.validFrom||'—'} a ${r.validUntil||'sin fin declarado'}`;out.effectiveStatus=taxRuleStatus(r,today())};if(key==='materials') {out.available=stock(data,String(r.productId),String(r.depositId));out.pending=Math.max(0,Number(r.quantity)-Number(out.available))}return out})
 return <Page title={title} subtitle={products?'Catálogo, IVA, precios y jerarquía madre → hijo → nieto.':spec!.description} actions={(!spec?.admin||admin)&&<button className="button" onClick={()=>open()}><Plus size={16}/>Nuevo registro</button>}>
  {products&&<Hint>Los productos mueven stock mediante remitos. Los servicios y bienes de uso no generan movimientos del inventario de reventa. Los bienes de uso requieren registrar su costo y depreciación en su circuito contable. Las variantes conservan un SKU propio.</Hint>}
  {key==='taxRules'&&<Hint>Vigencia consultada al {today()}. Las fechas inicial y final son inclusivas. El estado sólo compara las fechas declaradas: no acredita habilitación como agente, padrón, exclusión ni vigencia legal de la norma. Los importes se registran manualmente con su certificado; este catálogo no calcula retenciones o percepciones.</Hint>}
  {key==='banks'&&<Hint><p>Copia disponible del directorio: {bankCatalogInfo.count} entidades financieras, incluidos bancos y compañías financieras. Publicación: {bankCatalogInfo.published}; consulta: {bankCatalogInfo.consulted}. Las denominaciones se muestran como las publica el BCRA.</p><a href={bankCatalogInfo.source} target="_blank" rel="noreferrer">Consultar directorio del BCRA</a>{canAccess(session,'/finanzas/entidades')&&<p><button className="button secondary" onClick={()=>setCatalogOpen(true)}>Revisar incorporación del catálogo BCRA</button></p>}</Hint>}
  <DataTable title={title} rows={displayRows} columns={[...(key==='taxRules'?[{key:'name',label:'Nombre',render:(r:Record<string,unknown>)=><span style={{display:'inline-block',minWidth:140}}>{String(r.name)}</span>},{key:'scope',label:'Régimen y jurisdicción'},{key:'rate',label:'Alícuota (%)'},{key:'validity',label:'Vigencia'},{key:'effectiveStatus',label:'Estado'}]:fields.filter(f=>['sku','name','code','kind','category','type','branchId','group','status','date','due','price','quantity','attribute','value','platform','rate'].includes(f.key)).slice(0,6).map(f=>({key:f.key,label:f.label}))),...(key==='workCenters'?[{key:'schedule',label:'Horario de trabajo'},{key:'hours',label:'Horas / día'}]:[]),...(key==='routes'?[{key:'steps',label:'Operaciones'},{key:'hours',label:'Horas del lote'}]:[]),...(key==='combos'?[{key:'components',label:'SKU y cantidades'}]:[]),...(products?[{key:'stock',label:'Existencias'}]:key==='materials'?[{key:'available',label:'Disponible'},{key:'pending',label:'Faltante'}]:[]),{key:'actions',label:'Acciones',render:r=>(!spec?.admin||admin)&&<button className="button secondary small" onClick={()=>open(rows.find(x=>x.id===r.id))}><Pencil size={14}/>Editar</button>}]}/>
  {editing&&<Modal title={editing.id?'Editar registro':'Nuevo registro'} onClose={()=>setEditing(null)}><form onSubmit={save}><DynamicFields fields={key==='routes'?fields.filter(f=>f.key==='name'):key==='workCenters'?fields.filter(f=>f.key!=='shifts'&&(!editing.shifts||!['hours','startTime'].includes(f.key))):fields} value={editing} setValue={setEditing}/>{key==='workCenters'&&<ProductionShiftsEditor value={editing} setValue={setEditing}/>} {key==='routes'&&<RouteOperationsEditor value={editing} setValue={setEditing}/>}{formError&&<p className="form-error" role="alert">{formError}</p>}<div className="form-footer"><button type="button" className="button secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="button"><Save size={16}/>Guardar</button></div></form></Modal>}
  {catalogOpen&&<Modal title="Incorporar directorio del BCRA" onClose={()=>setCatalogOpen(false)}>{catalogError?<p role="alert" className="form-error">{catalogError}</p>:catalog&&<><p>{catalog.added.length} altas · {catalog.updated.length} registros con código o referencia oficial a completar · {catalog.retained.length} registros conservados sin cambios.</p><Hint>Se conservan los identificadores, nombres propios, sitios web y referencias de las cuentas y cheques. Las entidades personalizadas e históricas permanecen en el catálogo. Esta operación incorpora la copia publicada en {bankCatalogInfo.published}, consultada el {bankCatalogInfo.consulted}.</Hint><DataTable title="Cambios de catálogo" rows={[...catalog.added.map(b=>({...b,change:'Alta'})),...catalog.updated.map(b=>({...b,change:'Completar referencia'}))]} columns={[{key:'change',label:'Cambio'},{key:'code',label:'Código BCRA'},{key:'name',label:'Nombre en SICA'},{key:'bcraName',label:'Denominación BCRA'}]}/><div className="form-footer"><button className="button secondary" onClick={()=>setCatalogOpen(false)}>Cerrar</button><button className="button" disabled={!catalog.added.length&&!catalog.updated.length} onClick={async()=>{if(await transact(path,'Incorporar catálogo BCRA',bankCatalogInfo.published,{type:'banks.catalog.update'}))setCatalogOpen(false)}}>Incorporar catálogo</button></div></>}</Modal>}
  {key==='production'&&<Hint>Finalizá las órdenes desde el panel de Producción para consumir materiales y registrar el ingreso del producto terminado.</Hint>}
 </Page>
}
