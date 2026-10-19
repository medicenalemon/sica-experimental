import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {today} from '../.server/domain/constants.js'

// Prueba local aislada: el cliente simulado no tiene red, certificado ni clave privada.
const directory=await mkdtemp(join(tmpdir(),'sica-fiscal-ui-')),port=3003
const client={config:{cuit:'30712345671'},status:()=>({configured:true,environment:'homologacion',productionEnabled:false}),last:async()=>41,authorize:async()=>({state:'aprobado',cae:'12345678901234',expires:today().slice(0,4)+'-12-31',messages:[{code:0,message:'Resultado simulado para verificar la interfaz; no fue emitido por ARCA.'}]}),consult:async()=>({state:'no-encontrado',messages:[]})}
const app=await createApplication({filename:join(directory,'sica.sqlite'),adminPassword:'Sica-Fiscal-UI-QA-2026',origins:[`http://127.0.0.1:${port}`],arcaClient:client}),auth=await app.repository.login('admin','Sica-Fiscal-UI-QA-2026',false,'fixture')
const state=initialState();loadTextileDemo(state);state.settings.cuit=client.config.cuit;state.settings.name='SICA QA - CAE SIMULADO';state.settings.address='Domicilio sintético de prueba';state.settings.onboarding=true
state.settings.iibbRegistration='Inscripción sintética - sin valor registral';state.settings.activityStart='2020-01-01';state.masters.branches.find(b=>b.id==='central').activityStart='2021-02-03'
const party=state.parties.find(p=>p.side==='cliente'),product=state.products[0];party.iva='Consumidor Final'
const document=createDocument(state,{kind:'factura',side:'cliente',letter:'B',date:today(),due:today(),branchId:'central',partyId:party.id,lines:[{productId:product.id,description:'Prenda de prueba para PDF de homologación',quantity:2,unit:'Unidad',price:10000,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Prueba sin conexión a ARCA',responsible:'Administrador',costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'},'Administrador General')
await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
const revision=app.repository.read().revision;await app.repository.fiscal.operate(auth.token,{documentId:document.id,revision,reviewRevision:revision,options:{nationalIndirect:{amount:0,reference:'Ejemplo sintético sin otros impuestos nacionales indirectos'}},action:'autorizar'})
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));console.log(`Vista sintética de prueba: http://127.0.0.1:${port}/clientes/ventas`)
process.on('SIGINT',async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
