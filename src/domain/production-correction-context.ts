import type {State} from './types'
// A runtime capability for the atomic linked transaction; it cannot be supplied in JSON.
const linkedStates=new WeakSet<State>()
export const linkedProductionCorrection=(state:State)=>linkedStates.has(state)
export function withLinkedProductionCorrection<T>(state:State,work:()=>T):T{
 if(linkedStates.has(state))throw new Error('La corrección vinculada no admite operaciones anidadas.')
 linkedStates.add(state)
 try{return work()}finally{linkedStates.delete(state)}
}
