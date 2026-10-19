import {dateLabel} from '@/domain/constants'
export function AssetCurrencyBasis({references}:{references?:{id:string;number:string;date:string}[]}){
 const rows=[...new Map((references||[]).map(r=>[r.id,r])).values()]
 return rows.length?<p><strong>Base de moneda de cierre:</strong> {rows.map(r=>`${r.number}, corte ${dateLabel(r.date)}`).join('; ')}. Revisá que las estimaciones de esta operación estén en la misma base monetaria.</p>:null
}
