import {createApplication} from '../server/http.mjs'
import {inventoryRecoverabilityUiFixture} from './inventory-recoverability-ui-fixture.mjs'
const host='127.0.0.23',port=3028,password='Sica-Inventory-VNR-QA-2026',filename='var/qa-inventory-recoverability.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=inventoryRecoverabilityUiFixture();await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Valor recuperable sintético: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
