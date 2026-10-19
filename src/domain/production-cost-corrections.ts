import {productionRecoveryPositions,productionRecoveryReferences} from './production-recoverability'
import type {State,Session,ServiceReestimateInput,EntryLine} from './types'
import type {ProductionCostRecord} from './production-costs'
import {remeasureProductionCost} from './production-cost-remeasurement'
import {previewServiceReestimate,reestimateService,serviceReview} from './service-accruals'
import type {ServiceReestimatePreview} from './service-accruals'
import {withLinkedProductionCorrection} from './production-correction-context'
import {accountingSum,validJournal} from './trial-balance'
import {requireAdmin} from './permissions'
import {uid} from './constants'
import {inventoryAccountDefaults,previewInventoryCost,postInventoryCost,inventoryCostReview} from './inventory-costing'
import type {InventoryCostInput} from './types'
import type {InventoryPreview} from './inventory-costing'

export interface ProductionReestimateInput {version?:1|2|3;service:ServiceReestimateInput;reason:string;allocationConfirmed:boolean;review?:string}
interface SourceMeasurement {poolId:string;entryId:string;lineIndex:number;accountId:string;value:number;capitalized:number}
export interface ProductionCorrectionLayer {productionCostId:string;number:string;measurement:ReturnType<typeof remeasureProductionCost>;sources:SourceMeasurement[];allocations:{orderId:string;amount:number}[]}
export interface ProductionReestimatePreview {version?:2|3;destinations?:{wip:number;inventory:number;cogs:number;other:{accountId:string;amount:number}[]};inventory?:{correctionId:string;number:string;batchPrefixIds:string[];input:InventoryCostInput;preview:InventoryPreview};date:string;reason:string;service:ServiceReestimatePreview;entryPrefixIds:string[];stockPrefixIds:string[];costPrefixIds:string[];correctionPrefixIds:string[];layers:ProductionCorrectionLayer[];lines:EntryLine[];difference:number;expenseDifference:number}
export interface ProductionCorrection extends ProductionReestimateInput {id:string;number:string;responsible:string;createdAt:string;sourceId:string;sourceEntryId:string;inventoryBatchId?:string;entryIds:string[];preview:ProductionReestimatePreview}
const sum=(values:number[])=>values.reduce(accountingSum,0)
// Largest remainders also work for signed contributions in a positive net group.
function distribute(total:number,weights:number[],denominator=sum(weights)){
 if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(denominator)||denominator<=0)throw new Error('El reparto corregido requiere un costo neto y una base seguros.')
 const d=BigInt(denominator),rows=weights.map((w,i)=>{const n=BigInt(total)*BigInt(w);return {i,value:Number(n/d),remainder:n%d}}),difference=total-sum(rows.map(r=>r.value)),rank=[...rows].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)
 for(let i=0;i<Math.abs(difference);i++)(difference>0?rank[i]:rank[rank.length-1-i]).value+=Math.sign(difference)
 return rows.map(r=>r.value)
}
function latestLayer(state:State,id:string){return (state.productionCorrections||[]).flatMap(c=>c.preview.layers).filter(l=>l.productionCostId===id).at(-1)}
function currentSources(state:State,r:ProductionCostRecord):SourceMeasurement[]{return latestLayer(state,r.id)?.sources||r.preview.pools.flatMap(p=>p.sourceLines.map(s=>({poolId:p.id,entryId:s.entryId,lineIndex:s.lineIndex,accountId:s.accountId,value:s.value,capitalized:s.capitalized})))}
function currentRecord(state:State,r:ProductionCostRecord):ProductionCostRecord{
 const sources=currentSources(state,r),layer=latestLayer(state,r.id)
 if(!layer)return r
 return {...r,preview:{...r.preview,capitalized:layer.measurement.capitalized,unabsorbed:layer.measurement.unabsorbed,allocations:layer.allocations,pools:r.preview.pools.map(p=>{const measured=layer.measurement.pools.find(m=>m.poolId===p.id)!;return {...p,gross:measured.gross,capitalized:measured.capitalized,unabsorbed:measured.unabsorbed,sourceLines:p.sourceLines.map(s=>({...s,...sources.find(v=>v.poolId===p.id&&v.entryId===s.entryId&&v.lineIndex===s.lineIndex)!})),shares:measured.allocations.map(a=>({orderId:a.orderId,amount:a.after}))}})}}
}
export function previewProductionReestimate(state:State,input:ProductionReestimateInput,historical=false,frozenInventory?:ProductionReestimatePreview['inventory']):ProductionReestimatePreview{
 const version=input.version??(historical?1:3);if(version!==1&&version!==2&&version!==3||!historical&&version!==3)throw new Error('Las nuevas correcciones requieren la revisión vigente con conciliación de destinos.')
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>2000||input.allocationConfirmed!==true)throw new Error('Fundamentá la nueva información y confirmá que se mantiene el criterio original de reparto.')
 const service=withLinkedProductionCorrection(state,()=>previewServiceReestimate(state,input.service,historical)),accrual=state.serviceAccruals!.find(a=>a.id===service.accrualId)!,changed=new Set(service.lines.filter(l=>l.difference).map(l=>l.accountId)),records=(state.productionCosts||[]).filter(r=>r.preview.pools.some(p=>p.sourceLines.some(s=>changed.has(s.accountId)&&state.entries.find(e=>e.id===s.entryId)?.serviceRecordId===accrual.id)))
 if(!records.length)throw new Error('La nueva estimación no modifica fuentes de conversión conservadas.')
 if(records.some(r=>r.date>service.date)||state.inventoryCostBatches?.some(b=>b.date>=service.date))throw new Error('La corrección debe ser posterior a la imputación y al último corte CPP conservado.')
 if(records.some(r=>r.preview.pools.some(p=>new Set(p.sourceLines.map(s=>JSON.stringify([s.entryId,s.lineIndex]))).size!==p.sourceLines.length)))throw new Error('Consolidá las partes repetidas de una misma línea dentro del grupo antes de corregirlo.')
 const orders=new Set(records.flatMap(r=>r.orders))
 if(productionRecoveryPositions(state,service.date).some(b=>orders.has(b.orderId)&&b.allowance))throw new Error('La corrección de conversión desvalorizada requiere conciliar la pérdida y su límite de costo en la misma operación.')
 if(version===1&&state.stockMoves.some(m=>orders.has(m.documentId)&&m.quantity>0))throw new Error('Esta revisión requiere órdenes íntegramente en proceso; el producto terminado necesita su conciliación de existencias y costo de ventas.')
 if(state.reexpressionPostings?.length||state.inventoryInflations?.length)throw new Error('La corrección de conversión con una base reexpresada requiere su conciliación de moneda.')
 const sourceChanges=new Map<string,number>(),original=state.entries.find(e=>e.id===accrual.entryId)!
 for(const accountId of changed){
  const baseline=sum(accrual.preview.lines.filter(l=>l.accountId===accountId).map(l=>l.value)),value=sum(service.lines.filter(l=>l.accountId===accountId).map(l=>l.value)),claims=records.flatMap(r=>r.preview.pools.flatMap(p=>p.sourceLines.filter(s=>s.entryId===accrual.entryId&&s.accountId===accountId).map(s=>({key:JSON.stringify([r.id,p.id,s.entryId,s.lineIndex]),value:s.value})))),claimed=sum(claims.map(c=>c.value))
  if(baseline<=0||claimed>baseline||claims.some(c=>c.value<=0)||!original.lines.some(l=>l.accountId===accountId))throw new Error('La corrección necesita partes positivas de la estimación original, sin exceder su costo fuente.')
  if((state.productionCosts||[]).some(r=>r.preview.pools.some(p=>p.sourceLines.some(s=>changed.has(s.accountId)&&state.serviceReestimates?.some(v=>v.accrualId===accrual.id&&v.entryId===s.entryId)))))throw new Error('Una reestimación usada como fuente separada requiere consolidar sus imputaciones antes de corregirla.')
  const amounts=distribute(value,[...claims.map(c=>c.value),baseline-claimed],baseline)
  claims.forEach((c,i)=>sourceChanges.set(c.key,amounts[i]))
 }
 const journal=new Map<string,number>(),add=(id:string,value:number)=>journal.set(id,accountingSum(journal.get(id)||0,value))
 const layers=records.map(r=>{
  const before=currentRecord(state,r),sources=currentSources(state,r).map(s=>({...s,value:sourceChanges.get(JSON.stringify([r.id,s.poolId,s.entryId,s.lineIndex]))??s.value,capitalized:0})),measurement=remeasureProductionCost(before,before.preview.pools.map(p=>({poolId:p.id,gross:sum(sources.filter(s=>s.poolId===p.id).map(s=>s.value)),reason:input.reason.trim()})))
  for(const p of measurement.pools){const rows=sources.filter(s=>s.poolId===p.poolId),amounts=p.capitalized?distribute(p.capitalized,rows.map(s=>s.value),p.gross):rows.map(()=>0);rows.forEach((s,i)=>{s.capitalized=amounts[i]})}
  for(const s of currentSources(state,r))add(s.accountId,s.capitalized)
  for(const s of sources)add(s.accountId,-s.capitalized)
  add(r.wipAccountId,measurement.difference)
  if(!state.masters.accounts.some(a=>a.id===r.wipAccountId&&a.group==='Activo'&&(historical||a.postable)))throw new Error('La cuenta de producción en proceso original debe admitir la corrección.')
  return {productionCostId:r.id,number:r.number,measurement,sources,allocations:measurement.allocations.map(a=>({orderId:a.orderId,amount:a.after}))}
 })
 const lines=[...journal].filter(([,amount])=>amount).sort(([a],[b])=>a.localeCompare(b)).map(([accountId,n])=>({accountId,debit:Math.max(0,n),credit:Math.max(0,-n)}))
 if(!historical&&lines.some(l=>!state.masters.accounts.some(a=>a.id===l.accountId&&a.postable)))throw new Error('Todas las cuentas del asiento de corrección deben admitir imputaciones.')
 if(lines.length)validJournal(state,{id:'production-reestimate-proposal',date:service.date,concept:input.reason.trim(),branchId:service.branchId,documentId:'',lines})
 const result:ProductionReestimatePreview={date:service.date,reason:input.reason.trim(),service,entryPrefixIds:state.entries.map(e=>e.id),stockPrefixIds:state.stockMoves.map(m=>m.id),costPrefixIds:(state.productionCosts||[]).map(r=>r.id),correctionPrefixIds:(state.productionCorrections||[]).map(r=>r.id),layers,lines,difference:sum(layers.map(l=>l.measurement.difference)),expenseDifference:service.difference-sum(layers.map(l=>l.measurement.difference))}
 if(version===1)return result
 result.version=version
 result.destinations={wip:result.difference,inventory:0,cogs:0,other:[]}
 const outputs=state.stockMoves.filter(m=>orders.has(m.documentId)&&m.quantity>0)
 if(outputs.length){
  if(version===3&&layers.some(l=>l.measurement.allocations.some(a=>a.difference&&outputs.some(m=>m.documentId===a.orderId)&&!state.inventoryCostBatches?.some(b=>b.rows.some(row=>row.kind==='Fabricación'&&state.stockMoves.find(m=>m.id===row.moveId)?.documentId===a.orderId)))))throw new Error('La fabricación anterior a una apertura manual necesita conciliar su conversión antes de reestimar lotes terminados.')
  if(version===2&&state.inventoryRecoveries?.some(v=>v.date<service.date&&outputs.some(m=>m.date<=v.date&&layers.some(l=>l.measurement.allocations.some(a=>a.orderId===m.documentId&&a.difference)))))throw new Error('La conversión anterior a una base de VNR necesita su puente de costo y desvalorización antes de corregir lotes terminados.')
  const previous=state.inventoryCostBatches?.at(-1)
  if(!previous||outputs.some(m=>m.date>service.date||!state.inventoryCostBatches?.some(b=>b.sourceMoves.some(s=>s.id===m.id))))throw new Error('Conservá primero el CPP de los lotes terminados y elegí una fecha posterior para corregir su conversión.')
  const valuation:InventoryCostInput={date:service.date,reference:`INT-RPC-${String((state.productionCorrections?.length||0)+1).padStart(8,'0')} · CPP conciliado`,accounts:historical&&frozenInventory?structuredClone(frozenInventory.input.accounts):inventoryAccountDefaults(state)},before=previewInventoryCost(state,valuation,previous,!historical)
  if(before.sourceMoves.length||before.journals.length)throw new Error('Conservá primero un corte CPP con los movimientos y correcciones pendientes; la nueva revisión concilia sólo la conversión.')
  const number=`INT-RPC-${String((state.productionCorrections?.length||0)+1).padStart(8,'0')}`,correctionId=`production-correction:${number}`,proposed:ProductionCorrection={...input,version,id:correctionId,number,responsible:'Revisión propuesta',createdAt:'2000-01-01T00:00:00.000Z',sourceId:'proposed',sourceEntryId:'proposed',entryIds:[],preview:result},view={...state,productionCorrections:[...(state.productionCorrections||[]),proposed]},preview=previewInventoryCost(view,{...valuation,costVersion:version===3?(productionRecoveryReferences(state,service.date).length?11:10):9},previous,!historical),accounts=valuation.accounts,net=new Map<string,number>()
  for(const j of preview.journals)for(const l of j.lines)net.set(l.accountId,accountingSum(net.get(l.accountId)||0,l.debit-l.credit))
  const wipAccounts=new Set(records.map(r=>r.wipAccountId)),cogsAccounts=new Set([accounts.cogs,...(state.inventoryCostBatches||[]).map(b=>b.accounts.cogs)]);result.destinations={wip:accountingSum(result.difference,sum([...net].filter(([id])=>wipAccounts.has(id)).map(([,amount])=>amount))),inventory:net.get(accounts.inventory)||0,cogs:sum([...net].filter(([id])=>cogsAccounts.has(id)).map(([,amount])=>amount)),other:[...net].filter(([id,amount])=>amount&&!wipAccounts.has(id)&&id!==accounts.inventory&&!cogsAccounts.has(id)).map(([accountId,amount])=>({accountId,amount}))}
  if(accountingSum(sum([result.destinations.wip,result.destinations.inventory,result.destinations.cogs]),sum(result.destinations.other.map(l=>l.amount)))!==result.difference)throw new Error('La conversión corregida no concilia con proceso, existencias y resultados.')
  if(historical&&frozenInventory)preview.balances=preview.balances.map(b=>{const old=frozenInventory.preview.balances.find(v=>v.productId===b.productId&&v.depositId===b.depositId);return old?{...b,sku:old.sku,name:old.name,unit:old.unit,depositName:old.depositName}:b})
  result.inventory={correctionId,number,batchPrefixIds:(state.inventoryCostBatches||[]).map(b=>b.id),input:{...valuation,costVersion:version===3?(productionRecoveryReferences(state,service.date).length?11:10):9,review:inventoryCostReview(preview)},preview}
 }
 return result
}
export const productionCorrectionReview=(preview:ProductionReestimatePreview)=>JSON.stringify(preview)
export function postProductionReestimate(state:State,input:ProductionReestimateInput,actor:Session){
 requireAdmin(actor.role)
 input={...input,version:3};const next=structuredClone(state),preview=previewProductionReestimate(next,input)
 if(input.review!==productionCorrectionReview(preview))throw new Error('La revisión vinculada cambió. Preparala nuevamente antes de conservarla.')
 const source=withLinkedProductionCorrection(next,()=>reestimateService(next,{...input.service,review:serviceReview(preview.service)},actor)),id=preview.inventory?.correctionId||uid(),number=`INT-RPC-${String((next.productionCorrections?.length||0)+1).padStart(8,'0')}`,entries=preview.lines.length?[{id:uid(),date:preview.date,concept:number,branchId:preview.service.branchId,documentId:id,productionCorrectionId:id,lines:preview.lines}]:[],record:ProductionCorrection={...structuredClone(input),id,number,responsible:actor.name,createdAt:new Date().toISOString(),sourceId:source.id,sourceEntryId:source.entryId,entryIds:entries.map(e=>e.id),preview}
 next.entries.push(...entries);(next.productionCorrections??=[]).push(record)
 if(preview.inventory){const batch=postInventoryCost(next,preview.inventory.input,actor);batch.productionCorrectionId=id;record.inventoryBatchId=batch.id}
 Object.assign(state,next)
 return record
}
export function validateProductionCorrections(state:State){
 const records=state.productionCorrections||[],ids=new Set<string>(),sources=new Set<string>()
 if(!Array.isArray(records)||state.productionCorrections===null)throw new Error('Las correcciones de conversión deben ser una lista.')
 for(const [i,r]of records.entries()){
  const p=r.preview
  if(!r.id||ids.has(r.id)||sources.has(r.sourceId)||r.number!==`INT-RPC-${String(i+1).padStart(8,'0')}`||!r.responsible||!r.createdAt||Number.isNaN(Date.parse(r.createdAt))||!p||JSON.stringify(state.entries.slice(0,p.entryPrefixIds.length).map(e=>e.id))!==JSON.stringify(p.entryPrefixIds)||JSON.stringify(state.stockMoves.slice(0,p.stockPrefixIds.length).map(m=>m.id))!==JSON.stringify(p.stockPrefixIds)||JSON.stringify((state.productionCosts||[]).slice(0,p.costPrefixIds.length).map(v=>v.id))!==JSON.stringify(p.costPrefixIds)||JSON.stringify(records.slice(0,i).map(v=>v.id))!==JSON.stringify(p.correctionPrefixIds))throw new Error('No se conserva la identidad ni las fuentes de la corrección vinculada.')
  const entries=state.entries.slice(0,p.entryPrefixIds.length),entryIds=new Set(entries.map(e=>e.id)),view={...state,entries,stockMoves:state.stockMoves.slice(0,p.stockPrefixIds.length),productionCosts:(state.productionCosts||[]).slice(0,p.costPrefixIds.length),productionCorrections:records.slice(0,i),serviceReestimates:(state.serviceReestimates||[]).filter(v=>entryIds.has(v.entryId)),inventoryCostBatches:(state.inventoryCostBatches||[]).filter(b=>p.inventory?p.inventory.batchPrefixIds.includes(b.id):b.entryIds.every(id=>entryIds.has(id))&&b.date<p.date),reexpressionPostings:(state.reexpressionPostings||[]).filter(v=>v.preview.date<=p.date&&v.entryIds.every(id=>entryIds.has(id))),inventoryInflations:(state.inventoryInflations||[]).filter(v=>v.date<=p.date&&state.reexpressionPostings?.some(x=>x.id===v.postingId&&x.entryIds.every(id=>entryIds.has(id))))},expected=previewProductionReestimate(view,r,true,p.inventory),source=state.serviceReestimates?.find(v=>v.id===r.sourceId)
  if(r.review!==productionCorrectionReview(expected)||r.review!==productionCorrectionReview(p)||!source||source.entryId!==r.sourceEntryId||source.review!==serviceReview(p.service)||source.accrualId!==r.service.accrualId)throw new Error('Cambió la fuente, el reparto o la revisión de la corrección de conversión.')
  const posted=state.entries.filter(e=>e.productionCorrectionId===r.id),expectedOrder=[r.sourceEntryId,...r.entryIds]
  if(posted.length!==(p.lines.length?1:0)||JSON.stringify(posted.map(e=>e.id))!==JSON.stringify(r.entryIds)||JSON.stringify(state.entries.slice(p.entryPrefixIds.length,p.entryPrefixIds.length+expectedOrder.length).map(e=>e.id))!==JSON.stringify(expectedOrder)||posted.some(e=>e.documentId!==r.id||e.concept!==r.number||e.date!==p.date||e.branchId!==p.service.branchId||JSON.stringify(e.lines)!==JSON.stringify(p.lines)))throw new Error('Los asientos no concilian con la corrección vinculada de producción.')
  if(p.inventory){const batch=state.inventoryCostBatches?.find(b=>b.id===r.inventoryBatchId),batchEntries=batch?.entryIds||[];if(r.id!==p.inventory.correctionId||r.number!==p.inventory.number||JSON.stringify((state.inventoryCostBatches||[]).slice(0,p.inventory.batchPrefixIds.length).map(b=>b.id))!==JSON.stringify(p.inventory.batchPrefixIds)||!batch||batch.productionCorrectionId!==r.id||batch.costVersion!==p.inventory.input.costVersion||batch.date!==p.date||batch.review!==p.inventory.input.review||JSON.stringify(state.entries.slice(p.entryPrefixIds.length+expectedOrder.length,p.entryPrefixIds.length+expectedOrder.length+batchEntries.length).map(e=>e.id))!==JSON.stringify(batchEntries))throw new Error('No se conserva el CPP vinculado ni sus asientos de corrección de conversión.')}else if(r.inventoryBatchId)throw new Error('La corrección en proceso no tiene un CPP vinculado revisado.')
  ids.add(r.id);sources.add(r.sourceId)
 }
 if(state.inventoryCostBatches?.some(b=>b.productionCorrectionId&&!records.some(r=>r.id===b.productionCorrectionId&&r.inventoryBatchId===b.id)))throw new Error('Falta la corrección de conversión vinculada a un corte CPP.')
 if(state.entries.some(e=>e.productionCorrectionId&&!ids.has(e.productionCorrectionId)))throw new Error('Falta la constancia de una corrección de conversión.')
}
