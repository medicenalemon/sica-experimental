import {createApplication} from '../server/http.mjs'
import {fixedAssetsFixture} from './fixed-assets-fixture.mjs'
import {acquireFixedAsset,postDepreciation,previewDepreciation,fixedAssetReview} from '../.server/domain/fixed-assets.js'
import {prepareAssetImpairmentAccounts} from '../.server/domain/asset-impairments.js'
import {closeAccountingPeriod,previewAccountingClose,accountingCloseReview} from '../.server/domain/accounting-close.js'
const host='127.0.0.17',port=3022,password='Sica-Asset-Impairment-UI-QA-2026',filename='var/qa-asset-impairment.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin',password,false,'fixture'),actor=app.repository.auth(auth.token).actor,f=fixedAssetsFixture(actor),state=f.state;state.settings.name='SICA QA - VALOR RECUPERABLE';prepareAssetImpairmentAccounts(state,actor);acquireFixedAsset(state,f.reviewed(),actor)
 const dep=date=>{const i={date,reference:`Cargo sintético al ${date}`,reason:'Uso consumido hasta la fecha inclusive, con vida y residual de ensayo documentados'};i.review=fixedAssetReview(previewDepreciation(state,i));postDepreciation(state,i,actor)};dep('2026-10-09')
 const cp={date:'2026-10-09',reference:'Cierre sintético previo al deterioro',reason:'Información previa a la evaluación, costo y uso conservados',acknowledged:[]},p=previewAccountingClose(state,cp);cp.acknowledged=p.warnings.map(w=>w.id);cp.review=accountingCloseReview(p);closeAccountingPeriod(state,cp,actor);dep('2026-10-10')
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Recuperable sintético: http://${host}:${port}/contabilidad/bienes-de-uso`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
