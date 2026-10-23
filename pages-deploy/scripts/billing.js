/* Shared account, points and saved-job client. The server owns every balance. */
(function(){
  'use strict';
  const ORIGIN='https://ats-hr-review.hhjgudhdjugudh878.workers.dev';
  let account=null,revision=0,refreshPromise=null;
  const listeners=new Set();
  const language=()=>new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en';
  const words=(zh,en)=>language()==='zh'?zh:en;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(tab='plans')=>'/account/?tab='+tab+'&lang='+language();
  function emit(){listeners.forEach(fn=>fn(account));window.dispatchEvent(new CustomEvent('checkats:balance',{detail:account}));}
  async function request(path,options={}){
    const token=await window.CheckATSAuth?.getAccessToken();
    const headers=new Headers(options.headers||{});if(token)headers.set('Authorization','Bearer '+token);
    if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    let response;try{response=await fetch(ORIGIN+path,{...options,headers});}catch(_){throw Object.assign(new Error(words('连接失败，请稍后重试。','Could not connect. Please retry.')),{code:'NETWORK'});}
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok!==true){
      if(response.status===404&&['/api/billing/account','/api/auth/me','/api/jobs'].includes(path))throw Object.assign(new Error(words('账号服务尚未更新，请发布新版后端后再试。','The account service needs an update. Please deploy the new backend first.')),{code:'ACCOUNT_SERVICE_NOT_DEPLOYED',status:404});
      const known={AUTH_REQUIRED:words('请先登录账号。','Please log in first.'),INSUFFICIENT_POINTS:words('积分不足，请签到或购买积分。','Not enough points. Check in or buy a pack.'),PAID_REQUIRED:words('购买积分包或订阅后，可解锁这项功能。','Buy a points pack or subscribe to unlock this feature.'),PAYMENTS_UNAVAILABLE:words('收款尚未开通，请稍后再来。','Payments are not available yet. Please check back later.'),JOB_LIMIT:words('已保存 20 个岗位，请先删除旧方案。','You have 20 saved jobs. Delete an old one first.'),CONFLICT:words('此方案已在其他页面修改，请刷新后重试。','This job changed in another tab. Refresh before saving.'),BUSY:words('该操作仍在处理中，请稍后重试。','This operation is still processing. Please retry shortly.'),SUBSCRIPTION_EXISTS:words('你已有生效中的订阅，请在管理订阅中查看。','You already have a subscription. Open Manage subscription.'),INVALID_INPUT:words('请检查填写内容后重试。','Please check the form and try again.')};
      throw Object.assign(new Error(known[data.code]||words('服务暂不可用，请稍后重试。','Service unavailable. Please try again later.')),{code:data.code||'SERVICE_UNAVAILABLE',status:response.status});
    }
    return data;
  }
  async function refresh(){
    const current=++revision,session=window.CheckATSAuth?.getSession();
    if(!session){account=null;emit();return null;}
    const promise=request('/api/billing/account');refreshPromise=promise;
    try{const data=await promise;if(current===revision&&window.CheckATSAuth?.getSession()?.user?.id===session.user?.id){account=data;emit();}return current===revision?data:null;}finally{if(refreshPromise===promise)refreshPromise=null;}
  }
  function modal(title,content,actions=[]){
    document.getElementById('billingDialog')?.close();document.getElementById('billingDialog')?.remove();
    const previous=document.activeElement,dialog=document.createElement('dialog');dialog.id='billingDialog';dialog.className='billing-dialog';dialog.setAttribute('aria-labelledby','billingDialogTitle');
    dialog.innerHTML='<div class="billing-dialog-head"><h2 id="billingDialogTitle">'+escape(title)+'</h2><button type="button" class="billing-close" aria-label="'+words('关闭','Close')+'">×</button></div>'+content+'<div class="billing-dialog-actions"></div><p class="billing-message" role="status"></p>';
    document.body.append(dialog);dialog.querySelector('.billing-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();}});
    for(const action of actions){const button=document.createElement('button');button.type='button';button.className='button '+(action.secondary?'button-secondary':'button-primary');button.textContent=action.label;button.onclick=async()=>{if(button.disabled)return;button.disabled=true;const status=dialog.querySelector('[role=status]');status.textContent='';try{await action.run(dialog);}catch(error){status.textContent=error.message;status.classList.add('is-error');}finally{button.disabled=false;}};dialog.querySelector('.billing-dialog-actions').append(button);}
    dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});dialog.showModal();return dialog;
  }
  function login(){window.dispatchEvent(new Event('checkats:login'));}
  function requireLogin(){if(window.CheckATSAuth?.getSession())return true;modal(words('登录，继续优化这份简历。','Log in to keep improving your resume.'),'<p>'+words('验证邮箱即得 50 积分，每日签到再领 10 积分。','Get 50 points after verifying your email, plus 10 points for each daily check-in.')+'</p><p class="billing-muted">'+words('已输入的简历和岗位描述会保留。','Your resume and job description stay on this page.')+'</p>',[{label:words('登录 / 免费注册','Log in / Sign up'),run:d=>{d.close();login();}}]);return false;}
  function plansDialog(title){modal(title,'<p>'+words('一次性购买 800 积分，或订阅每期获得 2,000 积分。','Buy 800 permanent points, or subscribe for 2,000 points per period.')+'</p>',[{label:words('查看套餐与权益','View plans'),run:()=>{location.href=link('plans');}}]);}
  async function requireAi(kind){
    if(!requireLogin())return false;
    try{const a=await refresh();if(!a)return false;const cost=kind==='review'?10:20;if(a.points.total>=cost)return true;
      const actions=[];if(!a.checked_in)actions.push({label:words('签到领取 10 积分','Check in for 10 points'),run:async d=>{await checkin();d.close();}});
      actions.push({label:words('购买积分','Buy points'),secondary:!!actions.length,run:()=>{location.href=link();}});
      modal(words('积分不足','Not enough points'),'<p>'+words('本次需要 '+cost+' 积分，当前余额 '+a.points.total+' 积分。','This action costs '+cost+' points. Your balance is '+a.points.total+'.')+'</p>',actions);return false;
    }catch(error){modal(words('暂时无法读取积分','Could not load your points'),'<p>'+escape(error.message)+'</p>');return false;}
  }
  async function checkin(){const data=await request('/api/billing/checkin',{method:'POST',body:'{}'});await refresh();return data;}
  const aiRequests=new Map();
  async function fetchAi(url,options){
    const fingerprint=String(url)+'\n'+String(options.body||'');
    let id=aiRequests.get(fingerprint);if(!id){id=crypto.randomUUID();aiRequests.set(fingerprint,id);}
    const headers=new Headers(options.headers||{});headers.set('X-Request-ID',id);
    const response=await fetch(url,{...options,headers});
    if(response.status!==409)aiRequests.delete(fingerprint);
    else{const data=await response.clone().json().catch(()=>({}));if(data.code!=='BUSY')aiRequests.delete(fingerprint);}
    refresh().catch(()=>{});return response;
  }
  async function checkout(plan){if(!requireLogin())return;let data;try{data=await request('/api/billing/checkout',{method:'POST',body:JSON.stringify({plan,lang:language()})});}catch(error){if(error.status===404)error.message=words('收款尚未开通，请稍后再来。','Payments are not available yet. Please check back later.');throw error;}const url=new URL(data.url);if(url.protocol!=='https:'||!/(^|\.)creem\.io$/.test(url.hostname))throw new Error(words('支付链接无效。','Invalid checkout link.'));location.assign(url.href);}
  async function portal(){const data=await request('/api/billing/portal',{method:'POST',body:'{}'});const url=new URL(data.url);if(url.protocol!=='https:'||!/(^|\.)creem\.io$/.test(url.hostname))throw new Error(words('管理链接无效。','Invalid billing link.'));location.assign(url.href);}
  function isBasicTemplate(id){return ['refined','minimal','compact','index','charter'].includes(id);}
  function templateAllowed(id){return isBasicTemplate(id)||!!account?.entitlements?.premium;}
  async function saveJob(snapshot,id,expectedUpdatedAt){
    if(!requireLogin())return null;
    let a;try{a=await refresh();}catch(error){modal(words('无法读取账号','Account unavailable'),'<p>'+escape(error.message)+'</p>');return null;}
    if(!a?.entitlements?.premium){plansDialog(words('解锁岗位方案保存','Unlock saved job applications'));return null;}
    return new Promise(resolve=>{let saved=false;const d=modal(words('为这份准备起个名字','Name this application'),'<form id="saveJobForm"><label>'+words('公司名称','Company')+'<input name="company" required maxlength="100" autocomplete="organization" value="'+escape(snapshot.company||'')+'"></label><label>'+words('岗位名称','Job title')+'<input name="role" required maxlength="120" value="'+escape(snapshot.role||'')+'"></label><p class="billing-muted">'+words('保存简历、JD、AI 结果与排版设置。','Save your resume, job description, AI results and layout settings.')+'</p></form>',[{label:words('保存岗位方案','Save application'),run:async dialog=>{const form=dialog.querySelector('form');if(!form.reportValidity())return;const payload={company:form.company.value.trim(),role:form.role.value.trim(),snapshot,...(expectedUpdatedAt?{expected_updated_at:expectedUpdatedAt}:{})};const result=await request('/api/jobs'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:JSON.stringify(payload)});saved=true;dialog.close();resolve(result.job);}}]);d.addEventListener('close',()=>{if(!saved)resolve(null);},{once:true});d.querySelector('form').addEventListener('submit',event=>{event.preventDefault();d.querySelector('.billing-dialog-actions button').click();});});
  }
  async function authorizeExport(bytes,filename){
    if(!requireLogin())return false;
    let a;try{a=await refresh();}catch(error){modal(words('无法读取账号','Account unavailable'),'<p>'+escape(error.message)+'</p>');return false;}
    if(!a?.entitlements?.premium){plansDialog(words('解锁 PDF 导出','Unlock PDF export'));return false;}
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const attempt=()=>request('/api/billing/export',{method:'POST',body:JSON.stringify({fingerprint:hash,filename})});
    const old=await request('/api/billing/export?fingerprint='+hash);if(old.authorized)return true;
    return new Promise(resolve=>{let accepted=false;const cost=a.entitlements.unlimited_export?0:10;const d=modal(words('导出这份简历','Export this resume'),'<p class="billing-file-name">'+escape(filename)+'</p><div class="billing-receipt"><p>'+words('本次消耗','Cost')+'<strong>'+cost+' '+words('积分','points')+'</strong></p><p>'+words('当前可用','Available')+'<strong>'+a.points.total+' '+words('积分','points')+'</strong></p></div><p class="billing-muted">'+words('同一文件下载重试不重复扣分。','Downloading the same file again does not cost more points.')+'</p>',[{label:cost?words('确认导出 · 10 积分','Export · 10 points'):words('导出 PDF · 通行证权益','Export PDF · Included'),run:async dialog=>{await attempt();accepted=true;dialog.close();refresh().catch(()=>{});resolve(true);}}]);d.addEventListener('close',()=>{if(!accepted)resolve(false);},{once:true});});
  }
  window.CheckATSBilling={request,refresh,getAccount:()=>account,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},language,words,escape,link,modal,requireLogin,requireAi,plansDialog,checkin,checkout,portal,isBasicTemplate,templateAllowed,saveJob,authorizeExport,fetchAi};
  window.CheckATSAuth?.onAuthStateChange(()=>refresh().catch(()=>{}));
  window.addEventListener('storage',event=>{if(event.key==='checkats-auth-session')refresh().catch(()=>{});});
})();
