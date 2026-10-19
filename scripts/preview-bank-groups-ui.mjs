import {createApplication} from '../server/http.mjs'
import {bankGroupsFixture} from './bank-groups-fixture.mjs'
const host='127.0.0.33',port=3038,password='Sica-Bank-Groups-QA-2026',filename='var/qa-bank-groups.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0||!app.repository.read().state.bankStatements?.length){
 const auth=await app.repository.login('admin',password,false,'fixture')
 await app.repository.mutate(auth.token,{revision:app.repository.read().revision,requestId:crypto.randomUUID(),command:{state:(await bankGroupsFixture()).state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve))
console.log(`Conciliación agrupada de ensayo: http://${host}:${port}/finanzas/bancos/extractos`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
