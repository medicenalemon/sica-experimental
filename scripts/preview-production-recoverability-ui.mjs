import {createApplication} from '../server/http.mjs'
import {productionRecoverabilityFixture} from './production-recoverability-fixture.mjs'
const host='127.0.0.31',port=3036,password='Sica-Production-Recovery-QA-2026',filename='var/qa-production-recoverability.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=productionRecoverabilityFixture();await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Recuperable sintético de producción: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
