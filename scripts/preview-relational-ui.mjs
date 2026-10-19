import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,saveCheque} from '../.server/domain/engine.js'
import {receiptPrintFixture} from './receipt-print-fixture.mjs'
const directory=await mkdtemp(join(tmpdir(),'sica-relational-ui-')),port=39781,origin=`http://127.0.0.1:${port}`,password='Relational-UI-Only-Test-2026'
const app=await createApplication({filename:join(directory,'sica.sqlite'),adminPassword:password,origins:[origin],arca:{mode:'disabled'}})
const auth=await app.repository.login('admin',password,false,'fixture')
try{await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:receiptPrintFixture({initialState,loadTextileDemo,createDocument,saveCheque}).state}},true)}finally{app.repository.logout(auth.token)}
await new Promise((done,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',done)})
console.log(JSON.stringify({url:origin,username:'admin',password,temporaryDatabase:app.repository.filename}))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(done=>app.server.close(done));await app.close();await rm(directory,{recursive:true,force:true});process.exit(0)})
