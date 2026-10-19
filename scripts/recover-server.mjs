if(Number(process.versions.node.split('.')[0])<24)throw new Error('La recuperación requiere Node.js 24 o superior.')
process.umask(0o077)
const {inspectBackup,recoverBackup}=await import('../server/recovery.mjs')
const usage=`Uso:
  npm run recovery -- verify --source COPIA.sqlite [--company CODIGO] [--legacy]
  npm run recovery -- recover --source COPIA.sqlite --destination CARPETA_NUEVA --reason "Motivo" [--operator "Nombre"] [--company CODIGO] [--legacy]

Se usan COPIA.sqlite.audit-key y COPIA.sqlite.backup.json. --key permite indicar otra ubicación de la clave.
--legacy admite explícitamente respaldos anteriores sin sello completo del archivo.
La recuperación conserva usuarios, cierra las sesiones de la copia y no reemplaza un destino existente.`
const args=process.argv.slice(2),action=args.shift()
if(action==='--help'||action==='help'||!action){console.log(usage);process.exitCode=action?0:1}
else try{
 if(!['verify','recover'].includes(action))throw new Error('Elegí verify o recover. Usá --help para ver los argumentos.')
 const options={},names={'--source':'filename','--key':'keyFilename','--company':'expectedCompanyId','--destination':'destination','--reason':'reason','--operator':'operator'}
 const seen=new Set()
 for(let i=0;i<args.length;i++){
  const name=args[i]
  if(seen.has(name))throw new Error('No repitas argumentos.');seen.add(name)
  if(name==='--legacy'){options.allowLegacy=true;continue}
  if(!Object.hasOwn(names,name)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Argumentos incompletos o desconocidos. Usá --help.')
  options[names[name]]=args[++i]
 }
 if(!options.filename)throw new Error('Falta --source con el archivo de respaldo.')
 if(action==='verify'&&['destination','reason','operator'].some(k=>options[k]!==undefined))throw new Error('verify no publica una recuperación; omití destino, motivo y operador.')
 console.log(JSON.stringify(action==='verify'?await inspectBackup(options):await recoverBackup(options),null,2))
}catch(error){console.error(`Error: ${error.message}`);process.exitCode=1}
