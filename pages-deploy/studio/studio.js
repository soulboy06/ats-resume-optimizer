(function(){
  'use strict';
  const engine=window.StudioEngine,$=id=>document.getElementById(id);
  const copy={
    en:{emptyTitle:'Add your resume to preview.',titleFirst:'Your story.',titleLast:'Ready to send.',shortTemplate:'Choose a layout',shortDetails:'Make it yours',shortExport:'Export your PDF',title:'Your story. Ready to send.',intro:'Choose a layout, make it yours, and leave with a readable PDF.',privacy:'Resume and photos stay in your browser.',back:'← Back to analyzer',stepOne:'01 / CHOOSE A LOOK',templates:'Choose your template.',credits:'Template sources & licenses ↗',paper:'Paper',fontSize:'Text size',headingLanguage:'PDF headings',stepTwo:'02 / MAKE IT YOURS',details:'Your personal details.',name:'Full name',role:'Professional title',contact:'Contact details & links',uploadPhoto:'Add a photo (optional)',removePhoto:'Remove',photoHint:'Optional · JPG, PNG or WebP · up to 5 MB. Center-cropped for the header.',content:'Words worth keeping.',contentHint:'Review the imported sections. Unknown content is kept under Additional information.',paste:'Paste a complete resume',raw:'Complete resume text',apply:'Apply to fields',replaceHint:'Replaces the text fields below.',clear:'Clear this draft',stepThree:'03 / READY WHEN YOU ARE',preview:'Your finished resume.',download:'Download PDF',empty:'Your resume will appear here. Start with your rewrite or paste your text.',footnote:'Selectable text, automatic page breaks, no watermark. Review every page before sending.',summary:'Summary',experience:'Experience',projects:'Projects',education:'Education',skills:'Skills',certs:'Certifications',other:'Additional information',busy:'Preparing your PDF…',ready:'PDF ready. Text extraction checked. Pages: ',stale:'Updating preview. Download will be ready when it matches your edits.',storage:'Draft saved in this browser tab.',storageFail:'Browser storage is unavailable. Keep this page open and download your PDF before leaving.',imported:'Your AI rewrite is ready to style. Check the section fields before downloading.',loaded:'Resume applied. Check the fields and content order.',noText:'Paste your resume text first.',photoError:'Choose a valid JPG, PNG or WebP up to 5 MB.',photoReady:'Photo added locally. It is included in the PDF.',emptyError:'Add your resume content to begin.',fontError:'A character is not supported by the bundled fonts. Replace it and retry.',roundTrip:'The generated text could not be verified. Download is blocked; review your content and retry.',error:'PDF could not be prepared. Your content is kept; edit a field to retry.',contentLimit:'Use at most 60,000 characters in total and 30,000 per section.',pages:'This draft exceeds 15 pages. Shorten the content before exporting.',cleared:'Draft cleared.',confirmClear:'Clear all text and the photo from this draft?',page:'Page',restore:'Draft restored in this tab.'},
    zh:{emptyTitle:'填写简历后预览。',titleFirst:'你的经历，',titleLast:'准备好出发。',shortTemplate:'选择简历版式',shortDetails:'完善个人内容',shortExport:'预览并导出',title:'你的经历，准备好出发。',intro:'选一个喜欢的版式，补充细节，带走一份清晰可读的 PDF 简历。',privacy:'简历与照片仅在本机处理。',back:'← 返回分析首页',stepOne:'01 / 选择版式',templates:'选择简历模板。',credits:'模板来源与许可 ↗',paper:'纸张',fontSize:'正文字号',headingLanguage:'PDF 栏目语言',stepTwo:'02 / 补充细节',details:'完善个人信息。',name:'姓名',role:'求职意向 / 职业标题',contact:'联系方式与个人链接',uploadPhoto:'上传照片（可选）',removePhoto:'移除',photoHint:'可选 · JPG、PNG 或 WebP · 不超过 5 MB。照片居中裁切后放在页首。',content:'值得留下的经历。',contentHint:'请检查自动分配的栏目。未识别内容保留在「其他信息」，可以自行调整。',paste:'粘贴完整简历',raw:'完整简历文字',apply:'一键填入栏目',replaceHint:'会替换下方栏目中的文字。',clear:'清空当前草稿',stepThree:'03 / 准备好，即可出发',preview:'预览你的简历。',download:'下载 PDF',empty:'你的简历将在这里呈现。从 AI 改写结果进入，或粘贴简历开始制作。',footnote:'原生可选文字 · 自动分页 · 无水印。发送前请检查每一页。',summary:'个人简介',experience:'工作经历',projects:'项目经历',education:'教育背景',skills:'专业技能',certs:'证书认证',other:'其他信息',busy:'正在生成 PDF…',ready:'PDF 已就绪，已验证文字可解析。页数：',stale:'正在更新预览，完成后可下载最新版本。',storage:'草稿已保存在当前浏览器标签页。',storageFail:'浏览器存储不可用，请保持页面开启，并在离开前下载 PDF。',imported:'已带入 AI 改写结果。选择模板后，请核对各栏目再导出。',loaded:'已填入简历，请检查各栏目与内容顺序。',noText:'请先粘贴简历文字。',photoError:'请上传有效的 JPG、PNG 或 WebP 图片，且不超过 5 MB。',photoReady:'照片已在本机加入，将随 PDF 导出。',emptyError:'填写简历后即可预览。',fontError:'导出字体暂不支持某个字符，请替换后重试。',roundTrip:'导出文字未通过解析验证，已阻止下载。请检查内容后重试。',error:'未能生成 PDF，内容已保留。修改任一字段可重试。',contentLimit:'简历总计最多 60,000 字符，每栏最多 30,000 字符。',pages:'当前简历超过 15 页，请缩短内容后导出。',cleared:'已清空草稿。',confirmClear:'清空当前草稿中的文字和照片？',page:'第',restore:'已恢复当前标签页的草稿。'}
  };
  Object.assign(copy.en,{title:'Resume PDF Studio',back:'Back to analyzer',navAnalyzer:'Resume analyzer',navStudio:'PDF Studio',navGuide:'Guides',contentTab:'Content',styleTab:'Style',pageStyle:'Page style',editContent:'Edit content',templates:'Choose a template',details:'Personal details',role:'Professional title',uploadPhoto:'Add a photo',preview:'Resume preview',download:'Export PDF',saved:'Saved',all:'All',previous:'Previous template',next:'Next template',close:'Close editor',zoomIn:'Zoom in',zoomOut:'Zoom out',fullscreen:'Fullscreen preview'});
  Object.assign(copy.zh,{title:'简历制作工作台',back:'返回改写',navAnalyzer:'简历分析',navStudio:'PDF 工作台',navGuide:'使用指南',contentTab:'内容',styleTab:'样式',pageStyle:'页面样式',editContent:'编辑内容',templates:'选择模板',details:'基本信息',role:'职位',uploadPhoto:'添加照片',preview:'简历预览',download:'导出 PDF',saved:'已保存',all:'全部',previous:'上一个模板',next:'下一个模板',close:'关闭编辑器',zoomIn:'放大预览',zoomOut:'缩小预览',fullscreen:'全屏预览'});
  Object.assign(copy.en,{authTitle:'Log in',authIntro:'We’ll email you a sign-in link. No password needed.',authClose:'Close',authEmailLabel:'Email',authSendLink:'Send sign-in link',authSending:'Sending…',authCheckEmail:'Sign-in link sent — check your inbox.',authFailed:'Couldn’t send the link. Please try again.',authInvalidEmail:'Enter a valid email address.',authLogin:'Log in',authLogout:'Log out',authCredits:'{count} credits',authCreditsOne:'1 credit',authTabLink:'Magic link',authTabPassword:'Password',authPasswordLabel:'Password',authPasswordHint:'At least 6 characters. Passwords are hashed \u2014 we never see them.',authPasswordIntro:'Log in with your email and password on any device.',authSignIn:'Log in',authSignUp:'Sign up',authNeedAccount:'No account? Sign up',authHaveAccount:'Have an account? Log in',authPasswordTooShort:'Password must be at least 6 characters.',authConfirmEmail:'Account created \u2014 check your email to confirm, then log in.',authForgotPassword:'Forgot password?',authResetSent:'Password reset email sent \u2014 check your inbox.',authNewPasswordLabel:'New password',authSetPassword:'Set new password',authPasswordUpdated:'Password updated \u2014 you are logged in.'});
  Object.assign(copy.zh,{authTitle:'登录',authIntro:'我们会给你发一封登录链接邮件，无需密码。',authClose:'关闭',authEmailLabel:'邮箱',authSendLink:'发送登录链接',authSending:'发送中…',authCheckEmail:'登录链接已发送，请查收邮件。',authFailed:'发送失败，请重试。',authInvalidEmail:'请输入有效的邮箱地址。',authLogin:'登录',authLogout:'退出',authCredits:'{count} 次',authCreditsOne:'1 次',authTabLink:'邮件链接',authTabPassword:'密码',authPasswordLabel:'密码',authPasswordHint:'至少 6 位。密码经哈希存储，我们看不到明文。',authPasswordIntro:'用邮箱+密码在任何设备上登录。',authSignIn:'登录',authSignUp:'注册',authNeedAccount:'没有账号？去注册',authHaveAccount:'已有账号？去登录',authPasswordTooShort:'密码至少 6 位。',authConfirmEmail:'账号已创建，请查收邮件确认后再登录。',authForgotPassword:'忘记密码？',authResetSent:'重置邮件已发送，请查收邮箱。',authNewPasswordLabel:'新密码',authSetPassword:'设置新密码',authPasswordUpdated:'密码已更新，你已登录。'});
  const map={fName:'name',fTitle:'title',fContact:'contact'};
  Object.assign(copy.en,{lineSpacing:'Line spacing',templateSpacing:'Template default'});
  Object.assign(copy.zh,{lineSpacing:'正文行距',templateSpacing:'模板默认'});
  Object.assign(copy.en,{layout:'Content extends beyond the page. Shorten long fields or choose a smaller text size.',assets:'The template assets could not load. Check your connection and edit a field to retry.',compiler:'The template engine could not finish. Edit a field to retry.'});
  Object.assign(copy.zh,{layout:'内容超出页面，请缩短过长字段或调小字号后重试。',assets:'模板资源加载失败，请检查网络后修改任一字段重试。',compiler:'模板生成未完成，请修改任一字段重试。'});
  let lang=new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en';
  let state={data:engine.blank(),template:'refined',paper:'a4',size:'10.5',lineSpacing:'auto',contentLanguage:lang,photo:null};
  let revision=0,result=null,timer,rendering=false,fontBytes,photoVersion=0;
  const t=key=>copy[lang][key]||key;
  function notice(text,error=false){$('handoffStatus').textContent=text;$('handoffStatus').dataset.message=Object.keys(copy.en).find(key=>copy.en[key]===text||copy.zh[key]===text)||'';$('handoffStatus').classList.toggle('is-error',error);$('handoffStatus').classList.toggle('sr-only',!error);}
  function status(text,error=false){const busy=!error&&(text===t('busy')||text===t('stale'));$('exportPdfBtn').classList.toggle('is-preparing',busy);$('studioPreview').setAttribute('aria-busy',String(busy));$('exportStatus').textContent=text;$('exportStatus').classList.toggle('is-error',error);$('exportStatus').classList.toggle('sr-only',!error);$('exportStatus').hidden=false;}
  function save(){try{sessionStorage.setItem('checkats_studio_draft',JSON.stringify(state));$('draftStatus').textContent='';$('draftStatus').hidden=true;$('saveIndicator').textContent=t('saved');return true;}catch(_){$('saveIndicator').textContent='';$('draftStatus').textContent=t('storageFail');$('draftStatus').hidden=false;$('draftStatus').classList.add('is-error');return false;}}
  let zoom=85,drag=null,suppressClickUntil=0,wheelDelta=0,wheelTime=0,wheelLastStep=0;
  function layoutCarousel(dragOffset=0){
    const list=StudioTemplates.list(),active=list.findIndex(item=>item.id===state.template),width=$('templateGrid').clientWidth;
    const cardWidth=width>=800?140:width>=480?126:110,step=width>=800?154:width>=480?138:108;
    $('templateGrid').style.setProperty('--card-width',cardWidth+'px');
    document.querySelectorAll('.template-card').forEach((button,index)=>{
      let distance=index-active;const half=list.length/2;if(distance>half)distance-=list.length;if(distance<-half)distance+=list.length;
      const amount=distance+dragOffset/step,selected=index===active;
      button.style.setProperty('--offset',(distance*step+dragOffset)+'px');button.style.setProperty('--rise',Math.min(amount*amount*8,110)+'px');button.style.setProperty('--rotation',Math.max(-9,Math.min(9,-amount*3))+'deg');button.style.setProperty('--scale',Math.max(.68,1-Math.abs(amount)*.11));
      button.setAttribute('aria-pressed',String(selected));button.tabIndex=selected?0:-1;button.style.zIndex=String(20-Math.min(19,Math.abs(distance)));
      const visible=Math.abs(distance*step)<width/2+cardWidth/2;button.style.visibility=visible?'visible':'hidden';
    });
    $('selectedTemplate').textContent=StudioTemplates.get(state.template).name[lang];$('templatePosition').textContent=(active+1)+' / '+list.length;$('templateTotal').textContent=t('all')+' '+list.length;
    $('templateTotal').href='/studio/templates/?lang='+lang+'&current='+encodeURIComponent(state.template);$('templateTotal').setAttribute('aria-label',(lang==='zh'?'浏览全部模板':'Browse all templates')+' ('+list.length+')');
    $('templatePrev').disabled=$('templateNext').disabled=list.length<2;
  }
  function chooseTemplate(id,focus=false){if(!window.CheckATSBilling.templateAllowed(id)){window.CheckATSBilling.plansDialog(lang==='zh'?'解锁全部 30 个模板':'Unlock all 30 templates');return;}if(id===state.template){layoutCarousel();return;}state.template=id;$('templateCredit').textContent=StudioTemplates.get(id).credit;layoutCarousel();if(focus)$('templateGrid').querySelector('[aria-pressed=true]').focus({preventScroll:true});schedule();}
  function stepTemplate(delta,focus=false){const list=StudioTemplates.list(),index=list.findIndex(item=>item.id===state.template);chooseTemplate(list[(index+delta+list.length)%list.length].id,focus);}
  function renderTemplates(){
    $('templateGrid').replaceChildren();
    for(const template of StudioTemplates.list()){
      const button=document.createElement('button');button.type='button';button.className='template-card '+template.id;
      button.setAttribute('aria-pressed',String(template.id===state.template));button.setAttribute('aria-label',template.name[lang]);button.title=template.desc[lang];button.style.setProperty('--template-accent',template.accent);
      const sheet=document.createElement('img');sheet.className='template-sheet';sheet.src='/studio/assets/'+template.id+'.webp';sheet.alt='';sheet.width=170;sheet.height=240;
      const label=document.createElement('strong');label.textContent=template.name[lang];button.append(sheet,label);
      button.classList.toggle('is-premium',!window.CheckATSBilling.templateAllowed(template.id));button.addEventListener('click',()=>chooseTemplate(template.id));$('templateGrid').append(button);
    }
    $('templateCredit').textContent=StudioTemplates.get(state.template).credit;
    layoutCarousel();
  }
  function language(){
    document.documentElement.lang=lang;document.title=lang==='zh'?'PDF 简历工作台 | CheckATS':'Resume PDF Studio | CheckATS';
    document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
    document.querySelectorAll('[data-lang]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.lang===lang));button.classList.toggle('active',button.dataset.lang===lang);});
    document.querySelectorAll('[data-home-link]').forEach(link=>link.href=lang==='zh'?'/?lang=zh':'/');document.querySelector('[data-studio-link]').href='/studio/?lang='+lang;document.querySelector('[data-guide-link]').href=lang==='zh'?'/zh/guide/':'/guide/';
    for(const[id,key]of [['templatePrev','previous'],['templateNext','next'],['editorClose','close'],['editorBackdrop','close'],['zoomIn','zoomIn'],['zoomOut','zoomOut'],['previewFullscreen','fullscreen']])$(id).setAttribute('aria-label',t(key));
    if($('saveIndicator').textContent)$('saveIndicator').textContent=t('saved');
    for(const key of ['summary','experience','projects','education','skills','certs','other'])$('label-'+key).textContent=t(key);
    if($('handoffStatus').dataset.message)$('handoffStatus').textContent=t($('handoffStatus').dataset.message);
    document.querySelectorAll('.pdf-page').forEach((figure,index)=>{figure.querySelector('figcaption').textContent=t('page')+' '+(index+1)+' / '+(result?.pages||'');figure.querySelector('canvas').setAttribute('aria-label',t('page')+' '+(index+1));});
    renderTemplates();if(result)status(t('ready')+result.pages);else if(rendering)status(t('busy'));
  }
  function sync(){for(const [id,key]of Object.entries(map))$(id).value=state.data[key];$('paper').value=state.paper;$('fontSize').value=state.size;$('lineSpacing').value=state.lineSpacing;$('contentLanguage').value=state.contentLanguage;photoPreview();}
  function photoPreview(){const host=$('photoPreview');host.replaceChildren();if(state.photo){const img=document.createElement('img');img.src=state.photo;img.alt='';host.append(img);}else host.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>';$('photoRemove').hidden=!state.photo;}
  function schedule(){revision++;result=null;$('exportPdfBtn').disabled=true;document.querySelector('.studio-preview').classList.add('is-stale');status(t('stale'));save();clearTimeout(timer);timer=setTimeout(build,250);}
  async function build(){
    if(rendering)return;rendering=true;
    const version=revision,snapshot=JSON.parse(JSON.stringify(state));status(t('busy'));
    let pdf;
    try{
      await window.studioPdfReady;
      const generator=StudioTemplates.get(snapshot.template).engine==='typst'?window.StudioTypstEngine:engine;
      const built=await generator.generate(snapshot.data,snapshot,{templates:StudioTemplates,pdfLib:PDFLib,fontkit:window.fontkit,pdfjs:window.pdfjsLib,unicodeFont:async()=>{
        if(!fontBytes){const response=await fetch('/vendor/fonts/NotoSansSC.ttf');if(!response.ok)throw new Error('font');fontBytes=new Uint8Array(await response.arrayBuffer());}return fontBytes;
      }});
      if(version!==revision)return;
      pdf=await pdfjsLib.getDocument({data:built.bytes.slice(),isEvalSupported:false,standardFontDataUrl:'/vendor/standard_fonts/'}).promise;
      const fragment=document.createDocumentFragment();
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n),view=page.getViewport({scale:1.3}),canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('page')+' '+n);
        await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
        const figure=document.createElement('figure');figure.className='pdf-page';const caption=document.createElement('figcaption');caption.textContent=t('page')+' '+n+' / '+pdf.numPages;figure.append(caption,canvas);fragment.append(figure);
        if(version!==revision)return;
      }
      if(version!==revision)return;
      $('resumePreview').replaceChildren(fragment);updateZoom();result=built;$('exportPdfBtn').disabled=false;document.querySelector('.studio-preview').classList.remove('is-stale');status(t('ready')+built.pages);
    }catch(error){if(version===revision){result=null;$('exportPdfBtn').disabled=true;const key=error.message==='empty'?'emptyError':error.message==='font'?'fontError':Object.hasOwn(copy.en,error.message)?error.message:'error';status(t(key),error.message!=='empty');}}
    finally{if(pdf)await pdf.destroy();rendering=false;if(version!==revision){clearTimeout(timer);timer=setTimeout(build,50);}}
  }
  async function photo(file){
    const version=++photoVersion;
    try{
      if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error();
      const bitmap=await createImageBitmap(file);
      if(bitmap.width*bitmap.height>40000000){bitmap.close();throw new Error();}
      const canvas=document.createElement('canvas');canvas.width=360;canvas.height=470;
      const ratio=Math.max(canvas.width/bitmap.width,canvas.height/bitmap.height),w=bitmap.width*ratio,h=bitmap.height*ratio;
      canvas.getContext('2d').drawImage(bitmap,(360-w)/2,(470-h)/2,w,h);bitmap.close();
      if(version!==photoVersion)return;state.photo=canvas.toDataURL('image/png');photoPreview();$('photoStatus').textContent='';schedule();
    }catch(_){if(version===photoVersion)$('photoStatus').textContent=t('photoError');}
    finally{$('photoInput').value='';}
  }
  function apply(text){state.data=engine.parse(text);state.contentLanguage=/[\u3400-\u9fff]/.test(text)?'zh':'en';sync();schedule();}
  // Create every editable section, including the lossless fallback for unknown sections.
  for(const key of ['summary','experience','projects','education','skills','certs','other']){
    const wrap=document.createElement('details');wrap.className='editor-section';wrap.open=key==='summary';const label=document.createElement('summary');label.id='label-'+key;
    const field=document.createElement('div');field.className='studio-field section-content';const input=document.createElement('textarea');input.id='f-'+key;input.setAttribute('aria-labelledby',label.id);input.rows=['experience','projects'].includes(key)?7:4;input.maxLength=30000;map[input.id]=key;field.append(input);wrap.append(label,field);$('sectionFields').append(wrap);
  }
  try{const draft=JSON.parse(sessionStorage.getItem('checkats_studio_draft')||'null');if(draft){state={...state,...draft,data:engine.validate(draft.data)};state.template=StudioTemplates.get(state.template).id;if(!new URLSearchParams(location.search).has('lang')&&['en','zh'].includes(draft.uiLanguage))lang=draft.uiLanguage;notice(t('restore'));}
    const handoff=JSON.parse(sessionStorage.getItem('checkats_studio_handoff')||'null');
    const legacy=localStorage.getItem('checkats_ai_rewrite');
    const text=handoff?.text||legacy;
    if(typeof text==='string'&&text.trim()){if(['en','zh'].includes(handoff?.lang))lang=handoff.lang;state.data=engine.parse(text);state.photo=null;state.contentLanguage=/[\u3400-\u9fff]/.test(text)?'zh':'en';sessionStorage.removeItem('checkats_studio_handoff');localStorage.removeItem('checkats_ai_rewrite');notice(t('imported'));}
  }catch(_){notice(t('storageFail'),true);}
  const selectionUrl=new URL(location.href),requestedTemplate=selectionUrl.searchParams.get('template');
  if(requestedTemplate!==null){if(StudioTemplates.list().some(item=>item.id===requestedTemplate)){state.template=requestedTemplate;state.uiLanguage=lang;save();}selectionUrl.searchParams.delete('template');history.replaceState(null,'',selectionUrl);}
  $('templateTotal').addEventListener('click',event=>{if(!save()&&(Object.values(state.data).some(Boolean)||state.photo)){event.preventDefault();notice(t('storageFail'),true);}});
  for(const[id,key]of Object.entries(map))$(id).addEventListener('input',()=>{state.data[key]=$(id).value;schedule();});
  for(const[id,key]of [['paper','paper'],['fontSize','size'],['lineSpacing','lineSpacing'],['contentLanguage','contentLanguage']])$(id).addEventListener('change',()=>{state[key]=$(id).value;schedule();});
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{lang=button.dataset.lang;state.uiLanguage=lang;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);language();save();}));
  $('applyText').addEventListener('click',()=>{if(!$('rawResume').value.trim())return notice(t('noText'),true);apply($('rawResume').value);$('importDetails').open=false;notice(t('loaded'));});
  $('photoInput').addEventListener('change',()=>photo($('photoInput').files[0]));
  $('photoRemove').addEventListener('click',()=>{photoVersion++;state.photo=null;photoPreview();$('photoStatus').textContent='';schedule();});
  const emptyPreview=$('resumePreview').firstElementChild.cloneNode(true);
  $('clearBtn').addEventListener('click',()=>{if(!confirm(t('confirmClear')))return;photoVersion++;state.data=engine.blank();state.photo=null;$('rawResume').value='';$('photoStatus').textContent='';sync();schedule();$('resumePreview').replaceChildren(emptyPreview.cloneNode(true));language();notice(t('cleared'));});
  $('exportPdfBtn').addEventListener('click',async()=>{
    if(!result)return;const current=result,version=revision;
    $('exportPdfBtn').disabled=true;
    try{const filename=(state.data.name||'resume').replace(/[^\p{L}\p{N}_-]/gu,'_')+'-'+state.template+'.pdf';
      if(!window.CheckATSBilling.templateAllowed(state.template)){window.CheckATSBilling.plansDialog(lang==='zh'?'解锁这个模板后再导出':'Unlock this template to export');return;}
      if(!(await window.CheckATSBilling.authorizeExport(current.bytes,filename)))return;
      if(version!==revision){notice(lang==='zh'?'内容已修改，请重新导出。':'Content changed. Export the latest version.',true);return;}
      const url=URL.createObjectURL(new Blob([current.bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){notice(error.message,true);}finally{if(result)$('exportPdfBtn').disabled=false;}
  });
  const saveJob=document.createElement('button');saveJob.type='button';saveJob.className='button button-secondary button-sm billing-studio-save';saveJob.id='saveJobButton';
  saveJob.addEventListener('click',async()=>{saveJob.disabled=true;try{
    let context=null,snapshot={};try{context=JSON.parse(sessionStorage.getItem('checkats_job_context')||'null');snapshot=JSON.parse(sessionStorage.getItem('checkats_analyzer_snapshot')||'{}');}catch(_){}
    const saved=await window.CheckATSBilling.saveJob({...snapshot,studio:state,company:context?.company||'',role:context?.role||''},context?.id,context?.updated_at);
    if(saved){sessionStorage.setItem('checkats_job_context',JSON.stringify({id:saved.id,company:saved.company,role:saved.role,updated_at:saved.updated_at}));$('saveIndicator').textContent=lang==='zh'?'岗位方案已保存':'Application saved';}
  }finally{saveJob.disabled=false;}});
  document.querySelector('.studio-actions').prepend(saveJob);
  function updateBillingLabels(){
    saveJob.textContent=lang==='zh'?'保存到岗位':'Save to a job';
    const a=window.CheckATSBilling.getAccount(),label=$('exportPdfBtn').querySelector('span');
    label.textContent=a?.entitlements?.unlimited_export?(lang==='zh'?'导出 PDF · 通行证权益':'Export PDF · Included'):a?.entitlements?.premium?(lang==='zh'?'导出 PDF · 10 积分':'Export PDF · 10 points'):(lang==='zh'?'解锁 PDF 导出':'Unlock PDF export');
  }
  window.addEventListener('checkats:balance',()=>{renderTemplates();updateBillingLabels();});
  function updateZoom(){
    const host=$('resumePreview'),style=getComputedStyle(host),available=host.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    host.style.setProperty('--paper-width',Math.max(100,Math.min(660,available)*zoom/100)+'px');$('zoomValue').textContent=zoom+'%';$('zoomOut').disabled=zoom<=50;$('zoomIn').disabled=zoom>=150;
  }
  $('zoomOut').addEventListener('click',()=>{zoom=Math.max(50,zoom-10);updateZoom();});$('zoomIn').addEventListener('click',()=>{zoom=Math.min(150,zoom+10);updateZoom();});
  $('previewFullscreen').hidden=!document.fullscreenEnabled;
  $('previewFullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('studioPreview').requestFullscreen();}catch(_){}});
  const compact=matchMedia('(max-width:960px)');let editorReturnFocus;
  function openEditor(){
    if(!compact.matches){$('fName').focus();return;}
    editorReturnFocus=document.activeElement;$('studioEditor').classList.add('is-open');$('studioEditor').setAttribute('role','dialog');$('studioEditor').setAttribute('aria-modal','true');$('editorBackdrop').hidden=false;$('studioWorkspace').inert=true;document.body.classList.add('editor-is-open');$('editorOpen').setAttribute('aria-expanded','true');$('editorClose').focus();
  }
  function closeEditor(){const wasOpen=$('studioEditor').classList.contains('is-open');$('studioEditor').classList.remove('is-open');$('studioEditor').removeAttribute('role');$('studioEditor').removeAttribute('aria-modal');$('editorBackdrop').hidden=true;$('studioWorkspace').inert=false;document.body.classList.remove('editor-is-open');$('editorOpen').setAttribute('aria-expanded','false');if(wasOpen&&compact.matches)editorReturnFocus?.focus();}
  $('editorOpen').addEventListener('click',openEditor);$('editorClose').addEventListener('click',closeEditor);$('editorBackdrop').addEventListener('click',closeEditor);compact.addEventListener('change',()=>{if(!compact.matches)closeEditor();});
  $('resumePreview').addEventListener('click',event=>{if(event.target.closest('#emptyEdit')){openEditor();$('importDetails').open=true;if(!compact.matches)$('rawResume').focus();}});
  document.addEventListener('keydown',event=>{
    if(!$('studioEditor').classList.contains('is-open'))return;
    if(event.key==='Escape'){event.preventDefault();closeEditor();}
    if(event.key==='Tab'){const focusable=[...$('studioEditor').querySelectorAll('button:not([disabled]),a,input,textarea,select,summary')].filter(el=>el.tabIndex!==-1&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  function editorTab(name,focus=false){document.querySelectorAll('[data-editor-tab]').forEach(button=>{const active=button.dataset.editorTab===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;$(button.getAttribute('aria-controls')).hidden=!active;if(active&&focus)button.focus();});}
  document.querySelectorAll('[data-editor-tab]').forEach(button=>{button.addEventListener('click',()=>editorTab(button.dataset.editorTab));button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();editorTab(event.key==='Home'?'content':event.key==='End'?'style':button.dataset.editorTab==='content'?'style':'content',true);}});});
  $('templatePrev').addEventListener('click',()=>stepTemplate(-1));$('templateNext').addEventListener('click',()=>stepTemplate(1));
  const grid=$('templateGrid');
  grid.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();if(event.key==='Home')chooseTemplate(StudioTemplates.list()[0].id,true);else if(event.key==='End')chooseTemplate(StudioTemplates.list().at(-1).id,true);else stepTemplate(event.key==='ArrowRight'?1:-1,true);}});
  grid.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  grid.addEventListener('pointerdown',event=>{if(event.isPrimary&&event.button===0)drag={id:event.pointerId,x:event.clientX,y:event.clientY,active:false};});
  grid.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.active){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}if(Math.abs(dx)<8)return;drag.active=true;grid.setPointerCapture(event.pointerId);grid.classList.add('is-dragging');}layoutCarousel(Math.max(-150,Math.min(150,dx)));});
  function finishDrag(event,cancel=false){if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,active=drag.active;drag=null;grid.classList.remove('is-dragging');if(grid.hasPointerCapture(event.pointerId))grid.releasePointerCapture(event.pointerId);if(active){suppressClickUntil=Date.now()+300;if(!cancel&&Math.abs(dx)>35)stepTemplate(dx<0?1:-1);else layoutCarousel();}}
  grid.addEventListener('pointerup',event=>finishDrag(event));grid.addEventListener('pointercancel',event=>finishDrag(event,true));
  grid.addEventListener('wheel',event=>{const delta=event.shiftKey?event.deltaY:event.deltaX;if(Math.abs(delta)<Math.abs(event.shiftKey?event.deltaX:event.deltaY)||!delta)return;event.preventDefault();const now=Date.now();if(now-wheelTime>160)wheelDelta=0;wheelTime=now;wheelDelta+=delta;if(Math.abs(wheelDelta)>45&&now-wheelLastStep>200){stepTemplate(wheelDelta>0?1:-1);wheelDelta=0;wheelLastStep=now;}},{passive:false});
  new ResizeObserver(()=>{layoutCarousel();updateZoom();}).observe($('studioWorkspace'));
  language();sync();updateZoom();if(Object.values(state.data).some(Boolean))schedule();else $('importDetails').open=true;

  async function workerFetch(path,options){
    const token=await window.CheckATSAuth.getAccessToken(),headers=new Headers(options?.headers||{});
    if(token)headers.set('Authorization','Bearer '+token);
    const pass=new URLSearchParams(location.search).get('pass');if(pass)headers.set('X-Admin-Pass',pass);
    return fetch('https://ats-hr-review.hhjgudhdjugudh878.workers.dev'+path,{...options,headers});
  }
  const authUI=window.CheckATSAuthUI.mount({language:()=>lang,request:workerFetch});
  const applyStudioLanguage=language;
  language=function(){applyStudioLanguage();if(authUI)authUI.refresh();updateBillingLabels();};
  updateBillingLabels();window.CheckATSBilling.refresh().catch(()=>{});
})();
