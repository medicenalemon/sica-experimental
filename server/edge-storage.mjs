import {randomBytes,createHmac} from 'node:crypto'
import {exportPostgresCompany} from './postgres-backup.mjs'

export const edgeBucket='sica-private'
export function edgeStorage({url,key,fetch:request=fetch}){
 if(!url||!key)throw new Error('Storage no configurado.')
 const headers={apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})}
 const endpoint=path=>`${url}/storage/v1/object/${edgeBucket}/${path.split('/').map(encodeURIComponent).join('/')}`
 async function get(path){const response=await request(endpoint(path),{headers});if(response.status===404)return null;if(!response.ok){const result=await response.json().catch(()=>({}));if(String(result.statusCode)==='404')return null;throw new Error('No se pudo leer Storage privado.')}return new Uint8Array(await response.arrayBuffer())}
 async function put(path,bytes,type='application/octet-stream'){
  const response=await request(endpoint(path),{method:'POST',headers:{...headers,'Content-Type':type,'x-upsert':'false'},body:bytes})
  if(response.ok)return true
  // Storage returns either HTTP 409 or a JSON statusCode for duplicate objects.
  const result=await response.json().catch(()=>({}))
  if(response.status===409||String(result.statusCode)==='409'||result.error==='Duplicate')return false
  throw new Error('No se pudo escribir Storage privado.')
 }
 let backedUpDay=''
 async function backup(repository,{daily=false}={}){
  const day=new Date().toISOString().slice(0,10),marker=`backups/${repository.companyId}/daily/${day}.json`
  if(daily&&(backedUpDay===day||await get(marker))){backedUpDay=day;return {daily:true,alreadyStored:true}}
  const payload=JSON.stringify(await exportPostgresCompany(repository)),signature=createHmac('sha256',repository.key).update('sica-postgres-backup:v1\n'+payload).digest('hex')
  const path=`backups/${repository.companyId}/${new Date().toISOString().replaceAll(':','-')}-${crypto.randomUUID()}.sica-pg.json`
  await put(path+'.audit-key',repository.key)
  await put(path,JSON.stringify({format:'sica-postgres-backup',version:1,payload,signature})+'\n','application/json')
  if(daily){await put(marker,JSON.stringify({path,createdAt:new Date().toISOString()}),'application/json');backedUpDay=day}
  return {path,bucket:edgeBucket}
 }
 return {get,put,backup,async auditKey({existing,companyId}){
  const path=`keys/${companyId}.audit-key`
  let bytes=await get(path)
  if(!bytes){if(existing)throw new Error('Falta la clave original de auditoría en Storage privado.');await put(path,randomBytes(32));bytes=await get(path)}
  if(bytes?.length!==32)throw new Error('Clave privada de auditoría inválida.')
  return bytes
 }}
}
