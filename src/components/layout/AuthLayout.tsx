import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      {/* Lado izquierdo: Branding / Visual */}
      <div className="auth-branding">
        <div className="auth-branding-content">
          <div className="auth-logo-large">
            <span className="auth-version">Versión experimental</span>
          </div>
          <p className="auth-tagline">
            Soluciones Integrales Contables Administrativas. Conectá tus ventas, compras, finanzas, inventarios y contabilidad.
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
              <span>Gestión para empresas argentinas</span>
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
