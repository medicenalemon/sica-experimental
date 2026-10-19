import {createApplication} from '../server/http.mjs'
import {writeFile} from 'node:fs/promises'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,addManualEntry} from '../.server/domain/engine.js'
import * as originals from '../.server/domain/supplier-originals.js'
import * as vatModel from '../.server/domain/vat-purchases.js'
import * as annualModel from '../.server/domain/vat-annual.js'
import {vatLedgerFixture} from './vat-ledger-fixture.mjs'
const host='127.0.0.48',port=3053,password='Sica-Vat-Ledger-QA-2026',filename='var/qa-vat-ledger.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const f=vatLedgerFixture({initialState,loadTextileDemo,createDocument,addManualEntry,...originals,vatModel,annualModel}),auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);app.repository.logout(auth.token);await writeFile('output/qa/vat-ledger-before.json',JSON.stringify(app.repository.read().state,null,2)+'\n')}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Conciliación IVA: http://${host}:${port}/contabilidad/conciliacion-iva`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
