const c=require('crypto');module.exports=function(secret,off=0){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const ch of secret.replace(/=+$/,'').toUpperCase())bits+=A.indexOf(ch).toString(2).padStart(5,'0');
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));const ctr=Math.floor(Date.now()/30000)+off;const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(ctr));
 const h=c.createHmac('sha1',key).update(buf).digest();const o=h[h.length-1]&15;return String(((h.readUInt32BE(o)&0x7fffffff)%1e6)).padStart(6,'0')};
