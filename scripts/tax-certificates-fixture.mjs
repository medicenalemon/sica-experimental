import {taxMovementsFixture} from './tax-movements-fixture.mjs'
export function taxCertificateFixture(dependencies,{reviewedOn='2026-10-17'}={}){
 const f=taxMovementsFixture(dependencies),links=[1,2].map(index=>({rowId:`document:${f.receipt.id}:withholding:${index}`,reason:''}))
 const input={from:'2026-09-01',to:'2026-09-30',reviewedOn,previousId:'',reference:'CERT-COMPARISON-1',reason:'Comparación de ensayo contra respaldo sintético conservado por el operador.',evidence:{origin:'Certificado recibido',number:'CERT-SHARED',date:'2026-09-05',regime:'Régimen de retención de ensayo',type:'Retención',effect:'Sufrida',tax:'Ingresos Brutos',jurisdiction:'Tucumán',agentCuit:f.customer.cuit,agentName:f.customer.name,subjectCuit:f.state.settings.cuit,subjectName:f.state.settings.name,amount:250,state:'Informado como vigente',sourceReference:'Respaldo sintético de ensayo; no utilizar como certificado real.',fileName:'',sha256:''},links,confirmed:true}
 return {...f,input,actor:{userId:'admin',name:'Revisor de certificados',role:'Administrador General',permissions:[]}}
}
