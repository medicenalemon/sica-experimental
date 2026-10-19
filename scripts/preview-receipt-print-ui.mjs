import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,saveCheque} from '../.server/domain/engine.js'
import {receiptPrintFixture} from './receipt-print-fixture.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.57',port=3062,password='Sica-Receipt-Print-QA-2026'
const instance=await createApplication({filename:'var/qa-receipt-print.sqlite',adminPassword:password,origins:[`http://${host}:${port}`]}),repository=instance.repository
if(repository.read().revision===0){
 const f=receiptPrintFixture({initialState,loadTextileDemo,createDocument,saveCheque},'2026-10-18',false),auth=await repository.login('admin',password,false,'fixture')
 try{
  await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)
  await writeFile('output/qa/receipt-print-before.json',JSON.stringify(repository.read(),null,2)+'\n')
  await writeFile('output/qa/receipt-print-context.json',JSON.stringify({customerId:f.customer.id,supplierId:f.supplier.id,invoiceId:f.invoice.id,purchaseId:f.purchase.id},null,2)+'\n')
 }finally{repository.logout(auth.token)}
}
await new Promise(resolve=>instance.server.listen(port,host,resolve));console.log(`Ensayo de constancias: http://${host}:${port}/clientes/cobros/nuevo`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>instance.server.close(resolve));await instance.close();process.exit(0)})
