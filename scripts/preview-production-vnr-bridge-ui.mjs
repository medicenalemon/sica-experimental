import {createApplication} from '../server/http.mjs'
import {productionVnrBridgeFixture} from './production-vnr-bridge-fixture.mjs'
const host='127.0.0.29',port=3034,password='Sica-VNR-Bridge-QA-2026',filename='var/qa-production-vnr-bridge.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=productionVnrBridgeFixture();await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Puente de conversión/VNR sintético: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
