export function statementsFixture(initialState){
 const state=initialState();state.settings.exerciseStart='2026-01-01';state.settings.exerciseEnd='2026-12-31';state.settings.name='SICA QA - ESTADOS CONTABLES';state.settings.closedUntil='';
 for(const [id,name,group]of [['1.1.9','Mercadería','Activo'],['1.2.1','Bienes de uso al costo','Activo'],['1.2.2','Depreciación acumulada','Activo'],['3.2','Resultados no asignados','Patrimonio neto'],['3.3','Reserva legal','Patrimonio neto'],['5.4','Costo de ventas','Gastos'],['5.9','Depreciación de bienes de uso','Gastos']])state.masters.accounts.push({id,code:id,name,group,postable:true})
 const entry=(id,date,concept,lines)=>state.entries.push({id,date,concept,branchId:'central',documentId:'',manual:true,lines:lines.map(([accountId,amount])=>({accountId,debit:Math.max(amount,0),credit:Math.max(-amount,0)}))})
 entry('opening','2025-12-31','Saldo anterior sintético',[['1.1.2',100000],['1.2.1',200000],['3.1',-300000]])
 entry('sale','2026-01-05','Venta sintética con IVA',[['1.1.3',121000],['4.1',-100000],['2.1.2',-21000]])
 entry('collection','2026-01-06','Cobro parcial sintético',[['1.1.2',100000],['1.1.3',-100000]])
 entry('purchase','2026-01-07','Mercadería sintética',[['1.1.9',60000],['1.1.4',12600],['2.1.1',-72600]])
 entry('payment','2026-01-08','Pago parcial sintético',[['2.1.1',40000],['1.1.2',-40000]])
 entry('cost','2026-01-09','Costo de venta sintético',[['5.4',30000],['1.1.9',-30000]])
 entry('depreciation','2026-01-10','Depreciación sintética',[['5.9',5000],['1.2.2',-5000]])
 entry('contribution','2026-01-11','Aporte sintético de propietarios',[['1.1.2',20000],['3.1',-20000]])
 entry('distribution','2026-01-12','Distribución sintética',[['3.2',10000],['1.1.2',-10000]])
 entry('reserve','2026-01-13','Asignación sintética a reserva',[['3.2',8000],['3.3',-8000]])
 entry('transfer','2026-01-14','Transferencia sintética banco a caja',[['1.1.1',10000],['1.1.2',-10000]])
 const actor={userId:'admin',name:'Administrador',role:'Administrador General',permissions:[]}
 return {state,actor}
}
export function statementsInput(state,domain,{from=state.settings.exerciseStart,to='2026-10-20',reference='Estados QA 2026'}={}){
 const sources=domain.statementSources(state,from,to),rubrics={'1.1.9':'ac-inventory','3.3':'eq-reserves','5.4':'ex-cogs'},cashAccounts=['1.1.1','1.1.2'],cashSet=new Set(cashAccounts)
 const allocations=sources.accounts.map(a=>({accountId:a.accountId,items:[{rubricId:rubrics[a.accountId]||domain.suggestedStatementRubric(a.accountId,a.group),amount:a.amount,noteId:a.group==='Patrimonio neto'?'equity':'criteria'}]}))
 const equityEntries=sources.periodEntries.filter(e=>e.lines.some(l=>state.masters.accounts.find(a=>a.id===l.accountId)?.group==='Patrimonio neto')).map(e=>({entryId:e.id,category:({contribution:'Aportes',distribution:'Retiros y distribuciones',reserve:'Asignaciones y transferencias'}[e.id]||'Otras variaciones'),noteId:'equity',reason:'Clasificación sintética según el asiento y su documentación de ensayo.'}))
 const cashLines=sources.periodEntries.flatMap(e=>e.lines.flatMap((l,lineIndex)=>cashSet.has(l.accountId)?[{entryId:e.id,lineIndex,parts:[{category:({collection:'op-customers',payment:'op-suppliers',contribution:'fin-receipts',distribution:'fin-payments',transfer:'transfer'}[e.id]||(l.debit?'op-other-receipts':'op-other-payments')),amount:l.debit-l.credit,noteId:'cash',reason:'Flujo sintético revisado según el asiento y respaldo de ensayo.'}]}]:[]))
 return {from,to,reference,reason:'Preparación sintética para verificar los cuatro estados, notas y conciliación con el diario.',classificationConfirmed:true,cashConfirmed:true,nominalConfirmed:true,allocations,cashAccounts,cashBasis:'Caja y depósitos bancarios a la vista, de libre disponibilidad; sin inversiones equivalentes ni efectivo restringido en esta prueba.',cashLines,equityEntries,notes:domain.requiredStatementNotes.map(n=>({...n,body:`Caso sintético de prueba. ${n.title}. Importes nominales de ensayo; pendiente reexpresión y revisión profesional para la entidad concreta.`})),priorPositionId:'',priorPeriodId:'',comparativeReason:'Primera preparación sintética de ensayo; comparativos todavía no incorporados.'}
}
