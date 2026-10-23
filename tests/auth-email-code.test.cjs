const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../pages-deploy/scripts/auth.js'),'utf8');
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),dump:()=>JSON.stringify([...data])};}
const email='person@example.test',password='synthetic-password-123';
const session=(address=email,token='verified-recovery-token')=>({access_token:token,refresh_token:'synthetic-refresh-token',expires_in:3600,user:{id:'synthetic-user-id',email:address}});
function client(opts={}){
 const local=opts.local||storage(),temporary=opts.temporary||storage(),calls=[],events=[],clock=opts.clock||{now:Date.now()};
 class Clock extends Date{static now(){return clock.now;}}
 const location=new URL('https://checkats.online/?lang=zh');
 const ctx=vm.createContext({window:{crypto:webcrypto},location,history:{replaceState:(_,__,url)=>{location.href=new URL(url,location).href;}},localStorage:local,sessionStorage:temporary,URL,URLSearchParams,TextEncoder,Date:Clock,crypto:webcrypto,btoa:s=>Buffer.from(s,'binary').toString('base64'),fetch:async(url,init)=>{
  assert.ok(url.startsWith('https://qcjlagocvexlwbjvonps.supabase.co/auth/v1/'));
  const path=new URL(url).pathname.replace('/auth/v1/',''),body=init.body?JSON.parse(init.body):{};calls.push({path,body,headers:init.headers});
  if(opts.handle){const response=await opts.handle(path,body,init);if(response)return response;}
  if(path==='signup')return Response.json({user:{id:'synthetic-user-id',email:body.email}});
  if(path==='verify')return Response.json(session(body.email,body.type==='recovery'?'verified-recovery-token':'verified-signup-token'));
  if(path==='user')return Response.json({id:'synthetic-user-id',email});
  if(path==='token')return Response.json(session(body.email,'ordinary-login-token'));
  return Response.json({});
 }});
 vm.runInContext(source,ctx);const auth=ctx.window.CheckATSAuth;auth.onAuthStateChange((event,s)=>events.push({event,session:s}));
 return {auth,local,temporary,calls,events,clock};
}

test('forgot password verifies the email code on the initiating browser before allowing a password update',async()=>{
 const app=client();await app.auth.resetPasswordForEmail(email);
 assert.equal(app.auth.getSession(),null);assert.equal(app.auth.isRecoverySession(),false);
 assert.equal(app.auth.getPendingEmailVerification().email,email);
 await assert.rejects(app.auth.updatePassword(password),{code:'recovery-verification-required'});
 const verified=await app.auth.verifyEmailCode('123456');
 assert.equal(verified.purpose,'recovery');assert.equal(verified.session,null);assert.equal(app.auth.getSession(),null);assert.equal(app.auth.isRecoverySession(),true);
 assert.deepEqual(app.calls.find(c=>c.path==='verify').body,{email,token:'123456',type:'recovery'});
 assert.deepEqual(app.events.map(e=>e.event),['PASSWORD_RECOVERY']);
 await app.auth.updatePassword(password);
 assert.equal(app.calls.find(c=>c.path==='user').headers.Authorization,'Bearer verified-recovery-token');
 assert.equal(app.auth.isRecoverySession(),false);assert.equal(app.auth.getSession().user.email,email);
 assert.equal(app.events.at(-1).event,'SIGNED_IN');
});

test('registration confirmation uses email OTP and never stores the signup password or OTP',async()=>{
 const app=client(),result=await app.auth.signUp(email,password);
 assert.equal(result.needsConfirmation,true);assert.equal(app.auth.getSession(),null);
 assert.equal(app.auth.getPendingEmailVerification().purpose,'signup');
 assert.ok(!app.local.dump().includes(password));assert.ok(!app.temporary.dump().includes(password));
 await app.auth.verifyEmailCode('123456');
 assert.equal(app.calls.find(c=>c.path==='verify').body.type,'email');
 assert.equal(app.auth.getSession().access_token,'verified-signup-token');
 assert.equal(app.auth.getPendingEmailVerification(),null);
 assert.ok(!app.temporary.dump().includes('123456'));
});

test('registration still supports a project that already returns a confirmed session',async()=>{
 const app=client({handle:path=>path==='signup'?Response.json(session(email,'signup-session')):null});
 assert.equal((await app.auth.signUp(email,password)).needsConfirmation,false);
 assert.equal(app.auth.getSession().access_token,'signup-session');assert.equal(app.auth.getPendingEmailVerification(),null);
});

test('bad, expired or reused codes cannot unlock password changes',async()=>{
 const app=client({handle:path=>path==='verify'?Response.json({error_code:'otp_expired'},{status:403}):null});
 await app.auth.resetPasswordForEmail(email);
 const before=app.calls.length;await assert.rejects(app.auth.verifyEmailCode('abc123'),{code:'invalid-code'});assert.equal(app.calls.length,before);
 await assert.rejects(app.auth.verifyEmailCode('654321'),{code:'otp_expired'});
 assert.equal(app.auth.isRecoverySession(),false);assert.ok(app.auth.getPendingEmailVerification());
 await assert.rejects(app.auth.updatePassword(password),{code:'recovery-verification-required'});
 const good=client();await good.auth.resetPasswordForEmail(email);await good.auth.verifyEmailCode('123456');
 await assert.rejects(good.auth.verifyEmailCode('123456'),{code:'verification-expired'});
});

test('resending uses the correct purpose, respects a cooldown and does not need a redirect or PKCE verifier',async()=>{
 for(const purpose of ['signup','recovery']){
  const app=client();if(purpose==='signup')await app.auth.signUp(email,password);else await app.auth.resetPasswordForEmail(email);
  await assert.rejects(app.auth.resendEmailCode(),{code:'resend-too-soon'});
  assert.equal(app.calls.length,1);app.clock.now+=61000;await app.auth.resendEmailCode();
  assert.equal(app.calls.at(-1).path,purpose==='signup'?'resend':'recover');
  if(purpose==='signup')assert.equal(app.calls.at(-1).body.type,'signup');
  assert.ok(!app.local.dump().includes('-pkce'));assert.ok(!JSON.stringify(app.calls).includes('redirect_to'));
  assert.ok(!app.calls.at(-1).body.password);assert.ok(app.auth.getPendingEmailVerification().resendAt>app.clock.now);
 }
});

test('refreshing the initiating tab resumes verification while a separate device has no pending flow',async()=>{
 const app=client();await app.auth.resetPasswordForEmail(email);
 const refreshed=client({local:app.local,temporary:app.temporary,clock:app.clock});
 assert.equal(refreshed.auth.getPendingEmailVerification().email,email);
 assert.equal(client().auth.getPendingEmailVerification(),null);
 await refreshed.auth.verifyEmailCode('123456');
 const resumed=client({local:app.local,temporary:app.temporary,clock:app.clock});
 assert.equal(resumed.auth.isRecoverySession(),true);assert.equal(resumed.auth.getSession(),null);
 assert.ok(!app.local.dump().includes('verified-recovery-token'));
});

test('recovery of account B never uses or prematurely replaces the signed-in account A',async()=>{
 const app=client();await app.auth.signInWithPassword('account-a@example.test',password);
 await app.auth.resetPasswordForEmail('account-b@example.test');await app.auth.verifyEmailCode('123456');
 assert.equal(app.auth.getSession().user.email,'account-a@example.test');
 assert.equal(await app.auth.getAccessToken(),'ordinary-login-token');
 await app.auth.updatePassword(password);
 assert.equal(app.calls.find(c=>c.path==='user').headers.Authorization,'Bearer verified-recovery-token');
});

test('ordinary login and forged legacy recovery flags do not authorize this recovery flow',async()=>{
 const app=client();await app.auth.signInWithPassword(email,password);app.temporary.setItem('checkats_recovery','1');
 assert.equal(app.auth.isRecoverySession(),false);
 await assert.rejects(app.auth.updatePassword(password),{code:'recovery-verification-required'});
 assert.ok(!app.calls.some(c=>c.path==='user'));
});

test('pending flow expiry and cancellation invalidate delayed verification responses',async()=>{
 const expired=client();await expired.auth.resetPasswordForEmail(email);expired.clock.now+=3600001;
 assert.equal(expired.auth.getPendingEmailVerification(),null);
 await assert.rejects(expired.auth.verifyEmailCode('123456'),{code:'verification-expired'});
 let release;const response=new Promise(resolve=>{release=resolve;});
 const delayed=client({handle:path=>path==='verify'?response:null});await delayed.auth.resetPasswordForEmail(email);
 const verify=delayed.auth.verifyEmailCode('123456');delayed.auth.cancelEmailVerification();release(Response.json(session()));
 await assert.rejects(verify,{code:'verification-cancelled'});assert.equal(delayed.auth.isRecoverySession(),false);assert.equal(delayed.auth.getSession(),null);
});

test('a provider response for the wrong email never creates a recovery grant',async()=>{
 const app=client({handle:path=>path==='verify'?Response.json(session('different@example.test')):null});
 await app.auth.resetPasswordForEmail(email);await assert.rejects(app.auth.verifyEmailCode('123456'),{code:'bad-session'});
 assert.equal(app.auth.isRecoverySession(),false);assert.equal(app.auth.getSession(),null);
});

test('failed password updates preserve the verified state for retry; success and logout clear it',async()=>{
 let fail=true;const app=client({handle:path=>path==='user'&&fail?Response.json({msg:'temporary error'},{status:503}):null});
 await app.auth.resetPasswordForEmail(email);await app.auth.verifyEmailCode('123456');
 await assert.rejects(app.auth.updatePassword(password));assert.equal(app.auth.isRecoverySession(),true);
 fail=false;await app.auth.updatePassword(password);assert.equal(app.auth.isRecoverySession(),false);
 await app.auth.resetPasswordForEmail(email);await app.auth.signOut();
 assert.equal(app.auth.getPendingEmailVerification(),null);assert.equal(app.auth.getSession(),null);assert.equal(app.auth.isRecoverySession(),false);
});

test('prepared signup and password recovery emails contain a code and no clickable confirmation URL',()=>{
 for(const file of ['confirmation','recovery']){
  const template=fs.readFileSync(require('node:path').join(__dirname,'../supabase/email-templates/'+file+'.html'),'utf8');
  assert.ok(template.includes('{{ .Token }}'));assert.doesNotMatch(template,/ConfirmationURL|TokenHash|href=/i);
 }
});
