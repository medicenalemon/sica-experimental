import {applicationAmount} from './account-applications'
import type {Document,Side,State} from './types'
import {documentSign} from './engine'
import {sumMoney} from './treasury-model'

export const agingBuckets=['A vencer / vence hoy','1-30 días','31-60 días','61-90 días','Más de 90 días','Sin vencimiento informado'] as const
export interface AgingItem {id:string;partyId:string;side:Side;branchId:string;number:string;date:string;due:string;days:number|null;bucket:string;original:number;applied:number;pending:number;unapplied:number;applications:string[]}
export interface AgingGroup {id:string;partyId:string;name:string;code:string;side:Side;branchId:string;branchName:string;buckets:number[];pending:number;overdue:number;unapplied:number;balance:number;difference:number}
export interface AgingReport {date:string;items:AgingItem[];groups:AgingGroup[];pending:number;overdue:number;unapplied:number;balance:number;difference:number}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value}
function effect(d:Document){const value=d.total*documentSign(d.kind);if(!Number.isSafeInteger(value))throw new Error('La cuenta corriente contiene importes fuera del rango seguro.');return value}
const bucket=(days:number|null)=>days===null?5:days<=0?0:days<=30?1:days<=60?2:days<=90?3:4

/** Applications are evaluated at the cutoff; unallocated credits are never assigned by FIFO. */
export function accountsAging(s:State,date:string,branch='all',side:Side|'all'='all',partyId=''):AgingReport{
 if(!validDate(date))throw new Error('Elegí una fecha de corte válida.')
 const all=s.documents.filter(d=>documentSign(d.kind)!==0),byId=new Map(all.map(d=>[d.id,d]))
 const docs=all.filter(d=>d.date<=date&&(branch==='all'||d.branchId===branch)&&(side==='all'||d.side===side)&&(!partyId||d.partyId===partyId))
 if(docs.some(d=>!validDate(d.date)||d.due&&!validDate(d.due)))throw new Error('Hay fechas inválidas en los comprobantes de la selección.')
 const applied=new Map<string,number>(),used=new Map<string,number>(),references=new Map<string,string[]>()
 for(const d of docs){
  const allocations=d.allocations||[],value=effect(d)
  if(allocations.length&&value>=0)throw new Error(`Revisá las aplicaciones de ${d.number}: el origen debe ser una cancelación.`)
  if(new Set(allocations.map(a=>a.documentId)).size!==allocations.length)throw new Error(`Aplicaciones repetidas en ${d.number}.`)
  if(sumMoney(allocations.map(a=>a.amount))>Math.abs(value))throw new Error(`Las aplicaciones superan el importe de ${d.number}.`)
  for(const a of allocations){
   const target=byId.get(a.documentId)
   if(!Number.isSafeInteger(a.amount)||a.amount<0||!target||effect(target)<=0||target.partyId!==d.partyId||target.side!==d.side||target.branchId!==d.branchId)throw new Error(`Revisá el destino de las aplicaciones de ${d.number}.`)
   if(target.date>date)continue
   applied.set(target.id,sumMoney([applied.get(target.id)||0,a.amount]));used.set(d.id,sumMoney([used.get(d.id)||0,a.amount]))
   if(a.amount){references.set(target.id,[...(references.get(target.id)||[]),d.number]);references.set(d.id,[...(references.get(d.id)||[]),target.number])}
  }
 }
 const items:AgingItem[]=docs.map(d=>{
  const original=effect(d),assigned=sumMoney([original>0?applied.get(d.id)||0:used.get(d.id)||0,applicationAmount(s,d.id,original>0?'target':'credit',date)])
  if(assigned<0||assigned>Math.abs(original))throw new Error(`Las aplicaciones superan el saldo de ${d.number}.`)
  const days=d.due?Math.round((Date.parse(`${date}T12:00:00Z`)-Date.parse(`${d.due}T12:00:00Z`))/86400000):null
  return {id:d.id,partyId:d.partyId,side:d.side,branchId:d.branchId,number:d.number,date:d.date,due:d.due,days,bucket:original>0?agingBuckets[bucket(days)]:'Saldo a favor no aplicado',original,applied:assigned,pending:original>0?original-assigned:0,unapplied:original<0?-original-assigned:0,applications:[...(references.get(d.id)||[]),...(s.accountApplications||[]).filter(r=>r.preview.date<=date&&(r.preview.credit.id===d.id||r.preview.lines.some(l=>l.document.id===d.id))).map(r=>`${r.number} · ${r.preview.kind}`)]}
 })
 const keys=[...new Set(docs.map(d=>JSON.stringify([d.side,d.partyId,d.branchId])))],groups=keys.map(key=>{
  const [kind,id,branchId]=JSON.parse(key) as [Side,string,string],rows=items.filter(i=>i.side===kind&&i.partyId===id&&i.branchId===branchId),party=s.parties.find(p=>p.id===id)
  const buckets=agingBuckets.map(b=>sumMoney(rows.filter(r=>r.bucket===b).map(r=>r.pending))),pending=sumMoney(buckets),unapplied=sumMoney(rows.map(r=>r.unapplied)),balance=sumMoney(rows.map(r=>r.original))
  return {id:key,partyId:id,side:kind,branchId,name:party?.name||id,code:party?.code||'',branchName:String(s.masters.branches.find(b=>b.id===branchId)?.name||branchId),buckets,pending,overdue:sumMoney(buckets.slice(1,5)),unapplied,balance,difference:sumMoney([pending,-unapplied,-balance])}
 }).sort((a,b)=>a.side.localeCompare(b.side)||a.name.localeCompare(b.name)||a.branchName.localeCompare(b.branchName))
 const pending=sumMoney(groups.map(g=>g.pending)),unapplied=sumMoney(groups.map(g=>g.unapplied)),balance=sumMoney(groups.map(g=>g.balance)),difference=sumMoney([pending,-unapplied,-balance])
 if(difference||groups.some(g=>g.difference))throw new Error('La antigüedad no concilia con los saldos de cuenta corriente.')
 return {date,items:items.sort((a,b)=>a.date.localeCompare(b.date)||a.number.localeCompare(b.number)),groups,pending,overdue:sumMoney(groups.map(g=>g.overdue)),unapplied,balance,difference}
}
