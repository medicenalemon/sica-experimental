import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {today} from '../.server/domain/constants.js'

// Empresa y movimientos sintéticos en una base nueva. No ejecuta transferencias externas.
const directory=await mkdtemp(join(tmpdir(),'sica-cash-ui-')),port=3004
const app=await createApplication({filename:join(directory,'sica.sqlite'),adminPassword:'Sica-Cash-UI-QA-2026',origins:[`http://localhost:${port}`]}),auth=await app.repository.login('admin','Sica-Cash-UI-QA-2026',false,'fixture')
const state=initialState();loadTextileDemo(state);state.settings.name='SICA QA - CIERRES SINTÉTICOS';state.settings.onboarding=true
state.masters.treasury.push({id:'caja-salon',name:'Caja salón',type:'Caja',branchId:'central',bank:'',accountId:'1.1.1'})
const party=state.parties.find(p=>p.side==='cliente')
for(const [treasuryId,amount] of [['caja-principal',500000],['caja-salon',300000]])createDocument(state,{kind:'cobro',side:'cliente',letter:'X',date:today(),due:today(),branchId:'central',partyId:party.id,lines:[],payments:[{method:'Efectivo',amount,treasuryId,reference:'PRUEBA-'+treasuryId}],allocations:[],perceptions:0,sourceId:'',observations:'Anticipo sintético para verificar cierres',responsible:'Administrador',costCenter:'',depositId:'principal',official:false,valued:false,seller:'',priceList:'general'},'Administrador General')
await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));console.log(`Cajas sintéticas: http://localhost:${port}/finanzas/cajas`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
