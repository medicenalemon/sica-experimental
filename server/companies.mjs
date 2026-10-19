import {readFileSync,existsSync,realpathSync} from 'node:fs'
import {resolve} from 'node:path'

export function companyOptions(options){
 const entries=options.companies??[{...options,id:options.companyId||'sica',label:options.companyLabel||'Empresa principal'}]
 if(!Array.isArray(entries)||!entries.length||entries.length>50)throw new Error('Configurá entre una y cincuenta empresas.')
 const ids=new Set(),files=new Set(),keyFiles=new Set()
 const companies=entries.map(c=>{
  if(!c||typeof c.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(c.id)||ids.has(c.id))throw new Error('Cada empresa necesita un código único de hasta 64 letras minúsculas, números, guiones o guiones bajos.')
  const postgres=c.backend==='postgres'||c.databaseUrl!==undefined
  if(postgres&&(typeof c.databaseUrl!=='string'||!/^postgres(?:ql)?:\/\//.test(c.databaseUrl)))throw new Error('Cada empresa PostgreSQL necesita su variable de conexión configurada.')
  if(!postgres&&(typeof c.filename!=='string'||!c.filename.trim()))throw new Error('Cada empresa necesita su archivo de base de datos.')
  const filename=postgres?undefined:existsSync(c.filename)?realpathSync(c.filename):resolve(c.filename),label=c.label??c.id
  if(!postgres&&files.has(filename))throw new Error('Cada empresa de esta instalación debe usar un archivo de base de datos distinto.')
  const keyPath=c.auditKeyFile||`var/postgres/${c.id}.audit-key`,auditKeyFile=postgres?(existsSync(keyPath)?realpathSync(keyPath):resolve(keyPath)):undefined
  if(postgres&&keyFiles.has(auditKeyFile))throw new Error('Cada empresa PostgreSQL requiere su archivo de clave de auditoría exclusivo.')
  if(typeof label!=='string'||!label.trim()||label.length>160||Array.from(label).some(ch=>ch.charCodeAt(0)<32))throw new Error('Cada empresa necesita un nombre público de hasta 160 caracteres en una línea.')
  ids.add(c.id);if(postgres)keyFiles.add(auditKeyFile);else files.add(filename)
  return {...c,filename,...(postgres?{backend:'postgres',auditKeyFile}:{}),label:label.trim(),companyId:c.id}
 })
 const defaultId=options.companyId||companies[0].id
 if(!ids.has(defaultId))throw new Error('La empresa predeterminada debe estar en la configuración.')
 return {companies,defaultId}
}

export function loadCompanies(filename,environment=process.env){
 if(!filename)return undefined
 let rows;try{rows=JSON.parse(readFileSync(filename,'utf8'))}catch{throw new Error('No se pudo leer la configuración de empresas. Revisá el archivo JSON.')}
 if(!Array.isArray(rows)||!rows.length||rows.length>50)throw new Error('La configuración necesita una lista de una a cincuenta empresas.')
 const secret=name=>{if(name===undefined)return undefined;if(typeof name!=='string'||!/^[A-Z][A-Z0-9_]*$/.test(name))throw new Error('Las referencias de credenciales deben ser nombres de variables de entorno.');return environment[name]}
 return rows.map(c=>{
  if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('Configuración de empresa inválida.')
  if(c.driver!==undefined&&!['postgres','sqlite'].includes(c.driver))throw new Error('El driver de empresa debe ser postgres o sqlite.')
  if(c.adminPassword!==undefined||c.arca?.password!==undefined||c.databaseUrl!==undefined)throw new Error('Configurá las contraseñas mediante variables de entorno, fuera del archivo de empresas.')
  return {id:c.id,label:c.label,filename:c.database,...(c.driver==='postgres'?{backend:'postgres',databaseUrl:secret(c.databaseUrlEnv),auditKeyFile:c.auditKeyFile}:{}),adminPassword:secret(c.adminPasswordEnv),arca:{mode:c.arca?.mode||'disabled',cuit:c.arca?.cuit,certificate:c.arca?.certificate,key:c.arca?.key,password:secret(c.arca?.passwordEnv)||''}}
 })
}
