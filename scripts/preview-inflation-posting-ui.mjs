import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import * as statements from '../.server/domain/financial-statements.js'
import * as model from '../.server/domain/reexpression.js'
import * as postingModel from '../.server/domain/reexpression-posting.js'
import {inflationPostingFixture} from './inflation-posting-fixture.mjs'
const host='127.0.0.20',port=3025,password='Sica-Inflation-Posting-QA-2026',filename='var/qa-inflation-posting.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),{state}=inflationPostingFixture(initialState,statements,model,postingModel,{prepareAccounts:false});await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Ajuste anual sintético: http://${host}:${port}/contabilidad/moneda-cierre`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
