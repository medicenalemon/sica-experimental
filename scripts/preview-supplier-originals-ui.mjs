import {createApplication} from '../server/http.mjs'
import {writeFile} from 'node:fs/promises'
import {supplierOriginalsFixture} from './supplier-originals-fixture.mjs'
const host='127.0.0.43',port=3048,password='Sica-Supplier-Originals-QA-2026',filename='var/qa-supplier-originals.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const f=supplierOriginalsFixture(),auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);app.repository.logout(auth.token);await writeFile('output/qa/supplier-originals-before.json',JSON.stringify(app.repository.read().state,null,2)+'\n')}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Originales de proveedores: http://${host}:${port}/proveedores/compras`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
