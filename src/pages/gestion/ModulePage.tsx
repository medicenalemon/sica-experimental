import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { navigation } from '@/navigation'
import { useStore } from '@/state/context'
import { canAccess } from '@/domain/permissions'
import { Page } from '@/components/gestion/UI'
export default function ModulePage({path}:{path:string}) {
 const {session}=useStore(),module=navigation.find(n=>n.path===path)!
 return <Page title={module.label} subtitle="Elegí una sección para registrar operaciones o consultar información."><div className="module-grid">{module.items.filter(([,p])=>p!==path&&canAccess(session,p)).map(([label,path])=><Link key={path} className="card module-link" to={path}><module.icon size={22}/><h2>{label}</h2><span>Ingresar<ArrowUpRight size={16}/></span></Link>)}</div></Page>
}
export function NotFound() {return <Page title="Página no encontrada" subtitle="La ruta solicitada no existe en SICA."><Link className="button" to="/">Volver al inicio</Link></Page>}
