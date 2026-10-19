try{
 const response=await fetch(`http://127.0.0.1:${process.env.SICA_PORT||process.env.PORT||3001}/api/health`,{signal:AbortSignal.timeout(12000)})
 const health=await response.json()
 if(!response.ok||health.ok!==true||health.storage!=='postgres')process.exitCode=1
}catch{process.exitCode=1}
