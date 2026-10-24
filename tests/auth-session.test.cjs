const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../pages-deploy/scripts/auth.js'),'utf8');
const key='checkats-auth-session';
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
const user={id:'test-user',email:'test@example.test'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function client({local=storage(),handle,locks,lifecycle=false}={}){
 const clock={now:1800000000000},events=[],calls=[],handlers={},timers=[];
 class Clock extends Date{static now(){return clock.now;}}
 const window={navigator:{locks}},document={visibilityState:'visible',addEventListener:(e,fn)=>{handlers[e]=fn;}};
 if(lifecycle){window.addEventListener=(e,fn)=>{handlers[e]=fn;};window.setInterval=fn=>timers.push(fn);}
 const context=vm.createContext({window,document,localStorage:local,sessionStorage:storage(),Date:Clock,URL,URLSearchParams,location:new URL('https://checkats.online/'),fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return handle(url,init);}});
 vm.runInContext(source,context);const auth=window.CheckATSAuth;
 auth.onAuthStateChange((event,s)=>events.push({event,session:s}));
 function seed(token='old',expired=true){local.setItem(key,JSON.stringify({access_token:token,refresh_token:'refresh-'+token,expires_at:clock.now/1000+(expired?-10:3600),user}));}
 return {auth,clock,events,calls,local,handlers,timers,seed,document};
}
const fresh=(token='new')=>Response.json({access_token:token,refresh_token:'refresh-'+token,expires_in:3600,user});

test('expired identity remains visible and concurrent API calls share one renewal',async()=>{
 const pending=deferred(),app=client({handle:()=>pending.promise});app.seed();
 assert.equal(app.auth.getSession().user.id,user.id);
 const tokens=Array.from({length:8},()=>app.auth.getAccessToken());
 assert.equal(app.calls.length,1);pending.resolve(fresh());
 assert.deepEqual(await Promise.all(tokens),Array(8).fill('new'));
 assert.equal(app.auth.getSession().access_token,'new');
 assert.equal(app.events.filter(e=>e.event==='TOKEN_REFRESHED').length,1);
});

test('temporary HTTP and network failures retain refresh credentials and never send an expired access token',async()=>{
 for(const failure of [()=>Response.json({}, {status:503}),()=>Response.json({}, {status:429}),()=>{throw new Error('offline');},()=>Response.json({unexpected:true})]){
  let failing=true;const app=client({handle:()=>failing?failure():fresh()});app.seed();
  await assert.rejects(app.auth.getAccessToken(),{code:'session-refresh-unavailable'});
  assert.ok(app.local.getItem(key));assert.equal(app.events.length,0);
  await assert.rejects(app.auth.getAccessToken(),{code:'session-refresh-unavailable'});assert.equal(app.calls.length,1);
  failing=false;app.clock.now+=31000;assert.equal(await app.auth.getAccessToken(),'new');
 }
});

test('a definitively revoked refresh token signs out',async()=>{
 const app=client({handle:()=>Response.json({error_code:'refresh_token_not_found'},{status:400})});app.seed();
 assert.equal(await app.auth.getAccessToken(),null);assert.equal(app.local.getItem(key),null);
 assert.deepEqual(app.events.map(e=>e.event),['SIGNED_OUT']);
});

test('late refresh success and failure cannot overwrite a newer login',async()=>{
 for(const response of [fresh('stale'),Response.json({error_code:'refresh_token_not_found'},{status:400})]){
  const pending=deferred(),app=client({handle:()=>pending.promise});app.seed();
  const token=app.auth.getAccessToken();app.seed('new-login',false);pending.resolve(response);
  assert.equal(await token,'new-login');assert.equal(app.auth.getSession().access_token,'new-login');
  assert.equal(app.events.length,0);
 }
});

test('logging out while refresh is pending cannot restore the session',async()=>{
 const pending=deferred(),app=client({handle:url=>url.includes('refresh_token')?pending.promise:Response.json({})});app.seed();
 const token=app.auth.getAccessToken();await app.auth.signOut();pending.resolve(fresh());
 assert.equal(await token,null);assert.equal(app.local.getItem(key),null);
});

test('two tabs serialize refresh-token rotation and re-read shared storage',async()=>{
 let tail=Promise.resolve(),count=0;
 const locks={request:(_,fn)=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;}};
 const local=storage(),handle=()=>{count++;return fresh();};
 const a=client({local,handle,locks}),b=client({local,handle,locks});a.seed();
 assert.deepEqual(await Promise.all([a.auth.getAccessToken(),b.auth.getAccessToken()]),['new','new']);
 assert.equal(count,1);
});

test('timer, resumed tabs and cross-tab sign-out update authentication',async()=>{
 const app=client({handle:()=>fresh(),lifecycle:true});app.seed('old',false);
 app.clock.now+=3600000;app.timers[0]();assert.equal(await app.auth.getAccessToken(),'new');
 app.clock.now+=3600000;app.document.visibilityState='hidden';app.timers[0]();assert.equal(app.calls.length,1);
 app.document.visibilityState='visible';app.handlers.visibilitychange();assert.equal(await app.auth.getAccessToken(),'new');assert.equal(app.calls.length,2);
 app.local.removeItem(key);app.handlers.storage({key});assert.equal(app.events.at(-1).event,'SIGNED_OUT');
});
