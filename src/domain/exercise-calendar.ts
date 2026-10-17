import type {State} from './types'

export function exerciseRanges(state:State){return [...(state.settings.exerciseHistory||[]),{start:state.settings.exerciseStart,end:state.settings.exerciseEnd}]}
export function withinExerciseHistory(state:State,date:string){return exerciseRanges(state).some(r=>date>=r.start&&date<=r.end)}
export function withinSingleExercise(state:State,from:string,to:string){return exerciseRanges(state).some(r=>from>=r.start&&to<=r.end&&from<=to)}
