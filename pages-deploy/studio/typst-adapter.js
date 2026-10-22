/* Content is passed as JSON, never evaluated as Typst code. */
(function(root){
  const sectionKeys=['summary','experience','projects','education','skills','certs','other'];
  const labels={en:{summary:'Summary',experience:'Experience',projects:'Projects',education:'Education',skills:'Skills',certs:'Certifications',other:'Additional information'},zh:{summary:'个人简介',experience:'工作经历',projects:'项目经历',education:'教育背景',skills:'专业技能',certs:'证书认证',other:'其他信息'}};
  function entries(value){
    const result=[];let current,gap=false;
    const isDate=line=>/(?:19|20)\d{2}/.test(line)&&line.replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Present|Current|Now|to)\b/gi,'').replace(/[\d\s年月日迄至今现在./,–—−-]/g,'')==='';
    for(const raw of value.split('\n')){
      const line=raw.trim();
      if(!line){gap=true;continue;}
      const hasBody=current?.lines.some(x=>x.trim());
      if(/^[-*•▪●]\s+/.test(line)){
        if(!current){current={title:'',subtitle:'',dates:'',location:'',lines:[]};result.push(current);}
        if(gap&&hasBody)current.lines.push('');
        current.lines.push(line);
      }else if(line.includes('|')){
        const fields=line.split(/\s*\|\s*/);current={title:fields[0],subtitle:fields[1]||'',dates:fields[2]||'',location:fields.slice(3).join(' | '),lines:[]};result.push(current);
      }else if(current&&!hasBody&&isDate(line)&&!current.dates){
        current.dates=line;
      }else if(current&&!hasBody&&!current.subtitle&&(current.dates||!gap)){
        current.subtitle=line;
      }else if(current&&hasBody&&!gap){
        current.lines.push(line);
      }else{
        current={title:line,subtitle:'',dates:'',location:'',lines:[]};result.push(current);
      }
      gap=false;
    }
    return result;
  }
  function prepare(data,settings){
    const spacing=Number(settings.lineSpacing);
    return {data,contacts:data.contact.split(/\n|\s+\|\s+/).map(x=>x.trim()).filter(Boolean),settings:{paper:settings.paper==='letter'?'us-letter':'a4',size:Math.min(16,Math.max(8,Number(settings.size)||10.5)),lineSpacing:Number.isFinite(spacing)&&spacing>=1?Math.min(2,spacing):null,lang:settings.contentLanguage==='zh'?'zh':'en',hasPhoto:!!settings.photo},labels:labels[settings.contentLanguage==='zh'?'zh':'en'],entries:Object.fromEntries(sectionKeys.map(k=>[k,entries(data[k])]))};
  }
  function source(template){
    const functions=template.functions,params=template.params,slug=template.id;
    const derivedFonts=['Nunito Sans','Raleway','Bitter','Source Sans 3','Source Serif 4','EB Garamond','HK Grotesk','Inter','Roboto'];
    const fontIndex=derivedFonts.indexOf(template.font);
    const font=fontIndex<0?template.font:'CheckATS Studio '+String(fontIndex+1).padStart(2,'0');
    const available=(name,key)=>functions[name]?.includes(key);
    const headerName=['masthead','band-header','banner-header'].find(n=>functions[n]);
    const nativePhoto=params.includes('photo')||(headerName&&available(headerName,'photo'));
    const args={author:'d.name',font:'('+JSON.stringify(font)+', "Noto Sans SC")','font-size':'s.size * 1pt',paper:'s.paper',lang:'s.lang',profession:'d.title',contact:'d.contact','contact-items':'p.contacts.map(x => text(x))',location:'d.contact',photo:'photo','accent-color':'accent'};
    args.leading='if s.lineSpacing == none { '+template.leading+'em } else { (s.lineSpacing - 1) * 1em }';
    if(!params.includes('profession')&&!functions.masthead&&!functions['band-header']&&!functions['banner-header'])args.location='(d.title, d.contact).filter(x => x != "").join("\n")';
    if(!nativePhoto&&!headerName)for(const key of ['author','profession','contact','contact-items','location'])if(params.includes(key))args[key]='if s.hasPhoto { '+(key==='contact-items'?'()':'""')+' } else { '+args[key]+' }';
    let code='#import "/layout.typ": *\n#let p = json("/resume.json")\n#let d = p.data\n#let s = p.settings\n#let accent = '+JSON.stringify(template.accent)+'\n#let photo = if s.hasPhoto { "/photo.png" } else { none }\n';
    code+='#let resume-line-leading = if s.lineSpacing == none { '+template.leading+'em } else { (s.lineSpacing - 1) * 1em }\n';
    code+='#let resume-lines(value) = { let value = if value == none { "" } else { value.trim() }; if value != "" { let lines = value.split("\\n"); if s.lineSpacing == none { for line in lines { if line == "" { v(0.25em) } else { block(above: 0.15em, below: 0.15em, breakable: true, text(line)) } } } else { block(breakable: true, { set par(leading: resume-line-leading, spacing: 0pt); set text(top-edge: 0.85em, bottom-edge: -0.15em); for (i, line) in lines.enumerate() { if i > 0 { linebreak() }; text(line) } }) } } }\n';
    code+='#let resume-entry(e) = { block(sticky: true, { if e.title != "" { text(weight: "bold", e.title) }; if e.subtitle != "" { linebreak(); text(e.subtitle) }; if e.dates != "" { linebreak(); text(e.dates) }; if e.location != "" { linebreak(); text(e.location) } }); resume-lines(e.lines.join("\n")) }\n';
    code+='#let resume-photo-header() = block(above: 0pt, below: 1em, breakable: false, { set block(spacing: 0pt); set par(spacing: 0pt, leading: 0.5em, justify: false); grid(columns: (1fr, 54pt), column-gutter: 18pt, align: (left + top, right + top), { if d.name != "" { block(text(size: 23pt, weight: "bold", d.name)) }; if d.title != "" { v(4pt); block(text(size: 12pt, fill: rgb(accent), d.title)) }; if d.contact != "" { v(6pt); block(text(size: 8.5pt, fill: rgb("#5a5a55"), d.contact)) } }, block(width: 54pt, height: 70pt, radius: 3pt, clip: true, image("/photo.png", width: 54pt, height: 70pt, fit: "cover"))); v(9pt); line(length: 100%, stroke: 0.6pt + rgb(accent)) })\n';
    code+='#show: '+slug+'-cv.with('+params.filter(k=>Object.hasOwn(args,k)).map(k=>k+': '+args[k]).join(', ')+')\n';
    if(!nativePhoto&&!headerName)code+='#set document(author: d.name, title: d.name + " - Resume")\n';
    const header=()=>{
      if(!headerName)return '';
      const opts={author:'d.name',profession:'d.title',contact:'d.contact',photo:'photo','accent-color':'accent',initials:'d.name.split(" ").filter(x => x != "").slice(0, calc.min(2, d.name.split(" ").filter(x => x != "").len())).map(x => x.first()).join("")'};
      const original='#'+headerName+'('+Object.entries(opts).filter(([k])=>available(headerName,k)).map(([k,v])=>k+': '+v).join(', ')+')\n';
      return nativePhoto?original:'#if s.hasPhoto { resume-photo-header() } else { ['+original+'] }\n';
    };
    const extraPhoto=!nativePhoto&&!headerName?'#if s.hasPhoto { resume-photo-header() }\n':'';
    const section=(key,panel=false)=>{
      let body;
      if(['experience','projects','education'].includes(key)){
        const entry=functions[slug+'-entry']?slug+'-entry':functions['cv-entry']?'cv-entry':null;
        if(entry){
          const opts={title:'e.title',subtitle:'e.subtitle',dates:'e.dates',location:'e.location','accent-color':'accent'};
          const call=entry+'('+Object.entries(opts).filter(([k])=>available(entry,k)).map(([k,v])=>k+': '+v).join(', ');
          body='#for e in p.entries.'+key+' { '+call+(entry==='cv-entry'?'); resume-lines(e.lines.join("\n"))':', [#resume-lines(e.lines.join("\n"))])')+'; v(0.45em) }\n';
        }else body='#for e in p.entries.'+key+' { resume-entry(e); v(0.45em) }\n';
      }else if(slug==='grid'&&key==='skills')body='#skill-grid(d.skills.split(regex("[,，、;；\\n]+" )).filter(x => x.trim() != "").map(x => text(x.trim())))\n';
      else body='#resume-lines(d.'+key+')\n';
      if(panel)body='#resume-lines(d.'+key+')\n';
      if(slug==='caption')return '#if d.'+key+' != "" { caption-section(p.labels.'+key+', accent-color: accent, ['+body+']) }\n';
      if(slug==='preface'&&key==='summary')return '#if d.summary != "" { preface-lede(['+body+']) }\n';
      const sectionFn=panel?'panel-section':functions['main-section']?'main-section':'cv-section';
      const opts=available(sectionFn,'accent-color')?', accent-color: accent':'';
      const heading='#'+sectionFn+'(p.labels.'+key+opts+')\n';
      if(slug==='gazette')body='#gazette-plain['+body+']\n';
      if(slug==='index')body='#index-body['+body+']\n';
      if(slug==='strata'&&['experience','education','projects'].includes(key))body='#strata-band(accent-color: accent, ['+body+'])\n';
      if(slug==='timeline'&&['experience','education','projects'].includes(key))body='#timeline-track(accent-color: accent, ['+body+'])\n';
      return '#if d.'+key+' != "" { ['+heading+body+'] }\n';
    };
    if(functions['cv-layout']){
      const panel=!!functions['panel-section'],sideName=panel?'aside':'rail';
      let rail=panel?header()+extraPhoto:'';
      const contactFn=panel?'panel-contact':'rail-contact';
      if(functions[contactFn])rail+='#if d.contact != "" { '+contactFn+'(p.contacts.map(x => text(x))'+(available(contactFn,'accent-color')?', accent-color: accent':'')+') }\n';
      rail+=['skills','certs'].map(k=>section(k,panel)).join('');
      if(!panel)code+=header()+extraPhoto;
      code+='#cv-layout('+sideName+': ['+rail+'], main: ['+sectionKeys.filter(k=>!['skills','certs'].includes(k)).map(k=>section(k)).join('')+']'+(available('cv-layout','author')?', author: d.name':'')+(available('cv-layout','accent-color')?', accent-color: accent':'')+')\n';
    }else code+=header()+extraPhoto+sectionKeys.map(k=>section(k)).join('');
    return code;
  }
  function verify(data,extracted){
    const normalize=text=>String(text).normalize('NFKC').toLowerCase().replace(/[\s\u00ad\u200b]/gu,'');
    const actual=normalize(extracted);
    for(const [key,value] of Object.entries(data))for(const line of value.split('\n'))for(const part of line.split(key==='skills'?/[|,，、;；]/:'|')){
      const unit=normalize(part.trim());if(unit&&!actual.includes(unit))throw new Error('roundTrip');
    }
  }
  const api={source,prepare,entries,verify};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudioTypstAdapter=api;
})(typeof window==='undefined'?globalThis:window);
