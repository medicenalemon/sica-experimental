import {createApplication} from '../server/http.mjs'
import {productionConversionFixture} from './production-conversion-fixture.mjs'
const host='127.0.0.26',port=3031,password='Sica-Production-Conversion-QA-2026',filename='var/qa-production-conversion.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=productionConversionFixture();await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Conversión sintética: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
