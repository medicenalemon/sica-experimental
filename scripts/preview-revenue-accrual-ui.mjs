import {createApplication} from '../server/http.mjs'
import {revenueAccrualFixture} from './revenue-accrual-fixture.mjs'
const host='127.0.0.11',port=3016,password='Sica-Revenue-UI-QA-2026',filename='var/qa-revenue-accrual.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,f=revenueAccrualFixture(actor);await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Ingresos sintéticos: http://${host}:${port}/contabilidad/ingresos-devengados`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
