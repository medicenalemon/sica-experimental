import {createApplication} from '../server/http.mjs'
import {yearEndFixture} from './year-end-fixture.mjs'
const host='127.0.0.9',port=3014,password='Sica-Year-End-UI-QA-2026',filename='var/qa-year-end.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,state=yearEndFixture(actor);await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Cierre anual sintético: http://${host}:${port}/contabilidad/cierre-resultados`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
