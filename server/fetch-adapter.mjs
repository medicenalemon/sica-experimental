import {Buffer} from 'node:buffer'

// Reuse the HTTP routes in a Fetch runtime without a listening Node server.
export async function handleFetch(application,request,{prefix='/sica-api',remoteAddress=''}={}){
 const url=new URL(request.url)
 if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))return Response.json({error:'Recurso no encontrado.'},{status:404})
 const headers=Object.fromEntries(request.headers),body=request.body
 const req={method:request.method,url:(url.pathname.slice(prefix.length)||'/')+url.search,headers,socket:{remoteAddress},async *[Symbol.asyncIterator](){
  if(!body)return
  const reader=body.getReader()
  try{while(true){const {done,value}=await reader.read();if(done)break;yield Buffer.from(value)}}finally{await reader.cancel()}
 }}
 const responseHeaders=new Headers();let status=200,bytes,ended=false
 const res={headersSent:false,setHeader(name,value){responseHeaders.set(name,value)},writeHead(code,extra){status=code;for(const [name,value] of Object.entries(extra||{}))responseHeaders.set(name,value);this.headersSent=true},end(value){bytes=value;ended=true},destroy(){status=500;bytes=JSON.stringify({error:'Respuesta interrumpida.'});ended=true}}
 await application.handler(req,res)
 if(!ended)throw new Error('La ruta no produjo una respuesta.')
 return new Response(bytes,{status,headers:responseHeaders})
}
