import {vatAnnualFixture} from './vat-annual-fixture.mjs'
export function vatLedgerFixture(dependencies,options={}){
 const f=vatAnnualFixture(dependencies,options),{annualModel,addManualEntry}=dependencies,a=annualModel.preserveVatAnnual(f.state,{...f.input,review:annualModel.vatAnnualReview(annualModel.previewVatAnnual(f.state,f.input))},f.actor),vat=f.state.settings.accountMap.vatCredit,expense=f.state.settings.accountMap.purchases
 addManualEntry(f.state,f.actor.role,'2025-01-31','Ajuste de IVA de enero · ensayo contable','central',[{accountId:expense,debit:2150,credit:0},{accountId:vat,debit:0,credit:2150}]);const januaryAdjustment=f.state.entries.at(-1)
 addManualEntry(f.state,f.actor.role,'2025-12-31','Diferencia anual de IVA · ensayo contable',options.adjustmentBranchId||'central',[{accountId:expense,debit:1568,credit:0},{accountId:vat,debit:0,credit:1568}]);const annualAdjustment=f.state.entries.at(-1)
 const input={kind:'Anual',sourceId:a.id,asOf:'2025-12-31',accountIds:[vat],manual:[],reference:'IVA-MAYOR-ENSAYO-01',reason:'Conciliación sintética del IVA de compras con el diario. Los ajustes manuales requieren respaldo y revisión de sus contrapartidas.',previousId:'',confirmed:true}
 const adjustments=[januaryAdjustment,annualAdjustment].map(e=>({entryId:e.id,reference:`RESPALDO-${e.id}`,reason:'Ajuste manual sintético; revisar destino y submayores antes de una contabilización real.'}))
 return {...f,input,annual:a,januaryAdjustment,annualAdjustment,adjustments}
}
