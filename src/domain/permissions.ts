import type { Role, Session } from './types'

export function canAccess(session: Session | null, path: string): boolean {
  if (!session) return false
  if (path === '/' || ['/acerca-de','/herramientas'].some(p => path.startsWith(p))) return true
  if (session.role === 'Administrador General') return true
  if (path === '/stock/ajustes' || path.startsWith('/administracion') || path === '/configuracion' || path === '/onboarding') return false
  if (session.role === 'Administración') return ['/clientes', '/proveedores', '/finanzas', '/productos', '/stock', '/importaciones', '/reportes', '/contabilidad'].some(p => path.startsWith(p))
  if (session.role === 'Depósito') return ['/clientes/pedidos', '/clientes/remitos', '/proveedores/remitos', '/productos', '/stock/inventario', '/stock/depositos', '/stock/movimientos', '/stock/traslados','/stock/devoluciones'].some(p => path.startsWith(p))
  if (session.role === 'Producción') return ['/produccion', '/productos', '/proveedores/ordenes', '/stock/inventario', '/stock/movimientos'].some(p => path.startsWith(p))
  return session.permissions.some(p => path === p || path.startsWith(`${p}/`))
}
export function requireAdmin(role: Role) { if (role !== 'Administrador General') throw new Error('Esta operación requiere un Administrador General.') }
