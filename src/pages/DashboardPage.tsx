import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.25rem',
        }}>
          Bienvenido a SICA
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Panel de control — Vista general del sistema
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem',
      }}>
        <StatCard
          label="Ventas del Mes"
          value="$2,450,000"
          change="+12.5%"
          positive
          icon={TrendingUp}
          color="var(--primary-500)"
          bgColor="var(--primary-50)"
          delay={0}
        />
        <StatCard
          label="Clientes Activos"
          value="384"
          change="+8"
          positive
          icon={Users}
          color="var(--success-600)"
          bgColor="var(--success-50)"
          delay={1}
        />
        <StatCard
          label="Compras del Mes"
          value="$1,120,000"
          change="-3.2%"
          positive={false}
          icon={DollarSign}
          color="var(--warning-600)"
          bgColor="var(--warning-50)"
          delay={2}
        />
        <StatCard
          label="Productos en Stock"
          value="1,256"
          change="+24"
          positive
          icon={Package}
          color="var(--info-600)"
          bgColor="var(--info-50)"
          delay={3}
        />
      </div>

      {/* Content Placeholder */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1.25rem',
      }}>
        <div className="card" style={{ animation: 'fadeIn 0.5s ease-out 0.3s both' }}>
          <div className="card-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={18} style={{ color: 'var(--primary-500)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Resumen de Operaciones</span>
            </div>
            <span style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              padding: '4px 10px',
              background: 'var(--surface-tertiary)',
              borderRadius: 'var(--radius-full)',
            }}>
              Últimos 30 días
            </span>
          </div>
          <div className="card-body" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}>
            Los gráficos estarán disponibles próximamente
          </div>
        </div>

        <div className="card" style={{ animation: 'fadeIn 0.5s ease-out 0.4s both' }}>
          <div className="card-header">
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Actividad Reciente</span>
          </div>
          <div className="card-body" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            {[
              { text: 'Nueva venta registrada #1024', time: 'Hace 5 min' },
              { text: 'Stock actualizado: Producto A', time: 'Hace 15 min' },
              { text: 'Pago recibido de Cliente X', time: 'Hace 1 hora' },
              { text: 'Orden de compra #502 creada', time: 'Hace 2 horas' },
              { text: 'Nuevo cliente registrado', time: 'Hace 3 horas' },
            ].map((activity, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: i < 4 ? '1px solid var(--border-light)' : 'none',
                }}
              >
                <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                  {activity.text}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── StatCard sub-component ── */

interface StatCardProps {
  label: string
  value: string
  change: string
  positive: boolean
  icon: React.ComponentType<{ size?: number }>
  color: string
  bgColor: string
  delay: number
}

function StatCard({ label, value, change, positive, icon: Icon, bgColor, delay }: StatCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem 1.5rem',
        animation: `fadeIn 0.4s ease-out ${delay * 0.1}s both`,
        cursor: 'default',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.5rem' }}>
            {label}
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {value}
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '0.5rem',
          }}>
            {positive ? (
              <ArrowUpRight size={14} style={{ color: 'var(--success-500)' }} />
            ) : (
              <ArrowDownRight size={14} style={{ color: 'var(--danger-500)' }} />
            )}
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: positive ? 'var(--success-600)' : 'var(--danger-600)',
            }}>
              {change}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>vs. mes anterior</span>
          </div>
        </div>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-lg)',
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}
