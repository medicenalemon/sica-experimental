export const ivaConditions = ['Responsable Inscripto', 'Responsable Monotributo', 'Exento', 'Consumidor Final', 'No Responsable', 'Liberado (Tierra del Fuego)', 'Responsable Inscripto RG', 'Responsable no Inscripto', 'Responsable no Identificado']
export const legacyIva = ['Responsable Inscripto RG', 'Responsable no Inscripto', 'Responsable no Identificado']
export const taxRates = ['21', '10.5', '27', '5', '2.5', '0', 'Exento', 'No gravado']
export const units = ['Unidad', 'Metro', 'Centímetro', 'Milímetro', 'Kilogramo', 'Gramo', 'Litro', 'Kilómetro', 'Docena', 'Caja']
export const provinces = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán']
export const roles = ['Administrador General', 'Administración', 'Depósito', 'Producción', 'Personalizado'] as const
export const paymentMethods = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Cheque', 'Tarjeta de crédito', 'Tarjeta de débito', 'Retención']
export const taxTypes = ['Ganancias', 'Ingresos Brutos', 'IVA', 'Seguridad Social']
export const categories = ['Alimentos y Bebidas', 'Electrónica y Tecnología', 'Ropa y Accesorios', 'Muebles y Decoración', 'Ferretería y Construcción', 'Vehículos y Repuestos', 'Higiene y Cuidado Personal', 'Juguetería y Juegos', 'Papelería', 'Agrícolas y Ganaderos', 'Químicos y Farmacéuticos', 'Deportivos y Entretenimiento', 'Consultoría', 'Marketing y Publicidad', 'Financieros', 'Salud y Bienestar', 'Educativos', 'Transporte y Logística', 'Tecnología', 'Legales y Jurídicos', 'Mantenimiento y Reparación', 'Entretenimiento y Ocio', 'Inmobiliarios', 'Turismo y Hospitalidad', 'Seguridad', 'Recursos Humanos', 'Belleza y Estética', 'Diseño y Arquitectura']
export const costCenters = ['Gastos estructurales', 'Gastos de producción', 'Materias primas', 'Producto terminado', 'Servicios industriales', 'Gastos administrativos', 'Sueldos de producción', 'Sueldos de administración']
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Tucuman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const money = (cents: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100)
export const dateLabel = (date: string) => date ? date.slice(0, 10).split('-').reverse().join('/') : '—'
export const cents = (value: string | number) => Math.round(Number(value) * 100)
export const uid = () => crypto.randomUUID()
