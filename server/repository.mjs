import {cardLedgerSources} from '../.server/domain/card-disputes.js'
import {productionInventoryReview} from '../.server/domain/production-costs.js'
import {inventoryClosingSafeReference} from '../.server/domain/inventory-closing-model.js'
import {inventoryInflationSources} from '../.server/domain/inventory-inflation.js'
import {assetInflationSources} from '../.server/domain/asset-inflation.js'
import {sealBackup,syncFile} from './backup-integrity.mjs'
import {assertFiscalSources} from './fiscal-integrity.mjs'
import { fiscalSchema } from './fiscal-store.mjs'
import { DatabaseSync, backup } from 'node:sqlite'
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { initialState } from '../.server/domain/seed.js'
import { executeCommand, commandPath, documentPath } from '../.server/domain/commands.js'
import { validateState } from '../.server/domain/validation.js'
import { canAccess } from '../.server/domain/permissions.js'
import { modules } from '../.server/domain/modules.js'
import { derivePassword } from '../.server/domain/auth.js'

export class ApiError extends Error {constructor(status,message){super(message);this.status=status}}
const digest=value=>createHash('sha256').update(value).digest('hex')
const constantEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
export class Repository {
 static async open({filename,companyId='sica',adminPassword}) {
  const repository=new Repository(filename,companyId)
  if(!repository.db.prepare('SELECT id FROM companies WHERE id=?').get(companyId)) {
   if(typeof adminPassword!=='string'||adminPassword.length<12||adminPassword.length>1024){repository.db.close();throw new Error('La primera ejecución requiere SICA_ADMIN_PASSWORD de al menos 12 caracteres.')}
   const state=initialState(),user=state.masters.users[0];user.salt=randomBytes(24).toString('hex');user.passwordIterations=600000;user.passwordHash=await derivePassword(adminPassword,user.salt,600000)
   repository.db.prepare('INSERT INTO companies(id,revision,state) VALUES(?,0,?)').run(companyId,JSON.stringify(state))
  }
  try{repository.verifyAudit();return repository}catch(error){repository.db.close();throw error}
 }
 constructor(filename,companyId) {
  this.filename=resolve(filename);this.companyId=companyId;this.queue=Promise.resolve()
  if(existsSync(this.filename+'.recovering'))throw new Error('La recuperación SQLite está incompleta. Revisá el informe de recuperación antes de iniciar el servidor.')
  mkdirSync(dirname(this.filename),{recursive:true,mode:0o700})
  const keyPath=this.filename+'.audit-key'
  if(!existsSync(keyPath)&&existsSync(this.filename))throw new Error('Falta la clave de auditoría correspondiente a la base. Restaurá el archivo .audit-key del mismo respaldo.');if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'})
  this.key=readFileSync(keyPath);if(this.key.length!==32)throw new Error('Clave de auditoría inválida.')
  this.db=new DatabaseSync(this.filename,{timeout:5000});chmodSync(this.filename,0o600)
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,state TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,company_id TEXT NOT NULL,user_id TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL,auth_hash TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS requests(company_id TEXT NOT NULL,user_id TEXT NOT NULL,request_id TEXT NOT NULL,command_hash TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(company_id,user_id,request_id));
   CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,company_id TEXT NOT NULL,record TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS recovery(id INTEGER PRIMARY KEY AUTOINCREMENT,company_id TEXT NOT NULL,revision INTEGER NOT NULL,state TEXT NOT NULL,created TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset INTEGER NOT NULL);${fiscalSchema}`)
  this.db.exec('BEGIN IMMEDIATE')
  try{
   const columns=new Set(this.db.prepare('PRAGMA table_info(sessions)').all().map(c=>c.name))
   for(const [name,type] of [['public_id',"TEXT NOT NULL DEFAULT ''"],['created','INTEGER NOT NULL DEFAULT 0'],['last_seen','INTEGER NOT NULL DEFAULT 0'],['client_name',"TEXT NOT NULL DEFAULT 'Sesión anterior'"]])if(!columns.has(name))this.db.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`)
   for(const row of this.db.prepare("SELECT token FROM sessions WHERE public_id='' ").all())this.db.prepare('UPDATE sessions SET public_id=? WHERE token=?').run(crypto.randomUUID(),row.token)
   this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_public_id ON sessions(public_id); COMMIT')
  }catch(error){this.db.exec('ROLLBACK');throw error}
 }
 read(){const row=this.db.prepare('SELECT revision,state FROM companies WHERE id=?').get(this.companyId);if(!row)throw new ApiError(503,'Empresa no inicializada.');return {revision:Number(row.revision),state:JSON.parse(row.state)}}
 actor(user){return {userId:user.id,name:String(user.name),role:user.role,permissions:String(user.permissions||'').split(',').map(s=>s.trim()).filter(Boolean)}}
 auth(token){const record=this.db.prepare('SELECT * FROM sessions WHERE token=? AND company_id=? AND expires>?').get(digest(token||''),this.companyId,Date.now());if(!record)throw new ApiError(401,'Iniciá sesión nuevamente.');const {state}=this.read(),user=state.masters.users.find(u=>u.id===record.user_id&&u.active);if(!user||record.auth_hash!==digest(String(user.passwordHash))){this.db.prepare('DELETE FROM sessions WHERE token=?').run(record.token);throw new ApiError(401,'La sesión dejó de ser válida.')}if(Number(record.last_seen)<Date.now()-60000)this.db.prepare('UPDATE sessions SET last_seen=? WHERE token=?').run(Date.now(),record.token);return {actor:this.actor(user),csrf:record.csrf}}
 limitLogin(username,ip){const now=Date.now();for(const [key,maximum] of [[digest('ip:'+ip),60],[digest('user:'+ip+':'+username.toLowerCase()),10]]) {let row=this.db.prepare('SELECT * FROM login_attempts WHERE key=?').get(key);if(row&&Number(row.reset)>now&&Number(row.count)>=maximum)throw new ApiError(429,'Demasiados intentos. Esperá quince minutos.');if(!row||Number(row.reset)<=now)row={count:0,reset:now+15*60*1000};this.db.prepare('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)').run(key,Number(row.count)+1,Number(row.reset))}this.db.prepare('DELETE FROM login_attempts WHERE reset<?').run(now)}
 async login(username,password,remember,ip,clientName='Navegador'){if(typeof clientName!=='string'||clientName.length>80||Array.from(clientName).some(c=>c.charCodeAt(0)<32))throw new ApiError(400,'El nombre de terminal admite hasta 80 caracteres en una línea.');clientName=clientName.trim()||'Navegador';if(typeof username!=='string'||username.length>100||typeof password!=='string'||password.length>1024)throw new ApiError(400,'Datos de ingreso inválidos.');username=username.trim();this.limitLogin(username,ip);const {state}=this.read(),user=state.masters.users.find(u=>String(u.username).toLowerCase()===username.toLowerCase()&&u.active);const computed=await derivePassword(password,String(user?.salt||'sica-invalid-user'),user?Number(user.passwordIterations||150000):600000);if(!user||!constantEqual(computed,user.passwordHash))throw new ApiError(401,'Usuario o contraseña incorrectos.');const fresh=this.read().state.masters.users.find(u=>u.id===user.id&&u.active&&u.passwordHash===user.passwordHash);if(!fresh)throw new ApiError(401,'La sesión dejó de ser válida.');const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex'),duration=remember?30*24*60*60:8*60*60;this.db.prepare('INSERT INTO sessions(token,company_id,user_id,csrf,expires,auth_hash,public_id,created,last_seen,client_name) VALUES(?,?,?,?,?,?,?,?,?,?)').run(digest(token),this.companyId,user.id,csrf,Date.now()+duration*1000,digest(String(user.passwordHash)),crypto.randomUUID(),Date.now(),Date.now(),clientName);this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('DELETE FROM login_attempts WHERE key=?').run(digest('user:'+ip+':'+username.toLowerCase()));return {token,csrf,duration,actor:this.actor(fresh)}}
 logout(token){this.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token||''))}
 activeSessions(token){
  const {actor}=this.auth(token)
  if(actor.role!=='Administrador General')throw new ApiError(403,'La gestión de sesiones requiere Administrador General.')
  const users=new Map(this.read().state.masters.users.map(u=>[u.id,u]))
  return this.db.prepare('SELECT * FROM sessions WHERE company_id=? AND expires>? ORDER BY last_seen DESC,created DESC').all(this.companyId,Date.now()).filter(r=>{const u=users.get(r.user_id);return u?.active&&r.auth_hash===digest(String(u.passwordHash))}).map(r=>{const u=users.get(r.user_id);return {id:r.public_id,userId:u.id,name:String(u.name),username:String(u.username),role:u.role,terminal:r.client_name,created:r.created?new Date(Number(r.created)).toISOString():null,lastSeen:r.last_seen?new Date(Number(r.last_seen)).toISOString():null,expires:new Date(Number(r.expires)).toISOString(),current:r.token===digest(token)}})
 }
 publicState(actor){const {revision,state}=this.read(),allowed=path=>canAccess(actor,path),admin=actor.role==='Administrador General'
  const salesLedgerReadable=allowed('/contabilidad/conciliacion-iva-ventas')
  const vatLedgerReadable=allowed('/contabilidad/conciliacion-iva')
  const cardReadable=allowed('/finanzas/liquidaciones-tarjetas')
  state.cardSources=cardReadable?cardLedgerSources(state):[]
  if(!cardReadable)state.cardDisputes=[]
  const readableDocuments=state.documents.filter(d=>allowed(documentPath(d))||allowed('/'+(d.side==='cliente'?'clientes':'proveedores')+'/cuenta-corriente')||allowed('/reportes/'+(d.side==='cliente'?'ventas':'compras'))||allowed('/reportes/impositivos')||allowed('/finanzas/impuestos')||vatLedgerReadable||salesLedgerReadable||allowed('/reportes/cuentas-corrientes')||allowed('/finanzas/cuentas')||(allowed(d.side==='cliente'?'/clientes/cobros':'/proveedores/pagos')&&['factura','debito','credito','saldo'].includes(d.kind))||(allowed('/finanzas/liquidaciones-tarjetas')&&d.kind==='cobro'))
  const needed=new Set(['branches','users','notes','agenda'])
  for(const spec of modules)if(allowed(spec.path)){needed.add(spec.key);for(const f of spec.fields)if(f.source)needed.add(f.source)}
  const sides=new Set(readableDocuments.map(d=>d.side))
  for(const side of ['cliente','proveedor']){const base=side==='cliente'?'/clientes':'/proveedores';if(['alta','ventas','compras','pedidos','ordenes','remitos','notas','cobros','pagos','cuenta-corriente'].some(p=>allowed(base+'/'+p)))sides.add(side)}
  const commercial=sides.size>0
  const returnsReadable=allowed('/stock/devoluciones');if(returnsReadable){sides.add('cliente');sides.add('proveedor')}
  const reexpressionReadable=allowed('/contabilidad/moneda-cierre'),statementsReadable=allowed('/contabilidad/estados')||reexpressionReadable,fixedAssetReadable=allowed('/contabilidad/bienes-de-uso'),inventoryCostReadable=allowed('/contabilidad/inventario'),accountingCloseReadable=allowed('/contabilidad/cierres')||allowed('/contabilidad/cierre-resultados')||allowed('/contabilidad/apertura-ejercicio'),serviceReadable=allowed('/contabilidad/servicios-devengados'),revenueReadable=allowed('/contabilidad/ingresos-devengados'),revenueTaxReadable=allowed('/reportes/impositivos')||allowed('/finanzas/impuestos')||vatLedgerReadable
  const inventoryInflationSourceRows=inventoryCostReadable&&!reexpressionReadable&&!accountingCloseReadable?inventoryInflationSources(state):[]
  const inflationSources=fixedAssetReadable&&!reexpressionReadable&&!accountingCloseReadable?assetInflationSources(state):[]
  if(statementsReadable||accountingCloseReadable||serviceReadable||revenueReadable||fixedAssetReadable||vatLedgerReadable||salesLedgerReadable)needed.add('accounts')
  if(serviceReadable||fixedAssetReadable){sides.add('proveedor');needed.add('products')}
  if(revenueReadable){sides.add('cliente');needed.add('products')}
  if(inventoryCostReadable){sides.add('proveedor');for(const key of ['deposits','production','accounts'])needed.add(key)}
  if(allowed('/finanzas/cheques'))sides.add('cliente')
  if(commercial)for(const key of ['priceLists','prices','deposits'])needed.add(key)
  if(['/clientes/ventas','/clientes/pedidos','/clientes/remitos'].some(allowed))needed.add('combos')
  const stockReadable=['/stock/inventario','/stock/movimientos','/stock/traslados','/stock/devoluciones','/contabilidad/inventario','/contabilidad/cierres','/contabilidad/cierre-resultados','/contabilidad/apertura-ejercicio','/produccion','/reportes/inventario','/clientes/remitos','/proveedores/remitos'].some(allowed)
  if(stockReadable)needed.add('deposits')
  const receipts=allowed('/clientes/cobros')||allowed('/proveedores/pagos'),finance=receipts||['/finanzas/cajas','/finanzas/bancos','/finanzas/bancos/extractos','/reportes/financieros','/finanzas/liquidaciones-tarjetas'].some(allowed)
  if(allowed('/finanzas/cajas'))needed.add('cashClosures')
  if(finance)for(const key of ['treasury','banks','cards','paymentMethods','taxRules','accounts'])needed.add(key)
  if(allowed('/contabilidad/diario')||allowed('/contabilidad/mayor')||allowed('/contabilidad/balance'))needed.add('accounts')
  if(allowed('/proveedores/compras')||allowed('/reportes/compras'))needed.add('costCenters')
  state.parties=state.parties.filter(p=>sides.has(p.side)).map(p=>{
   const base=p.side==='cliente'?'/clientes':'/proveedores'
   if(allowed(base+'/alta')||allowed(base+'/cuenta-corriente')||allowed('/reportes/'+(p.side==='cliente'?'ventas':'compras')))return p
   // These fields are inputs for authorized orders/remits; private notes and balances are omitted.
   return Object.fromEntries(['id','side','code','name','cuit','iva','address','province','priceList','discount',...(receipts?['seller','commission']:[])].filter(k=>k in p).map(k=>[k,p[k]]))
  })
  if(!needed.has('products')&&!commercial&&!allowed('/productos/articulos')&&!allowed('/productos/servicios')&&!stockReadable)state.products=[]
  const documentIds=new Set(readableDocuments.map(d=>d.id)),returnCreditIds=new Set((state.stockReturns||[]).map(r=>r.noteId)),returnDocuments=returnsReadable?state.documents.filter(d=>d.kind==='remito'||['factura','credito'].includes(d.kind)).map(d=>documentIds.has(d.id)?d:({...d,fiscal:undefined,lines:d.lines.map(l=>({...l,price:0,discount:0})),payments:[],allocations:[],net:0,vat:0,total:0,perceptions:0,observations:'',responsible:''})):[]
  const serviceDocuments=serviceReadable||fixedAssetReadable?state.documents.filter(d=>d.side==='proveedor'&&['remito','factura','credito','debito'].includes(d.kind)&&(serviceReadable||d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'))).map(d=>documentIds.has(d.id)?d:({...d,observations:'',responsible:'',fiscal:undefined,lines:d.lines.map(l=>({...l,description:''}))})):[]
  const revenueDocuments=revenueReadable?state.documents.filter(d=>d.side==='cliente'&&['remito','factura','credito','debito'].includes(d.kind)).map(d=>documentIds.has(d.id)?d:({...d,observations:'',responsible:'',fiscal:undefined,lines:d.lines.map(l=>({...l,description:''}))})):[]
  const fixedAssetSales=fixedAssetReadable?state.documents.filter(d=>d.side==='cliente'&&['remito','factura','credito','debito'].includes(d.kind)&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso')).map(d=>documentIds.has(d.id)?d:revenueDocuments.find(r=>r.id===d.id)||({...d,partyId:'',observations:'',responsible:'',fiscal:undefined,payments:[],allocations:[],lines:d.lines.map(l=>({...l,description:''}))})):[]
  const closingDocuments=accountingCloseReadable?state.documents.map(d=>documentIds.has(d.id)?d:({...d,partyId:'',observations:'',responsible:'',fiscal:undefined,lines:d.lines.map(l=>({...l,description:''}))})):[]
  state.documents=accountingCloseReadable?[...new Map([...readableDocuments,...fixedAssetSales,...closingDocuments].map(d=>[d.id,d])).values()]:inventoryCostReadable?[...new Map([...readableDocuments,...state.documents.filter(d=>d.side==='proveedor'&&['factura','remito','credito','debito'].includes(d.kind)),...state.documents.filter(d=>d.side==='cliente'&&(d.kind==='remito'||returnCreditIds.has(d.id))).map(d=>documentIds.has(d.id)?d:({...d,partyId:'',lines:[],payments:[],allocations:[],net:0,vat:0,total:0,perceptions:0,observations:'',responsible:''})),...fixedAssetSales].map(d=>[d.id,d])).values()]:[...new Map([...readableDocuments,...returnDocuments,...serviceDocuments,...revenueDocuments,...fixedAssetSales].map(d=>[d.id,d])).values()];this.fiscal?.decorate(state);for(const d of state.documents)if(!documentIds.has(d.id)&&(d.side==='cliente'||returnsReadable&&!inventoryCostReadable)){delete d.fiscal;delete d.fiscalHistory}
  if(!revenueTaxReadable){state.vatPurchases=[];state.vatAnnual=[]}
  if(!allowed('/finanzas/impuestos')&&!allowed('/reportes/impositivos')&&!salesLedgerReadable)state.vatSales=[]
  if(!salesLedgerReadable)state.vatSalesLedger=[]
  if(!vatLedgerReadable)state.vatLedger=[]
  state.supplierOriginals=(state.supplierOriginals||[]).filter(r=>documentIds.has(r.preview.source.id))
  state.accountApplications=(state.accountApplications||[]).filter(r=>accountingCloseReadable||allowed('/finanzas/cuentas')||allowed('/reportes/cuentas-corrientes')||allowed('/'+(r.preview.credit.side==='cliente'?'clientes':'proveedores')+'/cuenta-corriente')||allowed(r.preview.credit.side==='cliente'?'/clientes/cobros':'/proveedores/pagos'))
  if(!stockReadable){state.stockMoves=[];state.stockTransfers=[]}if(!returnsReadable&&!inventoryCostReadable)state.stockReturns=revenueReadable?(state.stockReturns||[]).filter(r=>r.side==='cliente'&&state.documents.some(d=>d.id===r.sourceId)).map(r=>({...r,partyName:'',reason:'',responsible:''})):[]
  if(!vatLedgerReadable&&!salesLedgerReadable&&!['/contabilidad/diario','/contabilidad/mayor','/contabilidad/balance','/contabilidad/estados','/contabilidad/moneda-cierre','/contabilidad/cierres','/contabilidad/cierre-resultados','/contabilidad/apertura-ejercicio'].some(allowed))state.entries=serviceReadable||inventoryCostReadable||revenueReadable||fixedAssetReadable?state.entries.filter(e=>fixedAssetReadable&&(!!e.fixedAssetRecordId||state.documents.some(d=>d.id===e.documentId&&['factura','credito','debito'].includes(d.kind)))||revenueReadable&&(!!e.revenueRecordId||state.documents.some(d=>d.id===e.documentId&&d.side==='cliente'&&d.kind==='factura'))||serviceReadable&&(!!e.serviceRecordId||state.documents.some(d=>d.id===e.documentId&&d.side==='proveedor'&&d.kind==='factura'))||inventoryCostReadable&&(!!e.inventoryBatchId||!!e.inventoryRecoveryId||e.lines.some(l=>l.accountId===state.inventoryRecoveries?.[0]?.allowanceAccountId)||state.documents.some(d=>d.id===e.documentId&&d.side==='proveedor'&&['factura','credito','debito'].includes(d.kind))||e.lines.some(l=>l.accountId===(state.inventoryCostBatches?.at(-1)?.accounts.inventory||state.settings.accountMap.inventory)))):[]
  if(!finance&&!accountingCloseReadable)state.treasuryMoves=[]
  if(!allowed('/finanzas/cajas'))state.cashClosings=[]
  if(!allowed('/finanzas/bancos/extractos'))state.bankStatements=[]
  if(!allowed('/finanzas/liquidaciones-tarjetas')&&!allowed('/reportes/compras'))state.cardSettlements=[]
  if(!allowed('/produccion')){state.productionPlans=[];state.productionReservations=stockReadable?(state.productionReservations||[]).map(r=>({id:r.id,preview:{orderId:r.preview.orderId,date:r.preview.date,lines:r.preview.lines.map(({productId,depositId,quantity})=>({productId,depositId,quantity}))},...(r.release?{release:{date:r.release.date}}:{})})):[]}
  if(!inventoryCostReadable&&!accountingCloseReadable)state.inventoryCostBatches=[]
  if(!accountingCloseReadable){state.accountingCloses=[];if(!statementsReadable)state.yearEndCloses=[];else state.yearEndCloses=(state.yearEndCloses||[]).map(c=>({id:c.id,exerciseStart:c.exerciseStart}))}
  if(!reexpressionReadable)state.reexpressions=[]
  if(!reexpressionReadable&&!accountingCloseReadable)state.reexpressionPostings=fixedAssetReadable||inventoryCostReadable?(state.reexpressionPostings||[]).flatMap(p=>{const source=inflationSources.find(s=>s.id===p.id),inventorySource=inventoryInflationSourceRows.find(s=>s.id===p.id);return source||inventorySource||p.preview.productionInflationRequired?[{id:p.id,number:p.number,reexpressionId:p.reexpressionId,preview:{date:p.preview.date,from:p.preview.from,provider:p.preview.provider,...(p.preview.productionClosingRequired?{productionClosingRequired:true}:{}),...(p.preview.productionInflationRequired?{productionInflationRequired:true}:{}),...(source?{assetInflationSource:source}:{}),...(inventorySource?{inventoryInflationSource:inventorySource}:{})}}]:[]}):[]
  if(!admin)state.productionRecoveries=inventoryCostReadable?(state.productionRecoveries||[]).map(r=>({id:r.id,number:r.number,date:r.date,...(r.closing?{closing:{postingId:r.closing.postingId,inflationId:r.closing.inflationId}}:{}),allowanceAccountId:r.allowanceAccountId,preview:{rows:r.preview.rows.map(({orderId,branchId,wipAccountId,gross,afterAllowance})=>({orderId,branchId,wipAccountId,gross,afterAllowance}))}})):[];
  if(!admin)state.productionInflations=inventoryCostReadable?(state.productionInflations||[]).map(r=>({id:r.id,number:r.number,date:r.date,postingId:r.postingId,preview:{...(r.preview.reserve?{reserve:{source:{accountId:r.preview.reserve.source.accountId},balances:r.preview.reserve.balances.map(({orderId,branchId,before,after,difference})=>({orderId,branchId,before,after,difference}))}}:{}),balances:r.preview.balances.map(({orderId,accountId,branchId,before,after,difference})=>({orderId,accountId,branchId,before,after,difference}))}})):[];
  if(!admin)state.productionCorrections=inventoryCostReadable?(state.productionCorrections||[]).map(r=>({id:r.id,number:r.number,preview:{date:r.preview.date,...(r.preview.version===3?{version:3}:{}),layers:r.preview.layers.map(l=>({productionCostId:l.productionCostId,allocations:l.allocations}))}})):[];
  if(!admin)state.productionCosts=inventoryCostReadable?(state.productionCosts||[]).map(r=>({id:r.id,number:r.number,date:r.date,wipAccountId:r.wipAccountId,preview:{date:r.preview.date,branchId:r.preview.branchId,wipAccountId:r.preview.wipAccountId,orders:r.preview.orders.map(({name:_name,...o})=>o),allocations:r.preview.allocations},inventoryReview:productionInventoryReview(r.preview)})):[];
  if(!statementsReadable&&!accountingCloseReadable)state.inventoryRecoveries=(state.inventoryRecoveries||[]).map(r=>r.closing?({...r,closingReview:undefined,preview:{...r.preview,closing:inventoryClosingSafeReference(r.preview.closing)}}):r);if(!inventoryCostReadable&&!accountingCloseReadable)state.inventoryInflations=[];if(!inventoryCostReadable&&!accountingCloseReadable)state.inventoryRecoveries=[]
  if(!fixedAssetReadable&&!accountingCloseReadable)state.assetInflations=[]
  if(!statementsReadable)state.financialStatements=[]
  if(!vatLedgerReadable&&!salesLedgerReadable&&!['/contabilidad/diario','/contabilidad/mayor','/contabilidad/balance'].some(allowed))state.journalReversals=[]
  if(!allowed('/contabilidad/apertura-ejercicio'))state.exerciseOpenings=[]
  if(!revenueReadable&&!salesLedgerReadable&&!accountingCloseReadable&&!revenueTaxReadable){state.revenueAccruals=fixedAssetReadable?(state.revenueAccruals||[]).filter(a=>a.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso')).map(a=>({id:a.id,sourceId:a.sourceId,lines:a.lines.filter(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso').map(l=>({productId:l.productId}))})):[];state.revenueSettlements=[]}
  if(revenueTaxReadable&&!revenueReadable&&!salesLedgerReadable&&!accountingCloseReadable){state.revenueAccruals=(state.revenueAccruals||[]).map(a=>({id:a.id,number:a.number,date:a.date,sourceId:a.sourceId,preview:{source:{id:a.preview.source.id,number:a.preview.source.number,branchId:a.preview.source.branchId},net:a.preview.net,vat:a.preview.vat,total:a.preview.total}}));state.revenueSettlements=(state.revenueSettlements||[]).map(s=>({id:s.id,number:s.number,date:s.date,accrualId:s.accrualId,preview:{branchId:s.preview.branchId,invoiceNumber:s.preview.invoiceNumber,estimatedNet:s.preview.estimatedNet,estimatedVat:s.preview.estimatedVat}}))}
  if(!fixedAssetReadable&&!accountingCloseReadable){state.fixedAssets=[];state.assetCommissions=[];state.depreciationBatches=[];state.assetReestimates=[];state.assetDisposals=[];state.assetImpairments=[]}
  if(!serviceReadable&&!accountingCloseReadable){state.serviceAccruals=[];state.serviceReestimates=[];state.serviceSettlements=[];state.serviceCancellations=[]}
  if(!allowed('/finanzas/cheques')&&!receipts)state.cheques=[]
  if(!allowed('/importaciones/historial'))state.imports=[]
  state.audit=allowed('/administracion/auditoria')?this.db.prepare('SELECT record FROM audit WHERE company_id=? ORDER BY id').all(this.companyId).map(r=>JSON.parse(r.record)):[]
  for(const key of Object.keys(state.masters))if(!admin&&!needed.has(key))state.masters[key]=[]
  state.masters.users=state.masters.users.map(u=>{const {passwordHash,salt,passwordIterations,...safe}=u;void passwordHash;void salt;void passwordIterations;return admin?safe:{id:u.id,name:u.name,active:u.active}})
  if(!admin&&!vatLedgerReadable&&!salesLedgerReadable&&!allowed('/contabilidad/configuracion')&&!inventoryCostReadable&&!serviceReadable&&!revenueReadable)state.settings.accountMap={}
  return {revision,state,session:actor}
 }
 sign(record,previous){return createHmac('sha256',this.key).update(previous+'\n'+record).digest('hex')}
 audit(record){const previous=this.db.prepare('SELECT hash FROM audit WHERE company_id=? ORDER BY id DESC LIMIT 1').get(this.companyId)?.hash||'';const raw=JSON.stringify(record);this.db.prepare('INSERT INTO audit(company_id,record,previous_hash,hash) VALUES(?,?,?,?)').run(this.companyId,raw,previous,this.sign(raw,previous))}
 verifyAudit(){let previous='';for(const row of this.db.prepare('SELECT record,previous_hash,hash FROM audit WHERE company_id=? ORDER BY id').all(this.companyId)){if(row.previous_hash!==previous||!constantEqual(row.hash,this.sign(row.record,previous)))throw new Error('La cadena de auditoría no es válida. Se requiere revisar la base antes de operar.');previous=row.hash}}
 exclusive(callback){const operation=this.queue.then(callback);this.queue=operation.catch(()=>{});return operation}
 async mutate(token,{revision,requestId,command},restore=false) {if(!Number.isSafeInteger(revision)||!/^[-a-f0-9]{36}$/.test(requestId||''))throw new ApiError(400,'Versión o identificador de solicitud inválido.');const commandHash=digest((restore?'restore:':'command:')+JSON.stringify(command));return this.exclusive(async()=>{
  this.db.exec('BEGIN IMMEDIATE')
  try{
   const {actor}=this.auth(token),prior=this.db.prepare('SELECT command_hash FROM requests WHERE company_id=? AND user_id=? AND request_id=?').get(this.companyId,actor.userId,requestId)
   if(prior){if(prior.command_hash!==commandHash)throw new ApiError(409,'La solicitud repetida contiene otra operación.');this.db.exec('COMMIT');return {...this.publicState(actor),duplicate:true}}
   const current=this.read();if(current.revision!==revision)throw new ApiError(409,'Los datos cambiaron en otra sesión. Actualizá y repetí la operación.')
   let next=structuredClone(current.state),meta
   if(restore){if(actor.role!=='Administrador General')throw new ApiError(403,'La restauración requiere Administrador General.');validateState(command.state);next=structuredClone(command.state);next.masters.users=current.state.masters.users;next.audit=[];meta={action:'Restaurar copia de seguridad',detail:'Se preservaron los usuarios del servidor y una copia de recuperación.'};this.db.prepare('INSERT INTO recovery(company_id,revision,state,created) VALUES(?,?,?,?)').run(this.companyId,revision,JSON.stringify(current.state),new Date().toISOString())}
   else {if(command.type==='sessions.revoke'){if(actor.role!=='Administrador General')throw new ApiError(403,'La gestión de sesiones requiere Administrador General.');if(typeof command.sessionId!=='string'||!/^[-a-f0-9]{36}$/.test(command.sessionId)||typeof command.reason!=='string'||!command.reason.trim()||command.reason.length>500)throw new ApiError(400,'Seleccioná una sesión e indicá un motivo de hasta 500 caracteres.');const target=this.db.prepare('SELECT * FROM sessions WHERE public_id=? AND company_id=? AND expires>?').get(command.sessionId,this.companyId,Date.now());if(!target)throw new ApiError(409,'La sesión ya no está activa. Actualizá la lista.');if(target.token===digest(token))throw new ApiError(400,'Usá Cerrar sesión para salir de tu sesión actual.');const user=next.masters.users.find(u=>u.id===target.user_id);this.db.prepare('DELETE FROM sessions WHERE token=? AND company_id=?').run(target.token,this.companyId);meta={action:'Cerrar sesión de otra terminal',detail:`${user?.name||'Usuario anterior'} · ${target.client_name}: ${command.reason.trim()}`}}else{if(['production.cost','production.reestimate','production.inflation','production.recovery','production.recovery-accounts'].includes(command.type)&&actor.role!=='Administrador General')throw new ApiError(403,'La imputación contable de producción requiere Administrador General.');if(command.type==='inventory.recovery'&&command.assessment?.closing&&actor.role!=='Administrador General')throw new ApiError(403,'El VNR actual posterior al ajuste anual requiere Administrador General.');if(!canAccess(actor,commandPath(command)))throw new ApiError(403,'Tu perfil no tiene permiso para esta operación.');meta=await executeCommand(next,actor,command,command.type==='vat.sales'?{salesAuthorizations:this.fiscal?.salesSources(next,command.preparation.period,command.preparation.environment)}:{})}}
   validateState(next);this.assertFiscalState(next);for(const d of next.documents){delete d.fiscal;delete d.fiscalHistory}next.audit=[]
   const updated=revision+1;this.db.prepare('UPDATE companies SET revision=?,state=? WHERE id=? AND revision=?').run(updated,JSON.stringify(next),this.companyId,revision)
   this.audit({id:crypto.randomUUID(),at:new Date().toISOString(),user:actor.name,action:meta.action,detail:meta.detail,revision:updated,requestId})
   this.db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run(this.companyId,actor.userId,requestId,commandHash,updated)
   this.db.exec('COMMIT');const fresh=next.masters.users.find(u=>u.id===actor.userId&&u.active),old=current.state.masters.users.find(u=>u.id===actor.userId),signedOut=!fresh||fresh.passwordHash!==old.passwordHash;if(signedOut)this.logout(token);return {...this.publicState(fresh?this.actor(fresh):actor),signedOut}
  }catch(error){this.db.exec('ROLLBACK');throw error}
 })}
 recoveries(actor,id){if(actor.role!=='Administrador General')throw new ApiError(403,'La recuperación requiere Administrador General.');if(id!==undefined){const row=this.db.prepare('SELECT state FROM recovery WHERE company_id=? AND id=?').get(this.companyId,id);if(!row)throw new ApiError(404,'Copia de recuperación no encontrada.');return JSON.parse(row.state)}return this.db.prepare('SELECT id,revision,created,state FROM recovery WHERE company_id=? ORDER BY id DESC').all(this.companyId).map(r=>{const s=JSON.parse(r.state);return {id:Number(r.id),revision:Number(r.revision),created:r.created,name:s.settings.name,documents:s.documents.length}})}
 assertFiscalState(next){try{assertFiscalSources(this.db,this.companyId,next)}catch(error){throw new ApiError(409,error.message)}}
 backupState(actor){if(actor.role!=='Administrador General')throw new ApiError(403,'La copia completa requiere Administrador General.');const {state}=this.read();state.audit=this.db.prepare('SELECT record FROM audit WHERE company_id=? ORDER BY id').all(this.companyId).map(r=>JSON.parse(r.record));return state}
 async backupFile(directory=resolve(dirname(this.filename),'backups')){await this.queue;mkdirSync(directory,{recursive:true,mode:0o700});const destination=resolve(directory,`sica-${new Date().toISOString().replaceAll(':','-')}-${crypto.randomUUID().slice(0,8)}.sqlite`);await backup(this.db,destination);chmodSync(destination,0o600);writeFileSync(destination+'.audit-key',this.key,{mode:0o600,flag:'wx'});await syncFile(destination+'.audit-key');await sealBackup(destination,this.key);return destination}
 async close(){await this.queue;this.db.close()}
}
