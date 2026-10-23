const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../pages-deploy/scripts/billing.js'),'utf8');
function setup(){
 const storage=new Map(),calls=[],destinations=[];let fail=false;
 const window={CheckATSAuth:{getSession:()=>({user:{id:'alice'}}),getAccessToken:async()=>'synthetic-token',onAuthStateChange(){}},addEventListener(){}};
 const context=vm.createContext({window,location:{search:'?lang=zh',assign:url=>destinations.push(url)},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},URL,URLSearchParams,Headers,crypto:webcrypto,fetch:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});if(fail){fail=false;throw Error('lost response');}return Response.json({ok:true,url:'https://checkout.creem.io/test'});}});
 vm.runInContext(source,context);return {billing:window.CheckATSBilling,window,storage,calls,destinations,failNext:()=>fail=true};
}
test('checkout retains the same id after network failure, including a new page load, and scopes it to the signed-in account',async()=>{
 const a=setup();a.failNext();await assert.rejects(a.billing.checkout('pack'));await a.billing.checkout('pack');assert.equal(a.calls[0].body.request_id,a.calls[1].body.request_id);assert.equal(a.destinations.length,1);
 const b=setup();for(const [k,v] of a.storage)b.storage.set(k,v);await b.billing.checkout('pack');assert.equal(b.calls[0].body.request_id,a.calls[0].body.request_id);
 b.window.CheckATSAuth.getSession=()=>({user:{id:'bob'}});await b.billing.checkout('pack');assert.notEqual(b.calls[1].body.request_id,a.calls[0].body.request_id);
});
test('checkout never opens an untrusted payment destination',async()=>{
 const a=setup(); // The server also validates this; exercise the independent client check.
 const ctx=vm.createContext({document:{documentElement:{lang:'en'}},window:a.window,location:{search:'',assign:()=>assert.fail('redirected')},sessionStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,Headers,crypto:webcrypto,fetch:async()=>Response.json({ok:true,url:'https://creem.io.evil.test/pay'})});vm.runInContext(source,ctx);
 await assert.rejects(a.window.CheckATSBilling.checkout('pack'),/Invalid checkout link/);
});
const accountSource=fs.readFileSync(path.join(__dirname,'../pages-deploy/account/account.js'),'utf8');
function confirmation(status){
 let text='',refreshes=0;const requested=[];
 const begin=accountSource.indexOf('  async function confirmPurchase()'),end=accountSource.indexOf('  function startConfirmation()',begin);
 const context=vm.createContext({confirming:false,confirmationDone:false,returnPurchase:'purchase-owned',confirmationTimer:null,account:null,window:{CheckATSAuth:{getSession:()=>({user:{id:'alice'}})}},B:{request:async url=>{requested.push(url);return {status,plan:'pack'};},refresh:async()=>{refreshes++;return {points:{total:850}};}},render(){},clearTimeout(){},sessionStorage:{removeItem(){}},message:s=>text=s,tr:(zh,en)=>en});
 vm.runInContext(accountSource.slice(begin,end)+'\nthis.confirmPurchase=confirmPurchase;',context);return {context,run:()=>context.confirmPurchase(),text:()=>text,refreshes:()=>refreshes,requested};
}
test('return-page query flags alone never claim payment success; only owned fulfillment refreshes benefits',async()=>{
 const pending=confirmation('pending');await pending.run();assert.equal(pending.context.confirmationDone,false);assert.equal(pending.refreshes(),0);assert.match(pending.text(),/Confirming/);assert.match(pending.requested[0],/purchase_id=purchase-owned$/);
 const paid=confirmation('fulfilled');await paid.run();assert.equal(paid.context.confirmationDone,true);assert.equal(paid.refreshes(),1);assert.match(paid.text(),/Payment confirmed/);
 const refunded=confirmation('refunded');await refunded.run();assert.equal(refunded.refreshes(),0);assert.match(refunded.text(),/refunded/);
});

test('main-branch cached accounts render across pages but never cross account boundaries',()=>{
 const storage=new Map([['checkats_account_cache',JSON.stringify({uid:'alice',ts:Date.now(),data:{id:'alice',points:{total:850}}})]]);let user=null;
 const window={CheckATSAuth:{getSession:()=>user?{user:{id:user}}:null,onAuthStateChange(){}},addEventListener(){}};
 const context=vm.createContext({window,location:{search:'?lang=zh'},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URLSearchParams});vm.runInContext(source,context);
 user='alice';assert.equal(window.CheckATSBilling.getAccount().points.total,850);user='bob';assert.equal(window.CheckATSBilling.getAccount(),null);user=null;assert.equal(window.CheckATSBilling.getAccount(),null);
});

test('a late account refresh cannot expose the previous login after switching users',async()=>{
 let user=null,resolveFetch,started;const ready=new Promise(resolve=>started=resolve);const window={CheckATSAuth:{getSession:()=>user?{user:{id:user}}:null,getAccessToken:async()=>user,onAuthStateChange(){}},addEventListener(){},dispatchEvent(){}};
 const context=vm.createContext({window,location:{search:'?lang=en'},sessionStorage:{getItem:()=>null,setItem(){}},Headers,URLSearchParams,CustomEvent:class{},fetch:()=>new Promise(resolve=>{resolveFetch=resolve;started();})});vm.runInContext(source,context);
 user='alice';const pending=window.CheckATSBilling.refresh();await ready;user='bob';resolveFetch(Response.json({ok:true,id:'alice',points:{total:850}}));assert.equal(await pending,null);assert.equal(window.CheckATSBilling.getAccount(),null);
});
