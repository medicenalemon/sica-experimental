import { useState, useRef, useEffect, cloneElement, isValidElement } from 'react'
import type { ReactNode, ReactElement } from 'react'
import { Search, Download, FileText, Inbox, ArrowLeft, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { exportXlsx, exportPdf } from '@/domain/files'
import { useStore } from '@/state/context'

export function Page({ title, subtitle, actions, children }: {title:string;subtitle?:string;actions?:ReactNode;children:ReactNode}) {
  return <div className="page-container erp-page"><header className="page-heading"><div><p className="eyebrow">SICA / Gestión integral</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="actions">{actions}</div></header>{children}</div>
}
export function Back({to}:{to:string}) { return <Link className="button secondary" to={to}><ArrowLeft size={16}/>Volver</Link> }
export function Add({to,label='Nuevo registro'}:{to:string;label?:string}) {return <Link className="button" to={to}><Plus size={16}/>{label}</Link>}
export function Panel({title,children,actions}:{title?:string;children:ReactNode;actions?:ReactNode}) {return <section className="card erp-panel">{title && <div className="panel-title"><h2>{title}</h2>{actions}</div>}<div className="panel-content">{children}</div></section>}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) {const control = isValidElement(children) && typeof children.type === 'string' && ['input','select','textarea'].includes(children.type) ? cloneElement(children as ReactElement<{ 'aria-label'?: string }>, { 'aria-label': label }) : children; return <label className="erp-field"><span>{label}</span>{control}{hint && <small>{hint}</small>}</label>}
export function Metric({label,value,detail}:{label:string;value:ReactNode;detail?:string}) {return <div className="card metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>}
export function Empty({message='Todavía no hay registros.',children}:{message?:string;children?:ReactNode}) {return <div className="empty-state"><Inbox size={36}/><h3>{message}</h3><p>Los datos que registres aquí aparecerán en los módulos relacionados.</p>{children}</div>}
export function Hint({children}:{children:ReactNode}) {return <div className="hint"><FileText size={17}/><div>{children}</div></div>}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
 const dialog=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLElement>('button,input,select,textarea')?.focus();return()=>previous?.focus()},[])
 function keyDown(e:React.KeyboardEvent) {
  if(e.key==='Escape'){e.stopPropagation();close.current();return}
  if(e.key!=='Tab')return
  const fields=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length)
  const first=fields[0],last=fields.at(-1)
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
 }
 return <div className="modal-backdrop" onClick={onClose}><section ref={dialog} onKeyDown={keyDown} className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={20}/></button></header>{children}</section></div>}
export interface Column {key:string;label:string;render?:(row: Record<string,unknown>)=>ReactNode}
export function DataTable({columns,rows,title='Reporte',search=true,exportable=true}:{columns:Column[];rows:object[];title?:string;search?:boolean;exportable?:boolean}) {
  const [query,setQuery]=useState('')
  const {notify}=useStore()
  const visible=(rows as Record<string,unknown>[]).filter(r=>JSON.stringify(r).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))
  const exportRows=visible.map(r=>Object.fromEntries(columns.filter(c=>c.key!=='actions').map(c=>[c.label,r[c.key]??''])))
  async function download(format:string) { try { if(format==='xlsx') await exportXlsx(title,exportRows); else await exportPdf(title,exportRows) } catch {notify('Error: no se pudo generar el archivo.')} }
  return <div className="card table-card"><div className="table-toolbar">{search && <label className="search-input"><Search size={17}/><input aria-label="Buscar registros" placeholder="Buscar en los registros…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}<span className="muted">{visible.length} registros</span>{exportable && <div className="actions"><button className="button secondary small" onClick={()=>download('xlsx')}><Download size={14}/>XLSX</button><button className="button secondary small" onClick={()=>download('pdf')}><FileText size={14}/>PDF</button></div>}</div>{visible.length ? <div className="table-scroll"><table className="erp-table"><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{visible.map((r,i)=><tr key={String(r.id??i)}>{columns.map(c=><td key={c.key}>{c.render ? c.render(r) : String(r[c.key]??'—')}</td>)}</tr>)}</tbody></table></div> : <Empty message={query?'No hay coincidencias.':'Todavía no hay registros.'}/>}</div>
}
