import {createApplication} from '../server/http.mjs'
import {stockReturnFixture} from './stock-return-fixture.mjs'
const host='127.0.0.3',port=3008,password='Sica-Returns-UI-QA-2026',app=await createApplication({filename:'var/qa-stock-returns.sqlite',adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor;await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:stockReturnFixture(actor).state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Devoluciones sintéticas: http://${host}:${port}/stock/devoluciones`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
