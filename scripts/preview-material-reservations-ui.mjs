import {createApplication} from '../server/http.mjs'
import {materialReservationsFixture} from './material-reservations-fixture.mjs'
const host='127.0.0.36',port=3041,password='Sica-Material-Reservations-QA-2026',filename='var/qa-material-reservations.sqlite'
const app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){const f=materialReservationsFixture(),auth=await app.repository.login('admin',password,false,'fixture');await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);app.repository.logout(auth.token)}
await new Promise(resolve=>app.server.listen(port,host,resolve))
console.log(`Reserva de materiales de ensayo: http://${host}:${port}/produccion`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
