import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,settleCards} from '../.server/domain/engine.js'
import {today} from '../.server/domain/constants.js'
import {taxCertificateFixture} from './tax-certificates-fixture.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.54',port=3059,password='Sica-Tax-Certificates-QA-2026',instance=await createApplication({filename:'var/qa-tax-certificates.sqlite',adminPassword:password,origins:[`http://${host}:${port}`]}),repository=instance.repository
if(repository.read().revision===0){const f=taxCertificateFixture({initialState,loadTextileDemo,createDocument,settleCards},{reviewedOn:today()});f.state.settings.name='SICA Textil · comparación de certificados de ensayo';const auth=await repository.login('admin',password,false,'fixture');try{await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);await writeFile('output/qa/tax-certificates-before.json',JSON.stringify(repository.read(),null,2)+'\n');await writeFile('output/qa/tax-certificates-context.json',JSON.stringify({links:f.input.links,agentCuit:f.customer.cuit,agentName:f.customer.name,number:f.input.evidence.number,externalAmount:f.input.evidence.amount},null,2)+'\n')}finally{repository.logout(auth.token)}}
await new Promise(resolve=>instance.server.listen(port,host,resolve));console.log(`Comparación de certificados, ensayo local: http://${host}:${port}/finanzas/conciliacion-certificados`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>instance.server.close(resolve));await instance.close();process.exit(0)})
