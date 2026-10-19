export function serverConfig(environment=process.env){
 const host=environment.SICA_HOST||'127.0.0.1',port=Number(environment.SICA_PORT||environment.PORT||3001),secureCookie=environment.SICA_SECURE_COOKIE==='true'
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('SICA_PORT o PORT debe ser un puerto válido entre 1 y 65535.')
 const origins=environment.SICA_ORIGINS?.split(',').map(s=>s.trim())
 if(origins)for(const origin of origins){let parsed;try{parsed=new URL(origin)}catch{throw new Error('SICA_ORIGINS debe contener orígenes completos separados por comas.')};if(!['http:','https:'].includes(parsed.protocol)||parsed.origin!==origin)throw new Error('SICA_ORIGINS admite sólo orígenes HTTP/HTTPS sin rutas ni credenciales.')}
 if(!['127.0.0.1','localhost','::1'].includes(host)&&(!secureCookie||!origins?.length||!origins.every(o=>o.startsWith('https://'))))throw new Error('El acceso de red necesita HTTPS, cookies seguras y SICA_ORIGINS explícitos.')
 const driver=environment.SICA_DATABASE_DRIVER||'postgres'
 if(!['sqlite','postgres'].includes(driver))throw new Error('SICA_DATABASE_DRIVER debe ser postgres o sqlite.')
 return {host,port,secureCookie,origins,driver}
}
