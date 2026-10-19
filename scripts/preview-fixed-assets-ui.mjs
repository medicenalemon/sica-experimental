import {createApplication} from '../server/http.mjs'
import {fixedAssetsFixture} from './fixed-assets-fixture.mjs'
const host='127.0.0.14',port=3019,password='Sica-Fixed-Assets-UI-QA-2026',filename='var/qa-fixed-assets.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,f=fixedAssetsFixture(actor)
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Bienes de uso sintéticos: http://${host}:${port}/contabilidad/bienes-de-uso`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
