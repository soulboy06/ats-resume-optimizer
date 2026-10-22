/* Classic adapts the MIT-licensed sb2nov/resume layout; see licenses/. */
(function(root) {
  const templates = [
    { id:'classic',name:{zh:'经典单栏',en:'Classic'},desc:{zh:'衬线标题 · 清晰分节',en:'Serif headings · ruled sections'},family:'serif',accent:'#292b24',rule:true,margin:44,gap:12,source:'https://github.com/sb2nov/resume',credit:'Adapted from sb2nov/resume (MIT)' },
    { id:'modern',name:{zh:'现代专业',en:'Modern'},desc:{zh:'暖色点缀 · 可选照片',en:'Warm accent · optional photo'},family:'sans',accent:'#b44d30',rule:true,margin:44,gap:13,credit:'Original CheckATS layout' },
    { id:'minimal',name:{zh:'极简留白',en:'Minimal'},desc:{zh:'克制排版 · 内容优先',en:'Quiet typography · more space'},family:'sans',accent:'#506047',rule:false,margin:50,gap:17,credit:'Original CheckATS layout' }
  ];
  const api={list:()=>templates,get:id=>templates.find(t=>t.id===id)||templates[0]};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudioTemplates=api;
})(typeof window==='undefined'?globalThis:window);
