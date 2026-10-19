import {createApplication} from '../server/http.mjs'
import {fixedAssetsFixture} from './fixed-assets-fixture.mjs'
import {acquireFixedAsset,postDepreciation,previewDepreciation,fixedAssetReview} from '../.server/domain/fixed-assets.js'
import {closeAccountingPeriod,previewAccountingClose,accountingCloseReview} from '../.server/domain/accounting-close.js'
const host='127.0.0.15',port=3020,password='Sica-Asset-Reestimate-UI-QA-2026',filename='var/qa-asset-reestimate.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,f=fixedAssetsFixture(actor),state=f.state;state.settings.name='SICA QA - NUEVAS ESTIMACIONES'
 acquireFixedAsset(state,f.reviewed(),actor);const dp={date:'2026-10-10',reference:'Cargo sintético previo al cambio',reason:'Diez días de uso consumidos según información inicial'};dp.review=fixedAssetReview(previewDepreciation(state,dp));postDepreciation(state,dp,actor)
 const cp={date:'2026-10-10',reference:'Cierre sintético antes de la nueva evidencia',reason:'Información disponible al 10/10; no hubo cambios posteriores todavía',acknowledged:[]},p=previewAccountingClose(state,cp);cp.acknowledged=p.warnings.map(w=>w.id);cp.review=accountingCloseReview(p);closeAccountingPeriod(state,cp,actor)
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Nuevas estimaciones sintéticas: http://${host}:${port}/contabilidad/bienes-de-uso`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
