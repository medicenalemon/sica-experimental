import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useStore } from '@/state/context'
import { canAccess } from '@/domain/permissions'
export default function ProtectedRoute() {
 const {session,ready}=useStore(),location=useLocation()
 if(!ready)return <div className="access-denied" role="status">Conectando con SICA…</div>
 if(!session)return <Navigate to="/login" replace state={{from:location.pathname}}/>
 if(!canAccess(session,location.pathname))return <div className="access-denied"><h1>Acceso restringido</h1><p>Tu perfil no tiene permiso para esta sección.</p><Link className="button" to="/">Volver al inicio</Link></div>
 return <Outlet/>
}
