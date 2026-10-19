import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,addManualEntry} from '../.server/domain/engine.js'
import {buildFiscalRequest,numberedRequest} from '../.server/domain/fiscal.js'
import {prepareRevenueAccount,previewRevenueAccrual,previewRevenueSettlement,revenueReview,accrueRevenue,settleRevenue} from '../.server/domain/revenue-accruals.js'
import * as vatSales from '../.server/domain/vat-sales.js'
import {vatSalesLedgerFixture} from './vat-sales-ledger-fixture.mjs'
export async function prepareSalesLedgerExample(repository,password){
 const f=vatSalesLedgerFixture({initialState,loadTextileDemo,createDocument,addManualEntry,buildFiscalRequest,numberedRequest,prepareRevenueAccount,previewRevenueAccrual,previewRevenueSettlement,revenueReview,accrueRevenue,settleRevenue,vatSales}),auth=await repository.login('admin',password,false,'fixture');f.state.vatSales=[]
 try{await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);for(const a of f.authorizations){const options={saleTerms:a.request.snapshot.saleTerms,...(a.request.snapshot.nationalIndirect?{nationalIndirect:a.request.snapshot.nationalIndirect}:{})},p=repository.fiscal.preview(auth.token,a.documentId,options);await repository.fiscal.operate(auth.token,{documentId:a.documentId,revision:p.reviewRevision,reviewRevision:p.reviewRevision,environment:'produccion',options})}const p=repository.fiscal.salesPreview(auth.token,f.preparation.preview.input);await repository.mutate(auth.token,{revision:repository.read().revision,requestId:crypto.randomUUID(),command:{type:'vat.sales',preparation:{...p.input,review:vatSales.vatSalesReview(p)}}});const source=repository.read().state.vatSales[0];return {input:{...f.input,sourceId:source.id},adjustment:f.adjustment,preparationId:source.id,priorAccrualId:f.accrual.id,settlementId:f.settlement.id,unbilledAccrualId:f.unbilled.id,invoiceWithPriorId:f.invoiceWithPrior.id}}finally{repository.logout(auth.token)}
}
