/* Native PDF typesetting shared by preview and download. No resume network calls. */
(function(root) {
  'use strict';
  const keys=['name','title','contact','summary','experience','projects','education','skills','certs','other'];
  const blank=()=>Object.fromEntries(keys.map(k=>[k,'']));
  const labels={en:{summary:'SUMMARY',experience:'EXPERIENCE',projects:'PROJECTS',education:'EDUCATION',skills:'SKILLS',certs:'CERTIFICATIONS',other:'ADDITIONAL INFORMATION'},zh:{summary:'个人简介',experience:'工作经历',projects:'项目经历',education:'教育背景',skills:'专业技能',certs:'证书认证',other:'其他信息'}};
  const headings={
    summary:/^(professional summary|career summary|summary|profile|objective|个人简介|个人总结|职业概述|自我评价|简介)$/i,
    experience:/^(professional experience|work experience|employment history|work history|experience|工作经历|工作经验|实习经历)$/i,
    projects:/^(selected projects?|personal projects?|project experience|projects?|项目经历|项目经验|项目)$/i,
    education:/^(education(?:al background)?|教育背景|教育经历|学历)$/i,
    skills:/^(technical skills|professional skills|core skills|skills|专业技能|技术技能|技能清单|技能)$/i,
    certs:/^(certifications?|certificates?|licenses?|证书认证|证书|认证|资格证书)$/i,
    other:/^(additional information|other|其他信息|其他)$/i
  };
  function heading(line){
    const plain=line.trim().replace(/^#{1,6}\s*/,'').replace(/\*\*|__/g,'').replace(/[：:]\s*$/,'').trim();
    return Object.keys(headings).find(k=>headings[k].test(plain));
  }
  // Keep unrecognized sections and multiline contact details instead of discarding them.
  function parse(text) {
    const d=blank(),pre=[],buffers={};let active='';
    for(const line of String(text||'').replace(/\r\n?/g,'\n').split('\n')){
      const key=heading(line);if(key){active=key;buffers[key]||=[];continue;}
      if(active&&(/^\s*#{1,6}\s+/.test(line)||/^[A-Z][A-Z &/()-]{2,45}$/.test(line.trim())||/^(志愿经历|获奖经历|获奖情况|兴趣爱好|语言能力|出版物|社会活动)[：:]?$/.test(line.trim()))){active='other';buffers.other||=[];}
      if(active)buffers[active].push(line);else pre.push(line);
    }
    const first=pre.findIndex(s=>s.trim());
    if(first>=0){const line=pre[first].trim().replace(/^#{1,6}\s*/,'').replace(/\*\*/g,'');
      if(line.length<=70&&!/@|https?:|[。.!?]$/.test(line)){d.name=line;pre.splice(first,1);}}
    const remaining=pre.filter(s=>s.trim());
    if(d.name&&remaining[0]&&remaining[0].trim().length<75&&!/@|https?:|\d{3}|[。.!?]$/.test(remaining[0]))d.title=remaining.shift().trim();
    const unassigned=[];
    for(const line of remaining){
      if(/@|https?:|www\.|(?:\+?\d[\d ()-]{6,}\d)|(?:portfolio|linkedin|github|作品集|联系方式)\s*[:：]/i.test(line))d.contact+=(d.contact?'\n':'')+line.trim();
      else unassigned.push(line);
    }
    for(const key of Object.keys(buffers)){
      const lines=[];
      for(const line of buffers[key]){
        const previous=lines[lines.length-1]||'';
        // PDF extraction often inserts physical line breaks inside a bullet.
        // Reflow only unfinished bullets; keep job headings/dates and all text.
        if(/^\s*[-*•▪●]\s/.test(previous)&&line.trim()&&!/^\s*[-*•▪●]\s/.test(line)&&!/[.!?。！？;；:]$/.test(previous.trim())&&!/\||\d{4}\s*(?:年|[-/])/.test(line)){
          lines[lines.length-1]=previous.trimEnd()+(/[\u3400-\u9fff]$/.test(previous.trimEnd())&&/^[\u3400-\u9fff]/.test(line.trim())?'':' ')+line.trim();
        }else lines.push(line);
      }
      d[key]=lines.join('\n').trim();
    }
    if(unassigned.length)d.other=[unassigned.join('\n'),d.other].filter(Boolean).join('\n\n');
    return d;
  }
  function validate(data){
    const d=blank();
    for(const key of keys){d[key]=typeof data?.[key]==='string'?data[key].replace(/\r\n?/g,'\n').trim():'';if(d[key].length>30000)throw new Error('contentLimit');}
    if(Object.values(d).join('').length>60000)throw new Error('contentLimit');return d;
  }
  const normalized=s=>String(s).normalize('NFKC').replace(/\s+/gu,'');
  async function generate(input,settings,deps){
    const d=validate(input);if(!Object.values(d).some(Boolean))throw new Error('empty');
    const tpl=deps.templates.get(settings.template),lib=deps.pdfLib;
    const {PDFDocument,StandardFonts,rgb}=lib,doc=await PDFDocument.create();
    const family=tpl.family==='serif'?['TimesRoman','TimesRomanBold']:['Helvetica','HelveticaBold'];
    const regular=await doc.embedFont(StandardFonts[family[0]]),bold=await doc.embedFont(StandardFonts[family[1]]);
    const latin=new Map();let unicode;
    async function runs(text,strong=false){
      const base=strong?bold:regular,groups=[];let value='',std=true;
      for(const char of text){
        if(!latin.has(char)){try{regular.encodeText(char);latin.set(char,true);}catch(_){latin.set(char,false);}}
        const next=latin.get(char);if(value&&next!==std){groups.push({text:value,std});value='';}value+=char;std=next;
      }
      if(value)groups.push({text:value,std});
      if(groups.some(g=>!g.std)&&!unicode){
        const bytes=await deps.unicodeFont();doc.registerFontkit(deps.fontkit);
        unicode={font:await doc.embedFont(bytes,{subset:false}),coverage:new Set(deps.fontkit.create(bytes).characterSet)};
      }
      return groups.map(g=>{
        if(!g.std&&[...g.text].some(ch=>!unicode.coverage.has(ch.codePointAt(0))))throw new Error('font');
        return {text:g.text,font:g.std?base:unicode.font};
      });
    }
    async function width(text,size,strong){return (await runs(text,strong)).reduce((n,r)=>n+r.font.widthOfTextAtSize(r.text,size),0);}
    async function wrap(text,max,size,strong=false){
      const lines=[];let line='';
      const tokens=text.match(/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]|[^\S\n]+|[^\s\u3400-\u9fff\u3000-\u303f\uff00-\uffef]+/gu)||[];
      for(const token of tokens){
        if(await width(line+token,size,strong)<=max){line+=token;continue;}
        if(line.trim()){lines.push(line.trimEnd());line='';}
        if(/^\s+$/.test(token))continue;
        if(await width(token,size,strong)<=max){line=token;continue;}
        for(const ch of token){if(await width(line+ch,size,strong)>max&&line){lines.push(line);line='';}line+=ch;}
      }
      if(line.trim())lines.push(line.trimEnd());return lines.length?lines:[''];
    }
    const [w,h]=settings.paper==='letter'?[612,792]:[595.28,841.89];
    const margin=tpl.margin,size=Math.min(12,Math.max(9.5,Number(settings.size)||10.5)),leading=size*1.42;
    let page,y;const expected=[],placements=[];
    const color=hex=>rgb(...hex.match(/[\da-f]{2}/gi).map(s=>parseInt(s,16)/255));
    const ink=rgb(.16,.17,.14),muted=rgb(.33,.35,.31),accent=color(tpl.accent);
    function newPage(){if(doc.getPageCount()>=15)throw new Error('pages');page=doc.addPage([w,h]);y=h-margin;}
    function ensure(space){if(y-space<margin)newPage();}
    async function draw(text,x,baseline,fontSize,strong=false,tint=ink){
      let cursor=x;
      for(const r of await runs(text,strong)){page.drawText(r.text,{x:cursor,y:baseline,size:fontSize,font:r.font,color:tint});cursor+=r.font.widthOfTextAtSize(r.text,fontSize);}
      expected.push(text);placements.push({page:doc.getPageCount()-1,text,x,y:baseline,size:fontSize,width:cursor-x});
    }
    newPage();
    const top=y,photo=!!settings.photo,headerWidth=w-2*margin-(photo?92:0);
    for(const line of await wrap(d.name,headerWidth,25,true)){y-=27;await draw(line,margin,y,25,true,accent);}
    if(d.title){y-=6;for(const line of await wrap(d.title,headerWidth,12,true)){y-=16;await draw(line,margin,y,12,true);}}
    if(d.contact){y-=7;for(const raw of d.contact.split('\n'))for(const line of await wrap(raw,headerWidth,9)){ensure(13);y-=13;await draw(line,margin,y,9,false,muted);}}
    if(photo){const image=await doc.embedPng(settings.photo);page.drawImage(image,{x:w-margin-72,y:top-94,width:72,height:94});y=Math.min(y,top-94);}
    y-=10;
    const language=settings.contentLanguage==='zh'?'zh':'en';
    for(const key of ['summary','experience','projects','education','skills','certs','other']){
      if(!d[key])continue;
      ensure(leading*3+tpl.gap+22);y-=tpl.gap;
      await draw(labels[language][key],margin,y,10.5,true,accent);y-=8;
      if(tpl.rule)page.drawLine({start:{x:margin,y},end:{x:w-margin,y},thickness:.5,color:accent,opacity:.5});
      y-=leading;
      for(const raw of d[key].split('\n')){
        if(!raw.trim()){y-=leading*.45;continue;}
        const bullet=/^\s*[-*•▪●]\s+/.test(raw),indent=bullet?10:0;
        const isTitle=!bullet&&raw.length<85&&['experience','projects','education'].includes(key);
        const lines=await wrap(raw.trim(),w-2*margin-indent,size,isTitle);
        for(const line of lines){ensure(leading);await draw(line,margin+indent,y,size,isTitle);y-=leading;}
        y+=bullet?-2:0;
      }
    }
    doc.setTitle((d.name||'Resume')+' - Resume');doc.setCreator('CheckATS Resume Studio');
    const bytes=await doc.save();
    const pdf=await deps.pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,standardFontDataUrl:'/vendor/standard_fonts/'}).promise;
    let extracted='';
    try{for(let n=1;n<=pdf.numPages;n++)extracted+=(await(await pdf.getPage(n)).getTextContent()).items.map(i=>i.str||'').join(' ');
      if(normalized(extracted)!==normalized(expected.join(' ')))throw new Error('roundTrip');
    }finally{await pdf.destroy();}
    return {bytes,pages:doc.getPageCount(),placements,text:expected.join('\n')};
  }
  const api={blank,keys,labels,parse,validate,generate,normalized};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudioEngine=api;
})(typeof window==='undefined'?globalThis:window);
