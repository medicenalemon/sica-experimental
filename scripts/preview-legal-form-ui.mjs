import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
const host='127.0.0.44',port=3049,password='Sica-Legal-Form-QA-2026',filename='var/qa-legal-form.sqlite',app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const state=initialState();loadTextileDemo(state);state.settings.name='SICA Textil · Forma jurídica';const auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true);app.repository.logout(auth.token)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Forma jurídica: http://${host}:${port}/configuracion`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
