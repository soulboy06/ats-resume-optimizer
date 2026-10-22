(function(){
  'use strict';
  const $=id=>document.getElementById(id),templates=StudioTemplates.list();
  const strings={
    zh:{title:'简历模板库',back:'返回工作台',navAnalyzer:'简历分析',navStudio:'PDF 工作台',navGuide:'使用指南',all:'全部',single:'单栏',columns:'双栏与侧栏',photo:'含照片',search:'搜索模板名称',count:'{n} 款模板',current:'当前使用',use:'使用模板',continue:'继续编辑',empty:'没有找到匹配的模板',reset:'清除筛选',credits:'模板来源与许可 ↗',format:'A4 / US Letter',filters:'筛选模板',layout:'模板版式'},
    en:{title:'Resume template library',back:'Back to studio',navAnalyzer:'Resume analyzer',navStudio:'PDF Studio',navGuide:'Guides',all:'All',single:'Single column',columns:'Sidebars',photo:'With photo',search:'Search templates',count:'{n} templates',current:'Currently using',use:'Use template',continue:'Continue editing',empty:'No matching templates',reset:'Clear filters',credits:'Template sources & licenses ↗',format:'A4 / US Letter',filters:'Filter templates',layout:'Template layout'}
  };
  const query=new URLSearchParams(location.search);
  let lang=query.get('lang')==='zh'?'zh':'en',filter='all',search='',current='refined';
  const t=key=>strings[lang][key];
  const columns=template=>!!template.functions['cv-layout'];
  const photo=template=>template.params.includes('photo')||['masthead','band-header','banner-header'].some(name=>template.functions[name]?.includes('photo'));
  const matches=(template,kind)=>kind==='all'||kind==='columns'&&columns(template)||kind==='single'&&!columns(template)||kind==='photo'&&photo(template);
  function studioUrl(template){const params=new URLSearchParams({lang});if(template)params.set('template',template);return '/studio/?'+params;}
  function readCurrent(){
    let saved;try{saved=JSON.parse(sessionStorage.getItem('checkats_studio_draft')||'null')?.template;}catch(_){}
    const id=saved||query.get('current');if(templates.some(item=>item.id===id))current=id;
  }
  function render(){
    const result=templates.filter(template=>matches(template,filter)&&[template.name.en,template.name.zh,template.desc.en,template.desc.zh].join(' ').toLowerCase().includes(search.toLowerCase().trim()));
    const fragment=document.createDocumentFragment();
    for(const template of result){
      const selected=template.id===current,card=document.createElement('a');card.className='library-card glass'+(selected?' is-current':'');card.href=studioUrl(template.id);card.dataset.template=template.id;
      card.setAttribute('aria-label',t(selected?'continue':'use')+' · '+template.name[lang]);
      if(selected)card.setAttribute('aria-current','true');
      const preview=document.createElement('div');preview.className='library-card-preview';
      const image=document.createElement('img');image.src='/studio/assets/'+template.id+'.webp';image.alt='';image.width=358;image.height=507;image.loading='lazy';image.decoding='async';preview.append(image);
      if(selected){const badge=document.createElement('span');badge.className='library-selected';badge.textContent='✓ '+t('current');preview.append(badge);}
      const footer=document.createElement('div');footer.className='library-card-footer';
      const heading=document.createElement('div');heading.className='library-card-title';const name=document.createElement('h2');name.textContent=template.name[lang];const number=document.createElement('span');number.className='library-card-number';number.textContent=String(templates.indexOf(template)+1).padStart(2,'0');heading.append(name,number);
      const action=document.createElement('div');action.className='library-card-action';const kind=document.createElement('span');kind.className='library-card-kind';kind.textContent=t(columns(template)?'columns':'single');const use=document.createElement('span');use.className='library-card-use';use.textContent=t(selected?'continue':'use');use.insertAdjacentHTML('beforeend','<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>');action.append(kind,use);footer.append(heading,action);card.append(preview,footer);fragment.append(card);
    }
    $('templateLibraryGrid').replaceChildren(fragment);$('libraryEmpty').hidden=result.length>0;$('libraryCount').textContent=t('count').replace('{n}',result.length);
    document.querySelectorAll('[data-filter]').forEach(button=>{const kind=button.dataset.filter;button.setAttribute('aria-pressed',String(kind===filter));button.textContent=t(kind)+' '+templates.filter(template=>matches(template,kind)).length;});
    $('currentTemplate').textContent=t('current')+' · '+StudioTemplates.get(current).name[lang];
  }
  function language(){
    document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.title=t('title')+' | CheckATS';
    document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
    document.querySelectorAll('[data-lang]').forEach(button=>{const active=button.dataset.lang===lang;button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);});
    document.querySelectorAll('[data-home-link],.brand').forEach(link=>link.href=lang==='zh'?'/?lang=zh':'/');
    document.querySelector('[data-studio-link]').href=studioUrl();document.querySelector('[data-guide-link]').href=lang==='zh'?'/zh/guide/':'/guide/';$('libraryBack').href=$('currentTemplate').href=studioUrl();$('libraryCredits').href='/studio/credits.html?lang='+lang;
    $('templateSearch').placeholder=t('search');$('templateSearch').setAttribute('aria-label',t('search'));document.querySelector('.library-toolbar').setAttribute('aria-label',t('filters'));document.querySelector('.library-filters').setAttribute('aria-label',t('layout'));render();
  }
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;render();}));
  $('templateSearch').addEventListener('input',event=>{search=event.target.value;render();});
  $('resetFilters').addEventListener('click',()=>{filter='all';search='';$('templateSearch').value='';render();$('templateSearch').focus();});
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{lang=button.dataset.lang;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);language();}));
  window.addEventListener('pageshow',event=>{if(event.persisted){readCurrent();language();}});
  readCurrent();language();
})();
