const jsonHeaders={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};

export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get("Origin")||"";
    if(request.method==="OPTIONS")return preflight(origin,env);
    const cors=corsHeaders(origin,env);if(!cors)return response({error:"origin_not_allowed"},403);
    if(url.pathname==="/api/health"&&request.method==="GET")return response({ok:true},200,cors);
    const session=await requireSession(request,env);if(!session)return response({error:"authentication_required"},401,cors);
    if(!safeOrigin(request,env))return response({error:"invalid_origin"},403,cors);
    try{
      if(url.pathname==="/api/accounts"&&request.method==="GET")return listAccounts(session.userId,env,cors);
      if(url.pathname==="/api/banks/monobank/connect"&&request.method==="POST")return connectMonobank(request,session.userId,env,cors);
      if(url.pathname==="/api/banks/connect"&&request.method==="POST")return connectEnableBanking(request,session.userId,env,cors);
      if(url.pathname==="/api/sync"&&request.method==="POST")return response({ok:true,status:"sync_queued"},202,cors);
      return response({error:"not_found"},404,cors);
    }catch(error){return response({error:"request_failed"},500,cors)}
  }
};

function response(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...jsonHeaders,...extra}})}
function corsHeaders(origin,env){const allowed=env.FRONTEND_ORIGIN||"https://dimasdont-lab.github.io";return origin===allowed?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Credentials":"true","Vary":"Origin"}:null}
function preflight(origin,env){const cors=corsHeaders(origin,env);return cors?new Response(null,{status:204,headers:{...cors,"Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type,X-CSRF-Token","Access-Control-Max-Age":"600"}}):response({error:"origin_not_allowed"},403)}
function safeOrigin(request,env){if(["GET","HEAD"].includes(request.method))return true;return request.headers.get("Origin")===(env.FRONTEND_ORIGIN||"https://dimasdont-lab.github.io")}
async function sha256(value){const bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function requireSession(request,env){const match=(request.headers.get("Cookie")||"").match(/(?:^|;\s*)vf_session=([^;]+)/);if(!match||!env.DB)return null;const idHash=await sha256(decodeURIComponent(match[1]));const row=await env.DB.prepare("SELECT user_id, expires_at FROM sessions WHERE id_hash=?").bind(idHash).first();return row&&new Date(row.expires_at)>new Date()?{userId:row.user_id}:null}
async function listAccounts(userId,env,cors){const result=await env.DB.prepare("SELECT id,provider,bank_name AS bankName,display_name AS displayName,account_type AS accountType,currency,current_balance AS currentBalance,available_balance AS availableBalance,last_synced_at AS lastSyncedAt,is_active AS isActive,source FROM accounts WHERE user_id=? AND is_active=1").bind(userId).all();return response({accounts:result.results||[]},200,cors)}
async function connectMonobank(request,userId,env,cors){
  const {token}=await request.json();if(typeof token!=="string"||token.length<20||token.length>256)return response({error:"invalid_token_format"},400,cors);
  const mono=await fetch("https://api.monobank.ua/personal/client-info",{headers:{"X-Token":token,"Accept":"application/json"}});if(!mono.ok)return response({error:"token_rejected"},400,cors);const client=await mono.json();
  const encrypted=await encryptSecret(token,env.MONOBANK_TOKEN_ENCRYPTION_KEY),id=crypto.randomUUID(),now=new Date().toISOString();await env.DB.prepare("INSERT INTO bank_connections (id,user_id,provider,encrypted_credential,credential_iv,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,userId,"MONOBANK",encrypted.ciphertext,encrypted.iv,"active",now,now).run();
  const accounts=Array.isArray(client.accounts)?client.accounts:[];for(const account of accounts){const currency=isoCurrency(account.currencyCode),balance=Number(account.balance||0)/100;await env.DB.prepare("INSERT OR REPLACE INTO accounts (id,user_id,connection_id,provider,bank_name,display_name,account_type,currency,current_balance,available_balance,external_account_ref,last_synced_at,is_active,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,'bank')").bind(crypto.randomUUID(),userId,id,"MONOBANK","Monobank",account.type||"Monobank",account.type||"current",currency,balance,Number(account.balance||0)/100,await sha256(String(account.id||"")),now).run()}
  return response({ok:true,connectionId:id,accountsImported:accounts.length},201,cors);
}
async function connectEnableBanking(request,userId,env,cors){const {provider}=await request.json(),allowed=new Set(["PKO","REVOLUT","ERSTE"]);if(!allowed.has(provider))return response({error:"unsupported_provider"},400,cors);if(!env.ENABLE_BANKING_APPLICATION_ID||!env.ENABLE_BANKING_PRIVATE_KEY)return response({error:"provider_not_configured"},503,cors);const state=crypto.randomUUID(),hash=await sha256(state),expires=new Date(Date.now()+10*60*1000).toISOString();await env.DB.prepare("INSERT INTO authorization_states (state_hash,user_id,provider,expires_at) VALUES (?,?,?,?)").bind(hash,userId,provider,expires).run();return response({status:"authorization_scaffold_ready",provider,state},501,cors)}
async function encryptSecret(value,material){if(!material)throw new Error("encryption_key_missing");const raw=Uint8Array.from(atob(material),c=>c.charCodeAt(0));if(raw.length!==32)throw new Error("invalid_encryption_key");const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt"]),iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value));return{ciphertext:bytesToBase64(new Uint8Array(encrypted)),iv:bytesToBase64(iv)}}
function bytesToBase64(bytes){let binary="";for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary)}
function isoCurrency(code){return({980:"UAH",985:"PLN",978:"EUR",840:"USD",826:"GBP"})[String(code)]||"UAH"}


