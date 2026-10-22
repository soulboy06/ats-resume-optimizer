(function(){
  'use strict';
  const engine=window.StudioEngine,$=id=>document.getElementById(id);
  const copy={
    en:{emptyTitle:'Add your resume to preview.',titleFirst:'Your story.',titleLast:'Ready to send.',shortTemplate:'Choose a layout',shortDetails:'Make it yours',shortExport:'Export your PDF',title:'Your story. Ready to send.',intro:'Choose a layout, make it yours, and leave with a readable PDF.',privacy:'Resume and photos stay in your browser.',back:'← Back to analyzer',stepOne:'01 / CHOOSE A LOOK',templates:'Choose your template.',credits:'Template sources & licenses ↗',paper:'Paper',fontSize:'Text size',headingLanguage:'PDF headings',stepTwo:'02 / MAKE IT YOURS',details:'Your personal details.',name:'Full name',role:'Professional title',contact:'Contact details & links',uploadPhoto:'Add a photo (optional)',removePhoto:'Remove',photoHint:'Optional · JPG, PNG or WebP · up to 5 MB. Center-cropped for the header.',content:'Words worth keeping.',contentHint:'Review the imported sections. Unknown content is kept under Additional information.',paste:'Paste a complete resume',raw:'Complete resume text',apply:'Apply to fields',replaceHint:'Replaces the text fields below.',clear:'Clear this draft',stepThree:'03 / READY WHEN YOU ARE',preview:'Your finished resume.',download:'Download PDF',empty:'Your resume will appear here. Start with your rewrite or paste your text.',footnote:'Selectable text, automatic page breaks, no watermark. Review every page before sending.',summary:'Summary',experience:'Experience',projects:'Projects',education:'Education',skills:'Skills',certs:'Certifications',other:'Additional information',busy:'Preparing your PDF…',ready:'PDF ready. Text extraction checked. Pages: ',stale:'Updating preview. Download will be ready when it matches your edits.',storage:'Draft saved in this browser tab.',storageFail:'Browser storage is unavailable. Keep this page open and download your PDF before leaving.',imported:'Your AI rewrite is ready to style. Check the section fields before downloading.',loaded:'Resume applied. Check the fields and content order.',noText:'Paste your resume text first.',photoError:'Choose a valid JPG, PNG or WebP up to 5 MB.',photoReady:'Photo added locally. It is included in the PDF.',emptyError:'Add your resume content to begin.',fontError:'A character is not supported by the bundled fonts. Replace it and retry.',roundTrip:'The generated text could not be verified. Download is blocked; review your content and retry.',error:'PDF could not be prepared. Your content is kept; edit a field to retry.',contentLimit:'Use at most 60,000 characters in total and 30,000 per section.',pages:'This draft exceeds 15 pages. Shorten the content before exporting.',cleared:'Draft cleared.',confirmClear:'Clear all text and the photo from this draft?',page:'Page',restore:'Draft restored in this tab.'},
    zh:{emptyTitle:'填写简历后预览。',titleFirst:'你的经历，',titleLast:'准备好出发。',shortTemplate:'选择简历版式',shortDetails:'完善个人内容',shortExport:'预览并导出',title:'你的经历，准备好出发。',intro:'选一个喜欢的版式，补充细节，带走一份清晰可读的 PDF 简历。',privacy:'简历与照片仅在本机处理。',back:'← 返回分析首页',stepOne:'01 / 选择版式',templates:'选择简历模板。',credits:'模板来源与许可 ↗',paper:'纸张',fontSize:'正文字号',headingLanguage:'PDF 栏目语言',stepTwo:'02 / 补充细节',details:'完善个人信息。',name:'姓名',role:'求职意向 / 职业标题',contact:'联系方式与个人链接',uploadPhoto:'上传照片（可选）',removePhoto:'移除',photoHint:'可选 · JPG、PNG 或 WebP · 不超过 5 MB。照片居中裁切后放在页首。',content:'值得留下的经历。',contentHint:'请检查自动分配的栏目。未识别内容保留在「其他信息」，可以自行调整。',paste:'粘贴完整简历',raw:'完整简历文字',apply:'一键填入栏目',replaceHint:'会替换下方栏目中的文字。',clear:'清空当前草稿',stepThree:'03 / 准备好，即可出发',preview:'预览你的简历。',download:'下载 PDF',empty:'你的简历将在这里呈现。从 AI 改写结果进入，或粘贴简历开始制作。',footnote:'原生可选文字 · 自动分页 · 无水印。发送前请检查每一页。',summary:'个人简介',experience:'工作经历',projects:'项目经历',education:'教育背景',skills:'专业技能',certs:'证书认证',other:'其他信息',busy:'正在生成 PDF…',ready:'PDF 已就绪，已验证文字可解析。页数：',stale:'正在更新预览，完成后可下载最新版本。',storage:'草稿已保存在当前浏览器标签页。',storageFail:'浏览器存储不可用，请保持页面开启，并在离开前下载 PDF。',imported:'已带入 AI 改写结果。选择模板后，请核对各栏目再导出。',loaded:'已填入简历，请检查各栏目与内容顺序。',noText:'请先粘贴简历文字。',photoError:'请上传有效的 JPG、PNG 或 WebP 图片，且不超过 5 MB。',photoReady:'照片已在本机加入，将随 PDF 导出。',emptyError:'填写简历后即可预览。',fontError:'导出字体暂不支持某个字符，请替换后重试。',roundTrip:'导出文字未通过解析验证，已阻止下载。请检查内容后重试。',error:'未能生成 PDF，内容已保留。修改任一字段可重试。',contentLimit:'简历总计最多 60,000 字符，每栏最多 30,000 字符。',pages:'当前简历超过 15 页，请缩短内容后导出。',cleared:'已清空草稿。',confirmClear:'清空当前草稿中的文字和照片？',page:'第',restore:'已恢复当前标签页的草稿。'}
  };
  const map={fName:'name',fTitle:'title',fContact:'contact'};
  let lang=new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en';
  let state={data:engine.blank(),template:'classic',paper:'a4',size:'10.5',contentLanguage:lang,photo:null};
  let revision=0,result=null,timer,rendering=false,fontBytes,photoVersion=0;
  const t=key=>copy[lang][key]||key;
  function notice(text,error=false){$('handoffStatus').textContent=text;$('handoffStatus').dataset.message=Object.keys(copy.en).find(key=>copy.en[key]===text||copy.zh[key]===text)||'';$('handoffStatus').classList.toggle('is-error',error);$('handoffStatus').classList.toggle('sr-only',!error);}
  function status(text,error=false){$('exportStatus').textContent=text;$('exportStatus').classList.toggle('is-error',error);$('exportStatus').hidden=!error&&(text.startsWith(t('ready'))||text===t('emptyError'));}
  function save(){try{sessionStorage.setItem('checkats_studio_draft',JSON.stringify(state));$('draftStatus').textContent='';$('draftStatus').hidden=true;}catch(_){$('draftStatus').textContent=t('storageFail');$('draftStatus').hidden=false;$('draftStatus').classList.add('is-error');}}
  function renderTemplates(){
    $('templateGrid').replaceChildren();
    for(const template of StudioTemplates.list()){
      const button=document.createElement('button');button.type='button';button.className='template-card '+template.id;
      button.setAttribute('aria-pressed',String(template.id===state.template));button.setAttribute('aria-label',template.name[lang]);button.title=template.desc[lang];button.style.setProperty('--template-accent',template.accent);
      const sheet=document.createElement('img');sheet.className='template-sheet';sheet.src='/studio/assets/'+template.id+'.webp';sheet.alt='';sheet.width=170;sheet.height=240;
      const label=document.createElement('strong');label.textContent=template.name[lang];button.append(sheet,label);
      button.addEventListener('click',()=>{state.template=template.id;renderTemplates();schedule();});$('templateGrid').append(button);
    }
    $('templateCredit').textContent=StudioTemplates.get(state.template).credit;
  }
  function language(){
    document.documentElement.lang=lang;document.title=lang==='zh'?'PDF 简历工作台 | CheckATS':'Resume PDF Studio | CheckATS';
    document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
    document.querySelectorAll('[data-lang]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.lang===lang));button.classList.toggle('active',button.dataset.lang===lang);});
    for(const key of ['summary','experience','projects','education','skills','certs','other'])$('label-'+key).textContent=t(key);
    if($('handoffStatus').dataset.message)$('handoffStatus').textContent=t($('handoffStatus').dataset.message);
    document.querySelectorAll('.pdf-page').forEach((figure,index)=>{figure.querySelector('figcaption').textContent=t('page')+' '+(index+1)+' / '+(result?.pages||'');figure.querySelector('canvas').setAttribute('aria-label',t('page')+' '+(index+1));});
    renderTemplates();if(result)status(t('ready')+result.pages);else if(rendering)status(t('busy'));
  }
  function sync(){for(const [id,key]of Object.entries(map))$(id).value=state.data[key];$('paper').value=state.paper;$('fontSize').value=state.size;$('contentLanguage').value=state.contentLanguage;photoPreview();}
  function photoPreview(){const host=$('photoPreview');host.replaceChildren();if(state.photo){const img=document.createElement('img');img.src=state.photo;img.alt='';host.append(img);}else host.textContent='PHOTO';$('photoRemove').hidden=!state.photo;}
  function schedule(){revision++;result=null;$('exportPdfBtn').disabled=true;document.querySelector('.studio-preview').classList.add('is-stale');status(t('stale'));save();clearTimeout(timer);timer=setTimeout(build,250);}
  async function build(){
    if(rendering)return;rendering=true;
    const version=revision,snapshot=JSON.parse(JSON.stringify(state));status(t('busy'));
    let pdf;
    try{
      await window.studioPdfReady;
      const built=await engine.generate(snapshot.data,snapshot,{templates:StudioTemplates,pdfLib:PDFLib,fontkit:window.fontkit,pdfjs:window.pdfjsLib,unicodeFont:async()=>{
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
      $('resumePreview').replaceChildren(fragment);result=built;$('exportPdfBtn').disabled=false;document.querySelector('.studio-preview').classList.remove('is-stale');status(t('ready')+built.pages);
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
    const wrap=document.createElement('div');wrap.className='studio-field';const label=document.createElement('label');label.id='label-'+key;label.htmlFor='f-'+key;
    const input=document.createElement('textarea');input.id='f-'+key;input.rows=['experience','projects'].includes(key)?7:4;input.maxLength=30000;map[input.id]=key;wrap.append(label,input);$('sectionFields').append(wrap);
  }
  try{const draft=JSON.parse(sessionStorage.getItem('checkats_studio_draft')||'null');if(draft){state={...state,...draft,data:engine.validate(draft.data)};state.template=StudioTemplates.get(state.template).id;if(['en','zh'].includes(draft.uiLanguage))lang=draft.uiLanguage;notice(t('restore'));}
    const handoff=JSON.parse(sessionStorage.getItem('checkats_studio_handoff')||'null');
    const legacy=localStorage.getItem('checkats_ai_rewrite');
    const text=handoff?.text||legacy;
    if(typeof text==='string'&&text.trim()){if(['en','zh'].includes(handoff?.lang))lang=handoff.lang;state.data=engine.parse(text);state.photo=null;state.contentLanguage=/[\u3400-\u9fff]/.test(text)?'zh':'en';sessionStorage.removeItem('checkats_studio_handoff');localStorage.removeItem('checkats_ai_rewrite');notice(t('imported'));}
  }catch(_){notice(t('storageFail'),true);}
  for(const[id,key]of Object.entries(map))$(id).addEventListener('input',()=>{state.data[key]=$(id).value;schedule();});
  for(const[id,key]of [['paper','paper'],['fontSize','size'],['contentLanguage','contentLanguage']])$(id).addEventListener('change',()=>{state[key]=$(id).value;schedule();});
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{lang=button.dataset.lang;state.uiLanguage=lang;language();save();}));
  $('applyText').addEventListener('click',()=>{if(!$('rawResume').value.trim())return notice(t('noText'),true);apply($('rawResume').value);notice(t('loaded'));});
  $('photoInput').addEventListener('change',()=>photo($('photoInput').files[0]));
  $('photoRemove').addEventListener('click',()=>{photoVersion++;state.photo=null;photoPreview();$('photoStatus').textContent='';schedule();});
  $('clearBtn').addEventListener('click',()=>{if(!confirm(t('confirmClear')))return;photoVersion++;state.data=engine.blank();state.photo=null;$('rawResume').value='';$('photoStatus').textContent='';sync();schedule();$('resumePreview').replaceChildren();notice(t('cleared'));});
  $('exportPdfBtn').addEventListener('click',()=>{
    if(!result)return;const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=(state.data.name||'resume').replace(/[^\p{L}\p{N}_-]/gu,'_')+'-'+state.template+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  language();sync();if(Object.values(state.data).some(Boolean))schedule();else $('importDetails').open=true;
})();
