import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import * as statements from '../.server/domain/financial-statements.js'
import * as model from '../.server/domain/reexpression.js'
import {reexpressionFixture} from './reexpression-fixture.mjs'
const host='127.0.0.19',port=3024,password='Sica-Reexpression-UI-QA-2026',filename='var/qa-reexpression.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),{state}=reexpressionFixture(initialState,statements,model);await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Moneda de cierre sintética: http://${host}:${port}/contabilidad/moneda-cierre`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
