import {applicationAmount,assertApplicationAllocationDate} from './account-applications'
import {cardPendingDisputed} from './card-disputes'
import {convertedSupplierServiceNote} from './production-costs'
import {inventoryDocumentTiming,inventoryCostDate} from './inventory-dates'
import type { State, Role, Document, Line, Letter, Kind, EntryLine, Cheque, Master, Party, Product, CardSettlement } from './types'
import { legacyIva, today, uid, ivaConditions, taxRates, paymentMethods } from './constants'
import { requireAdmin } from './permissions'
import { validateCombo } from './combo-components'
import { validateProductionMaster } from './production-model'
import { validateBankEdit } from './bank-catalog'
import {assertTreasuryWithdrawal,assertTreasuryCredit,treasuryBalance} from './treasury-model'
import { registrationDate } from './fiscal-registration'
import {assertStockOutflow} from './stock-transfers'

export function validCuit(value: string): boolean {
  const n = value.replace(/[-\s]/g, '')
  if (!/^\d{11}$/.test(n) || /^0+$/.test(n)) return false
  const sum = [5,4,3,2,7,6,5,4,3,2].reduce((acc, w, i) => acc + Number(n[i]) * w, 0)
  const mod = 11 - sum % 11
  return (mod === 11 ? 0 : mod === 10 ? 9 : mod) === Number(n[10])
}
export function suggestedLetter(emitter: string, receptor: string): Letter {
  if (['Responsable Monotributo', 'Exento'].includes(emitter)) return 'C'
  return ['Responsable Inscripto', 'Responsable Monotributo'].includes(receptor) ? 'A' : 'B'
}
export function lineTotals(line: Line, letter: Letter) {
  const price = line.price * line.quantity * (1 - line.discount / 100)
  if (letter === 'C' || letter === 'X' || ['Exento', 'No gravado'].includes(line.tax)) return { net: Math.round(price), vat: 0, total: Math.round(price) }
  const ratePerThousand = Number(line.tax) * 10
  if (letter === 'B') {
    const total = Math.round(price)
    const net = Math.round(total * 1000 / (1000 + ratePerThousand))
    return { net, vat: total - net, total }
  }
  const net = Math.round(price)
  const vat = Math.round(net * ratePerThousand / 1000)
  return { net, vat, total: net + vat }
}
export function totals(lines: Line[], letter: Letter, perceptions = 0) {
  const t = lines.reduce((a, l) => { const v = lineTotals(l, letter); return { net: a.net + v.net, vat: a.vat + v.vat, total: a.total + v.total } }, { net: 0, vat: 0, total: 0 })
  return { ...t, perceptions, total: t.total + perceptions }
}
export function stock(state: State, productId: string, depositId?: string) {
  return state.stockMoves.filter(m => m.productId === productId && (!depositId || m.depositId === depositId)).reduce((s, m) => s + m.quantity, 0)
}
export function isCommercialDocument(doc: Document) { return !doc.accountOnly && !doc.number.startsWith('INT-ND-X-CH-') }
export function documentSign(kind: Kind) { return ['credito','cobro','pago'].includes(kind) ? -1 : ['factura','debito','saldo'].includes(kind) ? 1 : 0 }
export function partyBalance(state: State, partyId: string, branchId?: string) {
  return state.documents.filter(d => d.partyId === partyId && (!branchId || d.branchId === branchId)).reduce((s, d) => s + d.total * documentSign(d.kind), 0)
}
export function outstanding(state: State, doc: Document) {
  const applied = state.documents.reduce((s, d) => s + d.allocations.filter(a => a.documentId === doc.id).reduce((n, a) => n + a.amount, 0), 0)
  return Math.max(0, doc.total - applied - applicationAmount(state,doc.id,'target'))
}
export function remainingLines(state: State, source: Document): Line[] {
  return source.lines.map(line => {
    const supplied = state.documents.filter(d => d.sourceId === source.id && d.kind === 'remito').flatMap(d => d.lines).filter(l => l.productId === line.productId).reduce((sum, l) => sum + l.quantity, 0)
    return { ...line, quantity: Math.max(0, line.quantity - supplied) }
  }).filter(l => l.quantity > 0)
}
export function assertDate(state: State, date: string) {
  if(state.reexpressionPostings?.some(p=>date>=p.preview.from&&date<=p.preview.date))throw new Error('El ajuste anual ya está contabilizado. Completá el cierre de resultados y la apertura siguiente antes de registrar nuevos movimientos.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date) throw new Error('Ingresá una fecha válida.')
  if (date < state.settings.exerciseStart || date > state.settings.exerciseEnd) throw new Error('La fecha debe pertenecer al ejercicio configurado.')
  if (state.settings.closedUntil && date <= state.settings.closedUntil) throw new Error('El período está cerrado. No se pueden registrar movimientos.')
}
export function assertStockCostDate(state:State,date:string){
 const last=state.inventoryCostBatches?.at(-1)
 if(last&&date<=last.date)throw new Error(`El inventario está valorizado hasta ${last.date}. Registrá movimientos de stock después de ese corte.`)
}
function positive(value: number, label: string, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) throw new Error(`${label}: ingresá un importe o cantidad ${allowZero ? 'no negativo' : 'mayor que cero'}.`)
}
function entry(state: State, date: string, concept: string, branchId: string, documentId: string, lines: EntryLine[]) {
  const clean = lines.filter(l => l.debit || l.credit)
  if (clean.some(l => !Number.isSafeInteger(l.debit) || !Number.isSafeInteger(l.credit) || l.debit < 0 || l.credit < 0 || (l.debit > 0 && l.credit > 0))) throw new Error('El asiento contiene importes inválidos.')
  if (clean.reduce((n, l) => n + l.debit - l.credit, 0) !== 0 || clean.length < 2) throw new Error('El asiento debe tener al menos dos líneas y el Debe debe ser igual al Haber.')
  if (clean.some(l => !state.masters.accounts.some(a => a.id === l.accountId && a.postable))) throw new Error('Las cuentas del asiento deben existir y admitir imputaciones.')
  state.entries.push({ id: uid(), date, concept, branchId, documentId, lines: clean })
}
export function addManualEntry(state: State, role: Role, date: string, concept: string, branchId: string, lines: EntryLine[]) {
  if (!['Administrador General','Administración'].includes(role)) throw new Error('Sin permiso contable.')
  assertDate(state, date)
  if (!concept.trim()) throw new Error('Ingresá el concepto del asiento.')
  entry(state, date, concept, branchId, '', lines)
  state.entries.at(-1)!.manual=true
}
export function saveParty(state: State, party: Party) {
  if (!party.name.trim() || !ivaConditions.includes(party.iva)) throw new Error('Razón social y condición frente al IVA son obligatorias.')
  if (party.cuit && !validCuit(party.cuit)) throw new Error('El CUIT no tiene un dígito verificador válido.')
  if (party.iva !== 'Consumidor Final' && !party.cuit) throw new Error('El CUIT es obligatorio para esta condición fiscal.')
  if (state.parties.some(p => p.id !== party.id && p.side === party.side && (p.code === party.code || (p.cuit && p.cuit.replace(/\D/g,'') === party.cuit.replace(/\D/g,''))))) throw new Error('Ya existe un registro con ese código o CUIT.')
  if ([party.discount, party.commission].some(n => !Number.isFinite(n) || n < 0 || n > 100)) throw new Error('Los porcentajes deben estar entre 0 y 100.')
  const i = state.parties.findIndex(p => p.id === party.id)
  if (i >= 0) state.parties[i] = party; else state.parties.push(party)
}
export function saveProduct(state: State, p: Product) {
  if(!['Producto','Servicio','Bien de uso'].includes(p.kind))throw new Error('Elegí Producto, Servicio o Bien de uso.');
  if (!p.sku.trim() || !p.name.trim()) throw new Error('SKU y descripción son obligatorios.')
  if (state.products.some(x => x.id !== p.id && x.sku.toLowerCase() === p.sku.toLowerCase())) throw new Error('El SKU ya existe.')
  if (state.settings.skuMode === 'Numérico' && !/^\d+$/.test(p.sku)) throw new Error('El SKU debe ser numérico.')
  if (state.settings.skuMode === 'Alfabético' && !/^[a-zA-Z]+$/.test(p.sku)) throw new Error('El SKU debe ser alfabético.')
  positive(p.price, 'Precio', true); positive(p.cost, 'Costo', true); positive(p.minimum, 'Stock mínimo', true)
  if (p.parent) {
    let ancestor = state.products.find(x => x.id === p.parent)
    if (!ancestor || ancestor.id === p.id) throw new Error('Producto padre inválido.')
    let depth = 1
    while (ancestor?.parent) { if (ancestor.parent === p.id || ++depth > 2) throw new Error('La jerarquía admite madre, hijo y nieto, sin ciclos.'); ancestor = state.products.find(x => x.id === ancestor?.parent) }
  }
  if (!taxRates.includes(p.tax)) throw new Error('La alícuota de IVA no es válida.')
  const previous=state.products.find(x=>x.id===p.id)
  if(previous&&(p.sku!==previous.sku||p.kind!=='Producto')&&state.masters.combos.some(c=>String(c.components).split(',').some(part=>part.slice(0,part.lastIndexOf(':')).trim().toLowerCase()===previous.sku.toLowerCase())))throw new Error('El SKU integra un combo. Actualizá sus componentes antes de cambiar el código o convertirlo en servicio.')
  if(previous&&p.kind!==previous.kind&&state.documents.some(d=>d.lines.some(l=>l.productId===p.id)))throw new Error('El artículo conserva su tipo porque integra comprobantes. Registrá otro SKU para un destino distinto.');
  if(previous&&(p.unit!==previous.unit||p.kind!==previous.kind)&&(state.stockMoves.some(m=>m.productId===p.id)||(state.productionPlans||[]).some(plan=>(plan.productId===p.id||plan.materials.some(m=>m.productId===p.id))&&!['Terminada','Cancelada'].includes(String(state.masters.production.find(o=>o.id===plan.orderId)?.status)))))throw new Error('El artículo conserva su tipo y unidad porque tiene movimientos de stock o un plan de producción abierto.')
  const i = state.products.findIndex(x => x.id === p.id)
  if (i >= 0) state.products[i] = p; else state.products.push(p)
}
export function saveMaster(state: State, key: string, item: Master, role: Role) {
  if (['users','branches','accounts','priceLists','prices','taxRules'].includes(key)) requireAdmin(role)
  if (!String(item.name || item.code || '').trim()) throw new Error('Ingresá un nombre o código.')
  const list = state.masters[key] ?? []
  for (const field of ['quantity','price','rate','hours','capacity','cost','actualCost','settlementDays','commission']) {
    if (item[field] !== undefined && (!Number.isFinite(Number(item[field])) || Number(item[field]) < 0)) throw new Error(`${field}: el valor no puede ser negativo.`)
  }
  if(item.settlementDays!==undefined&&!Number.isSafeInteger(Number(item.settlementDays)))throw new Error('El plazo de liquidación debe ser una cantidad entera de días.')
  if (item.rate !== undefined && Number(item.rate) > 100) throw new Error('La alícuota no puede superar el 100%.')
  if (item.commission !== undefined && Number(item.commission) > 100) throw new Error('La comisión no puede superar el 100%.')
  if (item.adjustment !== undefined && (!Number.isFinite(Number(item.adjustment)) || Number(item.adjustment) < -100)) throw new Error('El ajuste de precios no puede reducirlos por debajo de cero.')
  if (item.branchId && !state.masters.branches.some(b=>b.id===item.branchId)) throw new Error('La sucursal no existe.')
  if (item.productId && !state.products.some(p=>p.id===item.productId)) throw new Error('El producto no existe.')
  if (item.orderId && !state.masters.production.some(o=>o.id===item.orderId)) throw new Error('La orden de producción no existe.')
  if (key === 'categories' && item.parent) {
    if (item.parent===item.id) throw new Error('Un rubro no puede ser su propio padre.')
    let parent=list.find(c=>c.id===item.parent), seen=new Set([item.id]);
    while(parent) { if(seen.has(parent.id)) throw new Error('Los rubros no pueden tener ciclos.');seen.add(parent.id);parent=list.find(c=>c.id===parent?.parent) }
  }
  if (key === 'branches' && (!/^\d{1,5}$/.test(String(item.point)) || Number(item.point) < 1 || list.some(x => x.id !== item.id && Number(x.point) === Number(item.point)))) throw new Error('El punto de venta debe ser único y tener entre 1 y 5 dígitos.')
  if(key==='branches')registrationDate(item.activityStart)
  if (key === 'users' && list.some(x => x.id !== item.id && x.username === item.username)) throw new Error('El usuario ya existe.')
  if (key === 'users' && !list.some(x => x.id === item.id)) throw new Error('Creá usuarios desde Usuarios y Perfiles para asignar una contraseña.')
  if(key==='treasury'&&(state.treasuryMoves.some(m=>m.treasuryId===item.id)||(state.bankStatements||[]).some(s=>s.treasuryId===item.id)||(state.cashClosings||[]).some(c=>c.lines.some(l=>l.fromId===item.id||l.toId===item.id)))){const old=list.find(x=>x.id===item.id);if(old&&(old.type!==item.type||old.branchId!==item.branchId||old.accountId!==item.accountId))throw new Error('La cuenta con movimientos, extractos o cierres conserva su tipo, sucursal y cuenta contable.')}
  if(key==='deposits'&&state.stockMoves.some(m=>m.depositId===item.id)&&list.find(x=>x.id===item.id)?.branchId!==item.branchId)throw new Error('El depósito con movimientos conserva su sucursal.')
  if (key === 'treasury' && item.type === 'Banco' && item.cbu && !/^\d{22}$/.test(String(item.cbu))) throw new Error('La CBU debe tener 22 dígitos.')
  if (key === 'accounts' && list.some(x => x.id !== item.id && x.code === item.code)) throw new Error('El código de cuenta ya existe.')
  if(key==='accounts'&&state.entries.some(e=>e.lines.some(l=>l.accountId===item.id))&&list.find(a=>a.id===item.id)?.group!==item.group)throw new Error('La cuenta con asientos conserva su grupo contable. Registrá una reclasificación mediante asientos revisados.')
  if (key === 'users' && list.find(x => x.id === item.id)?.role === 'Administrador General' && (item.role !== 'Administrador General' || !item.active) && list.filter(x => x.role === 'Administrador General' && x.active && x.id !== item.id).length === 0) throw new Error('Debe quedar al menos un Administrador General activo.')
  if (key === 'production') {
    const existing = list.find(x=>x.id===item.id)
    if (existing?.status === 'Terminada') throw new Error('Las órdenes terminadas conservan sus datos.')
    if (item.status === 'Terminada') throw new Error('Finalizá la orden desde el panel de Producción para registrar el consumo de materiales y el producto terminado.')
  }
  if(key==='combos')validateCombo(state,item)
  if(key==='banks')validateBankEdit(state,item)
  if(['production','materials','routes','workCenters','tasks'].includes(key))validateProductionMaster(state,key,item)
  const i = list.findIndex(x => x.id === item.id)
  if (i >= 0) list[i] = item; else list.push(item)
  state.masters[key] = list
}
export function adjustStock(state: State, role: Role, productId: string, depositId: string, quantity: number, reason: string, date: string) {
  requireAdmin(role); assertDate(state, date)
  assertStockCostDate(state,date)
  const p = state.products.find(p => p.id === productId)
  const deposit = state.masters.deposits.find(d => d.id === depositId)
  if (!p || p.kind !== 'Producto' || !deposit || !quantity || !Number.isFinite(quantity) || !reason.trim()) throw new Error('Seleccioná producto, depósito, cantidad distinta de cero y motivo.')
  assertStockOutflow(state,p.id,depositId,date,-quantity,p.negative,p.sku)
  state.stockMoves.push({ id: uid(), date, productId, depositId, quantity, reason, documentId: '', branchId: String(deposit.branchId) })
}
export function createDocument(state: State, input: Omit<Document,'id'|'number'|'net'|'vat'|'total'|'fiscalStatus'> & {
 total?: number }, role: Role): Document {
 if(convertedSupplierServiceNote(state,input))throw new Error('La nota de un servicio incorporado a producción requiere una corrección vinculada de conversión; esa ampliación está pendiente.');
  const invoice = ['factura','credito','debito'].includes(input.kind)
  const receipt = ['cobro','pago'].includes(input.kind)
  if (!['Administrador General','Administración'].includes(role) && !(role === 'Depósito' && ['pedido','remito'].includes(input.kind)) && !(role === 'Producción' && input.kind === 'orden-compra') && role !== 'Personalizado') throw new Error('Tu perfil no permite registrar esta operación.')
  assertDate(state, input.date)
  if(input.kind==='remito'&&input.lines.some(l=>state.products.find(p=>p.id===l.productId)?.kind==='Producto'))assertStockCostDate(state,input.date)
  const party = state.parties.find(p => p.id === input.partyId && p.side === input.side)
  const branch = state.masters.branches.find(b => b.id === input.branchId && b.active)
  if (!party || !branch) throw new Error('Seleccioná una contraparte y una sucursal activa.')
  if (invoice && input.letter !== 'X') {
    if (!validCuit(party.cuit)) throw new Error('El PPTX exige CUIT válido en comprobantes A, B y C. Completá el cliente o proveedor.')
    if (legacyIva.includes(party.iva) || legacyIva.includes(state.settings.iva)) throw new Error('La condición fiscal histórica requiere actualización antes de registrar comprobantes A, B o C.')
    const expected = input.side === 'cliente' ? suggestedLetter(state.settings.iva, party.iva) : suggestedLetter(party.iva, state.settings.iva)
    if (input.letter !== expected) throw new Error(`La combinación fiscal requiere clase ${expected}. Elegí X para una operación exclusivamente interna.`)
  }
  const source = input.sourceId ? state.documents.find(d => d.id === input.sourceId) : undefined
  if (input.sourceId && (!source || source.partyId !== party.id || source.branchId !== branch.id || source.side !== input.side)) throw new Error('El documento asociado debe pertenecer a la misma contraparte y sucursal.')
  if (['credito','debito'].includes(input.kind) && input.letter !== 'X' && (!source || source.kind !== 'factura' || source.letter !== input.letter)) throw new Error('La nota debe asociarse a una factura de la misma clase.')
  if (input.kind === 'factura' && source) {
    if (source.kind !== 'remito') throw new Error('La factura debe originarse en un remito.')
    if (state.documents.some(d => d.kind === 'factura' && d.sourceId === source.id)) throw new Error('Este remito ya fue facturado.')
    if (input.lines.length !== source.lines.length || input.lines.some(l => !source.lines.some(s => s.productId === l.productId && s.quantity === l.quantity))) throw new Error('La factura debe conservar los productos y cantidades del remito.')
  }
  if (!receipt && input.kind !== 'saldo') {
    if (!input.lines.length) throw new Error('Agregá al menos una línea.')
    if (new Set(input.lines.map(l => l.productId)).size !== input.lines.length) throw new Error('Agrupá cada artículo en una sola línea.')
    for (const l of input.lines) {
      if (!state.products.some(p => p.id === l.productId)) throw new Error('Seleccioná un producto o servicio del catálogo.')
      positive(l.quantity,'Cantidad'); positive(l.price,'Precio',true)
      if (!Number.isFinite(l.discount) || l.discount < 0 || l.discount > 100) throw new Error('Descuento inválido.')
    }
  }
  if (input.due && input.due < input.date) throw new Error('El vencimiento no puede ser anterior a la fecha.')
  if (!['A','B','C','X'].includes(input.letter)) throw new Error('Clase de comprobante inválida.')
  if (input.lines.some(l => !taxRates.includes(l.tax))) throw new Error('Alícuota inválida en el detalle.')
  positive(input.perceptions, 'Percepciones', true)
  let t = totals(input.lines, input.letter, input.perceptions)
  if (receipt) {
    if (!input.payments.length) throw new Error('Agregá una forma de pago o cobro.')
    input.payments.forEach(p => {
      if(!paymentMethods.includes(p.method))throw new Error('Forma de pago no reconocida.')
      positive(p.amount,'Importe')
      if (!Number.isSafeInteger(p.amount)) throw new Error('Importe inválido.')
      if (p.method === 'Retención') { if (!p.reference || !p.tax || (p.tax === 'Ingresos Brutos' && !p.jurisdiction)) throw new Error('Las retenciones necesitan certificado, impuesto y jurisdicción para IIBB.'); }
      else if (p.method === 'Cheque') {
        const cheque = state.cheques.find(c => c.id === p.chequeId)
        if (!cheque || cheque.amount !== p.amount || cheque.branchId !== input.branchId || cheque.status !== 'En cartera' || (input.kind === 'cobro' && (cheque.type !== 'Terceros' || cheque.receiptId || cheque.partyId !== party.id)) || (input.kind === 'pago' && cheque.type === 'Terceros' && !cheque.receiptId)) throw new Error('El cheque seleccionado no está disponible o tiene otro importe o cliente.')
      } else if(input.kind==='cobro' && isCardPayment(p.method)) {
        if(!p.cardId || !state.masters.cards.some(c=>c.id===p.cardId) || !p.reference.trim())throw new Error('El cobro con tarjeta necesita marca y referencia de cupón u operación.')
      } else if (!state.masters.treasury.some(t => t.id === p.treasuryId && t.branchId === input.branchId)) throw new Error('Seleccioná una caja o cuenta de la sucursal.')
    })
    if (new Set(input.payments.filter(p => p.chequeId).map(p => p.chequeId)).size !== input.payments.filter(p => p.chequeId).length) throw new Error('El cheque está repetido en el recibo.')
    const total = input.payments.reduce((n, p) => n + p.amount, 0)
    t = { net: total, vat: 0, perceptions: 0, total }
  }
  if (input.kind === 'saldo') { positive(Math.abs(input.total ?? 0),'Saldo inicial'); t = { net: input.total!, vat: 0, perceptions: 0, total: input.total! } }
  if (!Number.isSafeInteger(t.total)) throw new Error('El total supera el rango de importes admitido.')
  if (invoice && t.total <= 0) throw new Error('El total debe ser mayor que cero.')
  if (input.kind === 'credito' && source) {
    const already = state.documents.filter(d => d.kind === 'credito' && d.sourceId === source.id).reduce((n,d)=>n+d.total,0)
    if (already + t.total > source.total) throw new Error('Las notas de crédito superan el total de la factura asociada.')
  }
  const allocations = [...input.allocations]
  if (input.kind === 'credito' && source && !allocations.length) allocations.push({ documentId: source.id, amount: Math.min(t.total, outstanding(state, source)) })
  let allocated = 0
  if (new Set(allocations.map(a=>a.documentId)).size !== allocations.length) throw new Error('La aplicación contiene comprobantes repetidos.')
  for (const a of allocations) {
    const d = state.documents.find(d => d.id === a.documentId && d.partyId === party.id && d.branchId === branch.id && ['factura','debito','saldo'].includes(d.kind))
    positive(a.amount,'Aplicación',true)
    if(a.amount>0)assertApplicationAllocationDate(state,a.documentId,input.date)
    if (!d || a.amount > outstanding(state,d)) throw new Error('La aplicación supera el saldo disponible del comprobante.')
    allocated += a.amount
  }
  if (allocated > Math.abs(t.total)) throw new Error('Las aplicaciones superan el importe del recibo o nota.')
  const id = uid()
  const prefixes: Record<Kind,string> = { factura:'FC', credito:'NC', debito:'ND', cobro:'RC', pago:'OP', pedido:'NP', remito:'RM', 'orden-compra':'OC', saldo:'SI' }
  const seq = state.documents.filter(d => d.kind === input.kind && d.branchId === input.branchId && d.letter === input.letter).length + 1
  const documentPayments=input.payments.map(p=>{
    if(input.kind!=='cobro'||!isCardPayment(p.method))return {...p}
    const due=new Date(`${input.date}T12:00:00Z`);due.setUTCDate(due.getUTCDate()+Number(state.masters.cards.find(c=>c.id===p.cardId)?.settlementDays||0))
    return {...p,cardDue:due.toISOString().slice(0,10)}
  })
  const doc: Document = { ...input, payments:documentPayments, ...t, id, allocations, number: `INT-${prefixes[input.kind]}-${input.letter}-${String(branch.point).padStart(5,'0')}-${String(seq).padStart(8,'0')}`, fiscalStatus: input.letter === 'X' || !invoice ? 'interno' : 'pendiente' }
  delete doc.inventoryCostDate;delete doc.inventoryAfterBatchId;Object.assign(doc,inventoryDocumentTiming(state,doc))
  if (input.kind === 'remito') {
    const deposit = state.masters.deposits.find(d => d.id === input.depositId && d.branchId === branch.id)
    if (!deposit) throw new Error('Seleccioná un depósito de la sucursal.')
    if (source) {
      if (!(input.side === 'cliente' ? source.kind === 'pedido' : source.kind === 'orden-compra')) throw new Error('El remito debe originarse en un pedido u orden de compra.')
      const remaining = remainingLines(state, source)
      if (input.lines.some(l => !remaining.some(r => r.productId === l.productId && l.quantity <= r.quantity))) throw new Error('El remito supera las cantidades pendientes del pedido.')
    }
    const quantities=new Map<string,number>()
    for(const l of input.lines){const p=state.products.find(p=>p.id===l.productId)!;if(p.kind==='Producto')quantities.set(p.id,(quantities.get(p.id)||0)+l.quantity)}
    for(const [productId,quantity] of quantities){const p=state.products.find(p=>p.id===productId)!;assertStockOutflow(state,p.id,deposit.id,input.date,input.side==='cliente'?quantity:-quantity,p.negative,p.sku)}
    for(const l of input.lines){const p=state.products.find(p=>p.id===l.productId)!;if(p.kind!=='Producto')continue;const q=input.side==='cliente'?-l.quantity:l.quantity;state.stockMoves.push({id:uid(),date:input.date,productId:p.id,depositId:deposit.id,quantity:q,reason:doc.number,documentId:id,branchId:branch.id})}
  }
  if (receipt && input.payments.some(p=>p.chequeId && state.cheques.find(c=>c.id===p.chequeId)?.type==='Propio')) ensureOwnChequeAccount(state)
  if(input.kind==='cobro' && input.payments.some(p=>isCardPayment(p.method))) ensureCardAccounts(state)
  const m = state.settings.accountMap
  const purchaseVat = state.settings.iva === 'Responsable Inscripto' ? t.vat : 0
  if (invoice || input.kind === 'saldo') {
    const customer = input.side === 'cliente'
    const credit = input.kind === 'credito' || (input.kind === 'saldo' && t.total < 0)
    const journalTotal = Math.abs(t.total), journalNet = Math.abs(t.net)
    const lines: EntryLine[] = customer
      ? [{accountId:m.customers,debit:journalTotal,credit:0},{accountId:input.kind === 'saldo' ? m.equity : m.sales,debit:0,credit:journalNet},{accountId:m.vatDebit,debit:0,credit:t.vat},{accountId:m.perceptionsDebt,debit:0,credit:t.perceptions}]
      : [{accountId:input.kind === 'saldo' ? m.equity : m.purchases,debit:journalNet + t.vat - purchaseVat,credit:0},{accountId:m.vatCredit,debit:purchaseVat,credit:0},{accountId:m.perceptionsCredit,debit:t.perceptions,credit:0},{accountId:m.suppliers,debit:0,credit:journalTotal}]
    assertDate(state,inventoryCostDate(doc))
    entry(state,inventoryCostDate(doc),doc.number,input.branchId,id,credit ? lines.map(l=>({ ...l,debit:l.credit,credit:l.debit })) : lines)
  }
  if (receipt) {
    const customer = input.kind === 'cobro'
    const lines: EntryLine[] = [{accountId:customer ? m.customers : m.suppliers,debit:customer ? 0 : t.total,credit:customer ? t.total : 0}]
    for (const p of input.payments) {
      const treasury = state.masters.treasury.find(t => t.id === p.treasuryId)
      const accountId = p.method === 'Retención' ? (customer ? m.withholdingCredit : m.withholdingDebt) : p.method === 'Cheque' ? (state.cheques.find(c=>c.id===p.chequeId)?.type==='Propio' ? m.ownCheques : m.cheques) : customer && isCardPayment(p.method) ? m.cardReceivables : String(treasury?.accountId || m.cash)
      lines.push({accountId, debit:customer ? p.amount : 0, credit:customer ? 0 : p.amount})
      if (p.method === 'Cheque' && p.chequeId) { const cheque = state.cheques.find(c => c.id === p.chequeId)!; if (customer) cheque.receiptId = id; else { cheque.status = 'Entregado'; cheque.paymentId=id; if(cheque.type==='Propio')cheque.receiptId=id } }
      else if (p.method !== 'Retención' && !(customer && isCardPayment(p.method))) state.treasuryMoves.push({ id: uid(), date: input.date, treasuryId: p.treasuryId, amount: customer ? p.amount : -p.amount, reason: doc.number, documentId:id, branchId:input.branchId, reconciled:false })
    }
    entry(state,input.date,doc.number,input.branchId,id,lines)
  }
  state.documents.push(doc)
  if (input.kind === 'cobro' && party.seller && party.commission > 0) {
    const seller = state.parties.find(p => p.id === party.seller && p.side === 'proveedor')
    if (!seller) throw new Error('El vendedor asignado debe ser un proveedor.')
    const amount = Math.round(t.total * party.commission / 100)
    if (amount > 0) {
      const commissionDoc = { ...doc, id:uid(), number:`INT-COM-${doc.number}`, kind:'debito' as const, side:'proveedor' as const, letter:'X' as const, partyId:seller.id, total:amount, net:amount, vat:0, perceptions:0, lines:[], payments:[], allocations:[], sourceId:'', fiscalStatus:'interno' as const, observations:`Comisión ${party.commission}% sobre ${doc.number}` }
      state.documents.push(commissionDoc)
      state.masters.commissions.push({ id:uid(), name:commissionDoc.number, sellerId:seller.id, clientId:party.id, receiptId:id, amount, branchId:branch.id })
      entry(state,input.date,commissionDoc.observations,branch.id,commissionDoc.id,[{accountId:m.commissions,debit:amount,credit:0},{accountId:m.suppliers,debit:0,credit:amount}])
    }
  }
  return doc
}
function ensureOwnChequeAccount(state: State) {
  if (!state.settings.accountMap.ownCheques) {
    const id = '2.1.5'
    if (!state.masters.accounts.some(a=>a.id===id)) state.masters.accounts.push({id,code:id,name:'Cheques propios emitidos',group:'Pasivo',postable:true})
    state.settings.accountMap.ownCheques=id
  }
}
export function saveCheque(state: State, cheque: Cheque, role: Role) {
  const existing = state.cheques.find(c => c.id === cheque.id)
  if (existing) { requireAdmin(role); if (existing.receiptId && ['amount','partyId','branchId','type','receiptId','paymentId','status'].some(key=>existing[key as keyof Cheque]!==cheque[key as keyof Cheque])) throw new Error('En cheques aplicados se pueden corregir datos administrativos, manteniendo importe, cliente, sucursal, tipo y estado.') }
  positive(cheque.amount,'Importe')
  assertDate(state, cheque.issued)
  if (!cheque.number || !cheque.bank || !cheque.holder || !cheque.due || cheque.due < cheque.issued) throw new Error('Completá número, banco, titular y fechas válidas.')
  if (state.cheques.some(c => c.id !== cheque.id && c.number === cheque.number && c.bank === cheque.bank)) throw new Error('Ya existe ese número de cheque en el banco.')
  if (existing) Object.assign(existing,cheque); else state.cheques.push(cheque)
}
export function chequeStatus(state: State, id: string, status: Cheque['status'], role: Role, treasuryId = '') {
  requireAdmin(role)
  const c = state.cheques.find(c=>c.id===id)
  if (!c || c.status === status) return
  const allowed: Record<Cheque['status'],Cheque['status'][]> = { 'En cartera':['Depositado','Cobrado','Rechazado'], Depositado:['Cobrado','Rechazado'], Cobrado:[], Entregado:['Cobrado','Rechazado'], Rechazado:[] }
  if (!allowed[c.status].includes(status)) throw new Error('Transición de estado no permitida.')
  if (!c.receiptId) throw new Error('Aplicá el cheque a un cobro antes de cambiar su estado.')
  assertDate(state, today())
  const m = state.settings.accountMap
  const treasury = state.masters.treasury.find(t=>t.id===treasuryId && t.branchId === c.branchId)
  const receipt = state.documents.find(d=>d.id===c.receiptId)!
  if(c.type==='Propio') {
    ensureOwnChequeAccount(state)
    if(status==='Rechazado') {
      state.documents.push({...receipt,id:uid(),number:`INT-ND-X-CH-${c.number}`,date:today(),kind:'debito',letter:'X',accountOnly:true,lines:[],payments:[],allocations:[],net:c.amount,vat:0,perceptions:0,total:c.amount,sourceId:'',fiscalStatus:'interno',observations:`Cheque propio rechazado ${c.id}`})
      entry(state,today(),`Rechazo cheque propio ${c.number}`,c.branchId,c.id,[{accountId:m.ownCheques,debit:c.amount,credit:0},{accountId:m.suppliers,debit:0,credit:c.amount}])
    } else if(status==='Cobrado') {
      if(!treasury || treasury.type!=='Banco')throw new Error('Seleccioná la cuenta bancaria de débito del cheque propio.')
      state.treasuryMoves.push({id:uid(),date:today(),treasuryId:treasury.id,amount:-c.amount,reason:`Débito cheque propio ${c.number}`,documentId:c.id,branchId:c.branchId,reconciled:false})
      entry(state,today(),`Débito cheque propio ${c.number}`,c.branchId,c.id,[{accountId:m.ownCheques,debit:c.amount,credit:0},{accountId:String(treasury.accountId||m.bank),debit:0,credit:c.amount}])
    }
    c.status=status; return
  }
  const deliveredPayment = c.status==='Entregado' ? state.documents.find(d=>d.id===c.paymentId || (d.kind==='pago' && d.payments.some(p=>p.chequeId===c.id))) : undefined
  if(c.status==='Entregado' && (!deliveredPayment || deliveredPayment.kind!=='pago'))throw new Error('No se encontró el pago que documenta la entrega del cheque.')
  if (status === 'Rechazado') {
    if (state.documents.some(d=>d.observations===`Cheque rechazado ${c.id}`)) throw new Error('El rechazo ya fue contabilizado.')
    state.documents.push({ ...receipt,id:uid(),number:`INT-ND-X-CH-${c.number}`,date:today(),kind:'debito',letter:'X',accountOnly:true,lines:[],payments:[],allocations:[],net:c.amount,vat:0,perceptions:0,total:c.amount,sourceId:'',fiscalStatus:'interno',observations:`Cheque rechazado ${c.id}` })
    if(deliveredPayment)state.documents.push({...deliveredPayment,id:uid(),number:`INT-ND-X-CH-PROV-${c.number}`,date:today(),kind:'debito',letter:'X',accountOnly:true,lines:[],payments:[],allocations:[],net:c.amount,vat:0,perceptions:0,total:c.amount,sourceId:'',fiscalStatus:'interno',observations:`Cheque endosado rechazado ${c.id}`})
    entry(state,today(),`Rechazo cheque ${c.number}`,c.branchId,c.id,[{accountId:m.customers,debit:c.amount,credit:0},{accountId:deliveredPayment?m.suppliers:m.cheques,debit:0,credit:c.amount}])
  }
  if (status === 'Cobrado' && !deliveredPayment) {
    if (!treasury) throw new Error('Seleccioná una cuenta destino para acreditar el cheque.')
    state.treasuryMoves.push({ id:uid(),date:today(),treasuryId:treasury.id,amount:c.amount,reason:`Cobro cheque ${c.number}`,documentId:c.id,branchId:c.branchId,reconciled:false })
    entry(state,today(),`Cobro cheque ${c.number}`,c.branchId,c.id,[{accountId:String(treasury.accountId || m.bank),debit:c.amount,credit:0},{accountId:m.cheques,debit:0,credit:c.amount}])
  }
  c.status = status
}
export function transferTreasury(state: State, fromId: string, toId: string, amount: number, date: string, reason: string, closing = false) {
  assertDate(state,date); positive(amount,'Importe')
  const from = state.masters.treasury.find(t=>t.id===fromId), to = state.masters.treasury.find(t=>t.id===toId)
  if (!from || !to || from.active===false || to.active===false || !state.masters.branches.some(b=>b.id===from.branchId&&b.active) || fromId===toId || from.branchId !== to.branchId || !reason.trim()) throw new Error('Elegí dos cuentas distintas de la misma sucursal y un motivo.')
  const balance = treasuryBalance(state,fromId,date)
  assertTreasuryWithdrawal(state,fromId,date,amount);assertTreasuryCredit(state,toId,date,amount)
  if (amount > balance) throw new Error('El retiro supera el saldo disponible.')
  const id=uid()
  entry(state,date,reason,String(from.branchId),id,[{accountId:String(to.accountId),debit:amount,credit:0},{accountId:String(from.accountId),debit:0,credit:amount}])
  for (const [treasuryId, sign] of [[fromId,-1],[toId,1]] as const) state.treasuryMoves.push({id:uid(),date,treasuryId,amount:amount*sign,reason,documentId:id,branchId:String(from.branchId),reconciled:false})
  if (closing) state.masters.cashClosures.push({id,name:reason,date,fromId,toId,amount,balanceBefore:balance,branchId:from.branchId})
  return id
}

export function isCardPayment(method: string) { return ['Tarjeta de crédito','Tarjeta de débito'].includes(method) }
function ensureCardAccounts(state: State) {
  const mappings=[['cardReceivables','1.1.8','Cupones de tarjetas a cobrar','Activo'],['cardFees','5.3','Comisiones de tarjetas','Gastos']]
  for(const [key,id,name,group] of mappings)if(!state.settings.accountMap[key]) {
    if(!state.masters.accounts.some(a=>a.id===id))state.masters.accounts.push({id,code:id,name,group,postable:true})
    state.settings.accountMap[key]=id
  }
}
export function pendingCardPayments(state: State, branchId?: string) {
  return state.documents.filter(d=>d.kind==='cobro' && (!branchId || d.branchId===branchId)).flatMap(receipt=>receipt.payments.flatMap((p,paymentIndex)=>{
    if(!p.cardId || !isCardPayment(p.method))return [] // Historical cash-recorded payments are not recaptured.
    const settled=(state.cardSettlements||[]).reduce((n,s)=>n+s.items.filter(i=>i.receiptId===receipt.id && i.paymentIndex===paymentIndex).reduce((a,i)=>a+i.amount,0),0)
    const disputed=cardPendingDisputed(state,receipt.id,paymentIndex),remaining=p.amount-settled-disputed
    const card=state.masters.cards.find(c=>c.id===p.cardId)
    const due=new Date(`${receipt.date}T12:00:00Z`);due.setUTCDate(due.getUTCDate()+Number(card?.settlementDays||0))
    return [{receiptId:receipt.id,paymentIndex,cardId:p.cardId,branchId:receipt.branchId,date:receipt.date,due:p.cardDue||due.toISOString().slice(0,10),number:receipt.number,reference:p.reference,gross:p.amount,settled,disputed,remaining}]
  })).filter(p=>p.remaining>0)
}
export function settleCards(state: State, input: Omit<CardSettlement,'id'|'gross'|'net'>, role: Role) {
  if(!['Administrador General','Administración','Personalizado'].includes(role))throw new Error('Tu perfil no permite registrar liquidaciones de tarjetas.')
  assertDate(state,input.date)
  const bank=state.masters.treasury.find(t=>t.id===input.treasuryId && t.branchId===input.branchId && t.type==='Banco')
  if(!bank || !input.reference.trim() || !state.masters.cards.some(c=>c.id===input.cardId))throw new Error('Seleccioná tarjeta y cuenta bancaria de la sucursal, y una referencia de liquidación.')
  if((state.cardSettlements||[]).some(s=>s.cardId===input.cardId && s.branchId===input.branchId && s.reference.trim().toLowerCase()===input.reference.trim().toLowerCase()))throw new Error('Esa liquidación ya fue registrada. Se evitó duplicarla.')
  if(!input.items.length || new Set(input.items.map(i=>`${i.receiptId}:${i.paymentIndex}`)).size!==input.items.length)throw new Error('Seleccioná cupones sin repetirlos.')
  const pending=pendingCardPayments(state,input.branchId)
  let gross=0
  for(const item of input.items) {
    const p=pending.find(p=>p.receiptId===item.receiptId && p.paymentIndex===item.paymentIndex && p.cardId===input.cardId)
    if(!Number.isSafeInteger(item.amount) || item.amount<=0 || !p || item.amount>p.remaining || p.date>input.date)throw new Error('El cupón no está disponible, supera el pendiente o es posterior a la liquidación.')
    gross+=item.amount
  }
  if(!Number.isSafeInteger(input.fee)||input.fee<0)throw new Error('Los cargos deben ser un importe no negativo.')
  const validTaxes=['Ingresos Brutos','Ganancias','IVA','Seguridad Social']
  for(const w of input.withholdings)if(w.method!=='Retención' || !Number.isSafeInteger(w.amount) || w.amount<=0 || !w.reference.trim() || !validTaxes.includes(w.tax||'') || (w.tax==='Ingresos Brutos'&&!w.jurisdiction))throw new Error('Cada retención requiere importe positivo, impuesto, certificado y jurisdicción para IIBB.')
  const withheld=input.withholdings.reduce((n,w)=>n+w.amount,0),net=gross-input.fee-withheld
  if(!Number.isSafeInteger(gross) || net<0)throw new Error('Las deducciones superan el bruto de los cupones seleccionados.')
  ensureCardAccounts(state)
  const m=state.settings.accountMap,id=uid()
  const settlement:CardSettlement={...input,id,gross,net,reference:input.reference.trim()}
  entry(state,input.date,`Liquidación tarjeta ${settlement.reference}`,input.branchId,id,[{accountId:String(bank.accountId),debit:net,credit:0},{accountId:m.cardFees,debit:input.fee,credit:0},{accountId:m.withholdingCredit,debit:withheld,credit:0},{accountId:m.cardReceivables,debit:0,credit:gross}])
  if(net)state.treasuryMoves.push({id:uid(),date:input.date,treasuryId:bank.id,amount:net,reason:`Liquidación tarjeta ${settlement.reference}`,documentId:id,branchId:input.branchId,reconciled:false})
  ;(state.cardSettlements ||= []).push(settlement)
  return settlement
}
