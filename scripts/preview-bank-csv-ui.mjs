import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.34',port=3039,password='Sica-Bank-Csv-QA-2026',filename='var/qa-bank-csv.sqlite'
await writeFile('output/qa/extracto-bancario-valido.csv','\ufeffFecha,Referencia,Descripcion,Importe\r\n2026-10-13,CSV-01,"Primera parte, ensayo","2000,00"\r\n2026-10-13,CSV-02,"Segunda parte; ensayo","4000,00"\r\n2026-10-13,CSV-CARGO,Cargo pendiente,"-100,00"\r\n')
await writeFile('output/qa/extracto-bancario-invalido.csv','Fecha;Referencia;Descripcion;Importe\n2026-10-13;CSV-ERROR;"Celda sin cerrar;42,00')
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const state=initialState();loadTextileDemo(state);state.settings.name='SICA Textil · Extracto CSV de ensayo'
 const auth=await app.repository.login('admin',password,false,'fixture')
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve))
console.log(`Extractos CSV de ensayo: http://${host}:${port}/finanzas/bancos/extractos`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
