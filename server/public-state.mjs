import {taxCertificatePath} from '../.server/domain/tax-certificates.js'
import {taxMovementRows,taxMovementsPath} from '../.server/domain/tax-movements.js'
import {cardLedgerSources} from '../.server/domain/card-disputes.js'
import {productionInventoryReview} from '../.server/domain/production-costs.js'
import {inventoryClosingSafeReference} from '../.server/domain/inventory-closing-model.js'
import {inventoryInflationSources} from '../.server/domain/inventory-inflation.js'
import {assetInflationSources} from '../.server/domain/asset-inflation.js'
import { canAccess } from '../.server/domain/permissions.js'
import { modules } from '../.server/domain/modules.js'
import {documentPath} from '../.server/domain/commands.js'

export function projectState({revision,state},actor,{auditRecords=()=>[],decorate=()=>{}}={}){const allowed=path=>canAccess(actor,path),admin=actor.role==='Administrador General'
  state.taxMovementSources=[];delete state.taxMovementSourceError
  if(allowed(taxMovementsPath)||allowed(taxCertificatePath))try{state.taxMovementSources=taxMovementRows(state)}catch(error){state.taxMovementSourceError=error instanceof Error?error.message:'No se pudo revisar el origen impositivo.'}
  if(!allowed(taxCertificatePath))state.taxCertificates=[]
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
  const documentIds=new Set(readableDocuments.map(d=>d.id)),returnCreditIds=new Set((state.stockReturns||[]).map(r=>r.noteId)),returnDocuments=returnsReadable?state.documents.filter(d=>d.kind==='remito'||['factura','credito'].includes(d.kind)).map(d=>documentIds.has(d.id)?d:({...d,fiscal:undefined,lines:d.lines.map(l=>({...l,price:0,discount:0})),payments:[],allocations:[],net:0,vat:0,total:0,perceptions:0,perceptionEvidence:undefined,observations:'',responsible:''})):[]
  const serviceDocuments=serviceReadable||fixedAssetReadable?state.documents.filter(d=>d.side==='proveedor'&&['remito','factura','credito','debito'].includes(d.kind)&&(serviceReadable||d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso'))).map(d=>documentIds.has(d.id)?d:({...d,observations:'',responsible:'',fiscal:undefined,lines:d.lines.map(l=>({...l,description:''}))})):[]
  const revenueDocuments=revenueReadable?state.documents.filter(d=>d.side==='cliente'&&['remito','factura','credito','debito'].includes(d.kind)).map(d=>documentIds.has(d.id)?d:({...d,observations:'',responsible:'',fiscal:undefined,lines:d.lines.map(l=>({...l,description:''}))})):[]
  const fixedAssetSales=fixedAssetReadable?state.documents.filter(d=>d.side==='cliente'&&['remito','factura','credito','debito'].includes(d.kind)&&d.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Bien de uso')).map(d=>documentIds.has(d.id)?d:revenueDocuments.find(r=>r.id===d.id)||({...d,partyId:'',observations:'',responsible:'',fiscal:undefined,payments:[],allocations:[],lines:d.lines.map(l=>({...l,description:''}))})):[]
  const closingDocuments=accountingCloseReadable?state.documents.map(d=>documentIds.has(d.id)?d:({...d,partyId:'',observations:'',responsible:'',fiscal:undefined,lines:d.lines.map(l=>({...l,description:''}))})):[]
  state.documents=accountingCloseReadable?[...new Map([...readableDocuments,...fixedAssetSales,...closingDocuments].map(d=>[d.id,d])).values()]:inventoryCostReadable?[...new Map([...readableDocuments,...state.documents.filter(d=>d.side==='proveedor'&&['factura','remito','credito','debito'].includes(d.kind)),...state.documents.filter(d=>d.side==='cliente'&&(d.kind==='remito'||returnCreditIds.has(d.id))).map(d=>documentIds.has(d.id)?d:({...d,partyId:'',lines:[],payments:[],allocations:[],net:0,vat:0,total:0,perceptions:0,perceptionEvidence:undefined,observations:'',responsible:''})),...fixedAssetSales].map(d=>[d.id,d])).values()]:[...new Map([...readableDocuments,...returnDocuments,...serviceDocuments,...revenueDocuments,...fixedAssetSales].map(d=>[d.id,d])).values()];for(const d of state.documents){if(!documentIds.has(d.id))delete d.taxIdentity;if(!allowed(documentPath(d)))delete d.receiptSnapshot;}decorate(state);for(const d of state.documents)if(!documentIds.has(d.id)&&(d.side==='cliente'||returnsReadable&&!inventoryCostReadable)){delete d.fiscal;delete d.fiscalHistory}
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
  state.audit=allowed('/administracion/auditoria')?auditRecords():[]
  for(const key of Object.keys(state.masters))if(!admin&&!needed.has(key))state.masters[key]=[]
  state.masters.users=state.masters.users.map(u=>{const {passwordHash,salt,passwordIterations,...safe}=u;void passwordHash;void salt;void passwordIterations;return admin?safe:{id:u.id,name:u.name,active:u.active}})
  if(!admin&&!vatLedgerReadable&&!salesLedgerReadable&&!allowed('/contabilidad/configuracion')&&!inventoryCostReadable&&!serviceReadable&&!revenueReadable)state.settings.accountMap={}
  return {revision,state,session:actor}
 }
