import { LayoutDashboard } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description?: string
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="page-container">
      <div className="placeholder-page">
        <div className="placeholder-page-icon">
          <LayoutDashboard size={36} />
        </div>
        <h2>{title}</h2>
        <p>{description || 'Este módulo está en desarrollo. Pronto estará disponible.'}</p>
      </div>
    </div>
  )
}
