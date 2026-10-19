import {createApplication} from '../server/http.mjs'
import {inventoryCurrentVnrFixture} from './inventory-current-vnr-fixture.mjs'
const host='127.0.0.25',port=3030,password='Sica-Inventory-Current-VNR-QA-2026',filename='var/qa-inventory-current-vnr.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=inventoryCurrentVnrFixture();await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`VNR actual sintético al cierre: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
