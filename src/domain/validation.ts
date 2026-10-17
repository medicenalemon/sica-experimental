import {validateVatSalesLedger} from './vat-sales-ledger'
import {validateVatSales} from './vat-sales'
import {validateVatLedger} from './vat-ledger'
import {validateVatAnnual} from './vat-annual'
import {validateVatPurchases} from './vat-purchases'
import {validateSupplierOriginals} from './supplier-originals'
import {validateAccountApplications} from './account-applications'
import {validateCardDisputes} from './card-disputes'
import {centerProductionShifts,shiftDailyHours} from './production-schedule'
import {validateProductionReservations} from './production-reservations'
import {validateProductionRecoveries} from './production-recoverability'
import {validateProductionInflations} from './production-inflation'
import {validateProductionCorrections} from './production-cost-corrections'
import {validateProductionCosts} from './production-costs'
import {validateInventoryInflations} from './inventory-inflation'
import {validateInventoryRecoveries} from './inventory-recoverability'
import {validateAssetInflations} from './asset-inflation'
import {validateStatements} from './financial-statements'
import {validateReexpressionPostings} from './reexpression-posting'
import {validateReexpressions} from './reexpression'
import {validateAssetImpairments} from './asset-impairments'
import {validateAssetDisposals} from './asset-disposals'
import {validateFixedAssets} from './fixed-assets'
import {validateInventoryDocumentDates} from './inventory-dates'
import {validateAccountingCloses} from './accounting-close'
import {validateExerciseCalendar,validateExerciseOpenings} from './exercise-opening'
import {validateYearEndCloses} from './year-end-close'
import {validateRevenues} from './revenue-accruals'
import {validateJournalReversals} from './journal-reversals'
import {validateServices} from './service-accruals'
import type { State } from './types'
import { initialState } from './seed'
import {validateStockReturns} from './stock-returns'
import { validateStockTransfers } from './stock-transfers'
import { validateProductionPlans } from './production-workflow'
import { validateBankStatements } from './bank-reconciliation'
import { validateBanks } from './bank-catalog'
import {validateCashClosings} from './cash-closings'
import { validateRegistration } from './fiscal-registration'
import {validateInventoryCosts} from './inventory-costing'
export function validateState(value:unknown): asserts value is State {
 if(!value||typeof value!=='object')throw new Error('La copia no contiene una base SICA.')
 const s=value as State
 if(s.version!==1||!s.settings||typeof s.settings.name!=='string'||!s.masters)throw new Error('Versión o parámetros de copia inválidos.')
 for(const key of ['parties','products','documents','cheques','stockMoves','treasuryMoves','entries','audit','imports'] as const) {
  if(!Array.isArray(s[key]))throw new Error(`Falta la colección ${key}.`)
  const ids=s[key].map(x=>x.id);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw new Error(`Identificadores inválidos en ${key}.`)
 }
 for(const key of Object.keys(initialState().masters))if(!Array.isArray(s.masters[key]))throw new Error(`Falta el catálogo ${key}.`)
 validateBanks(s.masters.banks)
 validateRegistration(s.settings,s.masters.branches)
 if(!s.masters.users.some(u=>u.active&&u.role==='Administrador General'))throw new Error('La copia necesita un Administrador General activo.')
 const branches=new Set(s.masters.branches.map(b=>b.id)),parties=new Set(s.parties.map(p=>p.id)),products=new Set(s.products.map(p=>p.id)),accounts=new Set(s.masters.accounts.map(a=>a.id))
 for(const p of s.products)if(!['Producto','Servicio','Bien de uso'].includes(p.kind))throw new Error('La copia contiene un tipo de artículo inválido.')
 for(const d of s.documents) {if(!branches.has(d.branchId)||!parties.has(d.partyId)||![d.net,d.vat,d.total,d.perceptions].every(Number.isSafeInteger)||!Array.isArray(d.lines)||!Array.isArray(d.payments)||!Array.isArray(d.allocations))throw new Error('La copia contiene un comprobante inválido.');if(d.lines.some(l=>!products.has(l.productId)||!Number.isFinite(l.quantity)||!Number.isSafeInteger(l.price)))throw new Error('Detalle de comprobante inválido.')}
 for(const e of s.entries)if(!Array.isArray(e.lines)||e.lines.some(l=>!accounts.has(l.accountId)||!Number.isSafeInteger(l.debit)||!Number.isSafeInteger(l.credit)||l.debit<0||l.credit<0)||e.lines.reduce((n,l)=>n+l.debit-l.credit,0)!==0)throw new Error('La copia contiene un asiento inválido o desbalanceado.')
 if(s.cardSettlements !== undefined) {
  if(!Array.isArray(s.cardSettlements) || new Set(s.cardSettlements.map(c=>c.id)).size!==s.cardSettlements.length)throw new Error('Liquidaciones de tarjetas inválidas.')
  const totals=new Map<string,number>()
  for(const c of s.cardSettlements) {
   if(!c.id||!c.reference||!branches.has(c.branchId)||!s.masters.cards.some(card=>card.id===c.cardId)||!s.masters.treasury.some(t=>t.id===c.treasuryId&&t.branchId===c.branchId)||![c.gross,c.net,c.fee].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(c.items)||!c.items.length||!Array.isArray(c.withholdings))throw new Error('La copia contiene una liquidación inválida.')
   for(const i of c.items) {
    const d=s.documents.find(d=>d.id===i.receiptId&&d.kind==='cobro'&&d.branchId===c.branchId),p=d?.payments[i.paymentIndex]
    if(!p||p.cardId!==c.cardId||!Number.isSafeInteger(i.amount)||i.amount<=0)throw new Error('La liquidación contiene un cupón inválido.')
    const key=`${i.receiptId}:${i.paymentIndex}`,amount=(totals.get(key)||0)+i.amount
    if(amount>p.amount)throw new Error('La copia liquida un cupón por encima de su importe.')
    totals.set(key,amount)
   }
   if(c.items.reduce((n,i)=>n+i.amount,0)!==c.gross||c.withholdings.some(w=>!Number.isSafeInteger(w.amount)||w.amount<=0||!w.tax||!w.reference)||c.gross-c.fee-c.withholdings.reduce((n,w)=>n+w.amount,0)!==c.net)throw new Error('Los importes de la liquidación no concilian.')
  }
 }
 for(const m of s.stockMoves)if(!s.products.some(p=>p.id===m.productId&&p.kind==='Producto')||!Number.isFinite(m.quantity))throw new Error('La copia contiene un movimiento de stock inválido.')
 validateExerciseCalendar(s)
 validateSupplierOriginals(s)
 validateVatPurchases(s)
 validateVatSales(s)
 validateVatSalesLedger(s)
 validateVatAnnual(s)
 validateVatLedger(s)
 validateAccountApplications(s)
 validateCardDisputes(s)
 validateStockTransfers(s)
 validateStockReturns(s)
 for(const c of s.masters.workCenters)if(c.shifts){const shifts=centerProductionShifts(c);if(Math.abs(shiftDailyHours(shifts)-Number(c.hours))>0.000001)throw new Error('Los turnos no concilian con las horas del centro.')}
 validateProductionPlans(s)
 validateProductionReservations(s)
 for(const m of s.treasuryMoves)if(!Number.isSafeInteger(m.amount))throw new Error('La copia contiene un movimiento de tesorería inválido.')
 validateBankStatements(s)
 validateCashClosings(s)
 validateInventoryDocumentDates(s)
 validateProductionCorrections(s)
 validateProductionRecoveries(s)
 validateProductionInflations(s)
 validateProductionCosts(s)
 validateInventoryCosts(s)
 validateFixedAssets(s)
 validateAssetDisposals(s)
 validateAssetImpairments(s)
 validateJournalReversals(s)
 validateServices(s)
 validateRevenues(s)
 validateYearEndCloses(s)
 validateAccountingCloses(s)
 validateExerciseOpenings(s)
 validateStatements(s)
 validateReexpressions(s)
 validateReexpressionPostings(s)
 validateAssetInflations(s);validateInventoryInflations(s);validateInventoryRecoveries(s)
}
