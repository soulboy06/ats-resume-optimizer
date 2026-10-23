/* One password/email-code flow shared by the analyzer and PDF studio. */
(function(){
  'use strict';
  const copy={
    zh:{login:'登录',signup:'注册',logout:'退出',credits:'{n} 次',intro:'使用邮箱和密码登录。',email:'邮箱',password:'密码',passwordHint:'至少 6 位',newPassword:'新密码',confirmPassword:'确认新密码',needAccount:'没有账号？去注册',haveAccount:'已有账号？去登录',forgot:'忘记密码？',forgotTitle:'找回密码',forgotIntro:'我们会向你的邮箱发送验证码，在当前页面继续操作。',sendCode:'发送验证码',codeTitle:'验证邮箱',codeIntro:'查看手机或电脑上的邮件，将验证码输入下方。无需点击链接。',codeLabel:'邮箱验证码',verify:'验证并继续',resend:'重新发送验证码',wait:'{n} 秒后可重发',back:'返回登录',changeEmail:'更换邮箱',sending:'处理中…',invalidEmail:'请输入有效的邮箱地址。',invalidPassword:'密码至少 6 位。',invalidCode:'请输入邮件中的 6–10 位数字验证码。',badCode:'验证码不正确、已失效或已使用，请重试或重新发送。',rateLimit:'发送过于频繁，请稍后重试。',failed:'操作失败，请稍后重试。',loginFailed:'邮箱或密码不正确，请检查后重试。',notConfirmed:'请先验证邮箱，或重新发送注册验证码。',resetTitle:'设置新密码',resetIntro:'邮箱已验证，请在这里设置新密码。',savePassword:'保存新密码',mismatch:'两次输入的密码不一致。',updated:'密码已更新，已在此设备登录。',expired:'验证已失效，请重新获取验证码。',resent:'验证码已重新发送，请查看最新邮件。',signupSent:'注册验证码已发送。',recoverySent:'如果该邮箱已注册，将会收到验证码。',close:'关闭'},
    en:{login:'Log in',signup:'Sign up',logout:'Log out',credits:'{n} credits',intro:'Log in with your email and password.',email:'Email',password:'Password',passwordHint:'At least 6 characters',newPassword:'New password',confirmPassword:'Confirm new password',needAccount:'No account? Sign up',haveAccount:'Have an account? Log in',forgot:'Forgot password?',forgotTitle:'Reset your password',forgotIntro:'We will email you a verification code. Continue on this page.',sendCode:'Send verification code',codeTitle:'Verify your email',codeIntro:'Read the email on your phone or computer and enter its code below. No link needed.',codeLabel:'Email verification code',verify:'Verify and continue',resend:'Resend code',wait:'Resend in {n}s',back:'Back to login',changeEmail:'Use another email',sending:'Working…',invalidEmail:'Enter a valid email address.',invalidPassword:'Password must be at least 6 characters.',invalidCode:'Enter the 6–10 digit code from the email.',badCode:'The code is incorrect, expired or already used. Try again or request a new code.',rateLimit:'Too many attempts. Please try again later.',failed:'Could not complete this action. Please try again.',loginFailed:'Incorrect email or password. Please try again.',notConfirmed:'Verify your email first, or request another signup code.',resetTitle:'Set a new password',resetIntro:'Email verified. Set your new password here.',savePassword:'Save new password',mismatch:'The passwords do not match.',updated:'Password updated. You are now logged in on this device.',expired:'Verification expired. Please request a new code.',resent:'A new code was sent. Check your latest email.',signupSent:'Signup code sent.',recoverySent:'If this email is registered, it will receive a verification code.',close:'Close'}
  };
  function mount(options){
    const auth=window.CheckATSAuth,$=id=>document.getElementById(id),area=$('authArea'),backdrop=$('authBackdrop'),dialog=$('authDialog');
    if(!auth||!area||!backdrop||!dialog)return null;
    let mode='login',busy=false,credits=null,lastFocus=null,statusKey='',statusError=false,refreshRevision=0;
    const text=(key,n)=>copy[options.language()==='zh'?'zh':'en'][key].replace('{n}',String(n??''));
    dialog.innerHTML='<div class="auth-head"><div><h2 id="authTitle"></h2><p id="authIntro"></p></div><button class="auth-close" id="authClose" type="button" aria-label="Close">×</button></div><form id="authForm" novalidate><div class="auth-field" id="authEmailField"><label for="authEmail"></label><input id="authEmail" name="email" type="email" required maxlength="240" autocomplete="email" placeholder="you@example.com"></div><div class="auth-field" id="authPasswordField"><label for="authPassword"></label><input id="authPassword" name="password" type="password" required minlength="6" maxlength="128" autocomplete="current-password"><p class="auth-hint" id="authPasswordHint"></p></div><div class="auth-field" id="authCodeField" hidden><label for="authCode"></label><input id="authCode" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" spellcheck="false"></div><div class="auth-field" id="authNewPasswordField" hidden><label for="authNewPassword"></label><input id="authNewPassword" name="new-password" type="password" minlength="6" maxlength="128" autocomplete="new-password"></div><div class="auth-field" id="authConfirmPasswordField" hidden><label for="authConfirmPassword"></label><input id="authConfirmPassword" name="confirm-password" type="password" minlength="6" maxlength="128" autocomplete="new-password"></div><p class="auth-verification-email" id="authVerificationEmail" hidden></p><div class="auth-actions"><button class="button button-primary" id="authSubmit" type="submit"><span class="button-label"></span></button></div><div class="auth-flow-links"><button class="auth-link-btn" id="authSwitchBtn" type="button"></button><button class="auth-link-btn" id="authForgotBtn" type="button"></button><button class="auth-link-btn" id="authResendBtn" type="button" hidden></button><button class="auth-link-btn" id="authBackBtn" type="button" hidden></button></div><p class="auth-status" id="authStatus" role="status" aria-live="polite"></p></form>';
    const form=$('authForm'),email=$('authEmail'),password=$('authPassword'),code=$('authCode'),newPassword=$('authNewPassword'),confirmPassword=$('authConfirmPassword');
    function status(key,error){statusKey=key;statusError=!!error;renderStatus();}
    function renderStatus(){const s=$('authStatus'),value=statusKey?text(statusKey):'';if(s.textContent!==value)s.textContent=value;s.className='auth-status'+(statusKey?(statusError?' error':' success'):'');}
    function errorMessage(error){
      const c=error&&error.code||'',message=String(error&&error.message||'');
      if(c==='invalid-email')return 'invalidEmail';
      if(c==='password-too-short')return 'invalidPassword';
      if(c==='invalid-code')return 'invalidCode';
      if(c==='recovery-verification-required'||c==='verification-expired')return 'expired';
      if(c==='resend-too-soon'||error&&error.status===429)return 'rateLimit';
      if(/otp_expired|token_expired|invalid_credentials|bad_code_verifier/.test(c))return mode==='code'?'badCode':'loginFailed';
      if(c==='email_not_confirmed'||/email not confirmed/i.test(message))return 'notConfirmed';
      if(mode==='code'&&error&&error.status===403)return 'badCode';
      if(mode==='login'&&/invalid login credentials/i.test(message))return 'loginFailed';
      return 'failed';
    }
    function render(){
      const pending=auth.getPendingEmailVerification(),isCode=mode==='code',isReset=mode==='reset',isPassword=mode==='login'||mode==='signup';
      $('authTitle').textContent=text(isCode?'codeTitle':isReset?'resetTitle':mode==='forgot'?'forgotTitle':mode==='signup'?'signup':'login');
      $('authIntro').textContent=text(isCode?'codeIntro':isReset?'resetIntro':mode==='forgot'?'forgotIntro':'intro');
      $('authClose').setAttribute('aria-label',text('close'));
      for(const [id,key] of [['authEmail','email'],['authPassword','password'],['authCode','codeLabel'],['authNewPassword','newPassword'],['authConfirmPassword','confirmPassword']])dialog.querySelector('label[for="'+id+'"]').textContent=text(key);
      $('authPasswordHint').textContent=text('passwordHint');
      $('authEmailField').hidden=isCode||isReset;email.disabled=busy||isCode||isReset;
      $('authPasswordField').hidden=!isPassword;password.disabled=busy||!isPassword;password.autocomplete=mode==='signup'?'new-password':'current-password';
      $('authCodeField').hidden=!isCode;code.disabled=busy||!isCode;
      $('authNewPasswordField').hidden=!isReset;$('authConfirmPasswordField').hidden=!isReset;newPassword.disabled=busy||!isReset;confirmPassword.disabled=busy||!isReset;
      $('authVerificationEmail').hidden=!isCode;$('authVerificationEmail').textContent=isCode&&pending?pending.email:'';
      $('authSubmit').disabled=busy;$('authSubmit').querySelector('.button-label').textContent=text(busy?'sending':isCode?'verify':isReset?'savePassword':mode==='forgot'?'sendCode':mode==='signup'?'signup':'login');
      $('authSwitchBtn').hidden=!isPassword;$('authSwitchBtn').textContent=text(mode==='signup'?'haveAccount':'needAccount');$('authSwitchBtn').disabled=busy;
      $('authForgotBtn').hidden=mode!=='login';$('authForgotBtn').textContent=text('forgot');$('authForgotBtn').disabled=busy;
      $('authBackBtn').hidden=isPassword;$('authBackBtn').textContent=text(isCode?'changeEmail':'back');$('authBackBtn').disabled=busy;
      $('authResendBtn').hidden=!isCode;
      const seconds=pending?Math.max(0,Math.ceil((pending.resendAt-Date.now())/1000)):0;
      $('authResendBtn').disabled=busy||seconds>0||!pending;$('authResendBtn').textContent=seconds?text('wait',seconds):text('resend');
      renderStatus();
    }
    function setMode(next){mode=next;statusKey='';statusError=false;render();}
    function focusField(){(mode==='code'?code:mode==='reset'?newPassword:email).focus();}
    function open(){
      if(!auth.configured())return;
      lastFocus=document.activeElement;
      if(auth.isRecoverySession())setMode('reset');
      else if(auth.getPendingEmailVerification())setMode('code');
      else if(mode==='code'||mode==='reset')setMode('login');
      backdrop.classList.add('active');backdrop.setAttribute('aria-hidden','false');document.body.classList.add('auth-open');render();focusField();
    }
    function close(){backdrop.classList.remove('active');backdrop.setAttribute('aria-hidden','true');document.body.classList.remove('auth-open');password.value='';code.value='';newPassword.value='';confirmPassword.value='';if(lastFocus&&lastFocus.isConnected)lastFocus.focus();}
    function renderArea(session){
      area.replaceChildren();
      if(!session){const b=document.createElement('button');b.id='authLoginBtn';b.type='button';b.className='auth-login-btn';b.textContent=text('login');b.addEventListener('click',open);area.append(b);return;}
      const user=document.createElement('span');user.className='auth-user';const who=document.createElement('span');who.className='auth-email';who.textContent=session.user&&session.user.email||'';who.title=who.textContent;user.append(who);
      if(credits!==null){const count=document.createElement('span');count.className='auth-credits';count.textContent=text('credits',credits);user.append(count);}
      const out=document.createElement('button');out.type='button';out.className='auth-logout-btn';out.textContent=text('logout');out.addEventListener('click',()=>auth.signOut());area.append(user,out);
    }
    async function refresh(){
      const revision=++refreshRevision,session=auth.getSession();
      if(!session)credits=null;renderArea(session);render();
      if(!session)return;
      try{const response=await options.request('/api/auth/me',{method:'GET'}),data=await response.json();if(revision===refreshRevision&&response.ok&&data.ok&&auth.getSession()?.user?.id===session.user?.id){credits=Number.isFinite(Number(data.credits))?Math.max(0,Number(data.credits)):0;renderArea(auth.getSession());}}catch(_){}
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      if((mode==='login'||mode==='signup'||mode==='forgot')&&!email.checkValidity()){status('invalidEmail',true);email.focus();return;}
      if((mode==='login'||mode==='signup')&&password.value.length<6){status('invalidPassword',true);password.focus();return;}
      if(mode==='reset'&&newPassword.value.length<6){status('invalidPassword',true);newPassword.focus();return;}
      if(mode==='reset'&&newPassword.value!==confirmPassword.value){status('mismatch',true);confirmPassword.focus();return;}
      const operation=mode;busy=true;statusKey='';render();
      try{
        if(operation==='login'){await auth.signInWithPassword(email.value,password.value);close();}
        else if(operation==='signup'){const result=await auth.signUp(email.value,password.value);password.value='';if(result.needsConfirmation){setMode('code');status('signupSent');}else close();}
        else if(operation==='forgot'){await auth.resetPasswordForEmail(email.value);setMode('code');status('recoverySent');}
        else if(operation==='code'){const result=await auth.verifyEmailCode(code.value);code.value='';if(result.purpose==='recovery')setMode('reset');else close();}
        else if(operation==='reset'){await auth.updatePassword(newPassword.value);newPassword.value='';confirmPassword.value='';setMode('login');close();}
      }catch(error){status(errorMessage(error),true);}
      finally{busy=false;render();if(backdrop.classList.contains('active'))focusField();}
    });
    $('authForgotBtn').addEventListener('click',()=>{password.value='';setMode('forgot');email.focus();});
    $('authSwitchBtn').addEventListener('click',()=>{password.value='';setMode(mode==='signup'?'login':'signup');email.focus();});
    $('authBackBtn').addEventListener('click',()=>{const pending=auth.getPendingEmailVerification();if(pending)email.value=pending.email;const next=pending?.purpose==='recovery'?'forgot':pending?.purpose==='signup'?'signup':'login';auth.cancelEmailVerification();auth.cancelRecovery();code.value='';newPassword.value='';confirmPassword.value='';setMode(next);focusField();});
    $('authResendBtn').addEventListener('click',async()=>{if(busy)return;busy=true;render();try{await auth.resendEmailCode();code.value='';status('resent');}catch(error){status(errorMessage(error),true);}finally{busy=false;render();code.focus();}});
    $('authClose').addEventListener('click',close);backdrop.addEventListener('click',event=>{if(event.target===backdrop)close();});
    document.addEventListener('keydown',event=>{
      if(!backdrop.classList.contains('active'))return;
      if(event.key==='Escape'){event.preventDefault();close();}
      if(event.key==='Tab'){const items=[...dialog.querySelectorAll('button,input,a[href]')].filter(e=>!e.disabled&&e.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    });
    auth.onAuthStateChange(()=>refresh());
    const timer=setInterval(()=>{if(backdrop.classList.contains('active')&&mode==='code')render();},1000);
    addEventListener('pagehide',()=>clearInterval(timer),{once:true});
    auth.handleRedirectCallback().catch(()=>status('expired',true)).then(()=>{refresh();if(auth.isRecoverySession())open();});
    refresh();
    return {open,close,refresh,render};
  }
  window.CheckATSAuthUI={mount};
})();
