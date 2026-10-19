export async function derivePassword(password: string, salt: string, iterations = 600000) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits'])
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations,hash:'SHA-256'},key,256)
 return Array.from(new Uint8Array(bits)).map(n=>n.toString(16).padStart(2,'0')).join('')
}
