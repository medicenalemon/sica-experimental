import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,settleCards} from '../.server/domain/engine.js'
import {taxMovementsFixture} from './tax-movements-fixture.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.53',port=3058,password='Sica-Tax-Movements-QA-2026',instance=await createApplication({filename:'var/qa-tax-movements.sqlite',adminPassword:password,origins:[`http://${host}:${port}`]}),repository=instance.repository
if(repository.read().revision===0){const f=taxMovementsFixture({initialState,loadTextileDemo,createDocument,settleCards});f.state.settings.name='SICA Textil · retenciones y percepciones de ensayo';const auth=await repository.login('admin',password,false,'fixture');try{await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);await repository.mutate(auth.token,{revision:repository.read().revision,requestId:crypto.randomUUID(),command:{type:'document.create',document:{...f.base,perceptions:200},perceptionReference:'REG-COMMAND-TEST',perceptionJurisdiction:'Tucumán'}});await writeFile('output/qa/tax-movements-before.json',JSON.stringify(repository.read(),null,2)+'\n')}finally{repository.logout(auth.token)}}
await new Promise(resolve=>instance.server.listen(port,host,resolve));console.log(`Movimientos impositivos, ensayo local: http://${host}:${port}/reportes/retenciones-percepciones`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>instance.server.close(resolve));await instance.close();process.exit(0)})
