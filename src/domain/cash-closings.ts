import {withinExerciseHistory} from './exercise-calendar'
import type {State,Session,CashClosingInput,CashClosing} from './types'
import {assertDate,transferTreasury} from './engine'
import {sumMoney,treasuryBalance} from './treasury-model'
import {canAccess} from './permissions'
import {uid} from './constants'

export function closeCash(state:State,input:CashClosingInput,actor:Session):CashClosing {
 if(!canAccess(actor,'/finanzas/cajas'))throw new Error('Tu perfil no permite cerrar cajas.')
 assertDate(state,input.date)
 if(typeof input.reference!=='string'||!input.reference.trim()||input.reference.trim().length>100||(state.cashClosings||[]).some(c=>c.reference.toLowerCase()===input.reference.trim().toLowerCase()))throw new Error('Indicá una referencia única de cierre de hasta 100 caracteres.')
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)throw new Error('Indicá un motivo de cierre de hasta 1000 caracteres.')
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100||new Set(input.lines.map(l=>l.fromId)).size!==input.lines.length)throw new Error('El cierre necesita entre 1 y 100 cajas distintas.')
 const sources=new Set(input.lines.map(l=>l.fromId))
 const lines=input.lines.map(l=>{
  const from=state.masters.treasury.find(t=>t.id===l.fromId),to=state.masters.treasury.find(t=>t.id===l.toId)
  if(!from||from.type!=='Caja'||from.active===false||!state.masters.branches.some(b=>b.id===from.branchId&&b.active))throw new Error('Seleccioná cajas existentes de sucursales activas.')
  if(!Number.isSafeInteger(l.amount)||l.amount<0||l.counted!==undefined&&(!Number.isSafeInteger(l.counted)||l.counted<0))throw new Error('Los importes de retiro y arqueo deben ser centavos no negativos.')
  const balanceBefore=treasuryBalance(state,from.id,input.date)
  if(!Number.isSafeInteger(l.expectedBalance)||l.expectedBalance!==balanceBefore)throw new Error('El saldo cambió o falta la revisión. Revisá nuevamente el cierre.')
  if(balanceBefore<0||l.amount>balanceBefore||(l.counted!==undefined&&l.amount>l.counted))throw new Error(`El retiro supera el saldo de ${from.name} a la fecha de cierre.`)
  if(l.amount>0&&(!to||to.active===false||to.branchId!==from.branchId||sources.has(to.id)))throw new Error('El destino del retiro debe pertenecer a la misma sucursal y estar fuera de las cajas seleccionadas.')
  if((state.cashClosings||[]).some(c=>c.date>input.date&&c.lines.some(line=>line.fromId===from.id)))throw new Error('El cierre debe respetar el orden de fechas de cada caja.')
  const movementIds=state.treasuryMoves.filter(m=>m.treasuryId===from.id&&m.date<=input.date).map(m=>m.id)
  return {id:uid(),fromId:from.id,fromName:String(from.name),branchId:String(from.branchId),fromAccountId:String(from.accountId),toId:l.amount>0?to!.id:'',toName:l.amount>0?String(to!.name):'',toAccountId:l.amount>0?String(to!.accountId):'',amount:l.amount,balanceBefore,balanceAfter:balanceBefore-l.amount,movementIds,...(l.counted!==undefined?{counted:l.counted,difference:l.counted-balanceBefore}:{})}
 })
 const next=(state.cashClosings||[]).reduce((n,c)=>Math.max(n,Number(c.number.slice(7))||0),0)+1
 if(next>99_999_999)throw new Error('Se agotó la numeración de cierres internos.')
 const closing:CashClosing={id:uid(),number:`INT-CC-${String(next).padStart(8,'0')}`,reference:input.reference.trim(),date:input.date,reason:input.reason.trim(),responsible:actor.name,createdAt:new Date().toISOString(),total:sumMoney(lines.map(l=>l.amount)),lines}
 // Validate each withdrawal in a draft; a failure in any cash box preserves the whole batch.
 const draft=structuredClone(state)
 for(const line of closing.lines)if(line.amount>0){
  line.transferId=transferTreasury(draft,line.fromId,line.toId,line.amount,closing.date,`${closing.number} · ${closing.reason}`)
  for(const m of draft.treasuryMoves.filter(m=>m.documentId===line.transferId)){m.cashClosingId=closing.id;m.cashClosingLineId=line.id}
 }
 ;(draft.cashClosings??=[]).push(closing)
 state.treasuryMoves=draft.treasuryMoves;state.entries=draft.entries;state.cashClosings=draft.cashClosings
 return closing
}

export function validateCashClosings(state:State){
 const fail=()=>{throw new Error('La copia contiene cierres de caja o movimientos vinculados inconsistentes.')}
 if(state.cashClosings!==undefined&&!Array.isArray(state.cashClosings))fail()
 const closings=state.cashClosings||[],ids=new Set(closings.map(c=>c.id)),numbers=new Set(closings.map(c=>c.number)),references=new Set(closings.map(c=>String(c.reference).toLowerCase()))
 const transfers=closings.flatMap(c=>Array.isArray(c.lines)?c.lines.filter(l=>l.transferId).map(l=>l.transferId):[])
 if(new Set(transfers).size!==transfers.length)fail()
 if(ids.size!==closings.length||numbers.size!==closings.length||references.size!==closings.length)fail()
 if(state.treasuryMoves.some(m=>(m.cashClosingId!==undefined&&!ids.has(m.cashClosingId))||(m.cashClosingLineId!==undefined&&!m.cashClosingId)))fail()
 for(const c of closings){
  if(typeof c.id!=='string'||!c.id||!/^INT-CC-\d{8}$/.test(c.number)||Number(c.number.slice(7))<1||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||Number.isNaN(Date.parse(c.date))||new Date(`${c.date}T12:00:00Z`).toISOString().slice(0,10)!==c.date||!withinExerciseHistory(state,c.date)||![c.reference,c.reason,c.responsible,c.createdAt].every(s=>typeof s==='string'&&s.trim())||!Array.isArray(c.lines)||!c.lines.length||c.lines.length>100||new Set(c.lines.map(l=>l.fromId)).size!==c.lines.length||new Set(c.lines.map(l=>l.id)).size!==c.lines.length)fail()
  const sources=new Set(c.lines.map(l=>l.fromId)),allMoves=state.treasuryMoves.filter(m=>m.cashClosingId===c.id)
  if(allMoves.length!==c.lines.filter(l=>l.amount>0).length*2)fail()
  for(const l of c.lines){
   const from=state.masters.treasury.find(t=>t.id===l.fromId),to=state.masters.treasury.find(t=>t.id===l.toId)
   if(typeof l.id!=='string'||!l.id||!from||from.type!=='Caja'||from.branchId!==l.branchId||from.accountId!==l.fromAccountId||![l.fromName,l.branchId,l.fromAccountId].every(s=>typeof s==='string'&&s.trim())||![l.amount,l.balanceBefore,l.balanceAfter].every(n=>Number.isSafeInteger(n)&&n>=0)||l.balanceBefore-l.amount!==l.balanceAfter||!Array.isArray(l.movementIds)||new Set(l.movementIds).size!==l.movementIds.length||l.movementIds.some(id=>typeof id!=='string'||!id))fail()
   const original=l.movementIds.map(id=>state.treasuryMoves.find(m=>m.id===id))
   if(original.some(m=>!m||m.treasuryId!==l.fromId||m.date>c.date||m.cashClosingId===c.id)||sumMoney(original.map(m=>m!.amount))!==l.balanceBefore)fail()
   if(l.counted!==undefined&&(!Number.isSafeInteger(l.counted)||l.counted<l.amount||l.counted-l.balanceBefore!==l.difference)||l.counted===undefined&&l.difference!==undefined)fail()
   const moves=allMoves.filter(m=>m.cashClosingLineId===l.id)
   if(l.amount===0){if(moves.length||l.transferId||l.toId||l.toName||l.toAccountId)fail();continue}
   if(!to||to.branchId!==l.branchId||to.accountId!==l.toAccountId||sources.has(l.toId)||typeof l.toName!=='string'||!l.toName.trim()||typeof l.transferId!=='string'||!l.transferId||moves.length!==2)fail()
   for(const [id,amount] of [[l.fromId,-l.amount],[l.toId,l.amount]] as const)if(moves.filter(m=>m.treasuryId===id&&m.amount===amount&&m.date===c.date&&m.branchId===l.branchId&&m.documentId===l.transferId).length!==1)fail()
   const entries=state.entries.filter(e=>e.documentId===l.transferId)
   if(entries.length!==1||entries[0].date!==c.date||entries[0].branchId!==l.branchId||entries[0].lines.length!==2||!entries[0].lines.some(e=>e.accountId===l.fromAccountId&&e.credit===l.amount&&e.debit===0)||!entries[0].lines.some(e=>e.accountId===l.toAccountId&&e.debit===l.amount&&e.credit===0))fail()
  }
  if(c.total!==sumMoney(c.lines.map(l=>l.amount)))fail()
 }
}
