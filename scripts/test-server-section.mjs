import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
const section=process.argv[2]
const prefix=process.argv[3]||'document-rules'
if(!/^[a-z][a-z0-9-]{0,79}$/.test(prefix))throw new Error('Usá un prefijo de evidencia simple, sin rutas.')
if(!['core','extended'].includes(section))throw new Error('Elegí core o extended para ejecutar una sección completa de las pruebas HTTP.')
const source=await readFile('scripts/test-server.mjs','utf8')
const names=[...source.matchAll(/test\('((?:\\.|[^'])*)'/g)].map(m=>m[1])
assert.equal(new Set(names).size,names.length)
const selected=section==='core'?names.slice(0,60):names.slice(60)
assert.ok(selected.length)
const escaped=selected.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
const pattern=`^(?:${escaped.join('|')})$`
assert.equal(names.filter(name=>new RegExp(pattern).test(name)).length,selected.length)
await writeFile(`output/qa/${prefix}-http-${section}-selection.json`,JSON.stringify({section,total:names.length,selected:selected.length,names:selected},null,2)+'\n')
const child=spawn(process.execPath,['--test-name-pattern='+pattern,'scripts/test-server.mjs'],{stdio:'inherit'})
child.on('error',error=>{console.error(error);process.exitCode=1})
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0)})
