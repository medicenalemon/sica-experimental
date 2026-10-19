import {createApplication} from '../server/http.mjs'
import {assetInflationUiFixture} from './asset-inflation-ui-fixture.mjs'
// This script is the QA entry point, not an imported fixture.
const host='127.0.0.21',port=3026,password='Sica-Asset-Currency-QA-2026',filename='var/qa-asset-inflation.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),f=assetInflationUiFixture();await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Conciliación sintética por bien: http://${host}:${port}/contabilidad/bienes-de-uso`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
