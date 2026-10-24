(function(){
  'use strict';
  if(document.querySelector('.site-policy-footer'))return;
  if(!document.querySelector('link[href="/styles/legal.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/styles/legal.css';document.head.append(style);}
  const footer=document.createElement('footer');footer.className='site-policy-footer';document.body.append(footer);
  function render(){
    const zh=document.documentElement.lang.toLowerCase().startsWith('zh'),prefix=zh?'/zh':'';
    footer.replaceChildren();
    const label=document.createElement('span');label.textContent='CheckATS · soulboytools';footer.append(label);
    const nav=document.createElement('nav');nav.setAttribute('aria-label',zh?'政策与支持':'Policies and support');
    [['terms',zh?'服务条款':'Terms'],['privacy',zh?'隐私政策':'Privacy'],['refunds',zh?'退款政策':'Refunds'],['contact',zh?'联系支持':'Contact']].forEach(([path,title])=>{const a=document.createElement('a');a.href=prefix+'/'+path+'/';a.textContent=title;nav.append(a);});
    footer.append(nav);
  }
  render();new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
