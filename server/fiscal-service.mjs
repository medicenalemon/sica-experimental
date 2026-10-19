import {resolveStore} from './resolve-store.mjs'
import {FiscalRepository} from './fiscal-repository.mjs'
import {salesCandidates,previewVatSales} from '../.server/domain/vat-sales.js'
import {ArcaClient} from './arca-client.mjs'
import {ApiError} from './repository.mjs'
import {canonical,fingerprint,protectTicket,readTicket,fiscalRecord} from './fiscal-store.mjs'
import {buildFiscalRequest,numberedRequest} from '../.server/domain/fiscal.js'
import {assertProductionRequest} from '../.server/domain/fiscal-production.js'
import {documentPath} from '../.server/domain/commands.js'
import {canAccess} from '../.server/domain/permissions.js'
const environments=['homologacion','produccion']
export class FiscalService {
 constructor(repository,config={},dependencies={}){
  if(config.mode&&!['disabled',...environments].includes(config.mode))throw new Error('El modo ARCA debe ser disabled, homologacion o produccion.')
  this.repository=repository;this.store=new FiscalRepository(repository);this.queue=Promise.resolve();this.environment=config.mode==='produccion'?'produccion':'homologacion'
  const context=canonical([repository.companyId,this.environment,config.cuit,'wsfe']),cache={get:async()=>{const row=await this.store.getTicket(this.environment,config.cuit||'');return row?readTicket(repository.key,context,row.secret):null},set:ticket=>repository.exclusive(()=>this.store.saveTicket(this.environment,config.cuit,protectTicket(repository.key,context,ticket)))}
  this.client=dependencies.client||new ArcaClient(config,{...dependencies,cache});if(this.client.status().environment&&this.client.status().environment!==this.environment)throw new Error('El cliente ARCA no corresponde al ambiente configurado.');repository.fiscal=this
 }
 get(id,environment=this.environment){if(!environments.includes(environment))throw new ApiError(400,'Ambiente fiscal inválido.');return this.store.getJob(id,environment)}
 record(row){return fiscalRecord(row)}
 decorate(state){return resolveStore((function*(){for(const d of state.documents){delete d.fiscal;delete d.fiscalHistory;const rows=[];for(const environment of environments){const row=yield this.get(d.id,environment);if(row)rows.push(row)}if(rows.length){d.fiscalHistory=rows.map(row=>this.record(row));d.fiscal=this.record(rows.find(row=>row.environment===this.environment)||rows.at(-1))}}}).call(this))}
 check(token,id){return resolveStore((function*(){const {actor}=(yield this.repository.auth(token)),current=(yield this.repository.read()),d=current.state.documents.find(d=>d.id===id);if(!d||!canAccess(actor,documentPath(d))||d.side!=='cliente'||!['factura','credito','debito'].includes(d.kind))throw new ApiError(403,'No tenés permiso para autorizar este comprobante.');return {...current,actor,document:d}}).call(this))}
 associated(state,d){return resolveStore((function*(){if(d.kind==='factura')return undefined;const row=(yield this.get(d.sourceId)),source=state.documents.find(s=>s.id===d.sourceId);if(!row||row.state!=='aprobado'||fingerprint(source)!==row.signature)return undefined;return {issuer:row.issuer,point:Number(row.point),type:Number(row.type),number:Number(row.number),date:source.date,receiver:JSON.parse(row.request).detail.DocNro}}).call(this))}
 preview(token,id,options={},environment=this.environment){return resolveStore((function*(){const {state,document,revision}=(yield this.check(token,id)),row=(yield this.get(id,environment));if(row){if(fingerprint(document)!==row.signature||canonical(options)!==canonical(JSON.parse(row.options)))throw new ApiError(409,'La solicitud conserva sus datos y parámetros originales.');return {...JSON.parse(row.request),environment,reviewRevision:revision}}if(environment!==this.environment)throw new ApiError(400,'No hay una solicitud conservada en ese ambiente. Sólo se preparan nuevas solicitudes en el configurado.');const request=buildFiscalRequest(state,id,options,(yield this.associated(state,document)));if(environment==='produccion')assertProductionRequest(request);return {...request,environment,reviewRevision:revision}}).call(this))}
 salesSources(state,period,environment){return resolveStore((function*(){const sources=[];for(const d of salesCandidates(state,period).filter(d=>d.letter!=='X')){const row=yield this.get(d.id,environment);if(row)sources.push({documentId:d.id,request:JSON.parse(row.request),record:this.record(row),unchanged:fingerprint(d)===row.signature})}return sources}).call(this))}
 salesPreview(token,input){return resolveStore((function*(){const {actor}=(yield this.repository.auth(token));if(!canAccess(actor,'/finanzas/impuestos')&&!canAccess(actor,'/reportes/impositivos'))throw new ApiError(403,'Tu perfil no permite revisar preparaciones de IVA ventas.');const {state}=(yield this.repository.read());return previewVatSales(state,input,(yield this.salesSources(state,input.period,input.environment)))}).call(this))}
 async change(callback,actor,action,detail){return this.store.transaction(async()=>{await callback();const current=await this.repository.read();await this.store.bumpRevision();await this.repository.audit({id:crypto.randomUUID(),at:new Date().toISOString(),user:actor.name,action,detail,revision:current.revision+1})})}
 async operate(token,{documentId,revision,reviewRevision,environment,options={},action='autorizar'}){
  if(typeof documentId!=='string'||!Number.isSafeInteger(revision)||!['autorizar','consultar'].includes(action))throw new ApiError(400,'Solicitud fiscal inválida.')
  const run=async()=>{
   const {actor,state,document}=await this.check(token,documentId);let row=await this.get(documentId)
   if(environment!==undefined&&environment!==this.environment||this.environment==='produccion'&&environment!==this.environment)throw new ApiError(409,'El ambiente revisado no coincide con el del servidor. Revisá la solicitud en el ambiente actual antes de operar.')
   const status=this.client.status();if(status.environment&&status.environment!==this.environment)throw new ApiError(409,'El cliente ARCA cambió de ambiente. Reiniciá con una configuración coherente antes de operar.');const label=this.environment==='produccion'?`producción${status.simulated?' (simulación)':''}`:'homologación'
   if(!status.configured)throw new ApiError(503,`${this.environment==='produccion'?'Producción':'Homologación'} no configurada. Completá las credenciales del ambiente elegido en el servidor.`)
   if(row){if(this.client.config&&this.client.config.cuit!==row.issuer)throw new ApiError(409,'El CUIT de las credenciales no coincide con la solicitud original.');if(fingerprint(document)!==row.signature||row.issuer!==state.settings.cuit.replace(/[-\s]/g,''))throw new ApiError(409,'Los datos del comprobante cambiaron respecto de la solicitud guardada.');if(canonical(options)!==canonical(JSON.parse(row.options)))throw new ApiError(409,'Conservá los parámetros originales de la solicitud.');if(['aprobado','rechazado','conflicto'].includes(row.state))return this.record(row)}
   else{
    if(action==='consultar')throw new ApiError(400,'Todavía no se envió una solicitud para este comprobante.');if(revision!==(await this.repository.read()).revision)throw new ApiError(409,'Actualizá la base antes de solicitar el CAE.');if(reviewRevision!==revision)throw new ApiError(409,'Revisá nuevamente la solicitud: los datos cambiaron o falta su revisión.')
    const request=buildFiscalRequest(state,documentId,options,(await this.associated(state,document)));if(this.environment==='produccion')assertProductionRequest(request);if(request.issuer!==this.client.config?.cuit&&this.client.config)throw new ApiError(400,'El CUIT configurado en ARCA no coincide con la empresa.')
    await this.change(async()=>{const latest=await this.check(token,documentId);if(latest.revision!==revision)throw new ApiError(409,'Los datos cambiaron antes de reservar la solicitud.');if(await this.store.activeSeries(this.environment,request))throw new ApiError(409,'Hay una solicitud sin resolver en esta serie. Consultala antes de emitir otra.');await this.store.insertJob([this.repository.companyId,this.environment,documentId,request.issuer,request.point,request.type,0,'preparando',JSON.stringify(request),canonical(options),fingerprint(document),'{}',new Date().toISOString()])},actor,`Preparar solicitud ARCA de ${label}`,document.number)
    row=await this.get(documentId)
   }
   let request=JSON.parse(row.request),result
   try{
    if(row.number>0){result=await this.client.consult(request);if(result.state==='no-encontrado'){if(action==='consultar')result={state:'incierto',messages:[{code:602,message:'ARCA no encontró el número. Se conserva la reserva; podés reintentar la misma solicitud.'}]};else result=await this.client.authorize(request)}}
    else if(action==='consultar')result={state:'incierto',messages:[{code:0,message:'No se llegó a enviar una autorización. Reintentá la solicitud original.'}]}
    else{request=numberedRequest(request,(await this.client.last(request.point,request.type))+1);await this.change(async()=>{await this.check(token,documentId);await this.store.reserveNumber(documentId,this.environment,request.detail.CbteDesde,request)},actor,`Reservar número ARCA de ${label}`,`${document.number} · ${request.point}-${request.detail.CbteDesde}`);result=await this.client.authorize(request)}
   }catch{result={state:'incierto',messages:[{code:0,message:'No se confirmó el resultado de ARCA. Consultá el comprobante antes de continuar esta serie.'}]}}
   if(status.simulated===true)result={...result,simulated:true}
   await this.change(()=>this.store.finishJob(documentId,this.environment,result),actor,`Resultado ARCA de ${label}`,`${document.number} · ${result.state}`)
   return this.record(await this.get(documentId))
  };const operation=this.queue.then(()=>this.repository.fiscalExclusive?this.repository.fiscalExclusive(this.environment,documentId,run):run());this.queue=operation.catch(()=>{});return operation
 }
}
