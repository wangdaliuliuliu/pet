const crypto=require('node:crypto');
const hash=v=>crypto.createHash('sha256').update(v).digest();
function authorize(req,res,password){
  if(!password)return true;
  const header=req.headers.authorization||'';let credential='';
  if(header.startsWith('Basic ')&&header.length<4096)try{credential=Buffer.from(header.slice(6),'base64').toString('utf8');}catch{}
  const colon=credential.indexOf(':');const supplied=colon<0?'':credential.slice(colon+1);
  if(colon>=0&&crypto.timingSafeEqual(hash(supplied),hash(password)))return true;
  res.writeHead(401,{'WWW-Authenticate':'Basic realm="pet", charset="UTF-8"','Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('请输入此实例的访问密码。用户名可填写 pet。');return false;
}
module.exports={authorize};
