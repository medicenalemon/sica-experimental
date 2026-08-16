import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  // Simulamos la verificación de autenticación
  // En un entorno real, esto provendría de un Context, Redux, o token JWT.
  const isAuthenticated = localStorage.getItem('sica_isAuthenticated') === 'true';

  if (!isAuthenticated) {
    // Si no está autenticado, redirigir al login
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado, renderizar las rutas hijas
  return <Outlet />;
}
