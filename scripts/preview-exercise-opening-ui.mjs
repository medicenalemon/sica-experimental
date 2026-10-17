import {createApplication} from '../server/http.mjs'
import {exerciseOpeningFixture} from './exercise-opening-fixture.mjs'
const host='127.0.0.10',port=3015,password='Sica-Exercise-Opening-UI-QA-2026',filename='var/qa-exercise-opening.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,state=exerciseOpeningFixture(actor);await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Apertura sintética: http://${host}:${port}/contabilidad/apertura-ejercicio`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
