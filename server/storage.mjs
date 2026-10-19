import {Repository} from './repository.mjs'
export async function openRepository(options){
 if(options.backend==='postgres'||options.databaseUrl){const {PostgresRepository}=await import('./postgres-repository.mjs');return PostgresRepository.open(options)}
 return Repository.open(options)
}
