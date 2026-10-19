import {createApplication} from '../server/http.mjs'
import {fixedAssetsFixture} from './fixed-assets-fixture.mjs'
import {acquireFixedAsset,postDepreciation,previewDepreciation,fixedAssetReview} from '../.server/domain/fixed-assets.js'
import {prepareAssetDisposalAccounts} from '../.server/domain/asset-disposals.js'
import {createDocument} from '../.server/domain/engine.js'
import {closeAccountingPeriod,previewAccountingClose,accountingCloseReview} from '../.server/domain/accounting-close.js'
const host='127.0.0.16',port=3021,password='Sica-Asset-Disposal-UI-QA-2026',filename='var/qa-asset-disposal.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,f=fixedAssetsFixture(actor),state=f.state;state.settings.name='SICA QA - BAJAS DE BIENES DE USO';prepareAssetDisposalAccounts(state,actor)
 acquireFixedAsset(state,f.reviewed(),actor);const dep=date=>{const i={date,reference:`Cargo sintético al ${date}`,reason:'Consumo completo hasta la fecha inclusive, con parámetros de ensayo documentados'};i.review=fixedAssetReview(previewDepreciation(state,i));postDepreciation(state,i,actor)};dep('2026-10-10')
 const cp={date:'2026-10-10',reference:'Cierre sintético antes de la venta',reason:'Información previa al evento, costo y depreciación del equipo conservados',acknowledged:[]},p=previewAccountingClose(state,cp);cp.acknowledged=p.warnings.map(w=>w.id);cp.review=accountingCloseReview(p);closeAccountingPeriod(state,cp,actor)
 createDocument(state,{...f.invoice,side:'cliente',sourceId:'',partyId:state.parties.find(p=>p.side==='cliente').id,date:'2026-10-20',due:'2026-10-20',lines:[{...f.invoice.lines[0],price:80000}],observations:'Acta sintética: equipo entregado en su totalidad y control transferido el 20/10/2026. Factura en esa misma fecha, sin operación real.',responsible:actor.name},actor.role);dep('2026-10-20')
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Bajas sintéticas: http://${host}:${port}/contabilidad/bienes-de-uso`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
