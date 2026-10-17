import VatSalesLedgerPage from './pages/gestion/VatSalesLedgerPage'
import VatLedgerPage from './pages/gestion/VatLedgerPage'
import ReexpressionPage from './pages/gestion/ReexpressionPage'
import StatementsPage from './pages/gestion/StatementsPage'
import FixedAssetsPage from './pages/gestion/FixedAssetsPage'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StoreProvider } from '@/state/Store'
import AppLayout from '@/components/layout/AppLayout'
import AuthLayout from '@/components/layout/AuthLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/auth/LoginPage'
import PartiesPage from '@/pages/gestion/PartiesPage'
import DocumentsPage from '@/pages/gestion/DocumentsPage'
import MasterPage from '@/pages/gestion/MasterPage'
import ReportsPage, { CurrentAccount, InventoryPage, AccountsSummary } from '@/pages/gestion/ReportsPage'
import InventoryCostPage from '@/pages/gestion/InventoryCostPage'
import RevenueAccrualsPage from '@/pages/gestion/RevenueAccrualsPage'
import ServiceAccrualsPage from '@/pages/gestion/ServiceAccrualsPage'
import AccountingClosePage from '@/pages/gestion/AccountingClosePage'
import ExerciseOpeningPage from '@/pages/gestion/ExerciseOpeningPage'
import YearEndClosePage from '@/pages/gestion/YearEndClosePage'
import AccountingPage from '@/pages/gestion/AccountingPage'
import TreasuryPage, { ChequesPage } from '@/pages/gestion/TreasuryPage'
import SessionsPage from '@/pages/gestion/SessionsPage'
import SettingsPage, { UsersPage, AuditPage } from '@/pages/gestion/SettingsPage'
import AboutPage from '@/pages/gestion/AboutPage'
import ImportsPage from '@/pages/gestion/ImportsPage'
import CardsPage from '@/pages/gestion/CardsPage'
import BankStatementsPage from '@/pages/gestion/BankStatementsPage'
import StockReturnsPage from '@/pages/gestion/StockReturnsPage'
import StockTransfersPage from '@/pages/gestion/StockTransfersPage'
import ProductionPage from '@/pages/gestion/ProductionPage'
import ToolsPage from '@/pages/gestion/ToolsPage'
import ModulePage, { NotFound } from '@/pages/gestion/ModulePage'
import { modules } from '@/domain/modules'
import type { Kind, Side } from '@/domain/types'

export default function App() {
 const operations:[string,Side,Kind][]=[
 ['/clientes/ventas','cliente','factura'],['/clientes/notas/credito','cliente','credito'],['/clientes/notas/debito','cliente','debito'],['/clientes/cobros','cliente','cobro'],['/clientes/pedidos','cliente','pedido'],['/clientes/remitos','cliente','remito'],
 ['/proveedores/compras','proveedor','factura'],['/proveedores/notas/credito','proveedor','credito'],['/proveedores/notas/debito','proveedor','debito'],['/proveedores/pagos','proveedor','pago'],['/proveedores/ordenes','proveedor','orden-compra'],['/proveedores/remitos','proveedor','remito'],
 ]
 return <StoreProvider><BrowserRouter><Routes><Route element={<AuthLayout/>}><Route path="/login" element={<LoginPage/>}/></Route><Route element={<ProtectedRoute/>}><Route element={<AppLayout/>}>
 <Route path="/" element={<DashboardPage/>}/><Route path="/produccion" element={<ProductionPage/>}/>
 {(['cliente','proveedor'] as Side[]).map(side=>{const base=side==='cliente'?'/clientes':'/proveedores';return <Route key={side}><Route path={base} element={<PartiesPage side={side}/>}/><Route path={`${base}/alta`} element={<PartiesPage key={`${side}-form`} side={side} form/>}/><Route path={`${base}/cuenta-corriente`} element={<CurrentAccount side={side}/>}/><Route path={`${base}/notas`} element={<DocumentsPage side={side} kind="credito" notes/>}/></Route>})}
 {operations.map(([path,side,kind])=>['credito','debito'].includes(kind)?<Route key={path} path={path} element={<DocumentsPage side={side} kind={kind} form/>}/>:<Route key={path}><Route path={path} element={<DocumentsPage side={side} kind={kind}/>}/><Route path={`${path}/${kind==='factura'?'factura':'nuevo'}`} element={<DocumentsPage side={side} kind={kind} form/>}/></Route>)}
 {modules.map(m=><Route key={m.path} path={m.path} element={<MasterPage key={m.path} path={m.path}/>}/>)}
 <Route path="/proveedores/vendedores" element={<PartiesPage side="proveedor" sellers/>}/>
 <Route path="/productos/articulos" element={<MasterPage key="articulos" path="/productos/articulos" products/>}/><Route path="/productos/servicios" element={<MasterPage key="servicios" path="/productos/servicios" products service/>}/>
 <Route path="/stock/inventario" element={<InventoryPage/>}/><Route path="/stock/movimientos" element={<InventoryPage movements/>}/><Route path="/stock/ajustes" element={<InventoryPage adjustment/>}/>
 <Route path="/stock/devoluciones" element={<StockReturnsPage/>}/>
 <Route path="/stock/traslados" element={<StockTransfersPage/>}/>
 <Route path="/finanzas/bancos/extractos" element={<BankStatementsPage/>}/>
 <Route path="/finanzas/liquidaciones-tarjetas" element={<CardsPage/>}/><Route path="/finanzas/cajas" element={<TreasuryPage/>}/><Route path="/finanzas/bancos" element={<TreasuryPage type="Banco"/>}/><Route path="/finanzas/cheques" element={<ChequesPage/>}/><Route path="/finanzas/cuentas" element={<AccountsSummary/>}/><Route path="/finanzas/impuestos" element={<ReportsPage type="impositivos"/>}/>
 <Route path="/reportes" element={<ReportsPage/>}/>{['ventas','compras','financieros','impositivos','inventario','cuentas-corrientes'].map(t=><Route key={t} path={`/reportes/${t}`} element={<ReportsPage key={t} type={t}/>}/>)}
 <Route path="/contabilidad/conciliacion-iva-ventas" element={<VatSalesLedgerPage/>}/><Route path="/contabilidad/conciliacion-iva" element={<VatLedgerPage/>}/><Route path="/contabilidad/moneda-cierre" element={<ReexpressionPage/>}/><Route path="/contabilidad/estados" element={<StatementsPage/>}/><Route path="/contabilidad/bienes-de-uso" element={<FixedAssetsPage/>}/><Route path="/contabilidad/ingresos-devengados" element={<RevenueAccrualsPage/>}/><Route path="/contabilidad/servicios-devengados" element={<ServiceAccrualsPage/>}/><Route path="/contabilidad/apertura-ejercicio" element={<ExerciseOpeningPage/>}/><Route path="/contabilidad/cierre-resultados" element={<YearEndClosePage/>}/><Route path="/contabilidad/cierres" element={<AccountingClosePage/>}/><Route path="/contabilidad/inventario" element={<InventoryCostPage/>}/><Route path="/contabilidad" element={<AccountingPage/>}/>{['diario','mayor','balance','configuracion'].map(t=><Route key={t} path={`/contabilidad/${t}`} element={<AccountingPage key={t} type={t}/>}/>)}
 <Route path="/importaciones" element={<ImportsPage/>}/><Route path="/importaciones/gestionar" element={<ImportsPage/>}/><Route path="/importaciones/historial" element={<ImportsPage history/>}/>{['saldos-clientes','saldos-proveedores'].map(t=><Route key={t} path={`/importaciones/${t}`} element={<ImportsPage key={t} type={t}/>}/>)}
 <Route path="/configuracion" element={<SettingsPage/>}/><Route path="/administracion/parametros" element={<SettingsPage/>}/><Route path="/administracion/sesiones" element={<SessionsPage/>}/><Route path="/administracion/usuarios" element={<UsersPage/>}/><Route path="/administracion/auditoria" element={<AuditPage/>}/><Route path="/onboarding" element={<SettingsPage onboarding/>}/><Route path="/acerca-de" element={<AboutPage/>}/><Route path="/herramientas/calculadora" element={<ToolsPage/>}/>
 {['/finanzas','/productos','/stock','/administracion','/herramientas'].map(path=><Route key={path} path={path} element={<ModulePage path={path}/>}/>)}
 <Route path="*" element={<NotFound/>}/>
 </Route></Route></Routes></BrowserRouter></StoreProvider>
}
