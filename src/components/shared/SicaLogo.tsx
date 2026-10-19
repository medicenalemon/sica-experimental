import blueLogo from '@/assets/sica-logo-blue.png'
import whiteLogo from '@/assets/sica-logo-white.png'

type SicaLogoProps = {
  background: 'light' | 'dark'
  compact?: boolean
  className?: string
}

export default function SicaLogo({ background, compact = false, className = '' }: SicaLogoProps) {
  const dark = background === 'dark'
  // Frame the supplied PNGs without their transparent margins. The compact
  // viewport shows the original symbol while keeping the source artwork intact.
  const viewBox = dark
    ? `168 174 ${compact ? 414 : 1444} 552`
    : `128 150 ${compact ? 440 : 1520} 590`

  return (
    <svg
      className={`sica-logo ${className}`}
      viewBox={viewBox}
      role="img"
      aria-label="SICA — Soluciones Integrales Contables Administrativas"
    >
      <image href={dark ? whiteLogo : blueLogo} width="1774" height="887" />
    </svg>
  )
}
