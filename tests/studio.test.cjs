const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const engine=require('../pages-deploy/studio/engine.js');
const templates=require('../pages-deploy/studio/legacy-templates.js');
const lib=require('pdf-lib'),fontkit=require('@pdf-lib/fontkit');
const tmp=path.join(__dirname,'../tmp/pdfs');fs.mkdirSync(tmp,{recursive:true});
const english=`ALEX MORGAN
Software Engineer
Seattle, WA | alex.morgan@example.com
Portfolio: alexmorgan.example.com

PROFESSIONAL SUMMARY
Software engineer building reliable Python services and React applications.
PROFESSIONAL EXPERIENCE
Software Engineer II | Harborline | Mar 2022 - Present
- Built FastAPI services handling 18,000 shipment events each day for 40 customers.
- Reduced PostgreSQL search latency from 1.8 seconds to 620 milliseconds.

Software Engineer | Maplebridge | Jul 2019 - Feb 2022
- Implemented Stripe webhook verification and idempotent billing event processing.
SELECTED PROJECT
Support Queue Analytics | Python, PostgreSQL, React
- Added scheduled imports and CSV reports for support-ticket response trends.
TECHNICAL SKILLS
Python, SQL, TypeScript, React, Docker, AWS ECS, pytest
EDUCATION
Oregon State University | B.S. Computer Science | Jun 2019
VOLUNTEERING
Mentored students in a community programming group.`;
const chinese=`亚历克斯·摩根 Alex Morgan
软件工程师
西雅图 | alex.morgan@example.com
作品集：alexmorgan.example.com
个人简介
拥有六年以上 Python 后端及 React Web 应用开发经验。
工作经历
软件工程师 II | Harborline | 2022年3月 - 至今
- 使用 FastAPI 处理 18,000 次运单更新，支持 40 家企业客户。
- 优化 PostgreSQL 和 Redis，将 p95 响应时间从 1.8 秒降至 620 毫秒。
项目经历
工单分析 | Python 和 SQL
- 加入定时导入、异常记录校验和 CSV 报表下载。
专业技能
Python、TypeScript、Git、Docker、AWS ECS、pytest
教育背景
俄勒冈州立大学 | 计算机科学学士 | 2019年6月
志愿经历
辅导社区学生学习编程。`;
async function deps(){const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');return {pdfLib:lib,fontkit,templates,pdfjs:{...pdfjs,getDocument:o=>pdfjs.getDocument({...o,standardFontDataUrl:path.join(__dirname,'../node_modules/pdfjs-dist/standard_fonts/')})},unicodeFont:async()=>new Uint8Array(fs.readFileSync(path.join(__dirname,'../pages-deploy/vendor/fonts/NotoSansSC.ttf')))};}
test('bilingual import retains every content line, both roles, and unknown sections',()=>{
  for(const source of [english,chinese]){
    const d=engine.parse(source),all=Object.values(d).join('\n');
    for(const line of source.split('\n').filter(l=>l.trim())){
      if(Object.values(engine.labels.en).includes(line)||['PROFESSIONAL SUMMARY','PROFESSIONAL EXPERIENCE','SELECTED PROJECT','TECHNICAL SKILLS',...Object.values(engine.labels.zh)].includes(line))continue;
      assert.ok(all.includes(line),`Missing: ${line}`);
    }
    assert.ok(d.contact.includes('example.com'));assert.ok(d.experience);assert.ok(d.skills);assert.ok(d.education);
  }
  const d=engine.parse('Jane Doe\n# WORK EXPERIENCE\nFirst role\n## WORK EXPERIENCE\nSecond role\n## Awards\nAn award');
  assert.ok(d.experience.includes('First role'));assert.ok(d.experience.includes('Second role'));assert.ok(d.other.includes('An award'));
});
test('new imports clear absent sections rather than mixing another candidate into the draft',()=>{
  assert.equal(engine.parse('Jane Doe\nSkills\nPython').experience,'');
  assert.equal(engine.parse('Jane Doe\nSkills\nPython').name,'Jane Doe');
});
test('physical PDF line breaks reflow inside unfinished bullets while preserving the next job',()=>{
  const d=engine.parse('张三\n工作经历\n软件工程师\n- 每日处理物流状态更\n新。\n软件工程师 II\n- Added integration tests for\nPython services.\n教育背景\nUniversity');
  assert.ok(d.experience.includes('- 每日处理物流状态更新。'));
  assert.ok(d.experience.includes('软件工程师 II\n- Added integration tests for Python services.'));
});
test('all three layouts export readable English and Chinese PDFs with valid bounds',async()=>{
  const dependencies=await deps();
  for(const language of ['en','zh'])for(const template of templates.list()){
    const d=engine.parse(language==='en'?english:chinese);
    const result=await engine.generate(d,{template:template.id,contentLanguage:language,paper:'a4',size:10.5},dependencies);
    assert.ok(result.text.includes('18,000'));assert.ok(result.text.includes('620'));assert.ok(result.text.includes(d.name));
    for(const p of result.placements){assert.ok(p.y>=template.margin,`${template.id} overflow`);assert.ok(p.x+p.width<=595.28-template.margin+.1,`${template.id} horizontal overflow`);}
    fs.writeFileSync(path.join(tmp,`studio-${language}-${template.id}.pdf`),result.bytes);
  }
});
test('long resumes paginate without dropping the final section; photos remain embedded',async()=>{
  const dependencies=await deps(),d=engine.parse(english);
  d.experience=Array.from({length:70},(_,i)=>`- Project ${i+1}: Built reliable Python services, added tests and investigated customer issues.`).join('\n');
  d.certs='Final certificate marker 12345';
  const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const result=await engine.generate(d,{template:'modern',contentLanguage:'en',paper:'letter',size:11.5,photo},dependencies);
  assert.ok(result.pages>2);assert.ok(result.text.includes('Project 70:'));assert.ok(result.text.includes('Final certificate marker 12345'));
  const doc=await lib.PDFDocument.load(result.bytes);assert.equal(doc.getPageCount(),result.pages);assert.ok(doc.getPage(0).node.Resources().get(lib.PDFName.of('XObject')));
  for(const p of result.placements)assert.ok(p.y>=44&&p.y<=792-44);
  fs.writeFileSync(path.join(tmp,'studio-long-photo.pdf'),result.bytes);
});
test('empty and unsupported characters fail explicitly rather than creating a blank or corrupt PDF',async()=>{
  const dependencies=await deps();
  await assert.rejects(engine.generate(engine.blank(),{},dependencies),/empty/);
  await assert.rejects(engine.generate({...engine.blank(),name:'Jane',summary:'unsupported 🦄'},{template:'classic'},dependencies),/font/);
});
