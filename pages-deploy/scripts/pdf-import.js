/* Homepage imports text and reports extraction risks; PDF creation lives in /studio/. */
(function(){
  let revision=0,lang='en';
  const copy={en:{tooLarge:'Choose a PDF up to 10 MB.',tooManyPages:'Choose a PDF of at most 10 pages.',password:'Upload an unlocked PDF.',invalid:'This PDF could not be opened. Re-export it and retry.',error:'The PDF could not be read. Paste its text instead.',changedDocument:'The document changed during rewriting. Please retry.'},zh:{tooLarge:'请上传不超过 10 MB 的 PDF。',tooManyPages:'请上传不超过 10 页的 PDF。',password:'请上传已解锁的 PDF。',invalid:'无法打开此 PDF，请重新导出后重试。',error:'无法读取此 PDF，请粘贴简历文字。',changedDocument:'改写期间文档发生变化，请重试。'}};
  window.resumePdf={
    async importFile(file){
      const version=++revision;
      if(file.size>CheckATSPdf.LIMITS.bytes)throw new CheckATSPdf.PdfError('tooLarge');
      await window.pdfReady;
      const model=await CheckATSPdf.inspect(new Uint8Array(await file.arrayBuffer()),pdfjsLib);
      try{if(version!==revision)throw new CheckATSPdf.PdfError('changedDocument');return {text:model.text,stats:model.stats};}
      finally{await model.pdf.destroy();}
    },
    sourceChanged(){revision++;},clear(){revision++;},getRevision:()=>revision,
    setLanguage(value){lang=value==='zh'?'zh':'en';},
    errorMessage(error){return copy[lang][error?.code]||copy[lang].error;}
  };
})();
