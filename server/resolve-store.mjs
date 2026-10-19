// Keep synchronous SQLite callers working while PostgreSQL I/O is asynchronous.
// A generator completes synchronously unless a yielded operation is a Promise.
export function resolveStore(iterator){
 function advance(method,value){
  let step=iterator[method](value)
  while(!step.done){
   if(step.value&&typeof step.value.then==='function')return step.value.then(value=>advance('next',value),error=>advance('throw',error))
   step=iterator.next(step.value)
  }
  return step.value
 }
 return advance('next')
}
