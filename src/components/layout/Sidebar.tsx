import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Truck,
  DollarSign,
  Package,
  Warehouse,
  Upload,
  BarChart3,
  Settings,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronSubArrow,
  type LucideIcon,
} from 'lucide-react'

/* ══════════════════════════════════════════
   Types
   ══════════════════════════════════════════ */

interface SubItem {
  key: string
  label: string
  path: string
}

interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  iconClass: string
  path: string
  subItems?: SubItem[]
}

/* ══════════════════════════════════════════
   Navigation Data
   ══════════════════════════════════════════ */

const navItems: NavItem[] = [
  /* ── Inicio ── */
  {
    key: 'inicio',
    label: 'Inicio',
    icon: LayoutDashboard,
    iconClass: 'icon-inicio',
    path: '/',
  },

  /* ── Clientes ── */
  {
    key: 'clientes',
    label: 'Clientes',
    icon: Users,
    iconClass: 'icon-clientes',
    path: '/clientes',
    subItems: [
      { key: 'alta-clientes', label: 'Alta de Clientes', path: '/clientes/alta' },
      { key: 'ventas', label: 'Ventas', path: '/clientes/ventas' },
      { key: 'cobros', label: 'Cobros', path: '/clientes/cobros' },
      { key: 'notas-clientes', label: 'Notas (Crédito / Débito)', path: '/clientes/notas' },
      { key: 'remitos-venta', label: 'Remitos de Venta', path: '/clientes/remitos' },
      { key: 'pedidos-venta', label: 'Pedidos de Venta', path: '/clientes/pedidos' },
      { key: 'cta-cte-clientes', label: 'Cuenta Corriente Clientes', path: '/clientes/cuenta-corriente' },
    ],
  },

  /* ── Proveedores ── */
  {
    key: 'proveedores',
    label: 'Proveedores',
    icon: Truck,
    iconClass: 'icon-proveedores',
    path: '/proveedores',
    subItems: [
      { key: 'alta-proveedores', label: 'Alta de Proveedores', path: '/proveedores/alta' },
      { key: 'compras', label: 'Compras', path: '/proveedores/compras' },
      { key: 'pagos', label: 'Pagos', path: '/proveedores/pagos' },
      { key: 'notas-proveedores', label: 'Notas (Crédito / Débito)', path: '/proveedores/notas' },
      { key: 'remitos-compra', label: 'Remitos de Compra', path: '/proveedores/remitos' },
      { key: 'cta-cte-proveedores', label: 'Cuenta Corriente Proveedores', path: '/proveedores/cuenta-corriente' },
    ],
  },

  /* ── Finanzas ── */
  {
    key: 'finanzas',
    label: 'Finanzas',
    icon: DollarSign,
    iconClass: 'icon-finanzas',
    path: '/finanzas',
    subItems: [
      { key: 'cajas', label: 'Cajas', path: '/finanzas/cajas' },
      { key: 'bancos', label: 'Bancos', path: '/finanzas/bancos' },
      { key: 'cheques', label: 'Cheques', path: '/finanzas/cheques' },
      { key: 'impuestos', label: 'Impuestos', path: '/finanzas/impuestos' },
      { key: 'cuentas-cobrar-pagar', label: 'Cuentas por Cobrar / Pagar', path: '/finanzas/cuentas' },
      { key: 'tarjetas-credito', label: 'Tarjetas de Crédito', path: '/finanzas/tarjetas' },
      { key: 'retenciones-percepciones', label: 'Retenciones y Percepciones', path: '/finanzas/retenciones' },
    ],
  },

  /* ── Productos y Servicios ── */
  {
    key: 'productos',
    label: 'Productos y Servicios',
    icon: Package,
    iconClass: 'icon-productos',
    path: '/productos',
    subItems: [
      { key: 'articulos-sku', label: 'Productos / Artículos (SKU)', path: '/productos/articulos' },
      { key: 'rubros-subrubros', label: 'Rubros y Subrubros', path: '/productos/rubros' },
      { key: 'servicios', label: 'Servicios', path: '/productos/servicios' },
      { key: 'variantes', label: 'Variantes', path: '/productos/variantes' },
    ],
  },

  /* ── Stock y Logística ── */
  {
    key: 'stock',
    label: 'Stock y Logística',
    icon: Warehouse,
    iconClass: 'icon-stock',
    path: '/stock',
    subItems: [
      { key: 'stock-inventario', label: 'Stock', path: '/stock/inventario' },
      { key: 'depositos', label: 'Depósitos / Logística', path: '/stock/depositos' },
      { key: 'movimientos-stock', label: 'Movimientos de Stock', path: '/stock/movimientos' },
      { key: 'ajustes-stock', label: 'Ajustes de Stock', path: '/stock/ajustes' },
    ],
  },

  /* ── Importaciones (Suba Masiva) ── */
  {
    key: 'importaciones',
    label: 'Importaciones (Suba Masiva)',
    icon: Upload,
    iconClass: 'icon-importaciones',
    path: '/importaciones',
    subItems: [
      { key: 'gestionar-importaciones', label: 'Gestionar Importaciones', path: '/importaciones/gestionar' },
      { key: 'historial-importaciones', label: 'Historial de Importaciones', path: '/importaciones/historial' },
      { key: 'saldos-clientes', label: 'Saldos Clientes', path: '/importaciones/saldos-clientes' },
      { key: 'saldos-proveedores', label: 'Saldos Proveedores', path: '/importaciones/saldos-proveedores' },
    ],
  },

  /* ── Reportes ── */
  {
    key: 'reportes',
    label: 'Reportes',
    icon: BarChart3,
    iconClass: 'icon-reportes',
    path: '/reportes',
    subItems: [
      { key: 'reportes-ventas', label: 'Ventas', path: '/reportes/ventas' },
      { key: 'reportes-compras', label: 'Compras', path: '/reportes/compras' },
      { key: 'reportes-financieros', label: 'Financieros', path: '/reportes/financieros' },
      { key: 'reportes-impositivos', label: 'Impositivos', path: '/reportes/impositivos' },
      { key: 'reportes-inventario', label: 'Inventario', path: '/reportes/inventario' },
      { key: 'reportes-ctas-ctes', label: 'Cuentas Corrientes', path: '/reportes/cuentas-corrientes' },
    ],
  },

  /* ── Administración ── */
  {
    key: 'administracion',
    label: 'Administración',
    icon: Settings,
    iconClass: 'icon-admin',
    path: '/administracion',
    subItems: [
      { key: 'usuarios-perfiles', label: 'Usuarios y Perfiles', path: '/administracion/usuarios' },
      { key: 'sucursales', label: 'Sucursales / Unidades de Negocio', path: '/administracion/sucursales' },
      { key: 'listas-precios', label: 'Listas de Precios', path: '/administracion/listas-precios' },
      { key: 'parametros-sistema', label: 'Parámetros del Sistema', path: '/administracion/parametros' },
      { key: 'auditoria', label: 'Auditoría', path: '/administracion/auditoria' },
    ],
  },

  /* ── Configuración ── */
  {
    key: 'configuracion',
    label: 'Configuración',
    icon: SlidersHorizontal,
    iconClass: 'icon-config',
    path: '/configuracion',
  },
]

/* ══════════════════════════════════════════
   Sidebar Component
   ══════════════════════════════════════════ */

export default function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const toggleSubmenu = (key: string) => {
    setExpandedMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const isItemActive = (item: NavItem) => {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <BarChart3 size={22} />
        </div>
        <div className="sidebar-logo-text">
          <h1>SICA</h1>
          <span>Sistema Integral de Gestión</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav sidebar-scroll">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = isItemActive(item)
          const hasSubItems = item.subItems && item.subItems.length > 0
          const isExpanded = expandedMenus.includes(item.key)

          return (
            <div key={item.key} className="sidebar-section">
              {hasSubItems ? (
                /* ── Parent with sub-menu ── */
                <button
                  className={`sidebar-item${isActive ? ' active' : ''}`}
                  onClick={() => toggleSubmenu(item.key)}
                >
                  <span className={`sidebar-item-icon ${item.iconClass}`}>
                    <Icon size={18} />
                  </span>
                  <span className="sidebar-item-label">{item.label}</span>
                  <span className={`sidebar-item-chevron${isExpanded ? ' expanded' : ''}`}>
                    <ChevronDown size={14} />
                  </span>

                  {/* Tooltip (collapsed mode) */}
                  <span className="sidebar-tooltip">{item.label}</span>
                </button>
              ) : (
                /* ── Simple NavLink ── */
                <NavLink
                  to={item.path}
                  className={`sidebar-item${isActive ? ' active' : ''}`}
                >
                  <span className={`sidebar-item-icon ${item.iconClass}`}>
                    <Icon size={18} />
                  </span>
                  <span className="sidebar-item-label">{item.label}</span>

                  {/* Tooltip (collapsed mode) */}
                  <span className="sidebar-tooltip">{item.label}</span>
                </NavLink>
              )}

              {/* ── Sub-items ── */}
              {hasSubItems && isExpanded && !collapsed && (
                <div className="sidebar-subitems">
                  {item.subItems!.map((sub) => {
                    const isSubActive = location.pathname === sub.path

                    return (
                      <NavLink
                        key={sub.key}
                        to={sub.path}
                        className={`sidebar-subitem${isSubActive ? ' active' : ''}`}
                      >
                        <span>{sub.label}</span>
                        <span className="sidebar-subitem-arrow">
                          <ChevronSubArrow size={12} />
                        </span>
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Collapse toggle ── */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  )
}
