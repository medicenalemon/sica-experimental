import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
const host='127.0.0.35',port=3040,password='Sica-Sessions-QA-2026',filename='var/qa-sessions.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const state=initialState();loadTextileDemo(state);state.settings.name='SICA Textil · Sesiones de ensayo'
 const auth=await app.repository.login('admin',password,false,'fixture','Preparación de ensayo')
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true);app.repository.logout(auth.token)
}
if(app.repository.read().revision===1&&!app.repository.db.prepare("SELECT public_id FROM sessions WHERE company_id='sica' AND client_name='Caja de ensayo' AND expires>?").get(Date.now()))await app.repository.login('admin',password,false,'fixture','Caja de ensayo')
await new Promise(resolve=>app.server.listen(port,host,resolve))
console.log(`Sesiones de ensayo: http://${host}:${port}/administracion/sesiones`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
