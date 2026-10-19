import {withinExerciseHistory} from './exercise-calendar'
import type {State,Session,EntryLine,Document,ServiceAccrualInput,ServiceSettlementInput,ServiceAccrual,ServiceSettlement,ServiceReestimateInput,ServiceReestimate,ServiceCancellationInput,ServiceCancellation} from './types'
import {uid} from './constants'
import {canAccess,requireAdmin} from './permissions'
import {assertDate,lineTotals} from './engine'
import {accountingDate,accountingSum} from './trial-balance'
import {inventoryCostDate} from './inventory-dates'
import {linkedProductionCorrection} from './production-correction-context'

export const servicePath='/contabilidad/servicios-devengados'
function convertedSource(state:State,id:string,accounts?:string[]){return !linkedProductionCorrection(state)&&state.productionCosts?.some(r=>r.preview.pools.some(p=>p.sourceLines.some(s=>s.capitalized!==0&&(!accounts||accounts.includes(s.accountId))&&state.entries.find(e=>e.id===s.entryId)?.serviceRecordId===id)))}
type ServiceSource={id:string;number:string;date:string;branchId:string;partyId:string;lines:{productId:string;quantity:number;unit:string}[]}
export interface ServiceAccrualPreview {date:string;reference:string;reason:string;source:ServiceSource;liabilityId:string;lines:{productId:string;quantity:number;value:number;accountId:string}[];total:number;entry:EntryLine[]}
export interface ServiceSettlementPreview {reestimateIds?:string[];date:string;reference:string;reason:string;accrualId:string;invoiceId:string;invoiceNumber:string;invoiceDate:string;invoicePostingDate:string;branchId:string;liabilityId:string;purchaseAccountId:string;estimatedValue:number;invoiceValue:number;difference:number;lines:{productId:string;estimatedValue:number;invoiceValue:number;difference:number;accountId:string}[];entry:EntryLine[]}
export interface ServiceReestimatePreview {date:string;reference:string;reason:string;accrualId:string;accrualNumber:string;previousReestimateId:string;branchId:string;liabilityId:string;previousValue:number;total:number;difference:number;lines:{productId:string;accountId:string;previousValue:number;value:number;difference:number}[];entry:EntryLine[]}
export interface ServiceCancellationPreview {date:string;reference:string;reason:string;accrualId:string;accrualNumber:string;accrualReview:string;accrualEntryId:string;sourceId:string;sourceNumber:string;branchId:string;liabilityId:string;reestimates:{id:string;number:string;date:string;entryId:string;review:string}[];lines:{productId:string;quantity:number;accountId:string;value:number}[];total:number;entry:EntryLine[]}
export function serviceAccrualActive(state:State,id:string,to='9999-12-31'){return !state.serviceCancellations?.some(c=>c.accrualId===id&&c.date<=to)}
function text(value:string,label:string,max=1000){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new Error(`${label}: dato obligatorio de hasta ${max} caracteres.`);return value.trim()}
function date(state:State,value:string,historical:boolean){accountingDate(value);if(historical){if(!withinExerciseHistory(state,value))throw new Error('Fecha del devengamiento fuera del ejercicio.')}else assertDate(state,value)}
function account(state:State,id:string,group:string,historical:boolean){const a=state.masters.accounts.find(a=>a.id===id);if(!a||a.group!==group||!historical&&!a.postable)throw new Error(`Seleccioná una cuenta imputable de ${group}.`);return a}
function entryLines(values:{accountId:string;amount:number}[]){const sums=new Map<string,number>();for(const v of values)sums.set(v.accountId,accountingSum(sums.get(v.accountId)||0,v.amount));const rows=[...sums].filter(([,n])=>n).map(([accountId,n])=>({accountId,debit:Math.max(0,n),credit:Math.max(0,-n)}));if(rows.length<2||rows.reduce((n,l)=>accountingSum(n,l.debit-l.credit),0))throw new Error('El devengamiento no conserva la partida doble.');return rows}
function permission(actor:Session){if(!canAccess(actor,servicePath))throw new Error('Sin permiso para devengamientos de servicios.')}
export function serviceSources(state:State){return state.documents.filter(d=>d.side==='proveedor'&&d.kind==='remito'&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Servicio'))}
function sourceOf(state:State,id:string):Document {const source=serviceSources(state).find(d=>d.id===id);if(!source)throw new Error('Seleccioná un remito de proveedor con servicios recibidos.');return source}
export function previewServiceAccrual(state:State,input:ServiceAccrualInput,historical=false):ServiceAccrualPreview {
 date(state,input.date,historical);const reference=text(input.reference,'Referencia',200),reason=text(input.reason,'Fundamento'),source=sourceOf(state,input.sourceId)
 if(input.date<source.date)throw new Error('La fecha de devengamiento no puede preceder a la recepción del servicio.')
 if(!historical&&!state.masters.branches.some(b=>b.id===source.branchId&&b.active))throw new Error('La sucursal del servicio debe estar activa.')
 if(!historical&&state.documents.some(d=>d.kind==='factura'&&d.sourceId===source.id))throw new Error('El remito ya tiene factura. Revisá su contabilización antes de crear una estimación.')
 if(!Array.isArray(input.lines)||!input.lines.length||new Set(input.lines.map(l=>l.productId)).size!==input.lines.length)throw new Error('Seleccioná servicios sin repetir artículos.')
 account(state,input.liabilityId,'Pasivo',historical)
 if(input.liabilityId===state.settings.accountMap.suppliers||input.liabilityId===state.settings.accountMap.unbilled)throw new Error('Usá una cuenta de servicios devengados separada de proveedores y mercadería sin factura.')
 let total=0
 const lines=input.lines.map(l=>{const original=source.lines.find(x=>x.productId===l.productId),product=state.products.find(p=>p.id===l.productId);if(!original||product?.kind!=='Servicio'||!Number.isSafeInteger(l.value)||l.value<=0||!Number.isFinite(original.quantity)||original.quantity<=0)throw new Error('El detalle debe contener servicios recibidos e importes positivos en centavos seguros.');account(state,l.accountId,'Gastos',historical);if((state.serviceAccruals??[]).some(a=>a.sourceId===source.id&&serviceAccrualActive(state,a.id,input.date)&&a.lines.some(x=>x.productId===l.productId)))throw new Error('Este servicio recibido ya tiene un devengamiento registrado.');total=accountingSum(total,l.value);return {productId:l.productId,quantity:original.quantity,value:l.value,accountId:l.accountId}}).sort((a,b)=>a.productId.localeCompare(b.productId))
 const selected=new Set(lines.map(l=>l.productId)),snapshot={id:source.id,number:source.number,date:source.date,branchId:source.branchId,partyId:source.partyId,lines:source.lines.filter(l=>selected.has(l.productId)).map(l=>({productId:l.productId,quantity:l.quantity,unit:l.unit})).sort((a,b)=>a.productId.localeCompare(b.productId))}
 return {date:input.date,reference,reason,source:snapshot,liabilityId:input.liabilityId,lines,total,entry:entryLines([...lines.map(l=>({accountId:l.accountId,amount:l.value})),{accountId:input.liabilityId,amount:-total}])}
}
export const serviceReview=(preview:ServiceAccrualPreview|ServiceSettlementPreview|ServiceReestimatePreview|ServiceCancellationPreview)=>JSON.stringify(preview)
function journal(state:State,id:string,number:string,date:string,branchId:string,lines:EntryLine[]){const entry={id:uid(),date,concept:number,branchId,documentId:id,serviceRecordId:id,lines:structuredClone(lines)};state.entries.push(entry);return entry.id}
export function accrueService(state:State,input:ServiceAccrualInput,actor:Session):ServiceAccrual {
 permission(actor);const preview=previewServiceAccrual(state,input);if(input.review!==serviceReview(preview))throw new Error('La revisión del devengamiento cambió. Preparala nuevamente.');if(state.serviceAccruals?.some(a=>a.reference===preview.reference))throw new Error('La referencia de devengamiento ya se utilizó.')
 const id=uid(),number=`INT-DS-${String((state.serviceAccruals?.length||0)+1).padStart(8,'0')}`,record:ServiceAccrual={...input,reference:preview.reference,reason:preview.reason,lines:preview.lines.map(({productId,value,accountId})=>({productId,value,accountId})),id,number,responsible:actor.name,createdAt:new Date().toISOString(),entryId:journal(state,id,number,input.date,preview.source.branchId,preview.entry),preview:structuredClone(preview)}
 state.serviceAccruals=[...(state.serviceAccruals??[]),record];return record
}
export function serviceEstimate(state:State,accrual:ServiceAccrual,to='9999-12-31'){
 const revisions=(state.serviceReestimates??[]).filter(r=>r.accrualId===accrual.id&&r.date<=to),last=revisions.at(-1)
 const lines=accrual.preview.lines.map(l=>({...l,value:last?.lines.find(x=>x.productId===l.productId)?.value??l.value}))
 const cancellation=state.serviceCancellations?.find(c=>c.accrualId===accrual.id&&c.date<=to)
 return {lines:cancellation?lines.map(l=>({...l,value:0})):lines,total:cancellation?0:lines.reduce((n,l)=>accountingSum(n,l.value),0),reestimateIds:revisions.map(r=>r.id),lastDate:cancellation?.date||last?.date||accrual.date}
}
export function previewServiceReestimate(state:State,input:ServiceReestimateInput,historical=false):ServiceReestimatePreview {
 date(state,input.date,historical);const reference=text(input.reference,'Referencia',200),reason=text(input.reason,'Nueva información y fundamento'),accrual=state.serviceAccruals?.find(a=>a.id===input.accrualId)
 if(!accrual)throw new Error('Seleccioná un devengamiento de servicios existente.')
 if(!historical&&!serviceAccrualActive(state,accrual.id))throw new Error('El devengamiento fue anulado. Registrá una nueva estimación si corresponde.')
 const previous=serviceEstimate({...state,serviceCancellations:[]},accrual)
 if(input.date<previous.lastDate)throw new Error('La reestimación no puede preceder al último registro del devengamiento.')
 if(!historical&&(state.serviceSettlements?.some(s=>s.accrualId===accrual.id)||state.documents.some(d=>d.kind==='factura'&&d.sourceId===accrual.sourceId)))throw new Error('El servicio ya tiene factura o conciliación. Conciliá el importe real en lugar de reestimarlo.')
 if(!historical&&!state.masters.branches.some(b=>b.id===accrual.preview.source.branchId&&b.active))throw new Error('La sucursal del servicio debe estar activa.')
 account(state,accrual.liabilityId,'Pasivo',historical)
 if(!Array.isArray(input.lines)||input.lines.length!==previous.lines.length||new Set(input.lines.map(l=>l.productId)).size!==input.lines.length||input.lines.some(l=>!previous.lines.some(p=>p.productId===l.productId)||!Number.isSafeInteger(l.value)||l.value<0))throw new Error('Indicá una nueva estimación no negativa para cada servicio original, sin repetir artículos.')
 const lines=previous.lines.map(l=>{account(state,l.accountId,'Gastos',historical);const value=input.lines.find(x=>x.productId===l.productId)!.value;return {productId:l.productId,accountId:l.accountId,previousValue:l.value,value,difference:value-l.value}}),total=lines.reduce((n,l)=>accountingSum(n,l.value),0)
 if(!total)throw new Error('La estimación total debe ser positiva. Para una anulación completa usá la constancia de anulación revisada.')
 if(lines.every(l=>!l.difference))throw new Error('La nueva estimación debe modificar al menos un servicio.')
 const difference=total-previous.total
 if(!historical&&convertedSource(state,accrual.id,lines.filter(l=>l.difference).map(l=>l.accountId)))throw new Error('La reestimación del servicio incorporado a producción requiere la corrección vinculada de conversión, aún pendiente.')
 return {date:input.date,reference,reason,accrualId:accrual.id,accrualNumber:accrual.number,previousReestimateId:previous.reestimateIds.at(-1)||'',branchId:accrual.preview.source.branchId,liabilityId:accrual.liabilityId,previousValue:previous.total,total,difference,lines,entry:entryLines([...lines.map(l=>({accountId:l.accountId,amount:l.difference})),{accountId:accrual.liabilityId,amount:-difference}])}
}
export function reestimateService(state:State,input:ServiceReestimateInput,actor:Session):ServiceReestimate {
 permission(actor);const preview=previewServiceReestimate(state,input)
 if(input.review!==serviceReview(preview))throw new Error('La revisión de reestimación cambió. Preparala nuevamente.')
 if(state.serviceReestimates?.some(r=>r.reference===preview.reference))throw new Error('La referencia de reestimación ya se utilizó.')
 const id=uid(),number=`INT-RS-${String((state.serviceReestimates?.length||0)+1).padStart(8,'0')}`,record:ServiceReestimate={...input,reference:preview.reference,reason:preview.reason,lines:preview.lines.map(({productId,value})=>({productId,value})),id,number,responsible:actor.name,createdAt:new Date().toISOString(),entryId:journal(state,id,number,input.date,preview.branchId,preview.entry),preview:structuredClone(preview)}
 state.serviceReestimates=[...(state.serviceReestimates??[]),record];return record
}
export function previewServiceSettlement(state:State,input:ServiceSettlementInput,historical=false):ServiceSettlementPreview {
 date(state,input.date,historical);const reference=text(input.reference,'Referencia',200),reason=text(input.reason,'Fundamento'),accrual=state.serviceAccruals?.find(a=>a.id===input.accrualId),invoice=state.documents.find(d=>d.id===input.invoiceId)
 if(!accrual||!invoice||invoice.kind!=='factura'||invoice.side!=='proveedor'||invoice.sourceId!==accrual.sourceId||invoice.branchId!==accrual.preview.source.branchId||invoice.partyId!==accrual.preview.source.partyId)throw new Error('La conciliación necesita la factura del remito devengado.')
 if(!serviceAccrualActive(state,accrual.id))throw new Error('El devengamiento fue anulado y no puede conciliarse.')
 const estimate=serviceEstimate(state,accrual)
 if(input.date<estimate.lastDate||input.date<inventoryCostDate(invoice))throw new Error('La conciliación no puede preceder al devengamiento, su reestimación ni al registro contable de la factura.')
 if(state.serviceSettlements?.some(s=>s.accrualId===accrual.id))throw new Error('El devengamiento ya fue conciliado.')
 // Use the original purchase journal, so later changes to the automatic account mapping cannot redirect its reversal.
 const originals=state.entries.filter(e=>e.documentId===invoice.id&&!e.inventoryBatchId&&!e.serviceRecordId),original=originals[0],purchaseLines=original?.lines.filter(l=>l.debit&&state.masters.accounts.find(a=>a.id===l.accountId)?.group==='Gastos')
 if(originals.length!==1||!original||!purchaseLines||purchaseLines.length!==1||original.date!==inventoryCostDate(invoice))throw new Error('No se pudo identificar la cuenta de gasto original de la factura.')
 const purchaseAccountId=purchaseLines[0].accountId;account(state,purchaseAccountId,'Gastos',historical);account(state,accrual.liabilityId,'Pasivo',historical)
 const invoiceNet=invoice.lines.reduce((n,l)=>accountingSum(n,lineTotals(l,invoice.letter).net),0),invoiceVat=invoice.lines.reduce((n,l)=>accountingSum(n,lineTotals(l,invoice.letter).vat),0),purchaseAmount=purchaseLines[0].debit,invoiceGross=accountingSum(invoiceNet,invoiceVat)
 if(invoiceNet!==invoice.net||invoiceVat!==invoice.vat||![invoiceNet,invoiceGross].includes(purchaseAmount))throw new Error('El gasto original de la factura no concilia con su detalle.')
 const nonRecoverableVat=invoiceVat>0&&purchaseAmount===invoiceGross
 let estimatedValue=0,invoiceValue=0
 const lines=estimate.lines.map(l=>{account(state,l.accountId,'Gastos',historical);const actual=invoice.lines.find(x=>x.productId===l.productId);if(!actual||actual.quantity!==l.quantity)throw new Error('La factura debe conservar las cantidades del servicio devengado.');const t=lineTotals(actual,invoice.letter),value=accountingSum(t.net,nonRecoverableVat?t.vat:0);if(value<0)throw new Error('El importe facturado del servicio no puede ser negativo.');estimatedValue=accountingSum(estimatedValue,l.value);invoiceValue=accountingSum(invoiceValue,value);return {productId:l.productId,estimatedValue:l.value,invoiceValue:value,difference:value-l.value,accountId:l.accountId}})
 if(!historical&&convertedSource(state,accrual.id,lines.filter(l=>l.difference).map(l=>l.accountId)))throw new Error('La diferencia de factura del servicio incorporado a producción requiere la corrección vinculada de conversión, aún pendiente.')
 return {date:input.date,reference,reason,accrualId:accrual.id,invoiceId:invoice.id,invoiceNumber:invoice.number,invoiceDate:invoice.date,invoicePostingDate:original.date,branchId:invoice.branchId,liabilityId:accrual.liabilityId,purchaseAccountId,estimatedValue,invoiceValue,difference:invoiceValue-estimatedValue,lines,entry:entryLines([{accountId:accrual.liabilityId,amount:estimatedValue},...lines.map(l=>({accountId:l.accountId,amount:l.difference})),{accountId:purchaseAccountId,amount:-invoiceValue}]),...(estimate.reestimateIds.length?{reestimateIds:estimate.reestimateIds}:{})}
}
export function settleService(state:State,input:ServiceSettlementInput,actor:Session):ServiceSettlement {
 permission(actor);const preview=previewServiceSettlement(state,input);if(input.review!==serviceReview(preview))throw new Error('La revisión de conciliación cambió. Preparala nuevamente.');if(state.serviceSettlements?.some(s=>s.reference===preview.reference))throw new Error('La referencia de conciliación ya se utilizó.')
 const id=uid(),number=`INT-CS-${String((state.serviceSettlements?.length||0)+1).padStart(8,'0')}`,record:ServiceSettlement={...input,reference:preview.reference,reason:preview.reason,id,number,responsible:actor.name,createdAt:new Date().toISOString(),entryId:journal(state,id,number,input.date,preview.branchId,preview.entry),preview:structuredClone(preview)}
 state.serviceSettlements=[...(state.serviceSettlements??[]),record];return record
}
export function previewServiceCancellation(state:State,input:ServiceCancellationInput,historical=false):ServiceCancellationPreview {
 date(state,input.date,historical);const reference=text(input.reference,'Referencia de anulación',200),reason=text(input.reason,'Motivo de anulación'),accrual=state.serviceAccruals?.find(a=>a.id===input.accrualId)
 if(!accrual)throw new Error('Seleccioná un devengamiento de servicios existente.')
 if(!serviceAccrualActive(state,accrual.id))throw new Error('El devengamiento ya fue anulado.')
 if(state.serviceSettlements?.some(s=>s.accrualId===accrual.id))throw new Error('El devengamiento ya fue conciliado. Revisá la factura y su circuito de corrección.')
 if(!historical&&state.documents.some(d=>d.kind==='factura'&&d.sourceId===accrual.sourceId))throw new Error('La recepción ya tiene factura. Conciliá y revisá su circuito de corrección.')
 const estimate=serviceEstimate(state,accrual),reestimates=(state.serviceReestimates??[]).filter(r=>r.accrualId===accrual.id)
 if(input.date<estimate.lastDate)throw new Error('La anulación no puede preceder al devengamiento ni a su última reestimación.')
 // A correction of an original error must not be treated as a prospective reestimate across a locked period.
 if(!historical){assertDate(state,accrual.date);reestimates.forEach(r=>assertDate(state,r.date));if(!state.masters.branches.some(b=>b.id===accrual.preview.source.branchId&&b.active))throw new Error('La sucursal del servicio debe estar activa.')}
 account(state,accrual.liabilityId,'Pasivo',historical)
 if(!historical&&convertedSource(state,accrual.id))throw new Error('La anulación del servicio incorporado a producción requiere la corrección vinculada de conversión, aún pendiente.')
 const lines=estimate.lines.map(l=>{account(state,l.accountId,'Gastos',historical);return {productId:l.productId,quantity:l.quantity,accountId:l.accountId,value:l.value}})
 return {date:input.date,reference,reason,accrualId:accrual.id,accrualNumber:accrual.number,accrualReview:accrual.review!,accrualEntryId:accrual.entryId,sourceId:accrual.sourceId,sourceNumber:accrual.preview.source.number,branchId:accrual.preview.source.branchId,liabilityId:accrual.liabilityId,reestimates:reestimates.map(r=>({id:r.id,number:r.number,date:r.date,entryId:r.entryId,review:r.review!})),lines,total:estimate.total,entry:entryLines([{accountId:accrual.liabilityId,amount:estimate.total},...lines.map(l=>({accountId:l.accountId,amount:-l.value}))])}
}
export function cancelService(state:State,input:ServiceCancellationInput,actor:Session):ServiceCancellation {
 permission(actor);requireAdmin(actor.role);const preview=previewServiceCancellation(state,input)
 if(input.review!==serviceReview(preview))throw new Error('La revisión de anulación cambió. Preparala nuevamente.')
 if(state.serviceCancellations?.some(c=>c.reference===preview.reference))throw new Error('La referencia de anulación ya se utilizó.')
 const id=uid(),number=`INT-AS-${String((state.serviceCancellations?.length||0)+1).padStart(8,'0')}`,record:ServiceCancellation={...input,reference:preview.reference,reason:preview.reason,id,number,responsible:actor.name,createdAt:new Date().toISOString(),entryId:journal(state,id,number,input.date,preview.branchId,preview.entry),preview:structuredClone(preview)}
 state.serviceCancellations=[...(state.serviceCancellations??[]),record];return record
}
export function prepareServiceAccounts(state:State,actor:Session){if(actor.role!=='Administrador General')throw new Error('Esta operación requiere un Administrador General.');if(!state.masters.accounts.some(a=>a.id==='2.1.7'))state.masters.accounts.push({id:'2.1.7',code:'2.1.7',name:'Servicios recibidos sin facturar',group:'Pasivo',postable:true})}
export function validateServices(state:State){
 const accruals=state.serviceAccruals??[],settlements=state.serviceSettlements??[],reestimates=state.serviceReestimates??[],cancellations=state.serviceCancellations??[]
 if(!Array.isArray(accruals)||!Array.isArray(settlements)||!Array.isArray(reestimates)||!Array.isArray(cancellations)||state.serviceAccruals===null||state.serviceSettlements===null||state.serviceReestimates===null||state.serviceCancellations===null)throw new Error('Las constancias de servicios deben ser listas.')
 const ids=new Set<string>(),references=new Set<string>()
 for(const [kind,records] of [['DS',accruals],['RS',reestimates],['CS',settlements],['AS',cancellations]] as const)for(const [index,record] of records.entries()){
  if(!record.id||ids.has(record.id)||record.number!==`INT-${kind}-${String(index+1).padStart(8,'0')}`||!record.responsible||!record.createdAt||Number.isNaN(Date.parse(record.createdAt))||references.has(`${kind}:${record.reference}`))throw new Error('Constancia de servicios inválida.')
  ids.add(record.id);references.add(`${kind}:${record.reference}`)
  const preview=kind==='DS'?previewServiceAccrual({...state,serviceAccruals:accruals.slice(0,index)},record as ServiceAccrual,true):kind==='RS'?previewServiceReestimate({...state,serviceReestimates:reestimates.slice(0,index)},record as ServiceReestimate,true):kind==='AS'?previewServiceCancellation({...state,serviceCancellations:cancellations.filter(c=>c.id!==record.id)},record as ServiceCancellation,true):previewServiceSettlement({...state,serviceSettlements:settlements.filter(s=>s.id!==record.id)},record as ServiceSettlement,true)
  if(serviceReview(preview)!==record.review||serviceReview(record.preview)!==record.review)throw new Error('Cambió la fuente o revisión de una constancia de servicios.')
  const entries=state.entries.filter(e=>e.serviceRecordId===record.id),e=entries[0],branchId=kind==='DS'?(preview as ServiceAccrualPreview).source.branchId:(preview as ServiceSettlementPreview).branchId
  if(entries.length!==1||e.id!==record.entryId||e.date!==record.date||e.concept!==record.number||e.branchId!==branchId||e.documentId!==record.id||JSON.stringify(e.lines)!==JSON.stringify(preview.entry))throw new Error('El asiento de servicios no coincide con su constancia.')
  if(kind==='AS'){const p=preview as ServiceCancellationPreview,cancelIndex=state.entries.findIndex(x=>x.id===e.id);if(state.documents.some(d=>d.kind==='factura'&&d.sourceId===p.sourceId&&(inventoryCostDate(d)<record.date||state.entries.findIndex(x=>x.documentId===d.id&&!x.serviceRecordId&&!x.inventoryBatchId)<=cancelIndex)))throw new Error('La factura de la recepción debe haberse registrado después de la anulación conservada.')}
 }
 if(state.entries.some(e=>e.serviceRecordId&&!ids.has(e.serviceRecordId)))throw new Error('Falta la constancia de un asiento de servicios.')
}
