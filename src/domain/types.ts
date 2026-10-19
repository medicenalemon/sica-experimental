import type { FiscalRecord } from './fiscal'
export type Role = 'Administrador General' | 'Administración' | 'Depósito' | 'Producción' | 'Personalizado'
export type Side = 'cliente' | 'proveedor'
export type Letter = 'A' | 'B' | 'C' | 'X'
export type Kind = 'factura' | 'credito' | 'debito' | 'cobro' | 'pago' | 'pedido' | 'remito' | 'orden-compra' | 'saldo'
export type RecordData = Record<string, string | number | boolean>
export interface Master { id: string; [key: string]: string | number | boolean }
export interface Party extends Master {
  side: Side; code: string; name: string; cuit: string; iva: string; address: string;
  province: string; phone: string; email: string; paymentTerms: string; priceList: string;
  discount: number; seller: string; commission: number; paymentMethod: string; transport: string; category: string
}
export interface Product extends Master {
  sku: string; name: string; kind: string; category: string; subcategory: string; tax: string;
  barcode: string; minimum: number; supplier: string; negative: boolean; brand: string; model: string;
  parent: string; variants: string; unit: string; price: number; cost: number
}
export interface Line { productId: string; description: string; quantity: number; unit: string; price: number; tax: string; discount: number }
export interface TaxPerson {name:string;cuit:string}
export interface TaxIdentity {version:1;origin:'Catálogo al registrar'|'Agente declarado en liquidación'|'Agente sin identificar';company:TaxPerson;counterparty:TaxPerson;unknownReason:string}
export interface Payment { method: string; amount: number; treasuryId: string; reference: string; chequeId?: string; cardId?: string; cardDue?: string; tax?: string; jurisdiction?: string;agent?:TaxPerson;agentUnknownReason?:string;taxIdentity?:TaxIdentity }
export interface Document {inventoryCostDate?:string;inventoryAfterBatchId?:string;
  receiptSnapshot?:import('./receipt-print').ReceiptSnapshot;
  taxIdentity?:TaxIdentity;
  perceptionEvidence?:{tax:'Ingresos Brutos';jurisdiction:string;reference:string};
  id: string; number: string; kind: Kind; side: Side; letter: Letter; date: string; due: string;
  branchId: string; partyId: string; lines: Line[]; payments: Payment[]; net: number; vat: number;
  perceptions: number; total: number; sourceId: string; allocations: { documentId: string; amount: number }[];
  observations: string; responsible: string; costCenter: string; depositId: string; official: boolean;
  valued: boolean; accountOnly?: boolean; fiscal?:FiscalRecord;fiscalHistory?:FiscalRecord[]; seller: string; priceList: string; fiscalStatus: 'interno' | 'pendiente';
}
export interface Cheque {
  id: string; number: string; amount: number; issued: string; due: string; bank: string; holder: string;
  type: string; partyId: string; branchId: string; receiptId: string; paymentId?: string;
  status: 'En cartera' | 'Depositado' | 'Cobrado' | 'Entregado' | 'Rechazado';
}
export interface CardSettlement {
 id: string; reference: string; date: string; branchId: string; treasuryId: string; cardId: string;
 items: { receiptId: string; paymentIndex: number; amount: number }[];
 gross: number; fee: number; withholdings: Payment[]; net: number;
}
export interface StockMove { id: string; date: string; productId: string; depositId: string; quantity: number; reason: string; documentId: string; branchId: string; transferId?:string;returnId?:string }
export interface StockReturnInput {date:string;sourceId:string;depositId:string;reason:string;noteId?:string;lines:{productId:string;quantity:number}[]}
export interface StockReturn extends StockReturnInput {id:string;number:string;side:Side;branchId:string;sourceNumber:string;partyName:string;depositName:string;responsible:string;noteNumber?:string;noteDate?:string;lines:{productId:string;quantity:number;sku:string;description:string;unit:string}[]}
export interface StockTransferInput {
 date:string; fromId:string; toId:string; reason:string; lines:{productId:string;quantity:number}[];
}
export interface StockTransfer extends StockTransferInput {
 id:string; number:string; responsible:string; fromName:string; toName:string; fromBranchId:string; toBranchId:string;
 lines:{productId:string;quantity:number;sku:string;description:string;unit:string}[];
}
export interface ProductionShift {name:string;startHour:number;endHour:number}
export interface ProductionCalendar {
 workCenterId:string;workCenterName:string;dailyHours:number;dayStart:number;workDays:number[];nonWorkingDates:string[];
 shifts?:ProductionShift[];
 singleWindow?:true;
}
export interface ProductionOperation {
 id:string; sequence:number; name:string; plannedHours:number; bookings:{date:string;hours:number;startHour?:number}[];calendar?:ProductionCalendar;
 status:'Pendiente'|'En curso'|'Completada'; startedAt?:string; finishedAt?:string; startedBy?:string; finishedBy?:string; actualHours:number;
}
export interface ProductionPlan {
 id:string; scheduleVersion?:2|3; orderId:string; branchId:string; routeId:string; routeName:string; workCenterId:string; workCenterName:string;
 productId:string; productUnit:string; quantity:number; dailyHours:number; workDays:number[]; nonWorkingDates:string[]; preparedBy:string; preparedAt:string; operations:ProductionOperation[];
 materials:{productId:string;depositId:string;quantity:number;unit:string;name:string}[];
}
export interface TreasuryMove { cardDisputeRecordId?:string; id: string; date: string; treasuryId: string; amount: number; reason: string; documentId: string; branchId: string; reconciled: boolean; bankStatementLineId?:string; cashClosingId?:string; cashClosingLineId?:string }
export interface CashClosingInput {date:string;reference:string;reason:string;lines:{fromId:string;toId:string;amount:number;expectedBalance:number;counted?:number}[]}
export interface CashClosing {
 id:string;number:string;reference:string;date:string;reason:string;responsible:string;createdAt:string;total:number;
 lines:{id:string;fromId:string;fromName:string;branchId:string;fromAccountId:string;toId:string;toName:string;toAccountId:string;amount:number;balanceBefore:number;balanceAfter:number;movementIds:string[];counted?:number;difference?:number;transferId?:string}[];
}
export interface BankStatementInput {
 treasuryId:string; name:string; from:string; to:string; opening:number; closing:number;
 lines:{date:string;reference:string;description:string;amount:number}[];
}
export interface BankStatement extends BankStatementInput {
 id:string; branchId:string; accountName:string; importedBy:string; importedAt:string; status:'Activo'|'Anulado';
 lines:{id:string;date:string;reference:string;description:string;amount:number;treasuryMoveIds:string[]}[];
 groups?:{id:string;lineIds:string[];moveIds:string[]}[];
 events:{id:string;action:'Vincular'|'Desvincular'|'Anular';lineId:string;lineIds?:string[];groupId?:string;moveIds:string[];note:string;user:string;at:string}[];
}
export interface EntryLine { accountId: string; debit: number; credit: number }
export interface Entry {cardDisputeRecordId?:string; id: string; date: string; concept: string; branchId: string; documentId: string; lines: EntryLine[]; manual?:true;productionRecoveryId?:string;productionCorrectionId?:string;productionCostId?:string;reexpressionPostingId?:string;reversalRecordId?:string;fixedAssetRecordId?:string;inventoryBatchId?:string;inventoryRecoveryId?:string;serviceRecordId?:string;revenueRecordId?:string;yearEndCloseId?:string }
export interface FixedAssetInput {date:string;invoiceId:string;productId:string;reference:string;reason:string;name:string;assetClass:string;location:string;assetAccountId:string;accumulatedAccountId:string;expenseAccountId:string;method:'Lineal diaria'|'No depreciable';commissionedOn:string;usefulLifeEnd:string;residual:number;review?:string}
export interface FixedAsset extends FixedAssetInput {id:string;number:string;responsible:string;createdAt:string;entryId:string;preview:import('./fixed-assets').FixedAssetPreview}
export interface AssetCommissionInput {date:string;assetId:string;reference:string;reason:string;commissionedOn:string;usefulLifeEnd:string;residual:number;review?:string}
export interface AssetCommission extends AssetCommissionInput {id:string;number:string;responsible:string;createdAt:string;preview:import('./fixed-assets').AssetCommissionPreview}
export interface AssetImpairmentInput {date:string;reference:string;reason:string;entityClass:'Pequeña o mediana'|'Otra';level:'Global'|'Activo individual'|'Actividad generadora de efectivo'|'Unidad menor';scopeName:string;scopeReason:string;changesReason:string;scopeConfirmed:boolean;currencyConfirmed:boolean;noOtherAssetsConfirmed:boolean;marketValue:number|null;saleCosts:number|null;marketEvidence:string;valueInUse:number|null;useEvidence:string;discountBasis:string;allowanceAccountId:string;lossAccountId:string;reversalAccountId:string;lines:{assetId:string;individualRecoverable:number|null}[];review?:string}
export interface AssetImpairment extends AssetImpairmentInput {id:string;number:string;responsible:string;createdAt:string;entryIds:string[];preview:import('./asset-impairments').AssetImpairmentPreview}
export interface AssetDisposalInput {date:string;assetId:string;kind:'Venta'|'Pérdida'|'Abandono';invoiceId:string;reference:string;reason:string;expenseAccountId:string;incomeAccountId:string;controlConfirmed:boolean;review?:string}
export interface AssetDisposal extends AssetDisposalInput {id:string;number:string;responsible:string;createdAt:string;entryIds:string[];preview:import('./asset-disposals').AssetDisposalPreview}
export interface AssetReestimateInput {date:string;assetId:string;reference:string;reason:string;usefulLifeEnd:string;residual:number;review?:string}
export interface AssetReestimate extends AssetReestimateInput {id:string;number:string;responsible:string;createdAt:string;preview:import('./fixed-assets').AssetReestimatePreview}
export interface DepreciationInput {date:string;reference:string;reason:string;review?:string}
export interface DepreciationBatch extends DepreciationInput {id:string;number:string;responsible:string;createdAt:string;entryIds:string[];preview:import('./fixed-assets').DepreciationPreview}
export interface JournalReversalInput {date:string;entryId:string;reference:string;reason:string;review?:string}
export interface JournalReversal extends JournalReversalInput {id:string;number:string;responsible:string;createdAt:string;reversalEntryId:string;preview:import('./journal-reversals').JournalReversalPreview}
export interface RevenueAccrualInput {date:string;sourceId:string;reference:string;reason:string;fiscalReason:string;assetId:string;vatAccountId:string;lines:{productId:string;value:number;accountId:string;tax:string;evidence:string;recognition:'Entrega aceptada'|'Servicio concluido'}[];review?:string}
export interface RevenueAccrual extends RevenueAccrualInput {id:string;number:string;responsible:string;createdAt:string;entryId:string;preview:import('./revenue-accruals').RevenueAccrualPreview}
export interface RevenueSettlementInput {date:string;accrualId:string;invoiceId:string;reference:string;reason:string;review?:string}
export interface RevenueSettlement extends RevenueSettlementInput {id:string;number:string;responsible:string;createdAt:string;entryId:string;preview:import('./revenue-accruals').RevenueSettlementPreview}
export interface ServiceAccrualInput {date:string;sourceId:string;reference:string;reason:string;liabilityId:string;lines:{productId:string;value:number;accountId:string}[];review?:string}
export interface ServiceAccrual extends ServiceAccrualInput {id:string;number:string;responsible:string;createdAt:string;entryId:string;preview:import('./service-accruals').ServiceAccrualPreview}
export interface ServiceReestimateInput {date:string;accrualId:string;reference:string;reason:string;lines:{productId:string;value:number}[];review?:string}
export interface ServiceReestimate extends ServiceReestimateInput {id:string;number:string;responsible:string;createdAt:string;entryId:string;preview:import('./service-accruals').ServiceReestimatePreview}
export interface ServiceSettlementInput {date:string;accrualId:string;invoiceId:string;reference:string;reason:string;review?:string}
export interface ServiceSettlement extends ServiceSettlementInput {id:string;number:string;responsible:string;createdAt:string;entryId:string;preview:import('./service-accruals').ServiceSettlementPreview}
export interface ServiceCancellationInput {date:string;accrualId:string;reference:string;reason:string;review?:string}
export interface ServiceCancellation extends ServiceCancellationInput {id:string;number:string;responsible:string;createdAt:string;entryId:string;preview:import('./service-accruals').ServiceCancellationPreview}
export interface AccountingCloseInput {date:string;reference:string;reason:string;acknowledged:string[];review?:string}
export interface AccountingClose extends AccountingCloseInput {id:string;number:string;createdAt:string;responsible:string;previousClosedUntil:string;exerciseStart:string;exerciseEnd:string;preview:import('./accounting-close').AccountingClosePreview}
export interface YearEndCloseInput {reference:string;reason:string;resultsAccountId:string;acknowledged:string[];review?:string}
export interface YearEndClose extends YearEndCloseInput {id:string;number:string;date:string;exerciseStart:string;exerciseEnd:string;previousClosedUntil:string;responsible:string;createdAt:string;entryIds:string[];accountingCloseId:string;preview:import('./year-end-close').YearEndClosePreview;after:import('./trial-balance').TrialBalance}
export interface ExerciseOpeningInput {exerciseEnd:string;reference:string;reason:string;acknowledged:string[];review?:string}
export interface ExerciseOpening extends ExerciseOpeningInput {id:string;number:string;exerciseStart:string;previousStart:string;previousEnd:string;yearEndCloseId:string;accountingCloseId:string;responsible:string;createdAt:string;preview:import('./exercise-opening').ExerciseOpeningPreview}
export interface InventoryAccounts {inventory:string;opening:string;cogs:string;adjustments:string;transit:string;wip:string;unbilled?:string;stockAllowance?:string;stockRecovery?:string}
export interface InventoryOpeningLine {productId:string;depositId:string;quantity:number;value:number}
export interface InventoryOpeningNote {noteId:string;reference:string;lines:({sourceProductId:string;target:'Existencias';productId:string;depositId:string;value:number}|{sourceProductId:string;target:'Resultados';branchId:string;accountId:string;value:number})[]}
export interface InventoryCostInput {returnCosts?:{returnId:string;productId:string;value:number;reference:string;allowance?:number;allowanceReference?:string}[];openingNotes?:InventoryOpeningNote[];receiptCosts?:InventoryReceiptEstimate[];openingInvoices?:InventoryOpeningInvoice[];costVersion?:1|2|3|4|5|6|7|8|9|10|11;date:string;reference:string;accounts:InventoryAccounts;opening?:InventoryOpeningLine[];adjustments?:{moveId:string;value:number;reference:string}[];review?:string}
export interface InventoryBalance extends InventoryOpeningLine {branchId:string;sku:string;name:string;unit:string;depositName:string}
export interface InventoryCostRow {conversionValue?:number;moveId:string;productId:string;depositId:string;branchId:string;date:string;quantity:number;value:number;kind:'Compra'|'Compra estimada'|'Venta'|'Ajuste'|'Traslado'|'Consumo'|'Fabricación'|'Devolución cliente'|'Devolución proveedor';counterpart:string;invoiceId?:string;creditId?:string;creditValue?:number;costReference?:string;allowanceUsed?:number;allowanceRestored?:number;netValue?:number}
export interface InventoryCostCorrection {openingAssignment?:InventoryOpeningNote;noteId:string;invoiceId:string;date:string;recognitionDate?:string;kind:'credito'|'debito';amount:number;lines:{branchId:string;accountId:string;amount:number}[]}
export interface InventoryReturnSource {id:string;side:Side;date:string;sourceId:string;depositId:string;noteId:string;noteDate:string;noteCostDate?:string;lines:{productId:string;quantity:number}[]}
export interface InventoryReceiptEstimate {receiptId:string;reference:string;lines:{productId:string;value:number}[]}
export interface InventoryOpeningInvoice {invoiceId:string;reference:string;lines:InventoryOpeningNote['lines']}
export interface InventoryReceiptPosition {receiptId:string;number:string;date:string;branchId:string;partyId:string;partyName:string;estimatedDate:string;reference:string;accountId:string;lines:{productId:string;sku:string;quantity:number;estimatedValue:number}[];estimatedValue:number;invoiceId?:string;invoiceNumber?:string;invoiceDate?:string;recognitionDate?:string;invoiceValue?:number;difference?:number}
export interface InventoryInvoiceSettlement {receiptId:string;invoiceId:string;date:string;recognitionDate:string;estimatedValue:number;invoiceValue:number;difference:number;openingAssignment?:InventoryOpeningInvoice;lines:{branchId:string;accountId:string;amount:number}[]}
export interface InventoryCostBatch extends InventoryCostInput {productionRecoveries?:ReturnType<typeof import('./production-recoverability').productionRecoveryReferences>;productionCorrectionId?:string;productionBridge?:import('./inventory-costing').InventoryProductionBridge;productionCosts?:ReturnType<typeof import('./production-costs').productionCostReferences>;reserve?:import('./inventory-recoverability').InventoryReservePreview;recoveries?:{id:string;number:string;date:string;review:string}[];inflation?:{id:string;number:string;date:string;review:string;postingId:string}[];receipts?:InventoryReceiptPosition[];settlements?:InventoryInvoiceSettlement[];returnSources?:InventoryReturnSource[];corrections?:InventoryCostCorrection[];id:string;number:string;method:'CPP';responsible:string;createdAt:string;sourceMoves:StockMove[];rows:InventoryCostRow[];balances:InventoryBalance[];entryIds:string[]}
export interface Audit { id: string; at: string; user: string; action: string; detail: string }
export interface ImportRun { id: string; at: string; name: string; type: string; total: number; ok: number; errors: { row: number; field: string; message: string }[]; user: string }
export interface Settings {accountingCloseId?:string;
  exerciseHistory?:{start:string;end:string}[];
  name: string; cuit: string; iva: string; province: string; address: string; industry: string;
  legalForm?:string; iibbRegistration?:string; activityStart?:string;
  defaultVat: string; skuMode: string; exerciseStart: string; exerciseEnd: string; closedUntil: string;
  onboarding: boolean; accountMap: Record<string, string>; accountingStandard: string;
}
export interface State {
  taxCertificates?:import('./tax-certificates').TaxCertificateRecord[];
  taxMovementSources?:import('./tax-movements').TaxMovementRow[];taxMovementSourceError?:string;
  version: 1; settings: Settings; parties: Party[]; products: Product[]; documents: Document[];
  cheques: Cheque[]; stockMoves: StockMove[]; treasuryMoves: TreasuryMove[]; entries: Entry[];
  vatSalesLedger?:import('./vat-sales-ledger').VatSalesLedgerRecord[];vatSales?:import('./vat-sales').VatSalesRecord[];vatLedger?:import('./vat-ledger').VatLedgerRecord[];vatAnnual?:import('./vat-annual').VatAnnualRecord[];vatPurchases?:import('./vat-purchases').VatPurchasesRecord[];supplierOriginals?:import('./supplier-originals').SupplierOriginal[];accountApplications?:import('./account-applications').AccountApplication[];cardDisputes?:import('./card-disputes').CardDisputeRecord[];cardSources?:import('./card-disputes').CardSource[];productionReservations?:import('./production-reservations').ProductionReservation[];productionRecoveries?:import('./production-recoverability').ProductionRecovery[];productionInflations?:import('./production-inflation').ProductionInflation[];productionCorrections?:import('./production-cost-corrections').ProductionCorrection[];productionCosts?:import('./production-costs').ProductionCostRecord[];inventoryRecoveries?:import('./inventory-recoverability').InventoryRecovery[];inventoryInflations?:import('./inventory-inflation').InventoryInflation[];assetInflations?:import('./asset-inflation').AssetInflation[];reexpressionPostings?:import('./reexpression-posting').ReexpressionPosting[];reexpressions?:import('./reexpression').ReexpressionRecord[];financialStatements?:import('./financial-statements').StatementRecord[];assetImpairments?:AssetImpairment[];assetDisposals?:AssetDisposal[];assetReestimates?:AssetReestimate[];fixedAssets?:FixedAsset[];assetCommissions?:AssetCommission[];depreciationBatches?:DepreciationBatch[];journalReversals?:JournalReversal[];revenueAccruals?:RevenueAccrual[];revenueSettlements?:RevenueSettlement[];exerciseOpenings?:ExerciseOpening[];yearEndCloses?:YearEndClose[];serviceCancellations?:ServiceCancellation[];serviceAccruals?:ServiceAccrual[];serviceReestimates?:ServiceReestimate[];serviceSettlements?:ServiceSettlement[];accountingCloses?:AccountingClose[];cardSettlements?: CardSettlement[]; stockTransfers?:StockTransfer[]; stockReturns?:StockReturn[]; productionPlans?:ProductionPlan[]; bankStatements?:BankStatement[]; cashClosings?:CashClosing[]; inventoryCostBatches?:InventoryCostBatch[]; masters: Record<string, Master[]>; audit: Audit[]; imports: ImportRun[];
}
export interface Session { userId: string; name: string; role: Role; permissions: string[] }
