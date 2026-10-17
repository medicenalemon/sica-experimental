import {assetBookCost,assetInflationReferences,assertAssetInflationReady,reconciledAssetPosting} from './asset-inflation-model'
import type {State,Session,EntryLine,AssetImpairmentInput,AssetImpairment} from './types'
import {uid} from './constants'
import {canAccess,requireAdmin} from './permissions'
import {assertDate} from './engine'
import {accountingDate,accountingSum} from './trial-balance'
import {withinExerciseHistory} from './exercise-calendar'
import {inventoryCostDate,nextInventoryDate} from './inventory-dates'
import {fixedAssetPath,assetLife,assetAllowance,depreciationRows,nominalAssetAccumulated} from './fixed-assets'

export const assetComparisonLevels=['Global','Activo individual','Actividad generadora de efectivo','Unidad menor'] as const
export interface AssetImpairmentRow {inflation?:ReturnType<typeof assetInflationReferences>;
 assetId:string;number:string;name:string;assetClass:string;assetReview:string;branchId:string;commissionId:string;commissionReview:string;reestimateId:string;reestimateReview:string;
 method:'Lineal diaria'|'No depreciable';cost:number;accumulated:number;beforeAllowance:number;beforeValue:number;nominalAccumulated:number;ceiling:number;individualRecoverable:number|null;maximumReversal:number;
 difference:number;afterAllowance:number;afterValue:number;allowanceAccountId:string;residual:number;usefulLifeEnd:string;nextBasisDate:string;nextBase:number;remainingDays:number;
 previous:{id:string;date:string;number:string;entryIds:string[];difference:number;afterAllowance:number}[];
 depreciations:{id:string;date:string;number:string;entryIds:string[];charge:number}[];
}
export interface AssetImpairmentPreview {
 date:string;reference:string;reason:string;entityClass:AssetImpairmentInput['entityClass'];level:AssetImpairmentInput['level'];scopeName:string;scopeReason:string;changesReason:string;scopeConfirmed:true;currencyConfirmed:true;noOtherAssetsConfirmed:true;
 marketValue:number|null;saleCosts:number|null;netRealizable:number|null;marketEvidence:string;valueInUse:number|null;useEvidence:string;discountBasis:string;
 recoverable:number;lowerBoundOnly:boolean;carrying:number;ceiling:number;difference:number;afterValue:number;unrecognizedRecovery:number;action:'Pérdida'|'Reversión'|'Sin ajuste';
 allowanceAccountId:string;lossAccountId:string;reversalAccountId:string;rows:AssetImpairmentRow[];entries:{branchId:string;lines:EntryLine[]}[];
}
const text=(v:string,label:string,max=1000)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
const optionalText=(v:string,label:string,max=1000)=>{if(typeof v!=='string'||v.trim().length>max)throw new Error(`${label}: texto de hasta ${max} caracteres.`);return v.trim()}
const monetary=(n:number)=>Number.isSafeInteger(n)&&n>=0
function account(state:State,id:string,group:string,historical:boolean){if(!state.masters.accounts.some(a=>a.id===id&&a.group===group&&(historical||a.postable)))throw new Error(`Seleccioná una cuenta imputable de ${group} para valor recuperable.`)}
export const assetImpairmentReview=(p:AssetImpairmentPreview)=>JSON.stringify(p)

/** Capped proportional allocation in integer centavos, with stable largest-remainder ties. */
export function allocateAssetComparison(total:number,items:{id:string;weight:number;cap:number}[]):number[]{
 if(!monetary(total)||items.some(i=>!monetary(i.weight)||!monetary(i.cap))||new Set(items.map(i=>i.id)).size!==items.length)throw new Error('El reparto requiere importes y participantes válidos.')
 const result=items.map(()=>0);let remaining=total,active=items.map((_,i)=>i).filter(i=>items[i].cap>0)
 while(remaining){
  const denominator=active.reduce((n,i)=>n+BigInt(items[i].weight),0n)
  if(!denominator)throw new Error('El reparto proporcional no tiene mediciones contables positivas disponibles. Revisá la base de asignación de estos activos antes de revertir en grupo.')
  const capped=active.filter(i=>BigInt(remaining)*BigInt(items[i].weight)>BigInt(items[i].cap)*denominator)
  if(capped.length){for(const i of capped){result[i]=items[i].cap;remaining-=items[i].cap}active=active.filter(i=>!capped.includes(i));continue}
  const shares=active.map(i=>{const numerator=BigInt(remaining)*BigInt(items[i].weight);return {i,amount:Number(numerator/denominator),remainder:numerator%denominator}})
  for(const s of shares){result[s.i]=s.amount;remaining-=s.amount}
  for(const s of shares.sort((a,b)=>a.remainder===b.remainder?items[a.i].id.localeCompare(items[b.i].id):a.remainder>b.remainder?-1:1))if(remaining&&result[s.i]<items[s.i].cap){result[s.i]++;remaining--}
  if(remaining)throw new Error('Los topes no permiten completar el reparto de la comparación.')
 }
 if(result.reduce((n,v)=>accountingSum(n,v),0)!==total)throw new Error('El reparto no conserva el importe de la comparación.');return result
}
export function previewAssetImpairment(state:State,input:AssetImpairmentInput,historical=false):AssetImpairmentPreview {
 accountingDate(input.date);if(historical){if(!withinExerciseHistory(state,input.date))throw new Error('La comparación está fuera de los ejercicios conservados.')}else assertDate(state,input.date)
 const reference=text(input.reference,'Referencia',200),reason=text(input.reason,'Indicios y respaldo de la evaluación'),scopeName=text(input.scopeName,'Identificación del alcance',200),scopeReason=text(input.scopeReason,'Criterio del nivel y composición del alcance'),changesReason=optionalText(input.changesReason,'Nueva evidencia y cambios del alcance')
 if(!['Pequeña o mediana','Otra'].includes(input.entityClass)||!assetComparisonLevels.includes(input.level))throw new Error('Revisá la clasificación contable y el nivel de comparación.')
 if(input.entityClass==='Pequeña o mediana'&&input.level!=='Global')throw new Error('La clasificación pequeña o mediana requiere revisar la comparación a nivel global.')
 if(input.scopeConfirmed!==true||input.currencyConfirmed!==true||input.noOtherAssetsConfirmed!==true)throw new Error('Confirmá el alcance completo, la moneda homogénea de la medición y que no faltan otros tipos de activos en esta comparación.')
 if(!Array.isArray(input.lines)||!input.lines.length||new Set(input.lines.map(l=>l.assetId)).size!==input.lines.length||input.level==='Activo individual'&&input.lines.length!==1)throw new Error('Seleccioná los bienes del alcance sin repetirlos; una comparación individual admite sólo un bien.')
 if(!historical&&input.date<(state.depreciationBatches?.at(-1)?.date||''))throw new Error('La comparación no puede preceder al último corte de depreciación conservado.')
 if(state.assetImpairments?.at(-1)&&input.date<state.assetImpairments.at(-1)!.date)throw new Error('Registrá las comparaciones en orden de fecha.')
 // Same-day disposals follow the end-of-day assessment. A later global scope must use another date.
 if(!historical&&input.level==='Global'&&state.assetDisposals?.some(d=>d.date===input.date))throw new Error('Ya hay bajas de esa fecha; revisá la comparación global desde una fecha posterior.')
 if(!historical&&input.level==='Global'){
  for(const d of state.documents.filter(d=>d.side==='proveedor'&&inventoryCostDate(d)<=input.date&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'))){
   const pending=d.kind==='factura'?d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'&&!state.fixedAssets?.some(a=>a.invoiceId===d.id&&a.productId===l.productId&&a.date<=input.date)):d.kind==='remito'&&!state.documents.some(i=>i.kind==='factura'&&i.sourceId===d.id&&inventoryCostDate(i)<=input.date)
   if(pending)throw new Error('Capitalizá las compras y revisá los bienes recibidos sin factura antes de afirmar un alcance global completo.')
  }
 }
 const assets=(state.fixedAssets||[]).filter(a=>a.date<=input.date&&!state.assetDisposals?.some(d=>d.assetId===a.id&&(historical?d.date<input.date:d.date<=input.date))),selected=new Set(input.lines.map(l=>l.assetId))
 if(input.level==='Global'&&(assets.length!==selected.size||assets.some(a=>!selected.has(a.id))))throw new Error('La comparación global debe incluir todos los bienes de uso vigentes de todas las sucursales a esa fecha.')
 account(state,input.allowanceAccountId,'Activo',historical);account(state,input.lossAccountId,'Gastos',historical);account(state,input.reversalAccountId,'Ingresos',historical)
 if(state.fixedAssets?.some(a=>[a.assetAccountId,a.accumulatedAccountId,a.expenseAccountId].some(id=>[input.allowanceAccountId,input.lossAccountId,input.reversalAccountId].includes(id)))||state.assetDisposals?.some(d=>[d.expenseAccountId,d.incomeAccountId].some(id=>id&&[input.lossAccountId,input.reversalAccountId].includes(id))))throw new Error('Separá deterioro y reversión de costo, depreciación y resultados de bajas.')
 if(!historical&&[input.allowanceAccountId,input.lossAccountId,input.reversalAccountId].some(id=>Object.values(state.settings.accountMap).includes(id)))throw new Error('Usá cuentas separadas de las asociaciones automáticas para deterioro y reversión.')
 if(!historical)assertAssetInflationReady(state,input.lines.map(l=>l.assetId),input.date)
 const depRows=depreciationRows(state,input.date,true),nextBasisDate=nextInventoryDate(input.date),rows:AssetImpairmentRow[]=input.lines.map(l=>{
  const a=assets.find(a=>a.id===l.assetId),r=depRows.find(r=>r.assetId===l.assetId)
  if(!a||!r||!historical&&state.assetDisposals?.some(d=>d.assetId===a.id))throw new Error('Seleccioná un bien vigente registrado en esa fecha, sin baja conservada.')
  if(l.individualRecoverable!==null&&!monetary(l.individualRecoverable)||input.level==='Activo individual'&&l.individualRecoverable!==null)throw new Error('El tope recuperable individual debe ser no negativo o no determinable; la evaluación individual usa sus propias mediciones de recuperable.')
  if(state.assetImpairments?.some(c=>c.date>=input.date&&c.preview.rows.some(r=>r.assetId===a.id)))throw new Error('El bien ya fue evaluado en esa fecha o en una posterior.')
  if(!historical&&(state.assetCommissions?.some(c=>c.assetId===a.id&&c.date>input.date)||state.assetReestimates?.some(c=>c.assetId===a.id&&c.date>input.date)))throw new Error('La comparación no puede preceder a parámetros posteriores conservados.')
  if(!historical&&state.documents.some(d=>inventoryCostDate(d)<=input.date&&d.lines.some(l=>l.productId===a.productId)&&(d.side==='cliente'&&['remito','factura','credito','debito'].includes(d.kind)||['credito','debito'].includes(d.kind)&&d.sourceId===a.invoiceId)))throw new Error('Revisá ventas, entregas, notas y bajas del bien antes de evaluar su valor recuperable.')
  if(r.charge!==0)throw new Error('Contabilizá primero la depreciación hasta la fecha exacta de la comparación, inclusive.')
  const previous=state.assetImpairments?.filter(c=>c.date<=input.date&&c.preview.rows.some(r=>r.assetId===a.id)).map(c=>{const row=c.preview.rows.find(r=>r.assetId===a.id)!;return {id:c.id,date:c.date,number:c.number,entryIds:structuredClone(c.entryIds),difference:row.difference,afterAllowance:row.afterAllowance}})||[],prior=assetAllowance(state,a.id,input.date,true,false),beforeAllowance=prior?.row.afterAllowance||0,accumulated=r.previous,cost=assetBookCost(state,a,input.date,false),beforeValue=cost-accumulated-beforeAllowance,nominalAccumulated=nominalAssetAccumulated(state,a,input.date,false),ceiling=Math.min(cost-accumulated,cost-nominalAccumulated)
  if(beforeValue<0||beforeAllowance<0||accumulated<0)throw new Error('El valor contable previo del bien es inconsistente.')
  if(beforeAllowance&&input.allowanceAccountId!==prior!.row.allowanceAccountId)throw new Error('Conservá la cuenta del deterioro acumulado pendiente del bien para conciliar su saldo.')
  if(l.individualRecoverable!==null&&l.individualRecoverable<beforeValue)throw new Error('El recuperable individual indica un deterioro propio. Revisá esa medición antes de repartir una reversión de grupo.')
  const latest=state.assetImpairments?.findLast(c=>c.preview.rows.some(r=>r.assetId===a.id)),oldScope=latest&&JSON.stringify(latest.lines.map(l=>l.assetId).sort()),newScope=JSON.stringify([...selected].sort())
  if(latest&&(latest.entityClass!==input.entityClass||latest.level!==input.level||latest.scopeName!==scopeName||oldScope!==newScope)&&!changesReason)throw new Error('Fundamentá el cambio de clasificación, nivel, identificación o composición del alcance anterior.')
  const accounts=[a.assetAccountId,a.accumulatedAccountId,input.allowanceAccountId,prior?.row.allowanceAccountId].filter(Boolean)
  if(state.entries.some(e=>e.date<=input.date&&!e.fixedAssetRecordId&&!(e.reexpressionPostingId&&(historical&&e.date===input.date||reconciledAssetPosting(state,e.reexpressionPostingId,a.id)))&&e.lines.some(l=>accounts.includes(l.accountId))))throw new Error('Hay ajustes o movimientos ajenos al subregistro en las cuentas del bien. Conciliá costo y depreciación antes de comparar; el modelo nominal no incorpora esos ajustes automáticamente.')
  if(!state.masters.branches.some(b=>b.id===a.preview.branchId&&(historical||b.active)))throw new Error('La sucursal del bien debe estar activa.')
  const life=assetLife(state,a,input.date,false),remainingDays=life.commissionedOn?Math.max(0,(Date.parse(life.usefulLifeEnd+'T00:00:00Z')-Date.parse(nextBasisDate+'T00:00:00Z'))/86400000):0,depreciations=(state.depreciationBatches||[]).filter(b=>b.date<=input.date&&(b.preview.rows.find(r=>r.assetId===a.id)?.charge||0)>0).map(b=>({id:b.id,date:b.date,number:b.number,entryIds:structuredClone(b.entryIds),charge:b.preview.rows.find(r=>r.assetId===a.id)!.charge}))
  return {assetId:a.id,number:a.number,name:a.name,assetClass:a.assetClass,assetReview:a.review!,branchId:a.preview.branchId,commissionId:life.commissionId,commissionReview:life.commissionReview,reestimateId:life.reestimate?.id||'',reestimateReview:life.reestimate?.review||'',method:a.method,cost,...(assetInflationReferences(state,a.id,input.date,false).length?{inflation:assetInflationReferences(state,a.id,input.date,false)}:{}),accumulated,beforeAllowance,beforeValue,nominalAccumulated,ceiling,individualRecoverable:l.individualRecoverable,maximumReversal:Math.min(beforeAllowance,Math.max(0,Math.min(ceiling,l.individualRecoverable??ceiling)-beforeValue)),difference:0,afterAllowance:beforeAllowance,afterValue:beforeValue,allowanceAccountId:beforeAllowance?prior!.row.allowanceAccountId:input.allowanceAccountId,residual:life.residual,usefulLifeEnd:life.usefulLifeEnd,nextBasisDate,nextBase:0,remainingDays,previous,depreciations}
 }).sort((a,b)=>a.assetId.localeCompare(b.assetId))
 const carrying=rows.reduce((n,r)=>accountingSum(n,r.beforeValue),0),ceiling=rows.reduce((n,r)=>accountingSum(n,r.ceiling),0)
 if(input.marketValue!==null&&!monetary(input.marketValue)||input.saleCosts!==null&&!monetary(input.saleCosts)||input.valueInUse!==null&&!monetary(input.valueInUse)||(input.marketValue===null)!==(input.saleCosts===null)||input.marketValue===null&&input.valueInUse===null)throw new Error('Indicá mediciones seguras no negativas de precio/costos de venta y/o valor de uso; dejá no determinable como vacío.')
 const marketEvidence=input.marketValue===null?optionalText(input.marketEvidence,'Respaldo del VNR'):text(input.marketEvidence,'Respaldo del precio y costos directos de venta'),useEvidence=input.valueInUse===null?optionalText(input.useEvidence,'Respaldo del valor de uso'):text(input.useEvidence,'Proyección de flujos, supuestos y respaldo del valor de uso'),discountBasis=input.valueInUse===null?optionalText(input.discountBasis,'Base del descuento',200):text(input.discountBasis,'Tasa y base del descuento',200)
 if(input.marketValue===null&&marketEvidence||input.valueInUse===null&&(useEvidence||discountBasis))throw new Error('Una medición no determinada no debe conservar evidencia como si se hubiese calculado.')
 const netRealizable=input.marketValue===null?null:Math.max(0,input.marketValue-input.saleCosts!),recoverable=Math.max(netRealizable??0,input.valueInUse??0),lowerBoundOnly=netRealizable===null||input.valueInUse===null
 if(lowerBoundOnly&&(recoverable<=carrying||recoverable<ceiling))throw new Error('La única medición disponible no prueba la recuperación hasta el límite aplicable. Determiná VNR y valor de uso para medir el ajuste.')
 let difference=0,action:AssetImpairmentPreview['action']='Sin ajuste'
 if(recoverable<carrying){difference=carrying-recoverable;action='Pérdida';const parts=allocateAssetComparison(difference,rows.map(r=>({id:r.assetId,weight:r.beforeValue,cap:r.beforeValue})));rows.forEach((r,i)=>r.difference=parts[i])}
 else{
  const recovery=Math.min(recoverable-carrying,rows.reduce((n,r)=>accountingSum(n,r.maximumReversal),0))
  if(recovery){if(!changesReason)throw new Error('La reversión necesita nueva evidencia del cambio en las estimaciones del recuperable.');difference=-recovery;action='Reversión';const parts=input.level==='Activo individual'?[recovery]:allocateAssetComparison(recovery,rows.map(r=>({id:r.assetId,weight:r.beforeValue,cap:r.maximumReversal})));rows.forEach((r,i)=>r.difference=-parts[i])}
 }
 for(const r of rows){r.afterAllowance=accountingSum(r.beforeAllowance,r.difference);r.afterValue=r.beforeValue-r.difference;r.nextBase=r.method==='No depreciable'?0:Math.max(0,r.afterValue-r.residual)}
 const branches=new Map<string,{accountId:string;amount:number}[]>();for(const r of rows)if(r.difference){const values=branches.get(r.branchId)||[];values.push({accountId:r.allowanceAccountId,amount:-r.difference},{accountId:r.difference>0?input.lossAccountId:input.reversalAccountId,amount:r.difference});branches.set(r.branchId,values)}
 const entries=[...branches].sort(([a],[b])=>a.localeCompare(b)).map(([branchId,values])=>{const sums=new Map<string,number>();for(const v of values)sums.set(v.accountId,accountingSum(sums.get(v.accountId)||0,v.amount));const lines:EntryLine[]=[...sums].filter(([,v])=>v).map(([accountId,v])=>({accountId,debit:Math.max(0,v),credit:Math.max(0,-v)}));if(lines.length<2||lines.reduce((n,l)=>accountingSum(n,l.debit-l.credit),0))throw new Error('El ajuste de recuperable no conserva la partida doble.');return {branchId,lines}})
 return {date:input.date,reference,reason,entityClass:input.entityClass,level:input.level,scopeName,scopeReason,changesReason,scopeConfirmed:true,currencyConfirmed:true,noOtherAssetsConfirmed:true,marketValue:input.marketValue,saleCosts:input.saleCosts,netRealizable,marketEvidence,valueInUse:input.valueInUse,useEvidence,discountBasis,recoverable,lowerBoundOnly,carrying,ceiling,difference,afterValue:carrying-difference,unrecognizedRecovery:Math.max(0,recoverable-carrying+(difference<0?difference:0)),action,allowanceAccountId:input.allowanceAccountId,lossAccountId:input.lossAccountId,reversalAccountId:input.reversalAccountId,rows,entries}
}
export function assessAssetImpairment(state:State,input:AssetImpairmentInput,actor:Session):AssetImpairment {
 if(!canAccess(actor,fixedAssetPath))throw new Error('Sin permiso para valor recuperable de bienes de uso.')
 const preview=previewAssetImpairment(state,input);if(input.review!==assetImpairmentReview(preview))throw new Error('La revisión de recuperable cambió. Preparala nuevamente.');if(state.assetImpairments?.some(c=>c.reference===preview.reference))throw new Error('La referencia de comparación ya se utilizó.')
 const id=uid(),number=`INT-VR-${String((state.assetImpairments?.length||0)+1).padStart(8,'0')}`,entryIds=preview.entries.map(e=>{const entry={id:uid(),date:input.date,concept:number,documentId:id,fixedAssetRecordId:id,branchId:e.branchId,lines:structuredClone(e.lines)};state.entries.push(entry);return entry.id})
 const record:AssetImpairment={...input,reference:preview.reference,reason:preview.reason,scopeName:preview.scopeName,scopeReason:preview.scopeReason,changesReason:preview.changesReason,marketEvidence:preview.marketEvidence,useEvidence:preview.useEvidence,discountBasis:preview.discountBasis,lines:preview.rows.map(r=>({assetId:r.assetId,individualRecoverable:r.individualRecoverable})),id,number,responsible:actor.name,createdAt:new Date().toISOString(),entryIds,preview};state.assetImpairments=[...(state.assetImpairments||[]),record];return record
}
export function prepareAssetImpairmentAccounts(state:State,actor:Session){requireAdmin(actor.role);for(const [id,name,group]of [['1.2.3','Deterioro acumulado de bienes de uso','Activo'],['5.11','Pérdidas por desvalorización de bienes de uso','Gastos'],['4.10','Reversiones de desvalorización de bienes de uso','Ingresos']])if(!state.masters.accounts.some(a=>a.id===id))state.masters.accounts.push({id,code:id,name,group,postable:true})}
export function validateAssetImpairments(state:State){
 const records=state.assetImpairments??[];if(!Array.isArray(records)||state.assetImpairments===null)throw new Error('Las comparaciones de recuperable deben ser una lista.')
 const ids=new Set([...(state.fixedAssets||[]),...(state.assetCommissions||[]),...(state.assetReestimates||[]),...(state.depreciationBatches||[]),...(state.assetDisposals||[])].map(r=>r.id)),references=new Set<string>()
 for(const [i,r]of records.entries()){
  if(typeof r.id!=='string'||!r.id||ids.has(r.id)||r.number!==`INT-VR-${String(i+1).padStart(8,'0')}`||references.has(r.reference)||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||i&&r.date<records[i-1].date)throw new Error('Constancia de recuperable inválida.')
  ids.add(r.id);references.add(r.reference);const p=previewAssetImpairment({...state,assetImpairments:records.slice(0,i)},r,true),entries=state.entries.filter(e=>e.fixedAssetRecordId===r.id)
  if(r.review!==assetImpairmentReview(p)||r.review!==assetImpairmentReview(r.preview))throw new Error('Cambió el alcance, las fuentes, la medición o la revisión del recuperable.')
  if(JSON.stringify(entries.map(e=>e.id))!==JSON.stringify(r.entryIds)||entries.length!==p.entries.length||entries.some((e,i)=>e.date!==r.date||e.concept!==r.number||e.documentId!==r.id||e.branchId!==p.entries[i].branchId||JSON.stringify(e.lines)!==JSON.stringify(p.entries[i].lines)))throw new Error('Los asientos de recuperable no coinciden con su constancia.')
 }
}
