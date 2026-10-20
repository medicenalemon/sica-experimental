export async function openRepository(options){
 if(options.backend==='postgres'||options.databaseUrl){const {PostgresRepository}=await import('./postgres-repository.mjs');return PostgresRepository.open(options)}
 const {Repository}=await import('./repository.mjs')
 return Repository.open(options)
}
