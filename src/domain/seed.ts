import type { State } from './types'
import { categories, costCenters, today } from './constants'
import { initialBanks } from './bank-catalog'

export function initialState(): State {
  return {
    version: 1, reexpressions: [], financialStatements: [], assetImpairments: [], assetDisposals: [], assetReestimates: [], fixedAssets: [], assetCommissions: [], depreciationBatches: [], journalReversals: [], revenueAccruals: [], revenueSettlements: [], exerciseOpenings: [], yearEndCloses: [], serviceCancellations: [], serviceAccruals: [], serviceReestimates: [], serviceSettlements: [], accountingCloses: [], cardSettlements: [], productionPlans: [], bankStatements: [],
    settings: { legalForm:'Sociedad comercial · forma por definir', name: 'SICA Textil · Empresa de prueba', cuit: '', iva: 'Responsable Inscripto', province: 'Tucumán', address: '', industry: 'Comercio textil', defaultVat: '21', skuMode: 'Madre-Hijo-Nieto', exerciseStart: `${today().slice(0, 4)}-01-01`, exerciseEnd: `${today().slice(0, 4)}-12-31`, closedUntil: '', onboarding: false, accountingStandard: 'RT 54 / NUA · revisar adopción jurisdiccional', accountMap: { customers: '1.1.3', suppliers: '2.1.1', sales: '4.1', purchases: '5.1', vatDebit: '2.1.2', vatCredit: '1.1.4', cash: '1.1.1', bank: '1.1.2', cheques: '1.1.5', ownCheques: '2.1.5', cardReceivables: '1.1.8', cardFees: '5.3', withholdingCredit: '1.1.6', withholdingDebt: '2.1.3', perceptionsCredit: '1.1.7', perceptionsDebt: '2.1.4', equity: '3.1', commissions: '5.2' } },
    parties: [], products: [], documents: [], cheques: [], stockMoves: [], stockTransfers: [], stockReturns: [], treasuryMoves: [], entries: [], audit: [], imports: [],
    masters: {
      branches: [{ id: 'central', name: 'Casa Central', unit: 'Principal', point: '00001', address: '', active: true }],
      deposits: [{ id: 'principal', name: 'Depósito principal', branchId: 'central', address: '' }],
      treasury: [{ id: 'caja-principal', name: 'Caja principal', type: 'Caja', branchId: 'central', bank: '', cbu: '', accountId: '1.1.1' }],
      accounts: [
        ['1.1.1','Caja','Activo'], ['1.1.2','Bancos','Activo'], ['1.1.3','Deudores por ventas','Activo'], ['1.1.4','IVA crédito fiscal','Activo'], ['1.1.5','Valores a depositar','Activo'], ['1.1.6','Retenciones sufridas','Activo'], ['1.1.7','Percepciones sufridas','Activo'], ['1.1.8','Cupones de tarjetas a cobrar','Activo'],
        ['2.1.1','Proveedores','Pasivo'], ['2.1.2','IVA débito fiscal','Pasivo'], ['2.1.3','Retenciones a depositar','Pasivo'], ['2.1.4','Percepciones a depositar','Pasivo'], ['2.1.5','Cheques propios emitidos','Pasivo'], ['3.1','Capital y saldos iniciales','Patrimonio neto'], ['4.1','Ventas','Ingresos'], ['5.1','Compras y gastos','Gastos'], ['5.2','Comisiones de vendedores','Gastos'], ['5.3','Cargos de tarjetas','Gastos'],
      ].map(([id, name, group]) => ({ id, code: id, name, group, postable: true })),
      users: [{ id: 'admin', name: 'Administrador', username: 'admin', role: 'Administrador General', active: true, permissions: '' }],
      priceLists: [{ id: 'general', name: 'Lista general', branchId: 'central', adjustment: 0 }],
      prices: [], categories: categories.map((name, i) => ({ id: `rubro-${i}`, name, parent: '' })),
      costCenters: costCenters.map((name, i) => ({ id: `costo-${i}`, name })),
      paymentMethods: ['Efectivo','Transferencia','Mercado Pago','Cheque','Tarjeta de crédito','Tarjeta de débito'].map((name, i) => ({ id: `medio-${i}`, name })),
      banks: initialBanks(),
      cards: [{ id: 'visa', name: 'Visa', settlementDays: 30, commission: 0 }, { id: 'mastercard', name: 'Mastercard', settlementDays: 30, commission: 0 }],
      taxRules: [], variants: [], combos: [], ecommerce: [], production: [], tasks: [], machinery: [], routes: [], workCenters: [], materials: [], notes: [], agenda: [], commissions: [], cashClosures: [],
    },
  }
}
