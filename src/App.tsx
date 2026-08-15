import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import PlaceholderPage from '@/components/shared/PlaceholderPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          {/* ── Inicio ── */}
          <Route path="/" element={<DashboardPage />} />

          {/* ── Clientes ── */}
          <Route path="/clientes" element={<PlaceholderPage title="Clientes" description="Módulo de gestión integral de clientes." />} />
          <Route path="/clientes/alta" element={<PlaceholderPage title="Alta de Clientes" description="Registrar nuevos clientes en el sistema." />} />
          <Route path="/clientes/ventas" element={<PlaceholderPage title="Ventas" description="Gestionar las ventas a clientes." />} />
          <Route path="/clientes/cobros" element={<PlaceholderPage title="Cobros" description="Registrar y administrar cobros." />} />
          <Route path="/clientes/notas" element={<PlaceholderPage title="Notas (Crédito / Débito)" description="Gestión de notas de crédito y débito de clientes." />} />
          <Route path="/clientes/remitos" element={<PlaceholderPage title="Remitos de Venta" description="Gestión de remitos de venta." />} />
          <Route path="/clientes/pedidos" element={<PlaceholderPage title="Pedidos de Venta" description="Administrar pedidos de venta pendientes." />} />
          <Route path="/clientes/cuenta-corriente" element={<PlaceholderPage title="Cuenta Corriente Clientes" description="Consultar saldos y movimientos de clientes." />} />

          {/* ── Proveedores ── */}
          <Route path="/proveedores" element={<PlaceholderPage title="Proveedores" description="Módulo de gestión integral de proveedores." />} />
          <Route path="/proveedores/alta" element={<PlaceholderPage title="Alta de Proveedores" description="Registrar nuevos proveedores en el sistema." />} />
          <Route path="/proveedores/compras" element={<PlaceholderPage title="Compras" description="Gestionar órdenes de compra a proveedores." />} />
          <Route path="/proveedores/pagos" element={<PlaceholderPage title="Pagos" description="Registrar pagos realizados a proveedores." />} />
          <Route path="/proveedores/notas" element={<PlaceholderPage title="Notas (Crédito / Débito)" description="Gestión de notas de crédito y débito de proveedores." />} />
          <Route path="/proveedores/remitos" element={<PlaceholderPage title="Remitos de Compra" description="Gestión de remitos de compra." />} />
          <Route path="/proveedores/cuenta-corriente" element={<PlaceholderPage title="Cuenta Corriente Proveedores" description="Consultar saldos y movimientos de proveedores." />} />

          {/* ── Finanzas ── */}
          <Route path="/finanzas" element={<PlaceholderPage title="Finanzas" description="Módulo de gestión financiera integral." />} />
          <Route path="/finanzas/cajas" element={<PlaceholderPage title="Cajas" description="Administrar cajas y movimientos de efectivo." />} />
          <Route path="/finanzas/bancos" element={<PlaceholderPage title="Bancos" description="Gestión de cuentas bancarias y conciliaciones." />} />
          <Route path="/finanzas/cheques" element={<PlaceholderPage title="Cheques" description="Control de cheques emitidos y recibidos." />} />
          <Route path="/finanzas/impuestos" element={<PlaceholderPage title="Impuestos" description="Gestión de impuestos y obligaciones fiscales." />} />
          <Route path="/finanzas/cuentas" element={<PlaceholderPage title="Cuentas por Cobrar / Pagar" description="Control de cuentas pendientes de cobro y pago." />} />
          <Route path="/finanzas/tarjetas" element={<PlaceholderPage title="Tarjetas de Crédito" description="Gestión de pagos con tarjetas de crédito." />} />
          <Route path="/finanzas/retenciones" element={<PlaceholderPage title="Retenciones y Percepciones" description="Administrar retenciones y percepciones impositivas." />} />

          {/* ── Productos y Servicios ── */}
          <Route path="/productos" element={<PlaceholderPage title="Productos y Servicios" description="Catálogo de productos y servicios." />} />
          <Route path="/productos/articulos" element={<PlaceholderPage title="Productos / Artículos (SKU)" description="Gestión del catálogo de artículos con SKU." />} />
          <Route path="/productos/rubros" element={<PlaceholderPage title="Rubros y Subrubros" description="Clasificación de productos por rubros." />} />
          <Route path="/productos/servicios" element={<PlaceholderPage title="Servicios" description="Gestión de servicios ofrecidos." />} />
          <Route path="/productos/variantes" element={<PlaceholderPage title="Variantes" description="Variantes de productos (talle, color, etc.)." />} />

          {/* ── Stock y Logística ── */}
          <Route path="/stock" element={<PlaceholderPage title="Stock y Logística" description="Gestión de inventario y logística." />} />
          <Route path="/stock/inventario" element={<PlaceholderPage title="Stock" description="Consultar existencias de stock." />} />
          <Route path="/stock/depositos" element={<PlaceholderPage title="Depósitos / Logística" description="Administrar depósitos y puntos logísticos." />} />
          <Route path="/stock/movimientos" element={<PlaceholderPage title="Movimientos de Stock" description="Historial de movimientos de inventario." />} />
          <Route path="/stock/ajustes" element={<PlaceholderPage title="Ajustes de Stock" description="Realizar ajustes de inventario." />} />

          {/* ── Importaciones ── */}
          <Route path="/importaciones" element={<PlaceholderPage title="Importaciones (Suba Masiva)" description="Carga masiva de datos al sistema." />} />
          <Route path="/importaciones/gestionar" element={<PlaceholderPage title="Gestionar Importaciones" description="Iniciar y configurar importaciones masivas." />} />
          <Route path="/importaciones/historial" element={<PlaceholderPage title="Historial de Importaciones" description="Consultar importaciones realizadas." />} />
          <Route path="/importaciones/saldos-clientes" element={<PlaceholderPage title="Saldos Clientes" description="Importar saldos iniciales de clientes." />} />
          <Route path="/importaciones/saldos-proveedores" element={<PlaceholderPage title="Saldos Proveedores" description="Importar saldos iniciales de proveedores." />} />

          {/* ── Reportes ── */}
          <Route path="/reportes" element={<PlaceholderPage title="Reportes" description="Centro de reportes y analytics." />} />
          <Route path="/reportes/ventas" element={<PlaceholderPage title="Reportes de Ventas" description="Análisis detallado de ventas." />} />
          <Route path="/reportes/compras" element={<PlaceholderPage title="Reportes de Compras" description="Análisis detallado de compras." />} />
          <Route path="/reportes/financieros" element={<PlaceholderPage title="Reportes Financieros" description="Estados financieros y balances." />} />
          <Route path="/reportes/impositivos" element={<PlaceholderPage title="Reportes Impositivos" description="Reportes de obligaciones fiscales." />} />
          <Route path="/reportes/inventario" element={<PlaceholderPage title="Reportes de Inventario" description="Análisis de stock e inventario." />} />
          <Route path="/reportes/cuentas-corrientes" element={<PlaceholderPage title="Reportes de Cuentas Corrientes" description="Estado de cuentas corrientes." />} />

          {/* ── Administración ── */}
          <Route path="/administracion" element={<PlaceholderPage title="Administración" description="Panel de administración del sistema." />} />
          <Route path="/administracion/usuarios" element={<PlaceholderPage title="Usuarios y Perfiles" description="Gestionar usuarios, roles y permisos." />} />
          <Route path="/administracion/sucursales" element={<PlaceholderPage title="Sucursales / Unidades de Negocio" description="Administrar sucursales y puntos de operación." />} />
          <Route path="/administracion/listas-precios" element={<PlaceholderPage title="Listas de Precios" description="Configurar listas de precios por canal." />} />
          <Route path="/administracion/parametros" element={<PlaceholderPage title="Parámetros del Sistema" description="Configuración general del sistema." />} />
          <Route path="/administracion/auditoria" element={<PlaceholderPage title="Auditoría" description="Registro de auditoría y trazabilidad." />} />

          {/* ── Configuración ── */}
          <Route path="/configuracion" element={<PlaceholderPage title="Configuración" description="Ajustes generales y preferencias del sistema." />} />

          {/* ── 404 ── */}
          <Route path="*" element={<PlaceholderPage title="Página no encontrada" description="La ruta solicitada no existe en el sistema." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
