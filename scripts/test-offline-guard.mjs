// Preload only in tests. Never allow an accidental real ARCA request.
import http from 'node:http'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'

export function assertLocalUrl(input){
 const url=input instanceof URL?input:new URL(typeof input==='string'?input:input.url)
 if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error(`Las pruebas no permiten conexiones externas: ${url.hostname}`)
 return url
}
const realFetch=globalThis.fetch
globalThis.fetch=(input,options)=>{assertLocalUrl(input);return realFetch(input,{...options,redirect:'error'})}
for(const transport of [http,https])for(const method of ['request','get']){
 const original=transport[method]
 transport[method]=function(input,...rest){
  if(typeof input==='string'||input instanceof URL){assertLocalUrl(input);const override=rest[0];if(override&&typeof override==='object'&&(override.hostname||override.host||override.socketPath))throw new Error('Las pruebas no permiten sustituir el destino HTTP.')}
  else{
   const host=input?.hostname||input?.host||'localhost'
   if(!['localhost','127.0.0.1','::1','[::1]'].includes(host)||input?.socketPath)throw new Error('Las pruebas no permiten conexiones externas.')
  }
  return original.call(this,input,...rest)
 }
}
syncBuiltinESMExports()
