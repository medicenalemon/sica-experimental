import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {addManualEntry} from '../.server/domain/engine.js'
const host='127.0.0.12',port=3017,password='Sica-Journal-Reversal-UI-QA-2026',filename='var/qa-journal-reversal.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,state=initialState();loadTextileDemo(state);state.stockMoves=[];state.settings.exerciseStart='2026-01-01';state.settings.exerciseEnd='2026-12-31';state.settings.name='SICA QA - REVERSIÓN DEL DIARIO';addManualEntry(state,actor.role,'2026-10-03','Gasto sintético duplicado QA','central',[{accountId:'5.1',debit:15000,credit:0},{accountId:'2.1.1',debit:0,credit:15000}]);await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Diario sintético: http://${host}:${port}/contabilidad/diario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
