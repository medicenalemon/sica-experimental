import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {saveMaster} from '../.server/domain/engine.js'
import {today} from '../.server/domain/constants.js'
// Prueba local: nuevos datos sintéticos y base aislada, sin servicios externos.
const filename=process.env.SICA_PREVIEW_DATABASE||join(await mkdtemp(join(tmpdir(),'sica-route-ui-')),'sica.sqlite'),port=3005,app=await createApplication({filename,adminPassword:'Sica-Route-UI-QA-2026',origins:[`http://localhost:${port}`]})
if(app.repository.read().revision===0){
const auth=await app.repository.login('admin','Sica-Route-UI-QA-2026',false,'fixture')
const state=initialState();loadTextileDemo(state);state.settings.name='SICA QA - RUTAS SINTÉTICAS';state.settings.onboarding=true
for(const [id,name,startTime,hours] of [['qa-cut','Corte','08:00',4],['qa-sew','Costura','09:00',8],['qa-control','Control','08:00',4]])saveMaster(state,'workCenters',{id,name,startTime,hours,capacity:1,branchId:'central',workDays:'1,2,3,4,5,6,7'},'Administrador General')
saveMaster(state,'routes',{id:'qa-route',name:'Ruta textil de prueba',operations:JSON.stringify([{name:'Cortar',workCenterId:'qa-cut',hours:2},{name:'Coser',workCenterId:'qa-sew',hours:3},{name:'Controlar',workCenterId:'qa-control',hours:0.5}])},'Administrador General')
const output=state.products.find(p=>p.sku==='PANT-42-AZ'),raw=state.products.find(p=>p.sku==='REM-M-NEG')
saveMaster(state,'production',{id:'qa-order',name:'Lote entre centros de prueba',productId:output.id,quantity:2,branchId:'central',routeId:'qa-route',start:today(),end:state.settings.exerciseEnd,status:'Planificada'},'Administrador General')
saveMaster(state,'materials',{id:'qa-material',name:'Material sintético',orderId:'qa-order',productId:raw.id,depositId:'principal',unit:raw.unit,quantity:3},'Administrador General')
await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));console.log(`Rutas sintéticas: http://localhost:${port}/produccion/rutas`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
