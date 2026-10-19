import {vatPurchasesFixture} from './vat-purchases-fixture.mjs'
export function vatProrationFixture(dependencies){
 const f=vatPurchasesFixture(dependencies),model=dependencies.vatModel
 const firstInput={...f.input,review:model.vatPurchasesReview(model.previewVatPurchases(f.state,f.input))},legacy=model.preserveVatPurchases(f.state,firstInput,f.actor)
 const input={...f.input,previousId:legacy.id,reference:'IVA-PRORRATEO-ENSAYO-01',mode:'Prorrateo global',credits:f.input.credits.map(c=>({documentId:c.documentId,amount:c.documentId===f.invoice.id?1000:c.documentId===f.debit.id?70:c.documentId===f.credit.id?100:0})),proration:{from:'2026-01-01',to:'2026-10-31',taxable:750000,exempt:200000,untaxed:50000,reference:'BASES-FISCALES-ENSAYO',reason:'Bases netas fiscales acumuladas declaradas: 75% gravadas; destinos comunes y restitución según cómputo histórico revisados.',confirmed:true,common:f.input.credits.map(c=>({documentId:c.documentId,amount:c.documentId===f.invoice.id?2000:c.documentId===f.debit.id?100:0}))}}
 return {...f,input,legacy}
}
