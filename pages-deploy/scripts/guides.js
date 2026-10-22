(function(){
  'use strict';
  const pass=new URLSearchParams(location.search).get('pass');
  if(pass)for(const link of document.querySelectorAll('a[href^="/"]')){
    const url=new URL(link.getAttribute('href'),location.origin);
    if(url.origin!==location.origin||url.searchParams.has('pass'))continue;
    url.searchParams.set('pass',pass);
    link.setAttribute('href',url.pathname+url.search+url.hash);
  }
  const menu=document.querySelector('.docs-menu'),wide=matchMedia('(min-width: 961px)');
  function menuLayout(){menu.open=wide.matches;}
  menuLayout();wide.addEventListener('change',menuLayout);
  const mobileToc=document.querySelector('.docs-mobile-toc'),intro=document.querySelector('.docs-article .lede');
  if(mobileToc&&intro)intro.insertAdjacentElement('afterend',mobileToc);
  const input=document.getElementById('guide-search');
  if(input){
    const entries=[...document.querySelectorAll('[data-guide-entry]')],params=new URLSearchParams(location.search);
    function filter(){
      const value=input.value.normalize('NFKC').trim().toLowerCase();
      for(const entry of entries)entry.hidden=!entry.textContent.normalize('NFKC').toLowerCase().includes(value);
      for(const group of document.querySelectorAll('[data-guide-group]'))group.hidden=![...group.querySelectorAll('[data-guide-entry]')].some(entry=>!entry.hidden);
      document.querySelector('.docs-feature').hidden=!!value;
      document.querySelector('.docs-no-results').hidden=entries.some(entry=>!entry.hidden);
    }
    input.value=params.get('q')||'';filter();
    input.addEventListener('input',filter);
    input.form.addEventListener('submit',event=>{event.preventDefault();filter();});
    document.querySelector('[data-clear-search]').addEventListener('click',()=>{input.value='';const url=new URL(location.href);url.searchParams.delete('q');history.replaceState(null,'',url);filter();input.focus();});
  }
  const anchors=[...document.querySelectorAll('.docs-toc nav a')],headings=[...document.querySelectorAll('.docs-article h2[id]')];
  if(headings.length){
    let pending=false;
    function track(){
      pending=false;let current=headings[0];
      for(const heading of headings){if(heading.getBoundingClientRect().top<=170)current=heading;else break;}
      for(const link of anchors){if(link.hash==='#'+current.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
    }
    addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(track);}},{passive:true});track();
    document.querySelectorAll('.docs-mobile-toc a').forEach(link=>link.addEventListener('click',()=>{link.closest('details').open=false;}));
  }
})();
