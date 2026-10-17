import type { Master, State, Session } from './types'
import { canAccess } from './permissions'

const aliases:Record<string,string[]>={'00011':['Banco de la Nación Argentina'],'00285':['Banco Macro'],'00007':['Banco Galicia']}
const legacyIds:Record<string,string>={'00011':'nacion','00285':'macro','00007':'galicia'}
const normalizedName=(name:unknown)=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase()
export function bankCode(value:unknown):string {
 if(value===undefined||value===null||String(value).trim()==='')return ''
 const raw=String(value).trim()
 if(!/^\d{1,5}$/.test(raw)||Number(raw)===0)throw new Error('El código de entidad debe contener entre 1 y 5 dígitos y ser mayor que cero.')
 return raw.padStart(5,'0')
}
export function validateBanks(banks:Master[]) {
 const ids=new Set<string>(),codes=new Set<string>()
 for(const bank of banks){const code=bankCode(bank.code);if(!bank.id||ids.has(bank.id)||!String(bank.name||'').trim())throw new Error('Identificadores o nombres de entidades financieras inválidos.');ids.add(bank.id);if(code&&codes.has(code))throw new Error('El código de entidad financiera ya existe.');if(code)codes.add(code)}
}
export function validateBankEdit(state:State,item:Master) {
 const code=bankCode(item.code),old=state.masters.banks.find(b=>b.id===item.id)
 if(old&&bankCode(old.code)&&bankCode(old.code)!==code&&(state.cheques.some(c=>c.bank===item.id)||state.masters.treasury.some(t=>t.bank===item.id)))throw new Error('La entidad vinculada a cuentas o cheques conserva su código. Creá otra entidad para un banco distinto.')
 const candidate={...item,code};validateBanks([...state.masters.banks.filter(b=>b.id!==item.id),candidate]);item.code=code
 if(old&&bankCode(old.code)!==code){delete item.bcraName;delete item.bcraConsulted;delete item.bcraPublished}
}
export function bankCatalogPlan(banks:Master[]) {
 validateBanks(banks)
 const next=banks.map(b=>({...b})),added:Master[]=[],updated:Master[]=[]
 for(const official of bankCatalog){
  let candidates=next.filter(b=>bankCode(b.code)===official.code)
  if(!candidates.length)candidates=next.filter(b=>!bankCode(b.code)&&[official.name,...(aliases[official.code]||[])].some(name=>normalizedName(b.name)===normalizedName(name)))
  if(candidates.length>1)throw new Error(`Hay varias entidades sin código que coinciden con ${official.name}. Revisá sus códigos antes de incorporar el catálogo.`)
  const metadata={code:official.code,bcraName:official.name,bcraConsulted:bankCatalogInfo.consulted,bcraPublished:bankCatalogInfo.published}
  if(candidates.length){const old=candidates[0],index=next.findIndex(b=>b.id===old.id),replacement={...old,...metadata};if(Object.entries(metadata).some(([k,v])=>old[k]!==v)){next[index]=replacement;updated.push(replacement)}}
  else {const id=legacyIds[official.code]||`bcra-${official.code}`;if(next.some(b=>b.id===id))throw new Error(`El identificador ${id} pertenece a otra entidad. Revisá el catálogo existente.`);const bank={id,name:official.name,...metadata};next.push(bank);added.push(bank)}
 }
 validateBanks(next);return {banks:next,added,updated,retained:banks.filter(b=>!updated.some(u=>u.id===b.id))}
}
export function updateBankCatalog(state:State,actor:Session) {
 if(!canAccess(actor,'/finanzas/entidades'))throw new Error('Tu perfil no permite gestionar entidades financieras.')
 const plan=bankCatalogPlan(state.masters.banks)
 if(!plan.added.length&&!plan.updated.length)throw new Error('El catálogo del BCRA ya está incorporado.')
 state.masters.banks=plan.banks
 return `${plan.added.length} altas y ${plan.updated.length} actualizaciones; BCRA ${bankCatalogInfo.published}, consulta ${bankCatalogInfo.consulted}`
}
export function initialBanks():Master[]{return bankCatalogPlan([]).banks}

// Copia del directorio público del BCRA; las denominaciones se conservan tal como fueron recibidas.
export const bankCatalogInfo = {
  "consulted": "2026-10-08",
  "published": "julio de 2026",
  "source": "https://www.bcra.gob.ar/entidades-financieras/",
  "endpoint": "https://www.bcra.gob.ar/api/endpoints/entidades-financieras.php?action=list&lang=es",
  "sha256": "37d830e03fcf13dd987ec2886769b58724161f513409939550958ea8e0c0093f",
  "count": 73
} as const
export const bankCatalog:ReadonlyArray<{code:string;name:string}> = [
  {
    "code": "00340",
    "name": "BACS BANCO DE CREDITO Y SECURITIZAC"
  },
  {
    "code": "00017",
    "name": "BANCO BBVA ARGENTINA S.A."
  },
  {
    "code": "00426",
    "name": "BANCO BICA S.A."
  },
  {
    "code": "00331",
    "name": "BANCO CETELEM ARGENTINA S.A."
  },
  {
    "code": "00319",
    "name": "BANCO CMF S.A."
  },
  {
    "code": "00431",
    "name": "BANCO COINAG S.A."
  },
  {
    "code": "00389",
    "name": "BANCO COLUMBIA S.A."
  },
  {
    "code": "00299",
    "name": "BANCO COMAFI SOCIEDAD ANONIMA"
  },
  {
    "code": "00191",
    "name": "BANCO CREDICOOP COOPERATIVO LIMITAD"
  },
  {
    "code": "00432",
    "name": "BANCO DE COMERCIO S.A."
  },
  {
    "code": "00094",
    "name": "BANCO DE CORRIENTES S.A."
  },
  {
    "code": "00315",
    "name": "BANCO DE FORMOSA S.A."
  },
  {
    "code": "00007",
    "name": "BANCO DE GALICIA Y BUENOS AIRES S.A"
  },
  {
    "code": "00300",
    "name": "BANCO DE INVERSION Y COMERCIO EXTER"
  },
  {
    "code": "00029",
    "name": "BANCO DE LA CIUDAD DE BUENOS AIRES"
  },
  {
    "code": "00011",
    "name": "BANCO DE LA NACION ARGENTINA"
  },
  {
    "code": "00093",
    "name": "BANCO DE LA PAMPA SA"
  },
  {
    "code": "00014",
    "name": "BANCO DE LA PROVINCIA DE BUENOS AIR"
  },
  {
    "code": "00020",
    "name": "BANCO DE LA PROVINCIA DE CORDOBA S."
  },
  {
    "code": "00269",
    "name": "BANCO DE LA REPUBLICA ORIENTAL DEL "
  },
  {
    "code": "00045",
    "name": "BANCO DE SAN JUAN S.A."
  },
  {
    "code": "00086",
    "name": "BANCO DE SANTA CRUZ S.A."
  },
  {
    "code": "00321",
    "name": "BANCO DE SANTIAGO DEL ESTERO S.A."
  },
  {
    "code": "00332",
    "name": "BANCO DE SERVICIOS FINANCIEROS CARR"
  },
  {
    "code": "00338",
    "name": "BANCO DE SERVICIOS Y TRANSACCIONES "
  },
  {
    "code": "00198",
    "name": "BANCO DE VALORES S.A."
  },
  {
    "code": "00083",
    "name": "BANCO DEL CHUBUT S.A."
  },
  {
    "code": "00310",
    "name": "BANCO DEL SOL S.A."
  },
  {
    "code": "00448",
    "name": "BANCO DINO S.A."
  },
  {
    "code": "00044",
    "name": "BANCO HIPOTECARIO S.A."
  },
  {
    "code": "00322",
    "name": "BANCO INDUSTRIAL S.A."
  },
  {
    "code": "00305",
    "name": "BANCO JULIO SOCIEDAD ANONIMA"
  },
  {
    "code": "00285",
    "name": "BANCO MACRO S.A."
  },
  {
    "code": "00254",
    "name": "BANCO MARIVA S.A."
  },
  {
    "code": "00341",
    "name": "BANCO MASVENTAS S.A."
  },
  {
    "code": "00281",
    "name": "BANCO MERIDIAN S.A."
  },
  {
    "code": "00065",
    "name": "BANCO MUNICIPAL DE ROSARIO"
  },
  {
    "code": "00034",
    "name": "BANCO PATAGONIA S.A."
  },
  {
    "code": "00301",
    "name": "BANCO PIANO S.A."
  },
  {
    "code": "00268",
    "name": "BANCO PROVINCIA DE TIERRA DEL FUEGO"
  },
  {
    "code": "00097",
    "name": "BANCO PROVINCIA DEL NEUQUÉN SOCIEDA"
  },
  {
    "code": "00309",
    "name": "BANCO RIOJA SOCIEDAD ANONIMA UNIPER"
  },
  {
    "code": "00247",
    "name": "BANCO ROELA S.A."
  },
  {
    "code": "00277",
    "name": "BANCO SAENZ S.A."
  },
  {
    "code": "00072",
    "name": "BANCO SANTANDER ARGENTINA S.A."
  },
  {
    "code": "00435",
    "name": "BANCO SUCREDITO REGIONAL S.A.U."
  },
  {
    "code": "00027",
    "name": "BANCO SUPERVIELLE S.A."
  },
  {
    "code": "00312",
    "name": "BANCO VOII S.A."
  },
  {
    "code": "00131",
    "name": "BANK OF CHINA LIMITED SUCURSAL BUEN"
  },
  {
    "code": "00147",
    "name": "BIBANK S.A."
  },
  {
    "code": "00266",
    "name": "BNP PARIBAS"
  },
  {
    "code": "00143",
    "name": "BRUBANK S.A.U."
  },
  {
    "code": "00016",
    "name": "CITIBANK N.A."
  },
  {
    "code": "44077",
    "name": "COMPAÑIA FINANCIERA ARGENTINA S.A."
  },
  {
    "code": "65203",
    "name": "CRÉDITO REGIONAL COMPAÑÍA FINANCIER"
  },
  {
    "code": "44092",
    "name": "FCA COMPAÑIA FINANCIERA S.A."
  },
  {
    "code": "44093",
    "name": "GPAT COMPAÑIA FINANCIERA S.A.U."
  },
  {
    "code": "00015",
    "name": "INDUSTRIAL AND COMMERCIAL BANK OF C"
  },
  {
    "code": "44096",
    "name": "JOHN DEERE CREDIT COMPAÑÍA FINANCIE"
  },
  {
    "code": "00165",
    "name": "JPMORGAN CHASE BANK, NATIONAL ASSOC"
  },
  {
    "code": "44094",
    "name": "MERCEDES-BENZ COMPAÑÍA FINANCIERA A"
  },
  {
    "code": "45056",
    "name": "MONTEMAR COMPAÑIA FINANCIERA S.A."
  },
  {
    "code": "45030",
    "name": "NARANJA DIGITAL COMPAÑÍA FINANCIERA"
  },
  {
    "code": "00386",
    "name": "NUEVO BANCO DE ENTRE RÍOS S.A."
  },
  {
    "code": "00330",
    "name": "NUEVO BANCO DE SANTA FE SOCIEDAD AN"
  },
  {
    "code": "00311",
    "name": "NUEVO BANCO DEL CHACO S. A."
  },
  {
    "code": "44098",
    "name": "PSA FINANCE ARGENTINA COMPAÑÍA FINA"
  },
  {
    "code": "00339",
    "name": "RCI BANQUE S.A."
  },
  {
    "code": "45072",
    "name": "REBA COMPAÑIA FINANCIERA S.A."
  },
  {
    "code": "44095",
    "name": "ROMBO COMPAÑÍA FINANCIERA S.A."
  },
  {
    "code": "44099",
    "name": "TOYOTA COMPAÑÍA FINANCIERA DE ARGEN"
  },
  {
    "code": "00384",
    "name": "UALA BANK S.A.U."
  },
  {
    "code": "44088",
    "name": "VOLKSWAGEN FINANCIAL SERVICES COMPA"
  }
]
