import {createApplication} from '../server/http.mjs'
import {unbilledReceiptFixture} from './unbilled-receipt-fixture.mjs'
import {previewInventoryCost,inventoryCostReview,postInventoryCost} from '../.server/domain/inventory-costing.js'
const host='127.0.0.6',port=3011,password='Sica-Period-UI-QA-2026',filename='var/qa-accounting-close.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,f=unbilledReceiptFixture(actor,{invoice:true,extraReceipt:true}),state=f.state
 state.settings.name='SICA QA - CIERRE CONTABLE';const input={date:'2026-10-09',reference:'Inventario exacto para cierre sintético',accounts:f.accounts,receiptCosts:[f.estimate(f.pending)]};input.review=inventoryCostReview(previewInventoryCost(state,input,state.inventoryCostBatches.at(-1)));postInventoryCost(state,input,actor)
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Cierre sintético: http://${host}:${port}/contabilidad/cierres`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
