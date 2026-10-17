import {createApplication} from '../server/http.mjs'
import {writeFile} from 'node:fs/promises'
import {cardDisputesFixture} from './card-disputes-fixture.mjs'
const host='127.0.0.39',port=3044,password='Sica-Card-Disputes-QA-2026',filename='var/qa-card-disputes.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const f=cardDisputesFixture(),auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);app.repository.logout(auth.token);const state=app.repository.read().state;await writeFile('output/qa/card-disputes-before.json',JSON.stringify(Object.fromEntries(['documents','entries','stockMoves','cardSettlements','treasuryMoves'].map(k=>[k,state[k]])),null,2)+'\n')}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Contracargos de ensayo: http://${host}:${port}/finanzas/liquidaciones-tarjetas`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
