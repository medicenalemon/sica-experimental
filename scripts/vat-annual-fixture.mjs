import {vatPurchasesFixture} from './vat-purchases-fixture.mjs'
export function vatAnnualFixture(dependencies,options={}){
 const f=vatPurchasesFixture(dependencies),{state,actor,line}=f,{createDocument,previewSupplierOriginal,identifySupplierOriginal,supplierOriginalReview,vatModel:model}=dependencies
 state.documents=[];state.entries=[];state.stockMoves=[];state.treasuryMoves=[];state.supplierOriginals=[];delete state.vatPurchases;state.settings.exerciseStart='2025-01-01';state.settings.exerciseEnd='2025-12-31';state.settings.name='SICA Textil · Ajuste anual IVA'
 const create=(date,price,source,branchId=f.document.branchId)=>createDocument(state,{...f.document,kind:source?'credito':'factura',branchId,date,due:date,perceptions:0,sourceId:source?.id||'',lines:[line(price,'21')]},actor.role)
 const january=create('2025-01-15',20000),june=create('2025-06-15',20000,undefined,options.juneBranchId),credit=create('2025-06-20',1000,january),december=create('2025-12-15',10000)
 const extra=[];if(options.priorYearReturn){state.settings.exerciseStart='2024-01-01';const origin=create('2024-12-15',1000);state.settings.exerciseStart='2025-01-01';extra.push(origin,create('2025-06-21',1000,origin))}
 if(options.secondReturn)extra.push(create('2025-06-22',1000,january))
 for(const [i,d]of [january,june,credit,december,...extra].entries()){
  const input={documentId:d.id,documentKind:d.kind,date:d.date<'2025-01-01'?'2025-01-01':d.date,previousId:'',issuerCuit:f.supplier.cuit,receiverCuit:state.settings.cuit,point:4,number:i+1,authorization:'Sin consignar',code:'',expires:'',reference:`ANUAL-ORIG-${i+1}`,reason:'Original sintético para el ajuste anual, sin constatación externa.'};identifySupplierOriginal(state,{...input,review:supplierOriginalReview(previewSupplierOriginal(state,input))},actor)
 }
 for(const [period,taxable,direct]of [['2025-01',500000,1000],['2025-06',750000,700],['2025-12',800000,0]]){
  const docs=model.purchaseCandidates(state,period),input={period,previousId:'',reference:`ANUAL-COMPRAS-${period}`,reason:'Estimación mensual de ensayo y restitución histórica declarada.',mode:'Asignación directa y global',scopeConfirmed:true,credits:docs.map(d=>({documentId:d.id,amount:d.kind==='credito'?100:direct})),proration:{from:'2025-01-01',to:new Date(Date.UTC(2025,Number(period.slice(5)),0)).toISOString().slice(0,10),taxable,exempt:1000000-taxable,untaxed:0,reference:`BASES-${period}`,reason:'Bases fiscales acumuladas y asignaciones declaradas para el ensayo.',confirmed:true,common:docs.map(d=>({documentId:d.id,amount:d.kind==='credito'?0:2100}))}}
  model.preserveVatPurchases(state,{...input,review:model.vatPurchasesReview(model.previewVatPurchases(state,input))},actor)
 }
 const input={from:'2025-01-01',to:'2025-12-31',previousId:'',reference:'IVA-ANUAL-ENSAYO-01',reason:'Conciliación anual sintética del IVA común y de créditos computados declarados por mes.',taxable:800000,exempt:200000,untaxed:0,basisReference:'BASES-ANUALES-2025',nominalConfirmed:true,completeConfirmed:true,months:Array.from({length:12},(_,i)=>{const period=`2025-${String(i+1).padStart(2,'0')}`,p=model.previousVatPurchases(state,period);return {period,preparationId:p?.id||'',applied:p?.preview.proration?.prorated||0,reference:`COMPUTO-DECLARADO-${period}`,reason:'',noCommonConfirmed:!p?.preview.proration}}),returns:[{documentId:credit.id,commonReturned:210,commonRestored:100,reference:'DEVOLUCION-ENERO-2025',reason:'IVA común de compra del mismo ejercicio y crédito histórico restituido en junio.'}]}
 for(const d of extra.filter(d=>d.kind==='credito'))input.returns.push({documentId:d.id,commonReturned:0,commonRestored:0,reference:`EXTRA-${d.id}`,reason:'Devolución de ensayo revisada separadamente.'})
 return {...f,state,input,january,june,december,credit,extra}
}
