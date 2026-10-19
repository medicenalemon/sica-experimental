// Helper for crash/concurrency tests. Only temporary test databases are passed.
import {DatabaseSync} from 'node:sqlite'
import {Repository} from '../server/repository.mjs'
const [mode,filename,companyId,revision,index]=process.argv.slice(2)
if(mode==='crash'){
 const db=new DatabaseSync(filename,{timeout:5000});db.exec('PRAGMA foreign_keys=ON;BEGIN IMMEDIATE')
 const state=JSON.parse(db.prepare('SELECT state FROM companies WHERE id=?').get(companyId).state);state.masters.branches[0].name='Escritura sin confirmar'
 db.prepare('UPDATE companies SET state=?,revision=revision+1 WHERE id=?').run(JSON.stringify(state),companyId);db.prepare("UPDATE audit SET record='Evento sin confirmar' WHERE company_id=?").run(companyId)
 process.stdout.write('READY\n');setInterval(()=>{},1000)
}else if(mode==='race'){
 const repo=await Repository.open({filename,companyId})
 try{await repo.mutate(process.env.SICA_TEST_TOKEN,{revision:Number(revision),requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:`process-writer-${index}`,name:`Proceso ${index}`,text:'Ensayo concurrente'}}});console.log(JSON.stringify({status:200}))}catch(error){if(error.status!==409)throw error;console.log(JSON.stringify({status:409}))}finally{await repo.close()}
}else throw new Error('Modo de prueba desconocido.')
