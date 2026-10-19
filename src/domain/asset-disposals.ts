import {assetBookCost,assetInflationReferences,assertAssetInflationReady} from './asset-inflation-model'
import type {State,Session,EntryLine,AssetDisposalInput,AssetDisposal} from './types'
import {uid} from './constants'
import {canAccess,requireAdmin} from './permissions'
import {assertDate,lineTotals} from './engine'
import {accountingDate,accountingSum} from './trial-balance'
import {withinExerciseHistory} from './exercise-calendar'
import {inventoryCostDate} from './inventory-dates'
import {fixedAssetPath,depreciationRows,assetLife,assetAllowance} from './fixed-assets'

export interface AssetDisposalPreview {inflation?:ReturnType<typeof assetInflationReferences>;impairment?:{id:string;date:string;allowance:number;accountId:string;entryIds:string[]};
 date:string;assetId:string;assetNumber:string;assetReview:string;kind:AssetDisposalInput['kind'];reference:string;reason:string;controlConfirmed:true;
 branchId:string;cost:number;accumulated:number;bookValue:number;netSale:number;result:number;expenseAccountId:string;incomeAccountId:string;
 commissionId:string;commissionReview:string;reestimateId:string;reestimateReview:string;
 depreciations:{id:string;number:string;date:string;entryIds:string[];charge:number}[];
 sale?:{id:string;number:string;date:string;branchId:string;entryId:string;incomeAccountId:string;net:number;vat:number;total:number;line:{productId:string;quantity:number;unit:string;price:number;tax:string;discount:number;net:number;vat:number};receipt?:{id:string;number:string;date:string;quantity:number;unit:string}};
 entries:{branchId:string;lines:EntryLine[]}[];
}
export const assetDisposalReview=(p:AssetDisposalPreview)=>JSON.stringify(p)
function required(v:string,label:string,max=1000){if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
function account(state:State,id:string,group:string,historical:boolean){if(!state.masters.accounts.some(a=>a.id===id&&a.group===group&&(historical||a.postable)))throw new Error(`Seleccioná una cuenta imputable de ${group} para la baja.`)}
export function previewAssetDisposal(state:State,input:AssetDisposalInput,historical=false):AssetDisposalPreview {
 accountingDate(input.date);if(historical){if(!withinExerciseHistory(state,input.date))throw new Error('La baja está fuera de los ejercicios conservados.')}else assertDate(state,input.date)
 const reference=required(input.reference,'Referencia',200),reason=required(input.reason,'Fundamento y evidencia de la pérdida de control'),a=state.fixedAssets?.find(a=>a.id===input.assetId&&a.date<=input.date)
 if(!a)throw new Error('Seleccioná un bien registrado a la fecha de baja.')
 if(!historical)assertAssetInflationReady(state,[a.id],input.date)
 if(!['Venta','Pérdida','Abandono'].includes(input.kind)||input.controlConfirmed!==true)throw new Error('Confirmá la baja total y la transferencia o pérdida del control del bien, con evidencia de su fecha.')
 if(state.assetDisposals?.some(d=>d.assetId===a.id))throw new Error('El bien ya tiene una baja registrada.')
 if(state.assetImpairments?.some(c=>c.date>input.date&&c.preview.rows.some(r=>r.assetId===a.id)))throw new Error('La baja no puede preceder a una comparación posterior conservada del bien.')
 if(state.assetCommissions?.some(c=>c.assetId===a.id&&c.date>input.date)||state.assetReestimates?.some(r=>r.assetId===a.id&&r.date>input.date))throw new Error('La baja no puede preceder a una puesta en marcha o estimación posterior conservada.')
 if(!historical&&input.date<(state.depreciationBatches?.at(-1)?.date||''))throw new Error('La baja no puede preceder al último corte de depreciación conservado.')
 if(state.documents.some(d=>['credito','debito'].includes(d.kind)&&inventoryCostDate(d)<=input.date&&d.lines.some(l=>l.productId===a.productId)&&(d.sourceId===a.invoiceId||d.side==='cliente')))throw new Error('Revisá las notas y el costo o precio corregido antes de registrar la baja.')
 account(state,a.assetAccountId,'Activo',historical);account(state,a.accumulatedAccountId,'Activo',historical);account(state,input.expenseAccountId,'Gastos',historical)
 const row=depreciationRows(state,input.date,true).find(r=>r.assetId===a.id)!
 if(row.charge!==0)throw new Error('Contabilizá primero la depreciación hasta la fecha exacta de baja, inclusive.')
 const cost=assetBookCost(state,a,input.date,false),accumulated=row.previous,assessment=assetAllowance(state,a.id,input.date,true,false),allowance=assessment?.row.afterAllowance||0,bookValue=cost-accumulated-allowance
 if(accumulated<0||bookValue<0)throw new Error('El costo y la depreciación de la baja son inconsistentes.')
 let sale:AssetDisposalPreview['sale'],netSale=0,incomeAccountId=''
 if(input.kind==='Venta'){
  const invoice=state.documents.find(d=>d.id===input.invoiceId&&d.side==='cliente'&&d.kind==='factura'),line=invoice?.lines.find(l=>l.productId===a.productId),acquired=a.preview.invoice.line
  if(!invoice||!line||invoice.lines.filter(l=>l.productId===a.productId).length!==1||line.quantity!==acquired.quantity||line.unit!==acquired.unit)throw new Error('Seleccioná una factura de cliente con la cantidad y unidad completas del bien. Las bajas parciales requieren su propio circuito.')
  if(state.revenueAccruals?.some(r=>r.sourceId===invoice.sourceId&&r.lines.some(l=>l.productId===a.productId)))throw new Error('La venta tiene un ingreso devengado conservado. Revisá su conciliación, cuentas y baja mediante un circuito específico antes de reclasificar.')
  if(input.date!==inventoryCostDate(invoice))throw new Error('En este circuito la factura y la transferencia del bien deben tener la misma fecha de baja.')
  if(state.assetDisposals?.some(d=>d.kind==='Venta'&&d.invoiceId===invoice.id&&state.fixedAssets?.find(a=>a.id===d.assetId)?.productId===a.productId))throw new Error('La línea de venta ya está conciliada con otra baja.')
  const originals=state.entries.filter(e=>e.documentId===invoice.id&&!e.fixedAssetRecordId&&!e.inventoryBatchId&&!e.serviceRecordId&&!e.revenueRecordId&&!e.reversalRecordId),original=originals[0],income=original?.lines.filter(l=>l.credit&&state.masters.accounts.find(a=>a.id===l.accountId)?.group==='Ingresos')
  const net=invoice.lines.reduce((n,l)=>accountingSum(n,lineTotals(l,invoice.letter).net),0),vat=invoice.lines.reduce((n,l)=>accountingSum(n,lineTotals(l,invoice.letter).vat),0),t=lineTotals(line,invoice.letter)
  if(originals.length!==1||original.date!==input.date||original.branchId!==invoice.branchId||!income||income.length!==1||income[0].credit!==net||net!==invoice.net||vat!==invoice.vat||t.net<=0)throw new Error('La venta no concilia con su ingreso original y su IVA. Revisá el comprobante antes de dar de baja.')
  const source=invoice.sourceId?state.documents.find(d=>d.id===invoice.sourceId):undefined,received=source?.lines.find(l=>l.productId===a.productId)
  if(invoice.sourceId&&(!source||source.kind!=='remito'||source.side!=='cliente'||source.branchId!==invoice.branchId||source.partyId!==invoice.partyId||source.date!==input.date||!received||source.lines.filter(l=>l.productId===a.productId).length!==1||received.quantity!==line.quantity||received.unit!==line.unit))throw new Error('La entrega y factura deben conservar el bien completo y la misma fecha de transferencia. Las ventas sin factura o diferidas requieren ampliar el circuito.')
  netSale=t.net;incomeAccountId=input.incomeAccountId;account(state,incomeAccountId,'Ingresos',historical);account(state,income[0].accountId,'Ingresos',historical)
  if(incomeAccountId===income[0].accountId)throw new Error('Separá el ingreso de baja del ingreso comercial original.')
  sale={id:invoice.id,number:invoice.number,date:invoice.date,branchId:invoice.branchId,entryId:original.id,incomeAccountId:income[0].accountId,net,vat,total:invoice.total,line:{productId:line.productId,quantity:line.quantity,unit:line.unit,price:line.price,tax:line.tax,discount:line.discount,net:t.net,vat:t.vat},...(source&&received?{receipt:{id:source.id,number:source.number,date:source.date,quantity:received.quantity,unit:received.unit}}:{})}
 }else{
  if(input.invoiceId!==''||input.incomeAccountId!=='')throw new Error('La pérdida o abandono no debe inventar una venta o indemnización.')
  if(state.documents.some(d=>d.side==='cliente'&&d.kind==='factura'&&inventoryCostDate(d)<=input.date&&d.lines.some(l=>l.productId===a.productId)&&!state.assetDisposals?.some(b=>b.invoiceId===d.id&&state.fixedAssets?.find(a=>a.id===b.assetId)?.productId===a.productId)))throw new Error('Hay una venta del bien pendiente de conciliar; revisá su baja por venta.')
 }
 if(input.expenseAccountId===a.expenseAccountId)throw new Error('Separá el valor neto de baja del gasto de depreciación.')
 if(!historical&&[input.expenseAccountId,incomeAccountId].filter(Boolean).some(id=>Object.values(state.settings.accountMap).includes(id)))throw new Error('Usá cuentas de otros ingresos y gastos separadas de las asociaciones automáticas.')
 const values=new Map<string,{accountId:string;amount:number}[]>(),add=(branchId:string,accountId:string,amount:number)=>{const list=values.get(branchId)||[];list.push({accountId,amount});values.set(branchId,list)}
 if(assessment){account(state,assessment.row.allowanceAccountId,'Activo',historical);add(a.preview.branchId,assessment.row.allowanceAccountId,allowance)}
 add(a.preview.branchId,a.accumulatedAccountId,accumulated);add(a.preview.branchId,input.expenseAccountId,bookValue);add(a.preview.branchId,a.assetAccountId,-cost)
 if(sale){add(sale.branchId,sale.incomeAccountId,netSale);add(sale.branchId,incomeAccountId,-netSale)}
 const entries=[...values].sort(([a],[b])=>a.localeCompare(b)).map(([branchId,list])=>{
  if(!state.masters.branches.some(b=>b.id===branchId&&(historical||b.active)))throw new Error('La sucursal de la baja debe estar activa.')
  const sums=new Map<string,number>();for(const l of list)sums.set(l.accountId,accountingSum(sums.get(l.accountId)||0,l.amount))
  const lines=[...sums].filter(([,n])=>n).map(([accountId,n])=>({accountId,debit:Math.max(0,n),credit:Math.max(0,-n)}))
  if(lines.length>0&&(lines.length<2||lines.reduce<number>((n,l)=>accountingSum(n,l.debit-l.credit),0)!==0))throw new Error('El asiento de baja no conserva la partida doble.');return {branchId,lines}
 }).filter(e=>e.lines.length)
 const life=assetLife(state,a,input.date,false),depreciations=(state.depreciationBatches||[]).filter(b=>b.date<=input.date&&b.preview.rows.some(r=>r.assetId===a.id)).map(b=>({id:b.id,number:b.number,date:b.date,entryIds:structuredClone(b.entryIds),charge:b.preview.rows.find(r=>r.assetId===a.id)!.charge}))
 return {...(assessment?{impairment:{id:assessment.record.id,date:assessment.record.date,allowance,accountId:assessment.row.allowanceAccountId,entryIds:structuredClone(assessment.record.entryIds)}}:{}),...(assetInflationReferences(state,a.id,input.date,false).length?{inflation:assetInflationReferences(state,a.id,input.date,false)}:{}),date:input.date,assetId:a.id,assetNumber:a.number,assetReview:a.review!,kind:input.kind,reference,reason,controlConfirmed:true,branchId:a.preview.branchId,cost,accumulated,bookValue,netSale,result:netSale-bookValue,expenseAccountId:input.expenseAccountId,incomeAccountId,commissionId:life.commissionId,commissionReview:life.commissionReview,reestimateId:life.reestimate?.id||'',reestimateReview:life.reestimate?.review||'',depreciations,...(sale?{sale}:{}),entries}
}
export function disposeAsset(state:State,input:AssetDisposalInput,actor:Session):AssetDisposal {
 if(!canAccess(actor,fixedAssetPath))throw new Error('Sin permiso para bajas de bienes de uso.')
 const preview=previewAssetDisposal(state,input);if(input.review!==assetDisposalReview(preview))throw new Error('La revisión de baja cambió. Preparala nuevamente.');if(state.assetDisposals?.some(b=>b.reference===preview.reference))throw new Error('La referencia de baja ya se utilizó.')
 const id=uid(),number=`INT-BA-${String((state.assetDisposals?.length||0)+1).padStart(8,'0')}`,entryIds=preview.entries.map(e=>{const entry={id:uid(),date:input.date,concept:number,documentId:id,fixedAssetRecordId:id,branchId:e.branchId,lines:structuredClone(e.lines)};state.entries.push(entry);return entry.id})
 const record:AssetDisposal={...input,reference:preview.reference,reason:preview.reason,id,number,entryIds,responsible:actor.name,createdAt:new Date().toISOString(),preview};state.assetDisposals=[...(state.assetDisposals||[]),record];return record
}
export function prepareAssetDisposalAccounts(state:State,actor:Session){requireAdmin(actor.role);for(const [id,name,group] of [['4.9','Otros ingresos por bajas de bienes de uso','Ingresos'],['5.10','Valor neto de bajas de bienes de uso','Gastos']])if(!state.masters.accounts.some(a=>a.id===id))state.masters.accounts.push({id,code:id,name,group,postable:true})}
export function validateAssetDisposals(state:State){
 const records=state.assetDisposals??[];if(!Array.isArray(records)||state.assetDisposals===null)throw new Error('Las bajas de bienes de uso deben ser una lista.')
 const ids=new Set([...(state.fixedAssets||[]),...(state.assetCommissions||[]),...(state.assetReestimates||[]),...(state.depreciationBatches||[]),...(state.assetImpairments||[])].map(a=>a.id)),references=new Set<string>()
 for(const [i,r] of records.entries()){
  if(typeof r.id!=='string'||!r.id||ids.has(r.id)||r.number!==`INT-BA-${String(i+1).padStart(8,'0')}`||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||references.has(r.reference))throw new Error('Constancia de baja inválida.')
  ids.add(r.id);references.add(r.reference)
  const p=previewAssetDisposal({...state,assetDisposals:records.slice(0,i)},r,true),entries=state.entries.filter(e=>e.fixedAssetRecordId===r.id)
  if(r.review!==assetDisposalReview(p)||r.review!==assetDisposalReview(r.preview))throw new Error('Cambió la fuente, estimación o revisión de la baja.')
  if(JSON.stringify(entries.map(e=>e.id))!==JSON.stringify(r.entryIds)||entries.length!==p.entries.length||entries.some((e,i)=>e.date!==r.date||e.concept!==r.number||e.documentId!==r.id||e.branchId!==p.entries[i].branchId||JSON.stringify(e.lines)!==JSON.stringify(p.entries[i].lines)))throw new Error('Los asientos de baja no coinciden con su constancia.')
 }
}
