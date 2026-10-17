import {createApplication} from '../server/http.mjs'
import {inventoryInflationUiFixture} from './inventory-inflation-ui-fixture.mjs'
const host='127.0.0.22',port=3027,password='Sica-Inventory-Currency-QA-2026',filename='var/qa-inventory-inflation.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=inventoryInflationUiFixture();await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Inventario sintético en moneda de cierre: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
