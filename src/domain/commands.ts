import {assertDocumentSide} from './document-rules'
import {preserveTaxCertificate,taxCertificatePath} from './tax-certificates'
import {perceptionEvidence} from './tax-evidence'
import {preserveVatSalesLedger,vatSalesLedgerPath} from './vat-sales-ledger'
import type {VatSalesLedgerInput} from './vat-sales-ledger'
import {preserveVatSales,vatSalesPath} from './vat-sales'
import type {VatSalesInput,SalesAuthorization} from './vat-sales'
import {preserveVatLedger,vatLedgerPath} from './vat-ledger'
import type {VatLedgerInput} from './vat-ledger'
import {preserveVatAnnual} from './vat-annual'
import type {VatAnnualInput} from './vat-annual'
import {preserveVatPurchases,vatPurchasesPath} from './vat-purchases'
import type {VatPurchasesInput} from './vat-purchases'
import {identifySupplierOriginal,previewSupplierOriginal,supplierOriginalReview,supplierOriginalPath} from './supplier-originals'
import {applyAccountCredit,releaseOriginalApplication,reverseAccountApplication,applicationsPath} from './account-applications'
import {prepareCardClaimAccounts,registerCardDispute,resolveCardDispute} from './card-disputes'
import {reserveProductionMaterials,releaseProductionMaterials} from './production-reservations'
import {assessProductionRecovery,prepareProductionRecoveryAccounts} from './production-recoverability'
import {reconcileProductionInflation} from './production-inflation'
import {postProductionReestimate} from './production-cost-corrections'
import type {ProductionReestimateInput} from './production-cost-corrections'
import {postProductionCost,productionCostPath,productionCostReferences} from './production-costs'
import type {ProductionCostInput} from './production-costs'
import {reconcileInventoryInflation} from './inventory-inflation'
import {assessInventoryRecovery,prepareInventoryRecoveryAccounts} from './inventory-recoverability'
import {reconcileAssetInflation} from './asset-inflation'
import {postReexpression,prepareReexpressionPostingAccounts} from './reexpression-posting'
import {preserveStatements,statementsPath} from './financial-statements'
import {preserveReexpression,reexpressionPath} from './reexpression'
import {assessAssetImpairment,prepareAssetImpairmentAccounts} from './asset-impairments'
import {disposeAsset,prepareAssetDisposalAccounts} from './asset-disposals'
import {acquireFixedAsset,commissionAsset,postDepreciation,prepareFixedAssetAccounts,reestimateAsset,fixedAssetPath} from './fixed-assets'
import type {FixedAssetInput,AssetCommissionInput,DepreciationInput} from './types'
import {openExercise,exerciseOpeningPath} from './exercise-opening'
import {withinExerciseHistory,withinSingleExercise} from './exercise-calendar'
import {postInventoryCost,prepareInventoryAccounts} from './inventory-costing'
import {closeAccountingPeriod} from './accounting-close'
import {closeYearEnd,prepareYearEndAccount,yearEndPath} from './year-end-close'
import type {YearEndCloseInput,ExerciseOpeningInput} from './types'
import {accrueService,settleService,reestimateService,cancelService,prepareServiceAccounts,servicePath} from './service-accruals'
import {reverseJournal} from './journal-reversals'
import type {JournalReversalInput} from './types'
import {accrueRevenue,settleRevenue,prepareRevenueAccount,revenuePath} from './revenue-accruals'
import type {RevenueAccrualInput,RevenueSettlementInput} from './types'
import type {ServiceAccrualInput,ServiceSettlementInput,ServiceReestimateInput,ServiceCancellationInput} from './types'
import type {AccountingCloseInput} from './types'
import type { State, Session, Party, Product, Master, Document, Cheque, EntryLine, CardSettlement, Settings, StockTransferInput, BankStatementInput, CashClosingInput, InventoryCostInput, StockReturnInput } from './types'
import {closeCash} from './cash-closings'
import {registerStockReturn,linkStockReturnNote} from './stock-returns'
import { transferStock } from './stock-transfers'
import { importBankStatement, matchBankGroup, matchBankLine, unmatchBankLine, cancelBankStatement, manualReconciliation } from './bank-reconciliation'
import { canAccess, requireAdmin } from './permissions'
import { updateBankCatalog } from './bank-catalog'
import { validateRegistration } from './fiscal-registration'
import { saveParty, saveProduct, saveMaster, createDocument, saveCheque, chequeStatus, adjustStock, transferTreasury, addManualEntry, settleCards, validCuit } from './engine'
import { finishProduction } from './production'
import { prepareProduction, productionStep } from './production-workflow'
import { importSpecs, processImport } from './imports'
import { loadTextileDemo } from './demo'
import { modules } from './modules'
import { uid, roles, taxRates, provinces } from './constants'
import { derivePassword } from './auth'

export type Command =
 | {type:'tax.certificate';comparison:import('./tax-certificates').TaxCertificateInput}
 | {type:'supplier.original';original:import('./supplier-originals').SupplierOriginalInput}
 | {type:'accounts.release-original';application:import('./account-applications').ApplicationInput}
 | {type:'accounts.apply';application:import('./account-applications').ApplicationInput}
 | {type:'accounts.unapply';reversal:import('./account-applications').ApplicationReversalInput}
 | {type:'production.reestimate';correction:ProductionReestimateInput}
 | {type:'production.recovery';assessment:import('./production-recoverability').ProductionRecoveryInput}
 | {type:'production.recovery-accounts'}
 | {type:'production.inflation';reconciliation:import('./production-inflation').ProductionInflationInput}
 | {type:'production.cost';cost:ProductionCostInput}
 | {type:'exercise.open';opening:ExerciseOpeningInput}
 | {type:'year-end.accounts'}
 | {type:'year-end.close';closing:YearEndCloseInput}
 | {type:'party.save';party:Party}
 | {type:'product.save';product:Product}
 | {type:'master.save';key:string;item:Master}
 | {type:'document.create';document:Omit<Document,'id'|'number'|'net'|'vat'|'total'|'fiscalStatus'> & {total?:number};perceptionReference?:string;perceptionJurisdiction?:string;supplierOriginal?:Omit<import('./supplier-originals').SupplierOriginalInput,'documentId'|'documentKind'|'previousId'|'review'>}
 | {type:'cheque.save';cheque:Cheque}
 | {type:'cheque.status';id:string;status:Cheque['status'];treasuryId?:string}
 | {type:'cheque.delete';id:string}
 | {type:'stock.adjust';productId:string;depositId:string;quantity:number;reason:string;date:string}
 | {type:'stock.return';returned:StockReturnInput}
 | {type:'stock.return.note';id:string;noteId:string}
 | {type:'stock.transfer';transfer:StockTransferInput}
 | {type:'inventory.accounts'}
 | {type:'inventory.post';valuation:InventoryCostInput}
 | {type:'treasury.transfer';fromId:string;toId:string;amount:number;date:string;reason:string;closing:boolean}
 | {type:'cash.close';closing:CashClosingInput}
 | {type:'treasury.reconcile';id:string;reconciled:boolean}
 | {type:'sessions.revoke';sessionId:string;reason:string}
 | {type:'bank.import';statement:BankStatementInput}
 | {type:'bank.match';statementId:string;lineId:string;moveIds:string[];note:string}
 | {type:'bank.match-group';statementId:string;lineIds:string[];moveIds:string[];note:string}
 | {type:'bank.unmatch';statementId:string;lineId:string;note:string}
 | {type:'bank.cancel';statementId:string;note:string}
 | {type:'banks.catalog.update'}
 | {type:'production.finish';orderId:string;depositId:string;date:string}
 | {type:'production.reserve';reservation:import('./production-reservations').ReservationInput}
 | {type:'production.release';reservationId:string;date:string;reason:string}
 | {type:'production.prepare';orderId:string}
 | {type:'production.step';orderId:string;operationId:string;action:'iniciar'|'completar';date:string;actualHours?:number}
 | {type:'cards.dispute-accounts'}
 | {type:'cards.dispute';dispute:import('./card-disputes').CardDisputeInput}
 | {type:'cards.resolve';resolution:import('./card-disputes').CardResolutionInput}
 | {type:'cards.settle';settlement:Omit<CardSettlement,'id'|'gross'|'net'>}
 | {type:'journal.reverse';reversal:JournalReversalInput}
 | {type:'journal.create';date:string;concept:string;branchId:string;lines:EntryLine[]}
 | {type:'accounting.close';closing:AccountingCloseInput}
 | {type:'revenue.accounts'}
 | {type:'revenue.accrue';accrual:RevenueAccrualInput}
 | {type:'revenue.settle';settlement:RevenueSettlementInput}
 | {type:'asset.impairment';assessment:import('./types').AssetImpairmentInput}
 | {type:'asset.impairment-accounts'}
 | {type:'asset.dispose';disposal:import('./types').AssetDisposalInput}
 | {type:'asset.disposal-accounts'}
 | {type:'asset.reestimate';reestimate:import('./types').AssetReestimateInput}
 | {type:'asset.accounts'}
 | {type:'asset.acquire';asset:FixedAssetInput}
 | {type:'asset.commission';commission:AssetCommissionInput}
 | {type:'asset.depreciate';depreciation:DepreciationInput}
 | {type:'service.cancel';cancellation:ServiceCancellationInput}
 | {type:'service.accounts'}
 | {type:'service.accrue';accrual:ServiceAccrualInput}
 | {type:'service.settle';settlement:ServiceSettlementInput}
 | {type:'service.reestimate';reestimate:ServiceReestimateInput}
 | {type:'vat.sales-ledger';preparation:VatSalesLedgerInput}
 | {type:'vat.ledger';preparation:VatLedgerInput}
 | {type:'vat.annual';preparation:VatAnnualInput}
 | {type:'vat.sales';preparation:VatSalesInput}
 | {type:'vat.purchases';preparation:VatPurchasesInput}
 | {type:'settings.save';settings:Settings}
 | {type:'accounts.map';map:Record<string,string>}
 | {type:'users.save';item:Master;password?:string}
 | {type:'import.run';specId:string;rows:Record<string,string>[];filename:string}
 | {type:'statements.preserve';statement:import('./financial-statements').StatementInput}
 | {type:'inventory.inflation';reconciliation:import('./inventory-inflation').InventoryInflationInput}
 | {type:'inventory.recovery';assessment:import('./inventory-recoverability').InventoryRecoveryInput}
 | {type:'inventory.recovery-accounts'}
 | {type:'asset.inflation';reconciliation:import('./asset-inflation').AssetInflationInput}
 | {type:'reexpression.post';posting:import('./reexpression-posting').ReexpressionPostingInput}
 | {type:'reexpression.posting-accounts'}
 | {type:'reexpression.preserve';adjustment:import('./reexpression').ReexpressionInput}
 | {type:'demo.load'}

const paths:Record<string,string>={factura:'ventas',credito:'notas',debito:'notas',cobro:'cobros',pago:'pagos',pedido:'pedidos',remito:'remitos','orden-compra':'ordenes',saldo:'cuenta-corriente'}
export function documentPath(d:Pick<Document,'side'|'kind'>) {assertDocumentSide(d);return `/${d.side==='cliente'?'clientes':'proveedores'}/${d.side==='proveedor'&&d.kind==='factura'?'compras':paths[d.kind]}`}
export function commandPath(command:Command):string {
 switch(command.type) {
  case 'supplier.original':return supplierOriginalPath(command.original.documentKind)
  case 'accounts.release-original':case 'accounts.apply':case 'accounts.unapply':return applicationsPath
  case 'party.save':return command.party.side==='cliente'?'/clientes/alta':'/proveedores/alta'
  case 'product.save':return command.product.kind==='Servicio'?'/productos/servicios':'/productos/articulos'
  case 'master.save':{const spec=modules.find(m=>m.key===command.key);if(!spec||command.key==='users')throw new Error('Catálogo no autorizado.');return spec.path}
  case 'document.create':return documentPath(command.document)
  case 'cheque.save':case 'cheque.status':case 'cheque.delete':return '/finanzas/cheques'
  case 'stock.adjust':return '/stock/ajustes'
  case 'stock.return':case 'stock.return.note':return '/stock/devoluciones'
  case 'stock.transfer':return '/stock/traslados'
  case 'inventory.recovery':case 'inventory.recovery-accounts':case 'inventory.inflation':case 'inventory.accounts':case 'inventory.post':return '/contabilidad/inventario'
  case 'treasury.transfer':case 'cash.close':return '/finanzas/cajas'
  case 'treasury.reconcile':return '/finanzas/bancos'
  case 'sessions.revoke':return '/administracion/sesiones'
  case 'bank.import':case 'bank.match-group':case 'bank.match':case 'bank.unmatch':case 'bank.cancel':return '/finanzas/bancos/extractos'
  case 'banks.catalog.update':return '/finanzas/entidades'
  case 'production.reserve':case 'production.release':case 'production.prepare':case 'production.step':case 'production.finish':return '/produccion'
  case 'cards.dispute-accounts':return '/contabilidad/configuracion'
  case 'cards.dispute':case 'cards.resolve':return '/finanzas/liquidaciones-tarjetas'
  case 'cards.settle':return '/finanzas/liquidaciones-tarjetas'
  case 'journal.reverse':case 'journal.create':return '/contabilidad/diario'
  case 'statements.preserve':return statementsPath
  case 'reexpression.post':case 'reexpression.posting-accounts':case 'reexpression.preserve':return reexpressionPath
  case 'accounting.close':return '/contabilidad/cierres'
  case 'revenue.accounts':case 'revenue.accrue':case 'revenue.settle':return revenuePath
  case 'asset.inflation':case 'asset.impairment':case 'asset.impairment-accounts':case 'asset.dispose':case 'asset.disposal-accounts':case 'asset.reestimate':case 'asset.accounts':case 'asset.acquire':case 'asset.commission':case 'asset.depreciate':return fixedAssetPath
  case 'service.accounts':case 'service.accrue':case 'service.settle':case 'service.reestimate':case 'service.cancel':return servicePath
  case 'production.recovery':case 'production.recovery-accounts':case 'production.reestimate':case 'production.inflation':case 'production.cost':return productionCostPath
  case 'exercise.open':return exerciseOpeningPath
  case 'year-end.accounts':case 'year-end.close':return yearEndPath
  case 'tax.certificate':return taxCertificatePath
  case 'vat.sales-ledger':return vatSalesLedgerPath
  case 'vat.ledger':return vatLedgerPath
  case 'vat.annual':return vatPurchasesPath
  case 'vat.sales':return vatSalesPath
  case 'vat.purchases':return vatPurchasesPath
  case 'settings.save':case 'demo.load':return '/configuracion'
  case 'accounts.map':return '/contabilidad/configuracion'
  case 'users.save':return '/administracion/usuarios'
  case 'import.run':return '/importaciones/gestionar'
 }
}
const actions:Record<Command['type'],string>={'tax.certificate':'Conservar comparación de certificado impositivo','vat.sales-ledger':'Conservar conciliación contable de IVA ventas','vat.sales':'Conservar preparación de IVA ventas','vat.ledger':'Conservar conciliación contable de IVA','vat.annual':'Conservar preparación de ajuste anual de IVA','vat.purchases':'Conservar preparación de IVA compras','supplier.original':'Identificar comprobante recibido de proveedor','accounts.release-original':'Liberar aplicación original conservada','accounts.apply':'Aplicar crédito registrado','accounts.unapply':'Revertir aplicación de crédito','production.recovery':'Comparar recuperable de producción pendiente','production.recovery-accounts':'Preparar cuentas de recuperable de producción','production.inflation':'Conciliar moneda de cierre de conversión por orden','production.reestimate':'Corregir conversión por nueva estimación vinculada','production.cost':'Imputar costos completos de producción','inventory.recovery':'Evaluar VNR y desvalorización de inventario','inventory.recovery-accounts':'Preparar cuentas de desvalorización de inventario','inventory.inflation':'Conciliar moneda de cierre por artículo y depósito','asset.inflation':'Conciliar moneda de cierre por bien de uso','reexpression.post':'Contabilizar ajuste anual revisado','reexpression.posting-accounts':'Preparar cuentas de ajuste anual','reexpression.preserve':'Conservar preparación en moneda de cierre','statements.preserve':'Conservar expediente de estados contables','asset.impairment':'Evaluar valor recuperable y deterioro','asset.impairment-accounts':'Preparar cuentas de deterioro','asset.dispose':'Dar de baja bien de uso','asset.disposal-accounts':'Preparar cuentas de bajas de bienes de uso','asset.reestimate':'Reestimar vida útil y valor residual','asset.accounts':'Preparar cuentas de bienes de uso','asset.acquire':'Capitalizar bien de uso','asset.commission':'Registrar puesta en marcha','asset.depreciate':'Contabilizar depreciaciones','service.cancel':'Anular servicios devengados','journal.reverse':'Revertir asiento manual','revenue.accounts':'Preparar cuenta de ventas sin factura','revenue.accrue':'Devengar ingresos e IVA revisados','revenue.settle':'Conciliar ingresos facturados','exercise.open':'Abrir próximo ejercicio','year-end.accounts':'Preparar cuenta de resultados','year-end.close':'Cerrar cuentas de resultados','service.reestimate':'Reestimar servicios devengados','service.accounts':'Preparar cuenta de servicios','service.accrue':'Devengar servicios recibidos','service.settle':'Conciliar servicios facturados','accounting.close':'Cerrar período contable','party.save':'Guardar contraparte','product.save':'Guardar artículo','master.save':'Guardar registro','document.create':'Registrar comprobante','cheque.save':'Guardar cheque','cheque.status':'Cambiar estado de cheque','cheque.delete':'Eliminar cheque sin aplicar','stock.adjust':'Ajustar stock','stock.transfer':'Registrar traslado interno','stock.return':'Registrar devolución física','stock.return.note':'Vincular nota a devolución','inventory.accounts':'Preparar cuentas de inventario','inventory.post':'Contabilizar valuación de inventario','treasury.transfer':'Transferir / cerrar caja','cash.close':'Cerrar cajas','treasury.reconcile':'Conciliar movimiento','sessions.revoke':'Cerrar sesión de otra terminal','bank.import':'Cargar extracto bancario','bank.match':'Vincular fila bancaria','bank.match-group':'Vincular grupo bancario','bank.unmatch':'Desvincular fila bancaria','bank.cancel':'Anular extracto bancario','banks.catalog.update':'Incorporar catálogo BCRA','production.finish':'Finalizar producción','production.reserve':'Reservar materiales de producción','production.release':'Liberar materiales de producción','production.prepare':'Preparar ruta de producción','production.step':'Ejecutar operación de producción','cards.dispute-accounts':'Preparar cuentas de reclamos a tarjetas','cards.dispute':'Registrar contracargo de tarjeta','cards.resolve':'Resolver reclamo a procesadora','cards.settle':'Registrar liquidación de tarjeta','journal.create':'Registrar asiento','settings.save':'Guardar parámetros','accounts.map':'Configurar cuentas','users.save':'Guardar usuario','import.run':'Importar archivo','demo.load':'Cargar ejemplo textil'}
export async function executeCommand(state:State,actor:Session,command:Command,services:{salesAuthorizations?:SalesAuthorization[]}={}) {
 if(!command||typeof command.type!=='string'||!Object.hasOwn(actions,command.type))throw new Error('Operación no reconocida.')
 const path=commandPath(command)
 if(!canAccess(actor,path))throw new Error('Tu perfil no tiene permiso para esta operación.')
 let detail=''
 switch(command.type) {
  case 'supplier.original':detail=identifySupplierOriginal(state,command.original,actor).number;break
  case 'accounts.release-original':detail=releaseOriginalApplication(state,command.application,actor).number;break
  case 'accounts.apply':detail=applyAccountCredit(state,command.application,actor).number;break
  case 'accounts.unapply':detail=reverseAccountApplication(state,command.reversal,actor).number;break
  case 'party.save': if(!['cliente','proveedor'].includes(command.party.side)||state.parties.some(p=>p.id===command.party.id&&p.side!==command.party.side))throw new Error('Tipo de contraparte inválido.');saveParty(state,command.party);detail=command.party.name;break
  case 'product.save':{const old=state.products.find(p=>p.id===command.product.id);if(!['Producto','Servicio','Bien de uso'].includes(command.product.kind)||(old&&!canAccess(actor,old.kind==='Servicio'?'/productos/servicios':'/productos/articulos')))throw new Error('No tenés permiso para modificar este tipo de artículo.');saveProduct(state,command.product);}detail=command.product.sku;break
  case 'master.save':{
   const spec=modules.find(m=>m.key===command.key)!,old=state.masters[command.key]?.find(m=>m.id===command.item.id)
   const item:Master={...old,id:command.item.id||uid()}
   for(const field of spec.fields){const value=command.item[field.key]??old?.[field.key]??field.default
    if(value!==undefined)item[field.key]=value
    if(field.required&&(value===undefined||String(value).trim()===''))throw new Error(`${field.label}: dato obligatorio.`)
    if(value!==undefined&&String(value)!==''&&field.options&&!field.options.includes(String(value)))throw new Error(`${field.label}: opción inválida.`)
    if(field.source&&value){const source=field.source==='products'?state.products:state.masters[field.source];if(source&&!source.some(m=>m.id===value))throw new Error(`${field.label}: referencia inválida.`)}
   }
   saveMaster(state,command.key,item,actor.role);detail=String(item.name);break
  }
  case 'document.create':{if(!['cliente','proveedor'].includes(command.document.side)||!Object.hasOwn(paths,command.document.kind))throw new Error('Tipo de comprobante inválido.');const evidence=command.document.perceptions>0?perceptionEvidence(command.perceptionJurisdiction,command.perceptionReference):undefined;const working=command.supplierOriginal?structuredClone(state):state;if(command.supplierOriginal&&(command.document.side!=='proveedor'||!['factura','credito','debito'].includes(command.document.kind)||command.document.letter==='X'))throw new Error('El original recibido sólo acompaña facturas y notas A, B o C de proveedores.');const doc=createDocument(working,{...command.document,perceptionEvidence:evidence,fiscal:undefined,fiscalHistory:undefined,accountOnly:false,responsible:actor.name},actor.role);if(command.supplierOriginal){const input={...command.supplierOriginal,documentId:doc.id,documentKind:doc.kind as import('./supplier-originals').SupplierDocumentKind,previousId:''},preview=previewSupplierOriginal(working,input);identifySupplierOriginal(working,{...input,review:supplierOriginalReview(preview)},actor);Object.assign(state,working)}detail=doc.number;break}
  case 'cheque.save':{const existing=state.cheques.find(c=>c.id===command.cheque.id);if(!state.masters.branches.some(b=>b.id===command.cheque.branchId&&b.active)||!state.masters.banks.some(b=>b.id===command.cheque.bank)||!['Propio','Terceros'].includes(command.cheque.type))throw new Error('Datos de cheque inválidos.');saveCheque(state,existing?command.cheque:{...command.cheque,receiptId:'',paymentId:undefined,status:'En cartera'},actor.role);}detail=command.cheque.number;break
  case 'cheque.status':chequeStatus(state,command.id,command.status,actor.role,command.treasuryId);detail=`${command.id}: ${command.status}`;break
  case 'cheque.delete':{requireAdmin(actor.role);const c=state.cheques.find(c=>c.id===command.id);if(!c||c.receiptId||state.documents.some(d=>d.payments.some(p=>p.chequeId===c.id)))throw new Error('Sólo se puede eliminar un cheque existente sin aplicación.');state.cheques=state.cheques.filter(c=>c.id!==command.id);detail=c.number;break}
  case 'stock.adjust':adjustStock(state,actor.role,command.productId,command.depositId,command.quantity,command.reason,command.date);detail=command.reason;break
  case 'stock.return':detail=registerStockReturn(state,command.returned,actor).number;break
  case 'stock.return.note':detail=linkStockReturnNote(state,command.id,command.noteId,actor).number;break
  case 'stock.transfer':detail=transferStock(state,command.transfer,actor).number;break
  case 'inventory.accounts':prepareInventoryAccounts(state,actor);detail='Cuentas de existencias y costos';break
  case 'inventory.post':detail=postInventoryCost(state,command.valuation,actor).number;break
  case 'treasury.transfer':transferTreasury(state,command.fromId,command.toId,command.amount,command.date,command.reason,command.closing);detail=command.reason;break
  case 'cash.close':detail=closeCash(state,command.closing,actor).number;break
  case 'treasury.reconcile':detail=manualReconciliation(state,command.id,command.reconciled);break
  case 'bank.import':detail=importBankStatement(state,command.statement,actor).name;break
  case 'bank.match':detail=matchBankLine(state,command.statementId,command.lineId,command.moveIds,command.note,actor);break
  case 'bank.match-group':detail=matchBankGroup(state,command.statementId,command.lineIds,command.moveIds,command.note,actor);break
  case 'bank.unmatch':detail=unmatchBankLine(state,command.statementId,command.lineId,command.note,actor);break
  case 'bank.cancel':detail=cancelBankStatement(state,command.statementId,command.note,actor);break
  case 'banks.catalog.update':detail=updateBankCatalog(state,actor);break
  case 'production.reserve':detail=reserveProductionMaterials(state,command.reservation,actor).number;break
  case 'production.release':detail=releaseProductionMaterials(state,command.reservationId,command.date,command.reason,actor);break
  case 'production.prepare':detail=prepareProduction(state,command.orderId,actor).orderId;break
  case 'production.step':detail=productionStep(state,command.orderId,command.operationId,command.action,command.date,command.actualHours,actor);break
  case 'production.finish':finishProduction(state,command.orderId,command.depositId,command.date,actor.role,actor.name);detail=command.orderId;break
  case 'cards.dispute-accounts':prepareCardClaimAccounts(state,actor);detail='Cuentas de reclamos y pérdidas';break
  case 'cards.dispute':detail=registerCardDispute(state,command.dispute,actor).number;break
  case 'cards.resolve':detail=resolveCardDispute(state,command.resolution,actor).number;break
  case 'cards.settle':settleCards(state,command.settlement,actor.role);detail=command.settlement.reference;break
  case 'journal.reverse':detail=reverseJournal(state,command.reversal,actor).number;break
  case 'journal.create':if(!state.masters.branches.some(b=>b.id===command.branchId&&b.active))throw new Error('Sucursal del asiento inválida.');addManualEntry(state,actor.role,command.date,command.concept,command.branchId,command.lines);detail=command.concept;break
  case 'accounting.close':detail=closeAccountingPeriod(state,command.closing,actor).number;break
  case 'revenue.accounts':prepareRevenueAccount(state,actor);detail='Cuenta de ventas sin facturar';break
  case 'revenue.accrue':detail=accrueRevenue(state,command.accrual,actor).number;break
  case 'revenue.settle':detail=settleRevenue(state,command.settlement,actor).number;break
  case 'statements.preserve':detail=preserveStatements(state,command.statement,actor).number;break
  case 'reexpression.post':detail=postReexpression(state,command.posting,actor).number;break
  case 'reexpression.posting-accounts':prepareReexpressionPostingAccounts(state,actor);break
  case 'reexpression.preserve':detail=preserveReexpression(state,command.adjustment,actor).number;break
  case 'production.recovery':detail=assessProductionRecovery(state,command.assessment,actor).number;break
  case 'production.recovery-accounts':prepareProductionRecoveryAccounts(state,actor);detail='Cuentas de recuperable de producción';break
  case 'production.inflation':detail=reconcileProductionInflation(state,command.reconciliation,actor).number;break
  case 'inventory.inflation':detail=reconcileInventoryInflation(state,command.reconciliation,actor).number;break
  case 'inventory.recovery':detail=assessInventoryRecovery(state,command.assessment,actor).number;break
  case 'inventory.recovery-accounts':prepareInventoryRecoveryAccounts(state,actor);detail='Cuentas de desvalorización de inventario';break
  case 'asset.inflation':detail=reconcileAssetInflation(state,command.reconciliation,actor).number;break
  case 'asset.impairment':detail=assessAssetImpairment(state,command.assessment,actor).number;break
  case 'asset.impairment-accounts':prepareAssetImpairmentAccounts(state,actor);detail='Deterioro acumulado, pérdida y reversión';break
  case 'asset.dispose':detail=disposeAsset(state,command.disposal,actor).number;break
  case 'asset.disposal-accounts':prepareAssetDisposalAccounts(state,actor);detail='Otros ingresos y gastos por bajas';break
  case 'asset.reestimate':detail=reestimateAsset(state,command.reestimate,actor).number;break
  case 'asset.accounts':prepareFixedAssetAccounts(state,actor);detail='Cuentas de costo y depreciaciones';break
  case 'asset.acquire':detail=acquireFixedAsset(state,command.asset,actor).number;break
  case 'asset.commission':detail=commissionAsset(state,command.commission,actor).number;break
  case 'asset.depreciate':detail=postDepreciation(state,command.depreciation,actor).number;break
  case 'service.cancel':detail=cancelService(state,command.cancellation,actor).number;break
  case 'service.accounts':prepareServiceAccounts(state,actor);detail='Cuenta de servicios sin factura';break
  case 'service.accrue':detail=accrueService(state,command.accrual,actor).number;break
  case 'service.settle':detail=settleService(state,command.settlement,actor).number;break
  case 'service.reestimate':detail=reestimateService(state,command.reestimate,actor).number;break
  case 'production.reestimate':detail=postProductionReestimate(state,command.correction,actor).number;break
  case 'production.cost':detail=postProductionCost(state,command.cost,actor).number;break
  case 'exercise.open':detail=openExercise(state,command.opening,actor).number;break
  case 'year-end.accounts':prepareYearEndAccount(state,actor);detail='Cuenta de resultado del ejercicio';break
  case 'year-end.close':detail=closeYearEnd(state,command.closing,actor).number;break
  case 'tax.certificate':detail=preserveTaxCertificate(state,command.comparison,actor).number;break
  case 'vat.sales-ledger':detail=preserveVatSalesLedger(state,command.preparation,actor).number;break
  case 'vat.ledger':detail=preserveVatLedger(state,command.preparation,actor).number;break
  case 'vat.annual':detail=preserveVatAnnual(state,command.preparation,actor).number;break
  case 'vat.sales':if(!services.salesAuthorizations)throw new Error('La preparación de ventas requiere las fuentes fiscales del servidor.');detail=preserveVatSales(state,command.preparation,services.salesAuthorizations,actor).number;break
  case 'vat.purchases':detail=preserveVatPurchases(state,command.preparation,actor).number;break
  case 'settings.save':{
   requireAdmin(actor.role);const s=command.settings
   if(s.closedUntil!==state.settings.closedUntil)throw new Error('El bloqueo de períodos se registra con revisión e historial desde Contabilidad → Cierres. No se cambia desde Configuración.')
   validateRegistration(s,state.masters.branches)
   if(!s.name.trim()||(s.cuit&&!validCuit(s.cuit))||!['Responsable Inscripto','Responsable Monotributo','Exento'].includes(s.iva)||!provinces.includes(s.province)||!taxRates.includes(s.defaultVat)||!['Numérico','Alfabético','Alfanumérico','Madre-Hijo-Nieto'].includes(s.skuMode))throw new Error('Parámetros de empresa inválidos.')
   const dates=[s.exerciseStart,s.exerciseEnd,...(s.closedUntil?[s.closedUntil]:[])];if(dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(`${d}T12:00:00Z`).toISOString().slice(0,10)!==d)||s.exerciseEnd<s.exerciseStart||(s.closedUntil&&(s.closedUntil<s.exerciseStart&&s.closedUntil!==state.exerciseOpenings?.at(-1)?.previousEnd||s.closedUntil>s.exerciseEnd)))throw new Error('Fechas del ejercicio o cierre inválidas.')
   const operations=[...(state.supplierOriginals||[]).map(r=>({date:r.preview.input.date})),...(state.accountApplications||[]).map(r=>({date:r.preview.date})),...state.documents,...state.entries,...state.stockMoves,...state.treasuryMoves,...(state.cardSettlements||[]),...(state.cardDisputes||[]).map(r=>({date:r.preview.input.date})),...(state.cashClosings||[]),...(state.inventoryCostBatches||[]),...(state.bankStatements||[]).flatMap(s=>[{date:s.from},{date:s.to}])];if(operations.some(d=>!withinExerciseHistory({...state,settings:s},d.date)))throw new Error('El ejercicio debe contener todas las operaciones registradas.')
   if((state.exerciseOpenings?.length||state.yearEndCloses?.some(c=>c.exerciseStart===state.settings.exerciseStart&&c.exerciseEnd===state.settings.exerciseEnd))&&(s.exerciseStart!==state.settings.exerciseStart||s.exerciseEnd!==state.settings.exerciseEnd))throw new Error('El ejercicio cerrado conserva sus fechas. La apertura de otro ejercicio requiere su propio circuito.')
   if(state.masters.production.some(o=>!withinSingleExercise({...state,settings:s},String(o.start),String(o.end)))||(state.productionPlans||[]).some(p=>p.operations.some(o=>(o.startedAt&&!withinExerciseHistory({...state,settings:s},o.startedAt))||(o.finishedAt&&!withinExerciseHistory({...state,settings:s},o.finishedAt)))))throw new Error('El ejercicio debe contener las fechas previstas y reales de producción.')
   if(state.documents.length&&state.settings.iva!==s.iva)throw new Error('El cambio de condición fiscal con operaciones requiere migración supervisada.')
   state.settings={...s,exerciseHistory:state.settings.exerciseHistory,accountingCloseId:state.settings.accountingCloseId,accountMap:state.settings.accountMap,onboarding:true};detail=s.name;break
  }
  case 'accounts.map':requireAdmin(actor.role);if(command.map.wip!==state.settings.accountMap.wip&&productionCostReferences(state,'9999-12-31').some(r=>r.allocations.some(a=>a.amount&&!state.inventoryCostBatches?.some(b=>(b.costVersion===8||b.costVersion===9||b.costVersion===10||b.costVersion===11)&&b.sourceMoves.some(m=>m.documentId===a.orderId&&m.quantity>0)))))throw new Error('Conservá la cuenta de producción en proceso mientras haya conversión pendiente de incorporar a un lote.');if(state.inventoryRecoveries?.length&&command.map.stockAllowance!==state.inventoryRecoveries[0].allowanceAccountId)throw new Error('La asociación de desvalorización se conserva después de la primera comparación de inventario.');if(state.inventoryCostBatches?.length&&command.map.inventory!==state.settings.accountMap.inventory)throw new Error('La asociación de existencias se conserva después de la apertura valorizada.');if(Object.keys(command.map).length!==Object.keys(state.settings.accountMap).length||Object.keys(command.map).some(k=>!Object.hasOwn(state.settings.accountMap,k))||Object.values(command.map).some(id=>!state.masters.accounts.some(a=>a.id===id&&a.postable)))throw new Error('Seleccioná cuentas imputables para todas las asociaciones existentes.');state.settings.accountMap={...command.map};detail='Reglas de contabilización';break
  case 'users.save':{
   requireAdmin(actor.role);const input=command.item,old=state.masters.users.find(u=>u.id===input.id)
   if(!String(input.name||'').trim()||!String(input.username||'').trim()||!roles.some(role=>role===input.role)||typeof input.active!=='boolean')throw new Error('Datos de usuario inválidos.')
   if(state.masters.users.some(u=>u.id!==input.id&&String(u.username).toLowerCase()===String(input.username).trim().toLowerCase()))throw new Error('El nombre de usuario ya existe.')
   const item:Master={...old,id:input.id||uid(),name:String(input.name).trim(),username:String(input.username).trim(),role:input.role,active:input.active,permissions:String(input.permissions||'')}
   if(command.password!==undefined&&command.password!==''){if(command.password.length<12||command.password.length>1024)throw new Error('La contraseña debe tener entre 12 y 1024 caracteres.');item.salt=uid();item.passwordIterations=600000;item.passwordHash=await derivePassword(command.password,String(item.salt),600000)}
   else if(!old)throw new Error('La contraseña es obligatoria para un nuevo usuario.')
   if(old)saveMaster(state,'users',item,actor.role);else state.masters.users.push(item);detail=String(item.username);break
  }
  case 'import.run':{const spec=importSpecs.find(s=>s.id===command.specId);if(!spec||!Array.isArray(command.rows)||command.rows.length>5000)throw new Error('Importación inválida.');const result=processImport(state,spec,command.rows,actor.role,true);if(!result.validRows.length)throw new Error('No hay filas válidas para importar.');state.imports.push({id:uid(),at:new Date().toISOString(),name:command.filename,type:spec.name,total:command.rows.length,ok:result.validRows.length,errors:result.errors,user:actor.name});detail=command.filename;break}
  case 'sessions.revoke':throw new Error('La gestión de sesiones requiere el modo compartido con servidor.')
  case 'demo.load':requireAdmin(actor.role);loadTextileDemo(state);detail='Datos sintéticos';break
 }
 return {path,action:actions[command.type],detail:detail.slice(0,500)}
}
