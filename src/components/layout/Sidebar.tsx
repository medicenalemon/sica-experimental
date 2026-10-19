import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import SicaLogo from '@/components/shared/SicaLogo'
import { navigation } from '@/navigation'
import { useStore } from '@/state/context'
import { canAccess } from '@/domain/permissions'
export default function Sidebar() {
 const {session}=useStore(),location=useLocation()
 const [collapsed,setCollapsed]=useState(false),[expanded,setExpanded]=useState('')
 const activeGroup=navigation.find(n=>n.path!=='/'&&location.pathname.startsWith(n.path))?.path||''
 return <aside className={`sidebar${collapsed?' collapsed':''}`}><NavLink to="/" className="sidebar-logo" aria-label="SICA — Ir al inicio"><SicaLogo background="dark" className="sidebar-logo-full"/><SicaLogo background="dark" compact className="sidebar-logo-symbol"/></NavLink><nav aria-label="Navegación principal" className="sidebar-nav sidebar-scroll">{navigation.map(n=>{
  const children=n.items.filter(([,p])=>canAccess(session,p)),Icon=n.icon,isActive=n.path==='/'?location.pathname==='/':location.pathname.startsWith(n.path)
  if(!children.length&&!canAccess(session,n.path))return null
  const opened=expanded===n.path||(!expanded&&activeGroup===n.path)
  return <div className="sidebar-section" key={n.path}>{n.items.length?<button className={`sidebar-item${isActive?' active':''}`} title={n.label} aria-label={n.label} aria-expanded={opened&&!collapsed} onClick={()=>{setCollapsed(false);setExpanded(opened?'closed':n.path)}}><span className="sidebar-item-icon"><Icon size={18}/></span><span className="sidebar-item-label">{n.label}</span><span className={`sidebar-item-chevron${opened?' expanded':''}`}><ChevronDown size={14}/></span></button>:<NavLink className={`sidebar-item${isActive?' active':''}`} title={n.label} aria-label={n.label} to={n.path}><span className="sidebar-item-icon"><Icon size={18}/></span><span className="sidebar-item-label">{n.label}</span></NavLink>}{opened&&!collapsed&&children.length>0&&<div className="sidebar-subitems">{children.map(([label,path])=><NavLink key={path} end className={({isActive})=>`sidebar-subitem${isActive?' active':''}`} to={path}>{label}</NavLink>)}</div>}</div>
 })}</nav><div className="sidebar-footnote">Versión experimental</div><button className="sidebar-collapse-btn" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'Expandir menú':'Colapsar menú'}>{collapsed?<ChevronRight size={18}/>:<ChevronLeft size={18}/>}</button></aside>
}
