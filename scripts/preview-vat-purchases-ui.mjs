import {createApplication} from '../server/http.mjs'
import {writeFile} from 'node:fs/promises'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import * as originals from '../.server/domain/supplier-originals.js'
import {vatPurchasesFixture} from './vat-purchases-fixture.mjs'
const host='127.0.0.45',port=3050,password='Sica-Vat-Purchases-QA-2026',filename='var/qa-vat-purchases.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const f=vatPurchasesFixture({initialState,loadTextileDemo,createDocument,...originals}),auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);app.repository.logout(auth.token);await writeFile('output/qa/vat-purchases-before.json',JSON.stringify(app.repository.read().state,null,2)+'\n')}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`IVA compras: http://${host}:${port}/finanzas/impuestos`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
