import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {documentRulesFixture} from './document-rules-fixture.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.56',port=3061,password='Sica-Document-Rules-QA-2026'
const instance=await createApplication({filename:'var/qa-document-rules.sqlite',adminPassword:password,origins:[`http://${host}:${port}`]}),repository=instance.repository
if(repository.read().revision===0){
 const f=documentRulesFixture({initialState,loadTextileDemo,createDocument}),auth=await repository.login('admin',password,false,'fixture')
 try{
  await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)
  await writeFile('output/qa/document-rules-before.json',JSON.stringify(repository.read(),null,2)+'\n')
  await writeFile('output/qa/document-rules-context.json',JSON.stringify({customerId:f.customer.id,supplierId:f.supplier.id,invoiceId:f.invoice.id,futureId:f.future.id,purchaseId:f.purchase.id},null,2)+'\n')
 }finally{repository.logout(auth.token)}
}
await new Promise(resolve=>instance.server.listen(port,host,resolve));console.log(`Ensayo local: http://${host}:${port}/clientes/cobros/nuevo`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>instance.server.close(resolve));await instance.close();process.exit(0)})
