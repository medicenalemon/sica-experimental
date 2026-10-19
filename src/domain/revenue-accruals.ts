import type {State,Session,EntryLine,RevenueAccrualInput,RevenueSettlementInput,RevenueAccrual,RevenueSettlement} from './types'
import {uid,taxRates} from './constants'
import {canAccess,requireAdmin} from './permissions'
import {assertDate,lineTotals} from './engine'
import {accountingDate,accountingSum} from './trial-balance'
import {withinExerciseHistory} from './exercise-calendar'
import {inventoryCostDate} from './inventory-dates'

export const revenuePath='/contabilidad/ingresos-devengados'
export interface RevenueAccrualPreview {
 date:string;reference:string;reason:string;fiscalReason:string;assetId:string;vatAccountId:string;
 source:{id:string;number:string;date:string;branchId:string;lines:{productId:string;quantity:number;unit:string}[]};
 lines:(RevenueAccrualInput['lines'][number]&{quantity:number;vat:number})[];net:number;vat:number;total:number;entry:EntryLine[];
}
export interface RevenueSettlementPreview {
 date:string;reference:string;reason:string;accrualId:string;invoiceId:string;invoiceNumber:string;invoiceDate:string;invoicePostingDate:string;branchId:string;assetId:string;vatAccountId:string;salesAccountId:string;invoiceVatAccountId:string;
 estimatedNet:number;estimatedVat:number;invoiceNet:number;invoiceVat:number;difference:number;vatDifference:number;
 lines:{productId:string;accountId:string;estimatedNet:number;estimatedVat:number;invoiceNet:number;invoiceVat:number;difference:number;vatDifference:number}[];entry:EntryLine[];
}
function text(s:string,name:string,max=1000){if(typeof s!=='string'||!s.trim()||s.trim().length>max)throw new Error(`${name}: dato obligatorio de hasta ${max} caracteres.`);return s.trim()}
function date(state:State,s:string,historical:boolean){accountingDate(s);if(historical){if(!withinExerciseHistory(state,s))throw new Error('Fecha de ingreso fuera de los ejercicios conservados.')}else assertDate(state,s)}
function account(state:State,id:string,group:string,historical:boolean){const a=state.masters.accounts.find(a=>a.id===id);if(!a||a.group!==group||!historical&&!a.postable)throw new Error(`Seleccioná una cuenta imputable de ${group}.`)}
function entryLines(values:{accountId:string;amount:number}[]){const sums=new Map<string,number>();for(const v of values){if(!v.amount)continue;sums.set(v.accountId,accountingSum(sums.get(v.accountId)||0,v.amount))}const rows=[...sums].filter(([,n])=>n).map(([accountId,n])=>({accountId,debit:Math.max(0,n),credit:Math.max(0,-n)}));if(rows.length<2||rows.reduce((n,l)=>accountingSum(n,l.debit-l.credit),0))throw new Error('El asiento de ingresos no conserva la partida doble.');return rows}
function permission(actor:Session){if(!canAccess(actor,revenuePath))throw new Error('Sin permiso para ingresos devengados.')}
export function revenueSources(state:State){return state.documents.filter(d=>d.side==='cliente'&&d.kind==='remito')}
export function revenueVat(net:number,tax:string){if(!taxRates.includes(tax)||!Number.isSafeInteger(net)||net<0)throw new Error('Neto o tratamiento de IVA inválidos.');const n=(BigInt(net)*BigInt(Math.round((Number(tax)||0)*10))+500n)/1000n;if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('IVA fuera de los importes seguros.');return Number(n)}
export function previewRevenueAccrual(state:State,input:RevenueAccrualInput,historical=false):RevenueAccrualPreview {
 date(state,input.date,historical);const reference=text(input.reference,'Referencia',200),reason=text(input.reason,'Fundamento del ingreso'),fiscalReason=text(input.fiscalReason,'Fundamento del IVA'),source=revenueSources(state).find(d=>d.id===input.sourceId)
 if(!source)throw new Error('Seleccioná un remito de cliente.')
 if(input.date!==source.date)throw new Error('Este circuito registra ingreso e IVA en la fecha del remito: requiere entrega aceptada o servicio concluido y nacimiento fiscal en esa fecha. Otros momentos necesitan un tratamiento específico.')
 if(!historical&&!state.masters.branches.some(b=>b.id===source.branchId&&b.active))throw new Error('La sucursal de la entrega debe estar activa.')
 if(!historical&&state.documents.some(d=>d.kind==='factura'&&d.sourceId===source.id))throw new Error('El remito ya tiene factura. Revisá su contabilización antes de devengar.')
 account(state,input.assetId,'Activo',historical)
 if(!historical&&Object.values(state.settings.accountMap).includes(input.assetId))throw new Error('Usá un activo separado de clientes, caja, bancos y otras cuentas automáticas.')
 if(!Array.isArray(input.lines)||!input.lines.length||new Set(input.lines.map(l=>l.productId)).size!==input.lines.length)throw new Error('Seleccioná artículos sin repetirlos.')
 let net=0,vat=0
 const lines=input.lines.map(l=>{
  const original=source.lines.find(x=>x.productId===l.productId),product=state.products.find(p=>p.id===l.productId)
  if(!original||!product||!Number.isFinite(original.quantity)||original.quantity<=0||!Number.isSafeInteger(l.value)||l.value<=0)throw new Error('El detalle requiere artículos entregados e importes netos positivos en centavos seguros.')
  if(!historical&&product.kind==='Bien de uso')throw new Error('Las ventas de bienes de uso sin factura requieren revisar su baja y resultado en un circuito específico.')
  if(l.recognition!==(product.kind==='Servicio'?'Servicio concluido':'Entrega aceptada'))throw new Error('Revisá la entrega aceptada del bien o la conclusión del servicio; el remito solo no demuestra el ingreso.')
  if((state.revenueAccruals||[]).some(a=>a.sourceId===source.id&&a.lines.some(x=>x.productId===l.productId)))throw new Error('Este artículo del remito ya tiene un ingreso devengado.')
  if(state.stockReturns?.some(r=>r.sourceId===source.id&&r.date<=input.date&&r.lines.some(x=>x.productId===l.productId)))throw new Error('El artículo tiene una devolución en la fecha del reconocimiento. Revisá la operación antes de devengar toda la entrega.')
  account(state,l.accountId,'Ingresos',historical);const evidence=text(l.evidence,'Evidencia de aceptación o conclusión'),lineVat=revenueVat(l.value,l.tax)
  if(state.settings.iva!=='Responsable Inscripto'&&lineVat)throw new Error('La condición fiscal de la empresa no admite IVA débito discriminado en este circuito.')
  net=accountingSum(net,l.value);vat=accountingSum(vat,lineVat)
  return {...l,evidence,quantity:original.quantity,vat:lineVat}
 }).sort((a,b)=>a.productId.localeCompare(b.productId))
 const vatAccountId=vat?input.vatAccountId:'';if(vat){account(state,vatAccountId,'Pasivo',historical);if(!historical&&Object.entries(state.settings.accountMap).some(([key,id])=>key!=='vatDebit'&&id===vatAccountId))throw new Error('La cuenta de IVA debe estar separada de proveedores, retenciones y otros pasivos automáticos.')}
 const total=accountingSum(net,vat),selected=new Set(lines.map(l=>l.productId)),snapshot={id:source.id,number:source.number,date:source.date,branchId:source.branchId,lines:source.lines.filter(l=>selected.has(l.productId)).map(l=>({productId:l.productId,quantity:l.quantity,unit:l.unit})).sort((a,b)=>a.productId.localeCompare(b.productId))}
 return {date:input.date,reference,reason,fiscalReason,assetId:input.assetId,vatAccountId,source:snapshot,lines,net,vat,total,entry:entryLines([{accountId:input.assetId,amount:total},...lines.map(l=>({accountId:l.accountId,amount:-l.value})),{accountId:vatAccountId,amount:-vat}])}
}
export const revenueReview=(p:RevenueAccrualPreview|RevenueSettlementPreview)=>JSON.stringify(p)
function journal(state:State,id:string,number:string,date:string,branchId:string,lines:EntryLine[]){const e={id:uid(),date,concept:number,branchId,documentId:id,revenueRecordId:id,lines:structuredClone(lines)};state.entries.push(e);return e.id}
export function accrueRevenue(state:State,input:RevenueAccrualInput,actor:Session):RevenueAccrual {
 permission(actor);const preview=previewRevenueAccrual(state,input)
 if(input.review!==revenueReview(preview))throw new Error('La revisión del ingreso cambió. Preparala nuevamente.')
 if(state.revenueAccruals?.some(a=>a.reference===preview.reference))throw new Error('La referencia de ingreso ya se utilizó.')
 const id=uid(),number=`INT-DI-${String((state.revenueAccruals?.length||0)+1).padStart(8,'0')}`,record:RevenueAccrual={...input,reference:preview.reference,reason:preview.reason,fiscalReason:preview.fiscalReason,vatAccountId:preview.vatAccountId,lines:preview.lines.map(({quantity,vat,...l})=>{void quantity;void vat;return l}),id,number,responsible:actor.name,createdAt:new Date().toISOString(),entryId:journal(state,id,number,input.date,preview.source.branchId,preview.entry),preview:structuredClone(preview)}
 state.revenueAccruals=[...(state.revenueAccruals||[]),record];return record
}
export function previewRevenueSettlement(state:State,input:RevenueSettlementInput,historical=false):RevenueSettlementPreview {
 date(state,input.date,historical);const reference=text(input.reference,'Referencia',200),reason=text(input.reason,'Fundamento de conciliación'),a=state.revenueAccruals?.find(a=>a.id===input.accrualId),invoice=state.documents.find(d=>d.id===input.invoiceId),source=a&&state.documents.find(d=>d.id===a.sourceId)
 if(!a||!source||!invoice||invoice.letter==='X'||invoice.side!=='cliente'||invoice.kind!=='factura'||invoice.sourceId!==a.sourceId||invoice.branchId!==a.preview.source.branchId||invoice.partyId!==source.partyId)throw new Error('La conciliación necesita la factura del remito devengado.')
 if(input.date<a.date||input.date<inventoryCostDate(invoice))throw new Error('La conciliación no puede preceder al ingreso ni al registro contable de la factura.')
 if(state.revenueSettlements?.some(s=>s.accrualId===a.id))throw new Error('El ingreso ya fue conciliado.')
 if(!historical&&!state.masters.branches.some(b=>b.id===invoice.branchId&&b.active))throw new Error('La sucursal de la factura debe estar activa.')
 // Reverse the invoice's actual accounts, including IVA, rather than the current automatic mapping.
 const originals=state.entries.filter(e=>e.documentId===invoice.id&&!e.inventoryBatchId&&!e.revenueRecordId&&!e.serviceRecordId),original=originals[0],sales=original?.lines.filter(l=>l.credit&&state.masters.accounts.find(a=>a.id===l.accountId)?.group==='Ingresos')
 if(originals.length!==1||!sales||sales.length!==1||original.date!==inventoryCostDate(invoice))throw new Error('No se pudo identificar el asiento de venta original de la factura.')
 const invoiceNet=invoice.lines.reduce((n,l)=>accountingSum(n,lineTotals(l,invoice.letter).net),0),invoiceVat=invoice.lines.reduce((n,l)=>accountingSum(n,lineTotals(l,invoice.letter).vat),0)
 if(invoiceNet!==invoice.net||invoiceVat!==invoice.vat||sales[0].credit!==invoiceNet)throw new Error('La venta original no concilia con el detalle neto de la factura.')
 const vatLines=original.lines.filter(l=>l.credit&&l.accountId!==sales[0].accountId&&state.masters.accounts.find(a=>a.id===l.accountId)?.group==='Pasivo'),vatLine=invoiceVat?vatLines[0]:undefined
 if(invoiceVat&&(!vatLine||vatLine.credit!==invoiceVat))throw new Error('No se pudo identificar el IVA original de la factura.')
 const salesAccountId=sales[0].accountId,invoiceVatAccountId=vatLine?.accountId||'',vatAccountId=a.preview.vatAccountId||invoiceVatAccountId
 account(state,salesAccountId,'Ingresos',historical);account(state,a.assetId,'Activo',historical);if(vatAccountId)account(state,vatAccountId,'Pasivo',historical);if(invoiceVatAccountId)account(state,invoiceVatAccountId,'Pasivo',historical)
 const lines=a.preview.lines.map(l=>{account(state,l.accountId,'Ingresos',historical);const actual=invoice.lines.find(x=>x.productId===l.productId);if(!actual||actual.quantity!==l.quantity)throw new Error('La factura debe conservar las cantidades devengadas.');const t=lineTotals(actual,invoice.letter);return {productId:l.productId,accountId:l.accountId,estimatedNet:l.value,estimatedVat:l.vat,invoiceNet:t.net,invoiceVat:t.vat,difference:t.net-l.value,vatDifference:t.vat-l.vat}})
 const actualNet=lines.reduce((n,l)=>accountingSum(n,l.invoiceNet),0),actualVat=lines.reduce((n,l)=>accountingSum(n,l.invoiceVat),0),difference=actualNet-a.preview.net,vatDifference=actualVat-a.preview.vat
 return {date:input.date,reference,reason,accrualId:a.id,invoiceId:invoice.id,invoiceNumber:invoice.number,invoiceDate:invoice.date,invoicePostingDate:original.date,branchId:invoice.branchId,assetId:a.assetId,vatAccountId,salesAccountId,invoiceVatAccountId,estimatedNet:a.preview.net,estimatedVat:a.preview.vat,invoiceNet:actualNet,invoiceVat:actualVat,difference,vatDifference,lines,entry:entryLines([{accountId:salesAccountId,amount:actualNet},{accountId:invoiceVatAccountId,amount:actualVat},{accountId:a.assetId,amount:-a.preview.total},...lines.map(l=>({accountId:l.accountId,amount:-l.difference})),{accountId:vatAccountId,amount:-vatDifference}])}
}
export function settleRevenue(state:State,input:RevenueSettlementInput,actor:Session):RevenueSettlement {
 permission(actor);const preview=previewRevenueSettlement(state,input)
 if(input.review!==revenueReview(preview))throw new Error('La revisión de conciliación cambió. Preparala nuevamente.')
 if(state.revenueSettlements?.some(a=>a.reference===preview.reference))throw new Error('La referencia de conciliación ya se utilizó.')
 const id=uid(),number=`INT-CI-${String((state.revenueSettlements?.length||0)+1).padStart(8,'0')}`,record:RevenueSettlement={...input,reference:preview.reference,reason:preview.reason,id,number,responsible:actor.name,createdAt:new Date().toISOString(),entryId:journal(state,id,number,input.date,preview.branchId,preview.entry),preview:structuredClone(preview)}
 state.revenueSettlements=[...(state.revenueSettlements||[]),record];return record
}
export function prepareRevenueAccount(state:State,actor:Session){requireAdmin(actor.role);if(!state.masters.accounts.some(a=>a.id==='1.1.12'))state.masters.accounts.push({id:'1.1.12',code:'1.1.12',name:'Ventas realizadas sin facturar',group:'Activo',postable:true})}
export function validateRevenues(state:State){
 const accruals=state.revenueAccruals||[],settlements=state.revenueSettlements||[]
 if(!Array.isArray(accruals)||!Array.isArray(settlements)||state.revenueAccruals===null||state.revenueSettlements===null)throw new Error('Ingresos devengados y conciliaciones deben ser listas.')
 const ids=new Set<string>(),references=new Set<string>()
 for(const [kind,records] of [['DI',accruals],['CI',settlements]] as const)for(const [index,r] of records.entries()){
  if(!r.id||ids.has(r.id)||r.number!==`INT-${kind}-${String(index+1).padStart(8,'0')}`||!r.responsible||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||references.has(`${kind}:${r.reference}`))throw new Error('Constancia de ingresos inválida.')
  ids.add(r.id);references.add(`${kind}:${r.reference}`)
  const preview=kind==='DI'?previewRevenueAccrual({...state,revenueAccruals:accruals.filter(a=>a.id!==r.id)},r as RevenueAccrual,true):previewRevenueSettlement({...state,revenueSettlements:settlements.filter(s=>s.id!==r.id)},r as RevenueSettlement,true),entries=state.entries.filter(e=>e.revenueRecordId===r.id),e=entries[0],branchId=kind==='DI'?(preview as RevenueAccrualPreview).source.branchId:(preview as RevenueSettlementPreview).branchId
  if(revenueReview(preview)!==r.review||revenueReview(r.preview)!==r.review)throw new Error('Cambió la fuente o revisión de una constancia de ingresos.')
  if(entries.length!==1||e.id!==r.entryId||e.date!==r.date||e.concept!==r.number||e.branchId!==branchId||e.documentId!==r.id||JSON.stringify(e.lines)!==JSON.stringify(preview.entry))throw new Error('El asiento de ingresos no coincide con su constancia.')
 }
 if(state.entries.some(e=>e.revenueRecordId&&!ids.has(e.revenueRecordId)))throw new Error('Falta la constancia de un asiento de ingresos.')
}

/** Supplemental working-paper rows; internal constancias are never fiscal invoices. */
export function revenueTaxWork(state:State,from:string,to:string,branch='all'){
 const visible=(date:string,branchId:string)=>date>=from&&date<=to&&(branch==='all'||branchId===branch)
 return [
  ...(state.revenueAccruals||[]).filter(a=>visible(a.date,a.preview.source.branchId)).map(a=>({id:a.id,date:a.date,branchId:a.preview.source.branchId,number:a.number,source:a.preview.source.number,kind:'Ingreso e IVA sin factura',net:a.preview.net,vat:a.preview.vat,total:a.preview.total})),
  ...(state.revenueSettlements||[]).filter(s=>visible(s.date,s.preview.branchId)).map(s=>({id:s.id,date:s.date,branchId:s.preview.branchId,number:s.number,source:s.preview.invoiceNumber,kind:'Descuento de importes ya reconocidos',net:-s.preview.estimatedNet,vat:-s.preview.estimatedVat,total:-accountingSum(s.preview.estimatedNet,s.preview.estimatedVat)})),
 ].sort((a,b)=>a.date.localeCompare(b.date)||a.number.localeCompare(b.number))
}
