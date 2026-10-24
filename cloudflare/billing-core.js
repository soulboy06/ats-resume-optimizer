/* D1-backed points and application storage. No client-supplied balance is trusted. */
const schemaReady=new WeakMap();
const BASIC_TEMPLATES=new Set(['refined','minimal','compact','index','charter']);
const SCHEMA=[
`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL,credits INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS billing_accounts(user_id TEXT PRIMARY KEY,email TEXT NOT NULL,permanent_points INTEGER NOT NULL DEFAULT 0 CHECK(permanent_points>=0),subscription_points INTEGER NOT NULL DEFAULT 0 CHECK(subscription_points>=0),period_end INTEGER NOT NULL DEFAULT 0,period_start INTEGER NOT NULL DEFAULT 0,permanent_access INTEGER NOT NULL DEFAULT 0,subscription_id TEXT,customer_id TEXT,subscription_status TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS billing_ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,delta INTEGER NOT NULL,permanent_delta INTEGER NOT NULL DEFAULT 0,subscription_delta INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS billing_ledger_user ON billing_ledger(user_id,created_at DESC)`,
`CREATE TABLE IF NOT EXISTS billing_checkins(user_id TEXT NOT NULL,day TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,day))`,
`CREATE TABLE IF NOT EXISTS billing_usage(user_id TEXT NOT NULL,request_id TEXT NOT NULL,kind TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,permanent_spent INTEGER NOT NULL DEFAULT 0,subscription_spent INTEGER NOT NULL DEFAULT 0,period_end INTEGER NOT NULL DEFAULT 0,response TEXT,response_status INTEGER,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,request_id))`,
`CREATE TABLE IF NOT EXISTS billing_exports(user_id TEXT NOT NULL,fingerprint TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,fingerprint))`,
`CREATE TABLE IF NOT EXISTS saved_jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,company TEXT NOT NULL,role TEXT NOT NULL,snapshot TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS saved_jobs_user ON saved_jobs(user_id,updated_at DESC)`,
`CREATE TABLE IF NOT EXISTS billing_purchases(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,plan TEXT NOT NULL,product_id TEXT NOT NULL,checkout_id TEXT,created_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS billing_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,plan TEXT NOT NULL,points INTEGER NOT NULL,subscription_id TEXT,period_end INTEGER NOT NULL DEFAULT 0,period_start INTEGER NOT NULL DEFAULT 0,customer_id TEXT,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,grant_state INTEGER NOT NULL DEFAULT 0,transaction_id TEXT)`,
`CREATE TABLE IF NOT EXISTS billing_webhooks(id TEXT PRIMARY KEY,created_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS billing_fulfillments(purchase_id TEXT NOT NULL,order_id TEXT NOT NULL,PRIMARY KEY(purchase_id,order_id))`,
`CREATE TABLE IF NOT EXISTS billing_payment_reviews(event_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL)`
];
function fail(code,status=400){throw Object.assign(new Error(code),{code,status});}
const changed=r=>Number(r?.meta?.changes||0)>0;
function prepare(db,sql,...values){return db.prepare(sql).bind(...values);}
async function init(db){if(!db)fail('SERVICE_UNAVAILABLE',503);if(!schemaReady.has(db)){const p=db.batch(SCHEMA.map(sql=>db.prepare(sql))).catch(e=>{schemaReady.delete(db);throw e;});schemaReady.set(db,p);}await schemaReady.get(db);}
function active(a,now=Date.now()){return a.period_end>now&&['active','scheduled_cancel','canceled'].includes(a.subscription_status);}
function premium(a){return !!a.permanent_access||active(a);}
async function hash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
async function jsonBody(request,limit=1900000){if(Number(request.headers.get('Content-Length'))>limit)fail('INVALID_INPUT',413);const reader=request.body?.getReader();if(!reader)fail('INVALID_INPUT');const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail('INVALID_INPUT',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}try{const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))fail('INVALID_INPUT');return body;}catch(_){fail('INVALID_INPUT');}}
function short(value,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail('INVALID_INPUT');return value.trim();}
function safeSnapshot(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('INVALID_INPUT');
 const result={};
 for(const key of ['resume','rewritten','jd']){const v=input[key]??'';if(typeof v!=='string'||v.length>(key==='jd'?40000:60000))fail('INVALID_INPUT');result[key]=v;}
 for(const key of ['review','analysis'])if(input[key]!=null){if(typeof input[key]!=='object'||JSON.stringify(input[key]).length>60000)fail('INVALID_INPUT');result[key]=input[key];}
 if(input.studio!=null){const s=input.studio;if(!s||typeof s!=='object'||!s.data||typeof s.data!=='object')fail('INVALID_INPUT');const data={};for(const k of ['name','title','contact','summary','experience','projects','education','skills','certs','other']){const v=s.data[k]??'';if(typeof v!=='string'||v.length>30000)fail('INVALID_INPUT');data[k]=v;}
 const template=typeof s.template==='string'&&/^[a-z]{2,24}$/.test(s.template)?s.template:'refined';
 const photo=s.photo||null;if(photo&&(typeof photo!=='string'||photo.length>1400000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)))fail('INVALID_INPUT');
 result.studio={data,template,paper:s.paper==='letter'?'letter':'a4',size:String(s.size||'10.5').slice(0,6),lineSpacing:String(s.lineSpacing||'auto').slice(0,8),contentLanguage:s.contentLanguage==='zh'?'zh':'en',uiLanguage:s.uiLanguage==='zh'?'zh':'en',photo};}
 if(JSON.stringify(result).length>1800000)fail('INVALID_INPUT',413);return result;
}
async function ensureAccount(db,user){
 await init(db);const now=Date.now();
 await db.batch([
 prepare(db,`INSERT OR IGNORE INTO billing_accounts(user_id,email,permanent_points,created_at) VALUES(?,?,50+MAX(0,COALESCE((SELECT credits FROM users WHERE id=?),0))*10,?)`,user.id,user.email||'',user.id,now),
 prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,permanent_delta,created_at) VALUES(?,?,'signup',50,50,?)`,'signup:'+user.id,user.id,now),
 prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,permanent_delta,created_at) SELECT ?,?,'migration',credits*10,credits*10,? FROM users WHERE id=? AND credits>0`,'migration:'+user.id,user.id,now,user.id),
 prepare(db,`UPDATE billing_accounts SET email=? WHERE user_id=?`,user.email||'',user.id)
 ]);
 await db.batch([
 prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,subscription_delta,created_at) SELECT 'expire:'||user_id||':'||period_end,user_id,'expiration',-subscription_points,-subscription_points,? FROM billing_accounts WHERE user_id=? AND period_end<=? AND subscription_points>0`,now,user.id,now),
 prepare(db,`UPDATE billing_accounts SET subscription_points=0 WHERE user_id=? AND period_end<=?`,user.id,now)
 ]);
 const stale=await prepare(db,"SELECT request_id FROM billing_usage WHERE user_id=? AND status='reserved' AND created_at<?",user.id,now-300000).all();
 for(const usage of stale.results||[])await settle(db,user.id,usage.request_id,false);
 await prepare(db,"UPDATE billing_usage SET response=NULL WHERE user_id=? AND kind!='export' AND status='complete' AND created_at<? AND response IS NOT NULL",user.id,now-86400000).run();
 return prepare(db,'SELECT * FROM billing_accounts WHERE user_id=?',user.id).first();
}
async function reserve(db,user,kind,key,fingerprint,cost){
 const old=await prepare(db,'SELECT * FROM billing_usage WHERE user_id=? AND request_id=?',user.id,key).first();
 if(old){if(old.kind!==kind||old.fingerprint!==fingerprint)fail('CONFLICT',409);if(old.status==='complete'){if(old.response===null)fail('RETRY_WITH_NEW_ID',409);return {cached:old};}if(old.status==='failed')fail('RETRY_WITH_NEW_ID',409);if(old.status==='reserved'&&old.created_at<Date.now()-300000){await settle(db,user.id,key,false);fail('RETRY_WITH_NEW_ID',409);}fail('BUSY',409);}
 const a=await ensureAccount(db,user),now=Date.now(),sub=active(a)?a.subscription_points:0;
 const subSpent=Math.min(cost,sub),permanentSpent=cost-subSpent;
 const results=await db.batch([
 prepare(db,`INSERT OR IGNORE INTO billing_usage(user_id,request_id,kind,fingerprint,status,permanent_spent,subscription_spent,period_end,created_at) SELECT ?,?,?,?,'reserving',?,?,?,? WHERE EXISTS(SELECT 1 FROM billing_accounts WHERE user_id=? AND permanent_points>=? AND subscription_points>=? AND period_end=?)`,user.id,key,kind,fingerprint,permanentSpent,subSpent,a.period_end,now,user.id,permanentSpent,subSpent,a.period_end),
 prepare(db,`UPDATE billing_accounts SET permanent_points=permanent_points-?,subscription_points=subscription_points-? WHERE user_id=? AND EXISTS(SELECT 1 FROM billing_usage WHERE user_id=? AND request_id=? AND status='reserving')`,permanentSpent,subSpent,user.id,user.id,key),
 prepare(db,`UPDATE billing_usage SET status='reserved' WHERE user_id=? AND request_id=? AND status='reserving'`,user.id,key)
 ]);
 if(!changed(results[0])){const collision=await prepare(db,'SELECT request_id FROM billing_usage WHERE user_id=? AND request_id=?',user.id,key).first();if(collision)fail('BUSY',409);fail('INSUFFICIENT_POINTS',402);}
 return {cached:null};
}
async function settle(db,userId,key,success,body='',status=200){
 const u=await prepare(db,'SELECT * FROM billing_usage WHERE user_id=? AND request_id=?',userId,key).first();if(!u||u.status!=='reserved')return false;
 const now=Date.now();
 const updates=success?[
 prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,permanent_delta,subscription_delta,created_at) SELECT ?,user_id,kind,-permanent_spent-subscription_spent,-permanent_spent,-subscription_spent,? FROM billing_usage WHERE user_id=? AND request_id=? AND status='reserved'`,'usage:'+userId+':'+key,now,userId,key),
 prepare(db,`UPDATE billing_usage SET response=?,response_status=?,status='complete' WHERE user_id=? AND request_id=? AND status='reserved'`,body,status,userId,key)
 ]:[
 prepare(db,`UPDATE billing_accounts SET permanent_points=permanent_points+?,subscription_points=subscription_points+CASE WHEN period_end=? AND period_end>? THEN ? ELSE 0 END WHERE user_id=? AND EXISTS(SELECT 1 FROM billing_usage WHERE user_id=? AND request_id=? AND status='reserved')`,u.permanent_spent,u.period_end,now,u.subscription_spent,userId,userId,key),
 prepare(db,`UPDATE billing_usage SET status='failed',response=NULL WHERE user_id=? AND request_id=? AND status='reserved'`,userId,key)
 ];
 await db.batch(updates);return true;
}
async function verifySignature(raw,signature,secret){if(!secret||!signature||!/^[a-f0-9]{64}$/i.test(signature))return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);const bytes=new Uint8Array(signature.match(/../g).map(v=>parseInt(v,16)));return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(raw));}
export function createBilling({auth,isAdmin,headers,validateAi}){
 const reply=(data,status=200)=>Response.json({ok:status<400,...data},{status,headers:{...headers,'Cache-Control':'no-store'}});
 const errorResponse=e=>reply({code:e.code||'SERVICE_UNAVAILABLE',error:e.code||'Service unavailable'},e.status||503);
 async function userFor(request,env){const user=await auth(request,env);if(!user?.id||!user.email)fail('AUTH_REQUIRED',401);return user;}
 async function snapshot(db,user){const a=await ensureAccount(db,user),sub=active(a),day=new Date().toISOString().slice(0,10);const [check,ledger,orders]=await Promise.all([prepare(db,'SELECT day FROM billing_checkins WHERE user_id=? AND day=?',user.id,day).first(),prepare(db,'SELECT kind,delta,permanent_delta,subscription_delta,created_at FROM billing_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 60',user.id).all(),prepare(db,'SELECT id,plan,amount,currency,status,created_at FROM billing_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 20',user.id).all()]);return {id:user.id,email:user.email,credits:a.permanent_points+(sub?a.subscription_points:0),points:{permanent:a.permanent_points,subscription:sub?a.subscription_points:0,total:a.permanent_points+(sub?a.subscription_points:0)},entitlements:{premium:premium(a),permanent:!!a.permanent_access,subscription:sub,unlimited_export:sub,max_jobs:premium(a)?20:0},period_end:sub?a.period_end:null,customer_id:a.customer_id||null,checked_in:!!check,ledger:ledger.results||[],orders:orders.results||[]};}
 async function route(request,env){try{
  const path=new URL(request.url).pathname;
  if(path==='/api/billing/webhook')return await webhook(request,env);
  const user=await userFor(request,env),db=env.DB,a=await ensureAccount(db,user),url=new URL(request.url);
  if(['/api/billing/account','/api/auth/me'].includes(path)&&request.method==='GET')return reply(await snapshot(db,user));
  if(path==='/api/billing/checkin'&&request.method==='POST'){
   const day=new Date().toISOString().slice(0,10),now=Date.now(),id='checkin:'+user.id+':'+day;
   const r=await db.batch([
    prepare(db,`INSERT OR IGNORE INTO billing_checkins(user_id,day,created_at) VALUES(?,?,?)`,user.id,day,now),
    prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,permanent_delta,created_at) VALUES(?,?,'checkin',10,10,?)`,id,user.id,now),
    prepare(db,`UPDATE billing_accounts SET permanent_points=permanent_points+10 WHERE user_id=? AND changes()=1`,user.id)
   ]);return reply({claimed:changed(r[0]),...(await snapshot(db,user))});
  }
  if(path==='/api/billing/export'){
   if(!premium(a))fail('PAID_REQUIRED',403);
   const body=request.method==='POST'?await jsonBody(request,2000):{};const fp=body.fingerprint||url.searchParams.get('fingerprint');if(typeof fp!=='string'||! /^[a-f0-9]{64}$/.test(fp))fail('INVALID_INPUT');
   const existing=await prepare(db,'SELECT fingerprint FROM billing_exports WHERE user_id=? AND fingerprint=?',user.id,fp).first();if(existing)return reply({authorized:true,repeated:true});if(request.method==='GET')return reply({authorized:false});if(request.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
   const key='export:'+fp,cost=active(a)?0:10;const reserved=await reserve(db,user,'export',key,fp,cost);if(reserved.cached)return reply({authorized:true,repeated:true});
   try{await db.batch([prepare(db,'INSERT OR IGNORE INTO billing_exports(user_id,fingerprint,created_at) VALUES(?,?,?)',user.id,fp,Date.now()),prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,permanent_delta,subscription_delta,created_at) SELECT ?,user_id,'export',-permanent_spent-subscription_spent,-permanent_spent,-subscription_spent,? FROM billing_usage WHERE user_id=? AND request_id=? AND status='reserved'`,'usage:'+user.id+':'+key,Date.now(),user.id,key),prepare(db,`UPDATE billing_usage SET status='complete',response='{}',response_status=200 WHERE user_id=? AND request_id=? AND status='reserved'`,user.id,key)]);return reply({authorized:true,cost});}catch(e){await settle(db,user.id,key,false);throw e;}
  }
  if(path==='/api/billing/checkout'&&request.method==='POST')return await checkout(request,env,user,a);
  if(path==='/api/billing/checkout/status'&&request.method==='GET'){
   const id=short(url.searchParams.get('purchase_id'),100);
   const purchase=await prepare(db,'SELECT id,plan FROM billing_purchases WHERE id=? AND user_id=?',id,user.id).first();if(!purchase)fail('NOT_FOUND',404);
   const order=await prepare(db,`SELECT o.id,o.status,o.grant_state FROM billing_orders o JOIN billing_fulfillments f ON f.order_id=o.id WHERE f.purchase_id=? AND o.user_id=? ORDER BY o.created_at DESC LIMIT 1`,id,user.id).first();
   return reply({purchase_id:id,plan:purchase.plan,status:order?(order.status==='paid'&&order.grant_state===1?'fulfilled':order.status):'pending'});
  }
  if(path==='/api/billing/portal'&&request.method==='POST'){if(!a.customer_id)fail('INVALID_INPUT');const data=await creem(env,'/v1/customers/billing',{customer_id:a.customer_id});return reply({url:creemLink(data.customer_portal_link)});}
  if(path==='/api/jobs'||path.startsWith('/api/jobs/'))return await jobsRoute(request,db,user,a,path);
  fail('NOT_FOUND',404);
 }catch(e){return errorResponse(e);}}
 async function ai(request,env,kind,run){let user,key,reserved=false;try{
  if(request.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
  if(isAdmin(request,env))return await run();
  user=await userFor(request,env);await ensureAccount(env.DB,user);
  const body=await jsonBody(request.clone(),180000),raw=JSON.stringify(body);
  try{validateAi(body);}catch(_){return await run();}
  key=request.headers.get('X-Request-ID');if(!key||!/^[A-Za-z0-9:_-]{8,100}$/.test(key))fail('INVALID_INPUT');
  const fingerprint=await hash(kind+'\n'+raw),r=await reserve(env.DB,user,kind,key,fingerprint,kind==='review'?10:20);
  if(r.cached)return new Response(r.cached.response,{status:r.cached.response_status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
  reserved=true;const response=await run(),text=await response.clone().text();let valid=false;try{valid=response.ok&&JSON.parse(text).ok===true;}catch(_){}
  const committed=await settle(env.DB,user.id,key,valid,text,response.status);reserved=false;
  if(!committed)fail('BUSY',409);
  return response;
 }catch(e){if(reserved)await settle(env.DB,user.id,key,false).catch(()=>{});return errorResponse(e);}}
 async function jobsRoute(request,db,user,a,path){
  const id=path==='/api/jobs'?null:decodeURIComponent(path.slice('/api/jobs/'.length));if(id&&!/^[a-f0-9-]{36}$/.test(id))fail('INVALID_INPUT');
  if(request.method==='GET'){
   if(id){const row=await prepare(db,'SELECT * FROM saved_jobs WHERE id=? AND user_id=?',id,user.id).first();if(!row)fail('NOT_FOUND',404);return reply({job:{...row,snapshot:JSON.parse(row.snapshot)}});}
   const rows=await prepare(db,'SELECT * FROM saved_jobs WHERE user_id=? ORDER BY updated_at DESC LIMIT 20',user.id).all();return reply({jobs:(rows.results||[]).map(row=>{const s=JSON.parse(row.snapshot);return {...row,snapshot:{resume:(s.resume||'').slice(0,1600),rewritten:(s.rewritten||'').slice(0,1600),jd:(s.jd||'').slice(0,1600),analysis:s.analysis||null,review:s.review||null,studio:s.studio?{template:s.studio.template}:null},summary:true};})});
  }
  if(request.method==='DELETE'&&id){const r=await prepare(db,'DELETE FROM saved_jobs WHERE id=? AND user_id=?',id,user.id).run();if(!changed(r))fail('NOT_FOUND',404);return reply({deleted:true});}
  if(!premium(a))fail('PAID_REQUIRED',403);
  const b=await jsonBody(request),company=short(b.company,100),role=short(b.role,120),safe=safeSnapshot(b.snapshot),snapshotText=JSON.stringify(safe),now=Date.now();
  if(request.method==='POST'&&!id){const uuid=crypto.randomUUID();const r=await prepare(db,`INSERT INTO saved_jobs(id,user_id,company,role,snapshot,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM saved_jobs WHERE user_id=?)<20`,uuid,user.id,company,role,snapshotText,now,now,user.id).run();if(!changed(r))fail('JOB_LIMIT',409);return reply({job:{id:uuid,company,role,snapshot:safe,created_at:now,updated_at:now}},201);}
  if(request.method==='PUT'&&id){if(!Number.isSafeInteger(b.expected_updated_at))fail('INVALID_INPUT');const updated=Math.max(now,b.expected_updated_at+1);const r=await prepare(db,'UPDATE saved_jobs SET company=?,role=?,snapshot=?,updated_at=? WHERE id=? AND user_id=? AND updated_at=?',company,role,snapshotText,updated,id,user.id,b.expected_updated_at).run();if(!changed(r))fail('CONFLICT',409);return reply({job:{id,company,role,snapshot:safe,updated_at:updated}});}
  fail('METHOD_NOT_ALLOWED',405);
 }
 async function creem(env,path,body){
  if(!env.CREEM_API_KEY)fail('PAYMENTS_UNAVAILABLE',503);
  const base=env.CREEM_TEST_MODE==='true'?'https://test-api.creem.io':'https://api.creem.io',controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(base+path,{method:'POST',signal:controller.signal,headers:{'x-api-key':env.CREEM_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)fail('PAYMENTS_UNAVAILABLE',503);return data;}catch(_){fail('PAYMENTS_UNAVAILABLE',503);}finally{clearTimeout(timeout);}
 }
 function creemLink(value){try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&/(^|\.)creem\.io$/.test(u.hostname))return u.href;}catch(_){}fail('PAYMENTS_UNAVAILABLE',503);}
 async function checkout(request,env,user,a){
  const b=await jsonBody(request,3000);if(!['pack','pass'].includes(b.plan))fail('INVALID_INPUT');if(b.plan==='pass'&&active(a))fail('SUBSCRIPTION_EXISTS',409);
  const product=b.plan==='pack'?env.CREEM_PACK_PRODUCT_ID:env.CREEM_PASS_PRODUCT_ID;if(!product||!env.CREEM_WEBHOOK_SECRET||!env.CREEM_API_KEY)fail('PAYMENTS_UNAVAILABLE',503);
  if(b.request_id!==undefined&&(typeof b.request_id!=='string'||! /^[a-f0-9-]{36}$/i.test(b.request_id)))fail('INVALID_INPUT');
  const purchase=b.request_id||crypto.randomUUID();await prepare(env.DB,'INSERT OR IGNORE INTO billing_purchases(id,user_id,plan,product_id,created_at) VALUES(?,?,?,?,?)',purchase,user.id,b.plan,product,Date.now()).run();
  const saved=await prepare(env.DB,'SELECT * FROM billing_purchases WHERE id=?',purchase).first();if(saved.user_id!==user.id||saved.plan!==b.plan||saved.product_id!==product)fail('CONFLICT',409);
  const fulfilled=await prepare(env.DB,'SELECT order_id FROM billing_fulfillments WHERE purchase_id=?',purchase).first();if(fulfilled)fail('PURCHASE_COMPLETED',409);
  const data=await creem(env,'/v1/checkouts',{product_id:product,request_id:purchase,customer:{email:user.email},metadata:{checkats_user_id:user.id,checkats_purchase_id:purchase},success_url:'https://checkats.online/account/?tab=points&checkout=return&purchase_id='+encodeURIComponent(purchase)+'&lang='+(b.lang==='zh'?'zh':'en')});
  if(!data.id||(saved.checkout_id&&saved.checkout_id!==data.id))fail('PAYMENTS_UNAVAILABLE',503);const checkoutUrl=creemLink(data.checkout_url);await prepare(env.DB,'UPDATE billing_purchases SET checkout_id=? WHERE id=?',data.id,purchase).run();return reply({url:checkoutUrl,purchase_id:purchase});
 }
 async function webhook(request,env){
  if(request.method!=='POST')fail('METHOD_NOT_ALLOWED',405);if(!env.CREEM_WEBHOOK_SECRET)fail('PAYMENTS_UNAVAILABLE',503);
  const raw=await request.text();if(raw.length>200000)fail('INVALID_INPUT',413);if(!await verifySignature(raw,request.headers.get('creem-signature'),env.CREEM_WEBHOOK_SECRET))fail('INVALID_SIGNATURE',401);
  let event;try{event=JSON.parse(raw);}catch(_){fail('INVALID_INPUT');}if(!event.id||!event.object||typeof event.id!=='string')fail('INVALID_INPUT');await init(env.DB);
  const seen=await prepare(env.DB,'SELECT id FROM billing_webhooks WHERE id=?',event.id).first();if(seen)return reply({received:true,duplicate:true});
  const o=event.object,db=env.DB,now=Date.now(),type=event.eventType;
  if(o.mode&&o.mode!==(env.CREEM_TEST_MODE==='true'?'test':'prod'))fail('INVALID_MODE');
  const customer=typeof o.customer==='string'?o.customer:o.customer?.id;
  if(type==='checkout.completed'||type==='subscription.paid'){
   const purchaseId=o.metadata?.checkats_purchase_id||o.request_id;let purchase=purchaseId?await prepare(db,'SELECT * FROM billing_purchases WHERE id=?',purchaseId).first():null;
   if(!purchase&&type==='subscription.paid'){const a=await prepare(db,'SELECT user_id FROM billing_accounts WHERE subscription_id=?',o.id).first();if(a)purchase={user_id:a.user_id,plan:'pass',product_id:env.CREEM_PASS_PRODUCT_ID};}
   if(!purchase)fail('UNKNOWN_PURCHASE',409);
   const product=typeof o.product==='string'?o.product:o.product?.id;if(product!==purchase.product_id)fail('INVALID_PRODUCT');
   const expected=purchase.plan==='pack'?990:1990;
   if(type==='checkout.completed'){
    if(purchase.checkout_id&&purchase.checkout_id!==o.id)fail('INVALID_ORDER');
    if(o.status!=='completed'||o.order?.status!=='paid'||o.order?.amount!==expected||String(o.order?.currency).toUpperCase()!=='USD')fail('INVALID_ORDER');
    if(purchase.plan==='pass'){
     const subId=typeof o.subscription==='string'?o.subscription:o.subscription?.id;if(!subId||!customer)fail('INVALID_ORDER');await prepare(db,'UPDATE billing_accounts SET subscription_id=?,customer_id=? WHERE user_id=? AND (subscription_id IS NULL OR subscription_id=?)',subId,customer,purchase.user_id,subId).run();
    }else await grant(db,{id:o.order.id,user:purchase.user_id,plan:'pack',points:800,amount:990,customer,transaction:o.order.transaction_id||(typeof o.order.transaction==='string'?o.order.transaction:o.order.transaction?.id)||null,purchase:purchase.id,now});
   }else{
    if(purchase.plan!=='pass'||o.status!=='active'||o.product?.price!==1990||String(o.product?.currency).toUpperCase()!=='USD'||!o.last_transaction_id)fail('INVALID_ORDER');
    const end=Date.parse(o.current_period_end_date),start=Date.parse(o.current_period_start_date);if(!Number.isFinite(end)||!Number.isFinite(start)||end<=start)fail('INVALID_ORDER');
    await grant(db,{id:'period:'+o.id+':'+start,user:purchase.user_id,plan:'pass',points:2000,amount:1990,customer,sub:o.id,end,start,transaction:o.last_transaction_id,purchase:purchase.id,now});
   }
  }else if(['subscription.canceled','subscription.scheduled_cancel','subscription.expired','subscription.paused','subscription.update'].includes(type)){
   const a=await prepare(db,'SELECT * FROM billing_accounts WHERE subscription_id=?',o.id).first();if(a){const end=Date.parse(o.current_period_end_date),status=type==='subscription.update'?o.status:type.slice('subscription.'.length);if(!Number.isFinite(end)||end>=a.period_end){
    // Creem's customer portal emits canceled immediately, with a future paid-through
    // date. Canceling renewal must not erase that period or its remaining points.
    // Retain only our already-paid end date; a state event cannot extend access or
    // reactivate an order that a refund/expiry/pause has already revoked.
    if(['scheduled_cancel','canceled'].includes(status))await prepare(db,"UPDATE billing_accounts SET subscription_status=? WHERE user_id=? AND period_end>? AND subscription_status IN ('active','scheduled_cancel','canceled')",status,a.user_id,now).run();
    else if(['expired','paused'].includes(status))await prepare(db,"UPDATE billing_accounts SET subscription_status=?,period_end=MIN(period_end,?) WHERE user_id=?",status,now,a.user_id).run();
   }}
  }else if(type==='refund.created'||type==='dispute.created'){
   /* Retain an auditable event; fulfillment is stopped for this order. A refund
      needs manual reconciliation when points have already been spent. */
   const orderId=typeof o.order==='string'?o.order:o.order?.id;const transactionId=typeof o.transaction==='string'?o.transaction:o.transaction?.id||o.order?.transaction_id||null;
   if(orderId||transactionId){const order=await prepare(db,'SELECT * FROM billing_orders WHERE id=? OR transaction_id=?',orderId||null,transactionId).first();if(!order)fail('UNKNOWN_ORDER',409);
    // A pending/failed refund must not revoke a paid product. Partial refunds need
    // reconciliation; the full original grant cannot be removed for a small refund.
    if(type==='refund.created'&&o.status&&o.status!=='succeeded')return reply({received:true});
    if(type==='refund.created'&&o.transaction?.status==='partially_refunded'){await prepare(db,'INSERT OR IGNORE INTO billing_payment_reviews(event_id,order_id,reason,created_at) VALUES(?,?,?,?)',event.id,order.id,'partial_refund',now).run();await prepare(db,'INSERT OR IGNORE INTO billing_webhooks(id,created_at) VALUES(?,?)',event.id,now).run();return reply({received:true});}
    if(order&&order.status==='paid'){
    const a=await prepare(db,'SELECT * FROM billing_accounts WHERE user_id=?',order.user_id).first(),amount=order.plan==='pass'&&(a.subscription_id!==order.subscription_id||a.period_end!==order.period_end)?0:Math.min(order.points,order.plan==='pack'?a.permanent_points:a.subscription_points);
    await db.batch([prepare(db,"UPDATE billing_orders SET status='refund_processing' WHERE id=? AND status='paid'",order.id),prepare(db,`UPDATE billing_accounts SET permanent_points=MAX(0,permanent_points-?),subscription_points=MAX(0,subscription_points-CASE WHEN period_end=? THEN ? ELSE 0 END) WHERE user_id=? AND EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND status='refund_processing')`,order.plan==='pack'?amount:0,order.period_end,order.plan==='pass'?amount:0,order.user_id,order.id),prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,permanent_delta,subscription_delta,created_at) VALUES(?,?,'refund',?,?,?,?)`,'refund:'+order.id,order.user_id,-amount,order.plan==='pack'?-amount:0,order.plan==='pass'?-amount:0,now),prepare(db,"UPDATE billing_orders SET status='refunded' WHERE id=? AND status='refund_processing'",order.id)]);
    await prepare(db,"UPDATE billing_accounts SET permanent_access=CASE WHEN EXISTS(SELECT 1 FROM billing_orders WHERE user_id=? AND plan='pack' AND status='paid') THEN 1 ELSE 0 END WHERE user_id=?",order.user_id,order.user_id).run();
    if(order.plan==='pass')await prepare(db,"UPDATE billing_accounts SET subscription_status='refunded',period_end=? WHERE user_id=? AND subscription_id=? AND period_end=?",now,order.user_id,order.subscription_id,order.period_end).run();
   }}
  }
  await prepare(db,'INSERT OR IGNORE INTO billing_webhooks(id,created_at) VALUES(?,?)',event.id,now).run();return reply({received:true});
 }
 async function grant(db,g){
  const values=[g.id,g.user,g.plan,g.points,g.sub||null,g.end||0,g.start||0,g.customer||null,g.amount,'USD','paid',g.now,g.transaction||null];
  const batch=[prepare(db,'INSERT OR IGNORE INTO billing_orders(id,user_id,plan,points,subscription_id,period_end,period_start,customer_id,amount,currency,status,created_at,transaction_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',...values)];
  if(g.plan==='pack')batch.push(prepare(db,`UPDATE billing_accounts SET permanent_points=permanent_points+?,permanent_access=1,customer_id=COALESCE(?,customer_id) WHERE user_id=? AND EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND grant_state=0 AND status='paid')`,g.points,g.customer||null,g.user,g.id));
  else {batch.push(prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,subscription_delta,created_at) SELECT ?,user_id,'expiration',-subscription_points,-subscription_points,? FROM billing_accounts WHERE user_id=? AND period_start<? AND subscription_points>0 AND EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND grant_state=0)`,'rollover:'+g.id,g.now,g.user,g.start,g.id));batch.push(prepare(db,`UPDATE billing_accounts SET subscription_points=?,subscription_id=?,period_end=?,period_start=?,customer_id=?,subscription_status='active' WHERE user_id=? AND period_start<? AND EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND grant_state=0 AND status='paid')`,g.end>Date.now()?g.points:0,g.sub,g.end,g.start,g.customer||null,g.user,g.start,g.id));}
  batch.push(prepare(db,`INSERT OR IGNORE INTO billing_ledger(id,user_id,kind,delta,permanent_delta,subscription_delta,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND grant_state=0 AND status='paid') AND (?='pack' OR EXISTS(SELECT 1 FROM billing_accounts WHERE user_id=? AND period_start=? AND subscription_id=?))`,'order:'+g.id,g.user,g.plan==='pack'?'pack':'subscription',g.plan==='pass'&&g.end<=Date.now()?0:g.points,g.plan==='pack'?g.points:0,g.plan==='pass'&&g.end>Date.now()?g.points:0,g.now,g.id,g.plan,g.user,g.start||0,g.sub||null),prepare(db,'UPDATE billing_orders SET grant_state=1 WHERE id=? AND grant_state=0',g.id));
  if(g.purchase)batch.push(prepare(db,`INSERT OR IGNORE INTO billing_fulfillments(purchase_id,order_id) SELECT ?,id FROM billing_orders WHERE id=? AND user_id=? AND grant_state=1`,g.purchase,g.id,g.user));
  await db.batch(batch);
 }
 return {route,ai,snapshot,ensureAccount,reserve,settle,verifySignature,safeSnapshot,BASIC_TEMPLATES};
}
