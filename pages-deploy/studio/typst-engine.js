(function(root){
  let worker,sequence=0;const pending=new Map();
  function reset(){worker?.terminate();worker=null;for(const task of pending.values()){clearTimeout(task.timeout);task.reject(new Error('compiler'));}pending.clear();}
  function compile(request){
    if(!worker){worker=new Worker('/studio/typst-worker.mjs',{type:'module'});worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;clearTimeout(task.timeout);pending.delete(data.id);data.error?task.reject(new Error(data.error)):task.resolve(data.bytes);};worker.onerror=reset;}
    return new Promise((resolve,reject)=>{const id=++sequence,timeout=setTimeout(reset,90000);pending.set(id,{resolve,reject,timeout});worker.postMessage({id,...request});});
  }
  async function generate(data,settings,deps){
    const validated=root.StudioEngine.validate(data);if(!Object.values(validated).some(Boolean))throw new Error('empty');
    const template=deps.templates.get(settings.template),adapter=root.StudioTypstAdapter;
    const bytes=await compile({template:template.id,source:adapter.source(template),payload:adapter.prepare(validated,settings),photo:settings.photo});
    const doc=await deps.pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
    let text='';const pages=doc.numPages;
    try{if(pages>15)throw new Error('pages');for(let n=1;n<=pages;n++){const page=await doc.getPage(n),content=await page.getTextContent();for(const item of content.items)if(item.str&&(item.transform[4]<-1||item.transform[4]+item.width>page.view[2]+1||item.transform[5]<0||item.transform[5]>page.view[3]))throw new Error('layout');text+=content.items.map(i=>i.str||'').join(' ')+'\n';}adapter.verify(validated,text);}finally{await doc.destroy();}
    return {bytes,pages,text};
  }
  root.StudioTypstEngine={generate};
})(window);
