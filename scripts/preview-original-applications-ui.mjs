import {createApplication} from '../server/http.mjs'
import {writeFile} from 'node:fs/promises'
import {accountApplicationsFixture} from './account-applications-fixture.mjs'
const host='127.0.0.42',port=3047,password='Sica-Original-Applications-QA-2026',filename='var/qa-original-applications.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const f=accountApplicationsFixture({original:true}),auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);app.repository.logout(auth.token);await writeFile('output/qa/original-applications-before.json',JSON.stringify(app.repository.read().state,null,2)+'\n')}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Aplicaciones originales de ensayo: http://${host}:${port}/finanzas/cuentas`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
