import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {today} from '../.server/domain/constants.js'
import {taxIdentityFixture} from './tax-identity-fixture.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.55',port=3060,password='Sica-Tax-Identity-QA-2026'
const instance=await createApplication({filename:'var/qa-tax-identity.sqlite',adminPassword:password,origins:[`http://${host}:${port}`]}),repository=instance.repository
if(repository.read().revision===0){
 const f=taxIdentityFixture({initialState,loadTextileDemo,createDocument},today()),auth=await repository.login('admin',password,false,'fixture')
 try{
  await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)
  await writeFile('output/qa/tax-identity-before.json',JSON.stringify(repository.read(),null,2)+'\n')
  await writeFile('output/qa/tax-identity-context.json',JSON.stringify({date:today(),customerId:f.customer.id,supplierId:f.supplier.id,invoiceId:f.invoice.id,receiptId:f.receipt.id,legacyId:f.legacy.id,couponId:f.coupon.id},null,2)+'\n')
 }finally{repository.logout(auth.token)}
}
await new Promise(resolve=>instance.server.listen(port,host,resolve))
console.log(`Ensayo local de identidad impositiva: http://${host}:${port}/finanzas/liquidaciones-tarjetas`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>instance.server.close(resolve));await instance.close();process.exit(0)})
