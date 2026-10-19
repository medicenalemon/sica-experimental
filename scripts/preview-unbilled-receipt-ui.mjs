import {createApplication} from '../server/http.mjs'
import {unbilledReceiptFixture} from './unbilled-receipt-fixture.mjs'
const opening=process.argv.includes('--opening'),host=opening?'127.0.0.5':'127.0.0.4',port=opening?3010:3009,password='Sica-Receipts-UI-QA-2026',filename=opening?'var/qa-unbilled-opening.sqlite':'var/qa-unbilled-receipts.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor;await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:unbilledReceiptFixture(actor,{openingReceipt:opening,invoice:true,extraReceipt:!opening}).state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Recepciones sintéticas: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
