import { useState } from 'react'
import { Page, Panel, Field, Metric } from '@/components/gestion/UI'
import { money } from '@/domain/constants'
export default function ToolsPage() {
 const [a,setA]=useState(0),[b,setB]=useState(0),[op,setOp]=useState('+'),[vat,setVat]=useState(21)
 const result=op==='+'?a+b:op==='−'?a-b:op==='×'?a*b:b?a/b:NaN
 return <Page title="Calculadora" subtitle="Operaciones y cálculo de IVA para verificar importes."><Panel title="Cálculo"><div className="form-grid three"><Field label="Primer valor"><input type="number" step="any" value={a} onChange={e=>setA(Number(e.target.value))}/></Field><Field label="Operación"><select value={op} onChange={e=>setOp(e.target.value)}>{['+','−','×','÷'].map(o=><option key={o}>{o}</option>)}</select></Field><Field label="Segundo valor"><input type="number" step="any" value={b} onChange={e=>setB(Number(e.target.value))}/></Field></div><Metric label="Resultado" value={Number.isFinite(result)?new Intl.NumberFormat('es-AR',{maximumFractionDigits:6}).format(result):'No se puede dividir por cero'}/></Panel><Panel title="IVA sobre el primer valor"><Field label="Alícuota"><select value={vat} onChange={e=>setVat(Number(e.target.value))}>{[0,2.5,5,10.5,21,27].map(v=><option key={v} value={v}>{v}%</option>)}</select></Field><div className="metrics-grid"><Metric label="IVA sobre neto" value={money(Math.round(a*vat))}/><Metric label="Total con IVA" value={money(Math.round(a*100*(1+vat/100)))}/><Metric label="Neto desde bruto" value={money(Math.round(a*100/(1+vat/100)))}/></div></Panel></Page>
}
