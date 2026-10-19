import {createApplication} from '../server/http.mjs'
import {productionShiftsFixture} from './production-shifts-fixture.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.37',port=3042,password='Sica-Production-Shifts-QA-2026',filename='var/qa-production-shifts.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const f=productionShiftsFixture(),auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);app.repository.logout(auth.token);const s=app.repository.read().state;await writeFile('output/qa/production-shifts-before.json',JSON.stringify(Object.fromEntries(['documents','entries','stockMoves','treasuryMoves'].map(k=>[k,s[k]])),null,2)+'\n')}
await new Promise(resolve=>app.server.listen(port,host,resolve))
console.log(`Turnos de producción de ensayo: http://${host}:${port}/produccion/centros`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
