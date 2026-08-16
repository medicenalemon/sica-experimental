import { Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      {/* Lado izquierdo: Branding / Visual */}
      <div className="auth-branding">
        <div className="auth-branding-content">
          <div className="auth-logo-large">
            <div className="auth-logo-icon">
              <ShieldCheck size={48} strokeWidth={1.5} />
            </div>
            <h1>SICA ERP</h1>
            <span className="auth-version">v2.0 Enterprise</span>
          </div>
          <p className="auth-tagline">
            Sistema Integral Contable Administrativo. Gestiona tus finanzas, stock y operaciones desde una única plataforma inteligente.
          </p>
          
          <div className="auth-features">
            <div className="auth-feature-item">
              <div className="feature-dot"></div>
              <span>Control total de tu negocio</span>
            </div>
            <div className="auth-feature-item">
              <div className="feature-dot"></div>
              <span>Métricas en tiempo real</span>
            </div>
            <div className="auth-feature-item">
              <div className="feature-dot"></div>
              <span>Máxima seguridad y encriptación</span>
            </div>
          </div>
        </div>
        <div className="auth-branding-overlay"></div>
      </div>

      {/* Lado derecho: Formulario */}
      <div className="auth-form-container">
        <div className="auth-form-wrapper">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
