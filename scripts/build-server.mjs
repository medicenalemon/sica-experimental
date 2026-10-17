import ts from 'typescript'
import {readdir,mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const input=resolve('src/domain'),output=resolve('.server/domain')
await mkdir(output,{recursive:true})
for(const file of await readdir(input))if(file.endsWith('.ts')) {
 const source=await readFile(resolve(input,file),'utf8')
 let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText
 code=code.replace(/(from\s+["']|import\(["'])(\.[^"']+)(["'])/g,(_,start,path,end)=>`${start}${path.endsWith('.js')?path:path+'.js'}${end}`)
 await writeFile(resolve(output,file.replace(/\.ts$/,'.js')),code)
}
