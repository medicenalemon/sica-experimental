import {createApplication} from '../server/http.mjs'
import {inventoryReserveCurrencyFixture} from './inventory-reserve-currency-fixture.mjs'
const host='127.0.0.24',port=3029,password='Sica-Inventory-Reserve-Currency-QA-2026',filename='var/qa-inventory-reserve-currency.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=inventoryReserveCurrencyFixture({open:true,futureSale:true});await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Inventario neto sintético en moneda de cierre: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
