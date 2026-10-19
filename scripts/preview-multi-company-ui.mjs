import {createApplication} from '../server/http.mjs'
import {writeFile} from 'node:fs/promises'
import {multiCompanyConfigs,multiCompanyFixture} from './multi-company-fixture.mjs'
const host='127.0.0.38',port=3043,app=await createApplication({companies:multiCompanyConfigs,origins:[`http://${host}:${port}`]})
for(const c of multiCompanyConfigs){const r=app.repositories.get(c.id);if(r.read().revision===0){const auth=await r.login('admin',c.adminPassword,false,'fixture');await r.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:multiCompanyFixture(c.id)}},true);r.logout(auth.token);const s=r.read().state;await writeFile(`output/qa/multi-company-${c.id}-before.json`,JSON.stringify(Object.fromEntries(['documents','entries','stockMoves','treasuryMoves','masters'].map(k=>[k,k==='masters'?Object.fromEntries(Object.entries(s.masters).filter(([key])=>key!=='users')):s[k]])),null,2)+'\n')}}
await new Promise(resolve=>app.server.listen(port,host,resolve))
console.log(`Selector multiempresa de ensayo: http://${host}:${port}/login`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
