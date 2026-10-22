const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const templates=require('../pages-deploy/studio/templates.js'),adapter=require('../pages-deploy/studio/typst-adapter.js'),engine=require('../pages-deploy/studio/engine.js');
const root=path.join(__dirname,'..'),assets=path.join(root,'pages-deploy/vendor/typst');
const output=path.join(root,'tmp/pdfs/typst');fs.mkdirSync(output,{recursive:true});
let compiler,pdfjs;
const examples={en:{name:'Alex Morgan',title:'Software Engineer',contact:'alex@example.com | Seattle, WA\nhttps://alex.example.com',summary:'Software engineer building reliable Python services and React applications.',experience:'Software Engineer II | Harborline | March 2022 - Present\n- Built FastAPI services handling 18,000 shipment events each day.\n- Reduced PostgreSQL search latency from 1.8 seconds to 620 milliseconds.\n\nSoftware Engineer | Maplebridge | July 2019 - February 2022\n- Implemented webhook verification and idempotent billing.',projects:'Support Analytics | Python, PostgreSQL\n- Added scheduled imports and CSV reports.',education:'Oregon State University | B.S. Computer Science | 2019',skills:'Python, TypeScript, SQL, Docker, React',certs:'AWS Certified Developer | 2023',other:'Volunteer mentor for community programming students.'},zh:{name:'王晨',title:'软件工程师',contact:'wang.chen@example.com | 上海\nhttps://wang.example.com',summary:'拥有六年 Python 后端与 React Web 应用开发经验，负责企业物流平台。',experience:'高级软件工程师 | 海桥科技 | 2022年3月 - 至今\n- 使用 FastAPI 每日处理 18,000 次运单更新。\n- 优化查询，将延迟从 1.8 秒降低至 620 毫秒。\n\n软件工程师 | 枫桥科技 | 2019年7月 - 2022年2月\n- 加入支付回调验证和幂等处理。',projects:'工单分析平台 | Python、SQL\n- 加入定时导入和 CSV 报表下载。',education:'浙江大学 | 计算机科学学士 | 2019年6月',skills:'Python、TypeScript、Docker、SQL、React',certs:'AWS 开发者认证 | 2023年',other:'辅导社区学生学习编程，参与开源项目。'}};
test.before(async()=>{
  const m=await import('@myriaddreamin/typst-ts-web-compiler');
  await m.default({module_or_path:fs.readFileSync(path.join(root,'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'))});
  const builder=new m.TypstCompilerBuilder();builder.set_dummy_access_model();
  for(const file of [path.join(root,'pages-deploy/vendor/fonts/NotoSansSC.ttf'),...JSON.parse(fs.readFileSync(path.join(assets,'fonts.json'))).map(f=>path.join(assets,'fonts',f))])await builder.add_raw_font(fs.readFileSync(file));
  compiler=await builder.build();pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
});
test.after(()=>compiler?.free());
async function generate(template,data,settings={}){
  const opts={paper:'a4',size:'10.5',contentLanguage:'en',...settings};
  compiler.reset_shadow();compiler.reset();
  compiler.add_source('/layout.typ',fs.readFileSync(path.join(root,'pages-deploy/studio/typst',template.id,'layout.typ'),'utf8'));
  compiler.add_source('/main.typ',adapter.source(template));
  compiler.map_shadow('/resume.json',Buffer.from(JSON.stringify(adapter.prepare(engine.validate(data),opts))));
  if(opts.photo)compiler.map_shadow('/photo.png',Buffer.from(opts.photo.split(',')[1],'base64'));
  const world=compiler.snapshot('/','/main.typ',[]);let result;
  try{result=world.get_artifact(1,2);}finally{world.free();}
  assert.ok(result.result,template.id+': '+JSON.stringify(result.diagnostics));
  assert.doesNotMatch(JSON.stringify(result.diagnostics||[]),/glyph|unknown font family/i);
  const bytes=result.result,pdf=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
  let text='';const positions=[];
  try{for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();text+=content.items.map(i=>i.str||'').join(' ')+'\n';for(const item of content.items)if(item.str)positions.push({x:item.transform[4],y:item.transform[5],width:item.width,pageWidth:page.view[2],pageHeight:page.view[3]});}adapter.verify(data,text);return{bytes,text,pages:pdf.numPages,positions};}finally{await pdf.destroy();}
}
test('the collection contains the thirty audited layouts, not variants of the legacy renderer',()=>{
  assert.equal(templates.list().length,30);assert.equal(new Set(templates.list().map(t=>t.id)).size,30);
  for(const template of templates.list()){assert.equal(template.engine,'typst');assert.ok(fs.existsSync(path.join(root,'pages-deploy/studio/typst',template.id,'upstream.typ')));}
});
for(const lang of ['en','zh'])for(const template of templates.list())test(`${template.id}: native ${lang} text, complete sections and page bounds`,async()=>{
  const result=await generate(template,examples[lang],{contentLanguage:lang});
  assert.equal(result.pages,1,'A short resume should not have a separate header-only page');
  for(const item of result.positions){assert.ok(item.x>=-1&&item.x+item.width<=item.pageWidth+1,template.id+' horizontal overflow '+JSON.stringify(item));assert.ok(item.y>=0&&item.y<=item.pageHeight,template.id+' vertical overflow');}
  fs.writeFileSync(path.join(output,`${template.id}-${lang}.pdf`),result.bytes);
});
test('long entries and long sidebars paginate without dropping the final text',async()=>{
  for(const id of ['slate','atlas','caption','grid','timeline','portrait']){
    const data={...examples.en,experience:'Software Engineer | Company | 2020 - Present\n'+Array.from({length:65},(_,i)=>'- Project '+i+': Built reliable services, added tests and investigated customer reports.').join('\n'),skills:Array.from({length:65},(_,i)=>'Technical skill '+i).join('\n'),other:'Final content marker 8675309'};
    const result=await generate(templates.get(id),data,{paper:'letter'});assert.ok(result.pages>1);assert.ok(result.text.includes('8675309'));
    for(const item of result.positions)assert.ok(item.y>=0&&item.y<=792,id+' overflow');
    fs.writeFileSync(path.join(output,id+'-long.pdf'),result.bytes);
  }
});
test('user content stays literal and every template embeds photos on the first page',async()=>{
  const data={...examples.en,summary:'Literal #read("/private.txt") and [brackets] <tags> $ math \\ text & symbols.'};
  const photo='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'fixtures/studio-photo.png')).toString('base64');
  for(const {id} of templates.list()){
    const result=await generate(templates.get(id),data,{photo});
    fs.writeFileSync(path.join(output,id+'-photo.pdf'),result.bytes);
    const lib=require('pdf-lib'),pdf=await lib.PDFDocument.load(result.bytes);
    assert.ok(pdf.getPage(0).node.Resources().get(lib.PDFName.of('XObject')));
  }
});
test('Index photo shares the identity header instead of adding a separate row before the body',async()=>{
  const photo='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'fixtures/studio-photo.png')).toString('base64');
  for(const lang of ['en','zh']){
    const data={...examples[lang],name:lang==='zh'?'亚历克斯·摩根 Alex Morgan':examples.en.name};
    const plain=await generate(templates.get('index'),data,{contentLanguage:lang});
    const pictured=await generate(templates.get('index'),data,{photo,contentLanguage:lang});
    assert.equal(pictured.pages,plain.pages);
    fs.writeFileSync(path.join(output,'index-'+lang+'-photo-header.pdf'),pictured.bytes);
    const extract=async bytes=>{const pdf=await pdfjs.getDocument({data:bytes.slice()}).promise;try{return(await(await pdf.getPage(1)).getTextContent()).items;}finally{await pdf.destroy();}};
    const original=await extract(plain.bytes),updated=await extract(pictured.bytes),label=lang==='zh'?'个人简介':'SUMMARY';
    const baseline=items=>items.find(item=>item.str.replace(/\s/g,'')===label).transform[5];
    assert.ok(baseline(original)-baseline(updated)<35,'Photo should not reserve its own seventy-point row');
    for(const item of pictured.positions)assert.ok(item.x>=-1&&item.x+item.width<=item.pageWidth+1);
  }
});
test('all templates support partial drafts without adding placeholder people or losing sections',async()=>{
  const data={...engine.blank(),skills:'Python, SQL',other:'Contact me at test@example.com.'};
  for(const template of templates.list()){
    const result=await generate(template,data);assert.doesNotMatch(result.text,/Jane Smith|Alex Morgan/);assert.equal(result.pages,1);
  }
});

test('imported multiline roles keep dates and companies in one entry without empty body spacing',async()=>{
  for(const [dates,nextDates,company] of [['2022年3月 - 至今','2019年7月 - 2022年2月','Harborline Logistics Software – 美国西雅图'],['March 2022 - Present','July 2019 - February 2022','Harborline Logistics Software - Seattle']]){
    const experience=`Software Engineer II\n\n${dates}\n\n${company}\n- Built reliable services.\n\nSoftware Engineer\n\n${nextDates}\n\nMaplebridge Commerce\n- Added payment verification.\n\n`;
    const entries=adapter.entries(experience);
    assert.equal(entries.length,2);
    assert.equal(entries[0].title,'Software Engineer II');
    assert.equal(entries[0].dates,dates);
    assert.equal(entries[0].subtitle,company);
    assert.deepEqual(entries[0].lines,['- Built reliable services.']);
    const result=await generate(templates.get('portrait'),{...engine.blank(),name:'Alex Morgan',experience},{contentLanguage:dates.includes('年')?'zh':'en'});
    const pdf=await pdfjs.getDocument({data:result.bytes.slice()}).promise;
    try{
      const items=(await(await pdf.getPage(1)).getTextContent()).items;
      const title=items.find(item=>item.str.startsWith('Software Engineer II')),date=items.find(item=>item.str.startsWith(dates.includes('年')?'2022':dates)),bullet=items.find(item=>item.str.includes('Built reliable services.'));
      assert.ok(title&&date&&bullet,JSON.stringify(items.map(i=>i.str)));
      assert.ok(Math.abs(title.transform[5]-date.transform[5])<3,'Dates should share the role header row');
      assert.ok(title.transform[5]-bullet.transform[5]<35,'The first bullet should follow the header without phantom entries');
    }finally{await pdf.destroy();}
    fs.writeFileSync(path.join(output,'portrait-import-'+(dates.includes('年')?'zh':'en')+'.pdf'),result.bytes);
  }
  assert.equal(adapter.entries('Degree One | University | 2019\n\nDegree Two | College | 2017')[0].lines.length,0);
});
test('text verification rejects missing content and unsupported glyphs are reported',async()=>{
  assert.throws(()=>adapter.verify(examples.en,'Unrelated text'),/roundTrip/);
  await assert.rejects(generate(templates.get('refined'),{...examples.en,summary:'Unsupported unicorn 🦄'}),/glyph|roundTrip/);
});
test('manual line spacing changes actual PDF baselines across single-column and sidebar layouts',async()=>{
  const data={...engine.blank(),name:'Alex Morgan',summary:'First spacing marker\nSecond spacing marker'};
  for(const id of ['refined','index','slate','caption','grid','portrait']){
    for(const ratio of [1,1.5,2]){
      const result=await generate(templates.get(id),data,{size:'12',lineSpacing:String(ratio)});
      const pdf=await pdfjs.getDocument({data:result.bytes.slice()}).promise;
      try{const items=(await(await pdf.getPage(1)).getTextContent()).items;
        const first=items.find(item=>item.str==='First spacing marker'),second=items.find(item=>item.str==='Second spacing marker');
        assert.ok(Math.abs(first.transform[5]-second.transform[5]-12*ratio)<.2,id+' at '+ratio+': baseline gap '+(first.transform[5]-second.transform[5]));
      }finally{await pdf.destroy();}
    }
  }
});
test('all thirty templates retain readable text at the expanded size and spacing limits',async()=>{
  for(const template of templates.list())for(const [size,lineSpacing] of [['8','1'],['16','2']]){
    const result=await generate(template,examples.zh,{size,lineSpacing,contentLanguage:'zh'});
    for(const item of result.positions){assert.ok(item.x>=-1&&item.x+item.width<=item.pageWidth+1,template.id+' overflow at '+size);assert.ok(item.y>=0&&item.y<=item.pageHeight);}
    if(template.id==='index')fs.writeFileSync(path.join(output,`index-zh-${size}pt-spacing-${lineSpacing}.pdf`),result.bytes);
  }
});
