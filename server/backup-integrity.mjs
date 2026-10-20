import {Buffer} from 'node:buffer'
import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {readFile,writeFile,stat,open} from 'node:fs/promises'
import {canonical} from './fiscal-store.mjs'

export function sameDigest(a,b){return typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'))}
export async function fileDigest(filename){const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);return hash.digest('hex')}
export async function syncFile(filename){const file=await open(filename,'r');try{await file.sync()}finally{await file.close()}}
export async function readAuditKey(filename){if((await stat(filename)).size!==32)throw new Error('La clave de auditoría debe contener exactamente 32 bytes.');return readFile(filename)}
export async function sealBackup(filename,key,{replace=false}={}){
 const {DatabaseSync}=await import('node:sqlite')
 const db=new DatabaseSync(filename,{readOnly:true})
 let companies;try{companies=db.prepare('SELECT id,revision FROM companies ORDER BY id').all().map(c=>({id:c.id,revision:Number(c.revision)}))}finally{db.close()}
 const payload={format:'sica-sqlite-backup',version:1,createdAt:new Date().toISOString(),size:(await stat(filename)).size,sha256:await fileDigest(filename),companies}
 const signature=createHmac('sha256',key).update(canonical(payload)).digest('hex')
 const manifest={...payload,signature}
 await writeFile(filename+'.backup.json',JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:replace?'w':'wx'})
 await syncFile(filename);await syncFile(filename+'.backup.json')
 return manifest
}
export async function verifyBackupSeal(filename,key){
 const path=filename+'.backup.json'
 if((await stat(path)).size>65536)throw new Error('El sello de respaldo supera el tamaño admitido.')
 let manifest;try{manifest=JSON.parse(await readFile(path,'utf8'))}catch{throw new Error('El sello de respaldo no es JSON válido.')}
 if(!manifest||manifest.format!=='sica-sqlite-backup'||manifest.version!==1||!Number.isSafeInteger(manifest.size)||manifest.size<=0||!Array.isArray(manifest.companies)||!manifest.companies.length)throw new Error('Formato de sello de respaldo inválido.')
 const {signature,...payload}=manifest,expected=createHmac('sha256',key).update(canonical(payload)).digest('hex')
 if(!sameDigest(signature,expected))throw new Error('El sello HMAC del respaldo no corresponde a su clave.')
 if((await stat(filename)).size!==manifest.size||!sameDigest(await fileDigest(filename),manifest.sha256))throw new Error('El archivo SQLite cambió después de generarse el sello de respaldo.')
 return manifest
}
