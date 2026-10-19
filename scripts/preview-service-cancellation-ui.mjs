import {createApplication} from '../server/http.mjs'
import {serviceAccrualFixture} from './service-accrual-fixture.mjs'
import {accrueService,reestimateService,serviceReview,previewServiceReestimate} from '../.server/domain/service-accruals.js'
const host='127.0.0.13',port=3018,password='Sica-Service-Cancel-UI-QA-2026',filename='var/qa-service-cancellation.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,f=serviceAccrualFixture(actor),state=f.state;state.settings.name='SICA QA - ANULACIÓN DE SERVICIOS'
 const a=accrueService(state,f.reviewed(),actor),revision={date:'2026-10-04',accrualId:a.id,reference:'Nueva información sintética antes de revisión',reason:'Actualización de contrato de prueba: limpieza 130 ARS y reparación 30 ARS',lines:f.accrual.lines.map((l,i)=>({productId:l.productId,value:i?3000:13000}))};revision.review=serviceReview(previewServiceReestimate(state,revision));reestimateService(state,revision,actor)
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Servicios sintéticos: http://${host}:${port}/contabilidad/servicios-devengados`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
