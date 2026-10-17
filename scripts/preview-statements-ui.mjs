import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {statementsFixture} from './statements-fixture.mjs'
const host='127.0.0.18',port=3023,password='Sica-Statements-UI-QA-2026',filename='var/qa-statements.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),{state}=statementsFixture(initialState);await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Estados sintéticos: http://${host}:${port}/contabilidad/estados`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
