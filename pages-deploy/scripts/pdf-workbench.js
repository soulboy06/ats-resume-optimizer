(function () {
  'use strict';
  const engine = window.CheckATSPdf;
  const host = document.getElementById('pdfWorkbench');
  let lang = 'en', model = null, draft = null, result = null, revision = 0, pageIndex = 0, pending = false, error = '', activeText = '';
  // Studio mode: main page no longer shows PDF preview. If host is missing,
  // expose only importFile (for PDF upload text extraction), skip UI.
  const uiEnabled = !!host;
  let unicodeBytes;
  const messages = {
    en: {
      title: 'Your PDF, before and after', local: 'Preview and PDF export stay in this browser. Only text is sent when you request AI rewriting.',
      original: 'Uploaded PDF', optimized: 'Optimized PDF', empty: 'Run AI Rewrite to preview your optimized PDF here.',
      legend: 'Green marks added or replaced text. Outlines mark deletions. The downloaded PDF has no green marks.',
      export: 'Download clean PDF', refresh: 'Update PDF preview', editing: 'Edit rewritten paragraphs', paragraph: 'Paragraph',
      remove: 'Remove PDF', page: 'Page', of: 'of', source: 'Text extracted from your PDF', checks: 'PDF extraction checks',
      text: 'Selectable text', readable: 'Text found on every page', emptyPages: 'Page(s) without extractable text',
      columns: 'Possible multiple columns: compare the extracted reading order with your original.',
      caution: 'These checks measure this PDF’s text extraction, not an ATS pass rate. Page size, text positions, font style and graphics are reused; embedded fonts may be substituted. Longer rewrites must fit the original text regions.',
      ready: 'Export checked: text can be extracted from the generated PDF. Review the content and layout before using it.',
      fitting: 'Preparing PDF and checking extracted text…', stale: 'Your changes are not in the preview yet. Update the preview before exporting.',
      missingSource: 'The resume text has changed outside the PDF editor. Re-upload the PDF to reconnect its layout, or continue with text-only rewriting.',
      tooLarge: 'Choose a PDF up to 10 MB.', tooManyPages: 'Choose a resume of at most 10 pages.', password: 'This PDF is password protected. Upload an unlocked copy.',
      invalid: 'This PDF could not be opened. Try exporting it again from the original editor.',
      imageOnly: 'One or more pages have no selectable text. Preview is available, but layout-preserving export needs a text-based PDF. OCR is not included.',
      forms: 'This PDF contains form fields or a signature. Preview is available; export an ordinary unsigned text PDF from your editor to enable rewriting.',
      rotation: 'Rotated text or pages cannot safely preserve layout yet. Preview is available; upload an unrotated copy for PDF export.',
      garbled: 'Some extracted characters are unreadable. Check the extracted text and export a fresh PDF from the original editor.',
      inlineImage: 'This PDF uses inline graphics that cannot safely be edited yet. Preview is available; re-export it from your editor.',
      textRendering: 'This PDF uses an invisible or outlined text layer. Preview is available; upload a normal text PDF for faithful editing.',
      unsupportedStream: 'This PDF’s drawing instructions cannot safely be preserved. You can preview and check the text; PDF rewriting is unavailable for this file.',
      tooManyBlocks: 'This PDF has too many separate text blocks for layout-preserving rewriting.',
      tooMuchText: 'Layout-preserving AI rewrite supports up to 8,000 characters. Use a shorter resume; the document will not be silently truncated.',
      mapping: 'The rewrite did not include a valid paragraph map. Update the Worker as well as the website, then retry.',
      protectedBlock: 'The rewrite changed a protected heading or contact line. Retry; this version cannot be exported.',
      overflow: 'A rewritten paragraph does not fit its original space. Shorten the paragraph in the PDF editor, then update the preview.',
      font: 'This text contains characters that the export fonts cannot represent. No PDF was exported; try a supported character or a different source PDF.',
      roundTrip: 'The exported text did not match the approved rewrite. Download is blocked to avoid missing, duplicated or hidden text.',
      unavailable: 'The PDF tools could not load. Reload the page and try again.', error: 'The PDF could not be prepared. Your text is still available.',
      changedDocument: 'The source changed during rewriting. Retry with the current document.', loading: 'Opening PDF…', noEdits: 'No editable paragraphs on this page.',
      substituted: 'Font substitutions can slightly change letter shapes. Check both previews.', file: 'File', blocked: 'Preview only', pass: 'Available',
    },
    zh: {
      title: 'PDF 原稿与优化预览', local: '预览和 PDF 导出均在本机浏览器完成。仅在你请求 AI 改写时发送文字。',
      original: '上传的 PDF', optimized: '优化后的 PDF', empty: '点击「使用 AI 改写」后，在这里预览优化后的 PDF。',
      legend: '绿色标出新增或替换的文字，绿框表示删除。下载的 PDF 不带绿色标记。',
      export: '下载无标记 PDF', refresh: '更新 PDF 预览', editing: '编辑改写后的段落', paragraph: '段落',
      remove: '移除 PDF', page: '第', of: '/', source: '从 PDF 中提取的文字', checks: 'PDF 解析检查',
      text: '可选择的文字', readable: '每页都能提取到文字', emptyPages: '页无法提取文字',
      columns: '检测到可能的多栏排版，请对照原稿确认提取文字的阅读顺序。',
      caution: '这里检查的是当前 PDF 的文字解析情况，不是 ATS 通过率。沿用原稿页面尺寸、文字位置、字体风格及图形；嵌入字体可能被替换。改写需放得进原来的文字区域。',
      ready: '已检查导出文件，文字可以重新解析。使用前请确认内容和排版。',
      fitting: '正在生成 PDF 并验证文字解析…', stale: '预览尚未包含刚才的修改，请先更新预览再导出。',
      missingSource: '简历文字已在 PDF 编辑器之外修改。请重新上传 PDF 以重新关联版式，或继续使用纯文本改写。',
      tooLarge: '请上传不超过 10 MB 的 PDF。', tooManyPages: '请上传不超过 10 页的简历。', password: '这份 PDF 有密码保护，请上传已解锁的副本。',
      invalid: '无法打开这份 PDF，请从原编辑器重新导出。',
      imageOnly: '部分页面无法提取文字，可能是扫描件。可以预览，但保留版式改写需要文字型 PDF；当前不包含 OCR。',
      forms: '这份 PDF 包含表单或签名。可以预览；请从原编辑器导出普通、未签名的文字 PDF 后改写。',
      rotation: '暂不能安全保留旋转页面或旋转文字的排版。可以预览，请上传未旋转的副本以导出。',
      garbled: '提取结果含有无法识别的字符。请核对文字，并从原编辑器重新导出 PDF。',
      inlineImage: '这份 PDF 的内联图形暂不能安全编辑。可以预览，请尝试从原编辑器重新导出。',
      textRendering: '这份 PDF 使用隐形或描边文字层。可以预览，请上传普通文字 PDF 后改写。',
      unsupportedStream: '这份 PDF 的绘图指令暂不能安全保留。可以预览和检查文字，但不能为此文件生成保留版式的改写 PDF。',
      tooManyBlocks: '这份 PDF 的文字块过多，暂不支持保留版式改写。',
      tooMuchText: '保留版式的 AI 改写最多支持 8,000 字符。请使用更短的简历，系统不会截断原文。',
      mapping: '改写结果缺少有效的段落对应信息。请同时更新 Worker 和网站，然后重试。',
      protectedBlock: 'AI 修改了受保护的标题或联系方式，本次不能导出，请重试。',
      overflow: '改写后的某段文字放不进原来的区域。请在 PDF 段落编辑器中缩短该段，再更新预览。',
      font: '导出字体无法表示部分字符。没有导出文件，请替换该字符或使用另一份 PDF。',
      roundTrip: '导出文字与确认后的改写不一致。为避免丢字、重复或隐藏旧文字，已阻止下载。',
      unavailable: 'PDF 工具未能加载，请刷新页面后重试。', error: '未能生成 PDF，简历文字仍然保留。',
      changedDocument: '改写期间原稿发生了变化，请使用当前文档重试。', loading: '正在打开 PDF…', noEdits: '本页没有可改写的段落。',
      substituted: '字体替换可能导致字形略有不同，请对照预览检查。', file: '文件', blocked: '仅可预览', pass: '可用',
    }
  };
  const t = key => messages[lang][key] || messages[lang].error;
  const el = (tag, className, text) => {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  const button = (text, action, primary) => {
    const node = el('button', 'button button-sm ' + (primary ? 'button-primary' : 'button-secondary'), text);
    node.type = 'button'; node.addEventListener('click', action); return node;
  };
  const message = (key, detail) => t(key) + (detail ? ' (' + detail + ')' : '');
  function setError(e) { error = message(e?.code || 'error', e?.code === 'overflow' ? e.message : ''); result = null; }

  async function renderPage(pdf, container, highlights) {
    const page = await pdf.getPage(pageIndex + 1), viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.25, 1400 / Math.max(viewport.width, viewport.height));
    const view = page.getViewport({ scale }), wrapper = el('div', 'pdf-paper');
    wrapper.style.aspectRatio = view.width + '/' + view.height;
    const canvas = el('canvas'); canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', t('page') + ' ' + (pageIndex + 1));
    wrapper.append(canvas); container.append(wrapper);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
    for (const h of highlights || []) {
      if (h.page !== pageIndex) continue;
      const r = view.convertToViewportRectangle([h.x, h.y, h.x + h.width, h.y + h.height]);
      const mark = el('span', 'pdf-change' + (h.deletion ? ' pdf-deletion' : ''));
      mark.style.left = Math.min(r[0], r[2]) / view.width * 100 + '%';
      mark.style.top = Math.min(r[1], r[3]) / view.height * 100 + '%';
      mark.style.width = Math.abs(r[2] - r[0]) / view.width * 100 + '%';
      mark.style.height = Math.abs(r[3] - r[1]) / view.height * 100 + '%';
      mark.setAttribute('aria-hidden', 'true'); wrapper.append(mark);
    }
  }

  async function paint() { if (!uiEnabled) return;
    const version = revision;
    host.hidden = !model && !pending && !error;
    host.replaceChildren(); if (host.hidden) return;
    const header = el('div', 'pdf-header'), title = el('div');
    title.append(el('h3', '', t('title')), el('p', 'pdf-muted', t('local')));
    header.append(title, button(t('remove'), clear)); host.append(header);
    if (!model) { host.append(el('p', 'pdf-status', error || t('loading'))); return; }
    host.append(el('p', 'pdf-filename', t('file') + ': ' + model.name));
    const checks = el('div', 'pdf-checks'); checks.setAttribute('aria-label', t('checks'));
    checks.append(el('span', '', t('text') + ': ' + model.stats.chars), el('span', '', t('page') + ': ' + model.stats.pages),
      el('span', model.stats.emptyPages ? 'pdf-warning' : '', model.stats.emptyPages ? model.stats.emptyPages + ' ' + t('emptyPages') : t('readable')));
    host.append(checks);
    if (model.stats.columns) host.append(el('p', 'pdf-warning', t('columns')));
    host.append(el('p', 'pdf-muted', t('caution')));
    for (const code of model.unsupported) host.append(el('p', 'pdf-warning', message(code)));
    if (model.text.length > engine.LIMITS.rewriteChars) host.append(el('p', 'pdf-warning', t('tooMuchText')));
    const extracted = el('details', 'pdf-extracted'); extracted.append(el('summary', '', t('source')), el('pre', '', model.text)); host.append(extracted);
    const nav = el('div', 'pdf-toolbar');
    const previous = button('←', () => { pageIndex--; revision++; paint(); }); previous.disabled = pageIndex === 0;
    previous.setAttribute('aria-label', lang === 'zh' ? '上一页' : 'Previous page');
    const next = button('→', () => { pageIndex++; revision++; paint(); }); next.disabled = pageIndex >= model.stats.pages - 1;
    next.setAttribute('aria-label', lang === 'zh' ? '下一页' : 'Next page');
    nav.append(previous, el('span', '', t('page') + ' ' + (pageIndex + 1) + ' ' + t('of') + ' ' + model.stats.pages), next); host.append(nav);
    const grid = el('div', 'pdf-preview-grid'), before = el('article'), after = el('article');
    before.append(el('h4', '', t('original'))); after.append(el('h4', '', t('optimized'))); grid.append(before, after); host.append(grid);
    const status = el('p', 'pdf-status' + (error ? ' pdf-warning' : '')); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    status.textContent = error || (pending ? t('fitting') : result ? t('ready') : draft ? t('stale') : '');
    host.append(status);
    if (draft) {
      host.append(el('p', 'pdf-muted', t('legend')));
      const actions = el('div', 'pdf-toolbar');
      const refresh = button(t('refresh'), generate); refresh.disabled = pending;
      const download = button(t('export'), downloadPdf, true); download.id = 'pdfDownloadBtn'; download.disabled = !result || pending;
      actions.append(refresh, download); host.append(actions);
      const editor = el('details', 'pdf-paragraph-editor'); editor.open = !!error;
      editor.append(el('summary', '', t('editing')));
      let editable = 0;
      for (const block of model.pages[pageIndex].blocks) {
        if (!block.editable) continue;
        editable++;
        const label = el('label', '', t('paragraph') + ' ' + block.id), input = el('textarea');
        input.id = 'pdf-edit-' + block.id; label.htmlFor = input.id; input.value = draft.find(r => r.id === block.id).text; input.rows = Math.min(7, block.lines.length + 2); input.maxLength = 3000;
        input.addEventListener('input', () => {
          draft.find(r => r.id === block.id).text = input.value;
          activeText = draft.map(r => r.text).join('\n'); revision++; result = null; error = '';
          download.disabled = true; status.textContent = t('stale');
          document.dispatchEvent(new CustomEvent('checkats:pdf-edit', { detail: { text: activeText } }));
        });
        editor.append(label, input);
      }
      if (!editable) editor.append(el('p', '', t('noEdits')));
      host.append(editor);
    }
    try {
      await renderPage(model.pdf, before);
      if (version !== revision) return;
      if (result) {
        const pdf = await window.pdfjsLib.getDocument({ data: result.bytes.slice(), isEvalSupported: false, standardFontDataUrl: '/vendor/standard_fonts/' }).promise;
        try { if (version === revision) await renderPage(pdf, after, result.highlights); } finally { await pdf.destroy(); }
      } else after.append(el('div', 'pdf-placeholder', t('empty')));
    } catch (e) { if (version === revision) { status.textContent = t('error'); result = null; const b = document.getElementById('pdfDownloadBtn'); if (b) b.disabled = true; } }
  }

  async function generate() {
    if (!model || !draft || pending) return;
    const version = ++revision, sourceModel = model;
    pending = true; result = null; error = ''; paint();
    try {
      const built = await engine.createNative(sourceModel, draft.map(r => ({ ...r })), {
        pdfLib: window.PDFLib, pdfjs: window.pdfjsLib, fontkit: window.fontkit,
        unicodeFont: async () => {
          if (!unicodeBytes) {
            const response = await fetch('/vendor/fonts/NotoSansSC.ttf');
            if (!response.ok) throw new engine.PdfError('font');
            unicodeBytes = new Uint8Array(await response.arrayBuffer());
          }
          return unicodeBytes;
        }
      });
      if (version === revision && model === sourceModel) result = built;
    } catch (e) { if (version === revision) setError(e); }
    finally { pending = false; if (model) paint(); }
  }
  function downloadPdf() {
    if (!result || pending) return;
    const url = URL.createObjectURL(new Blob([result.bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url;
    a.download = (model.name.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}_-]/gu, '_') || 'resume') + '-optimized.pdf';
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clear() {
    revision++; const old = model; model = null; draft = null; result = null; error = ''; activeText = ''; pageIndex = 0;
    if (old) old.pdf.destroy(); paint();
  }
  async function importFile(file) {
    const version = ++revision, old = model;
    model = null; draft = null; result = null; error = ''; activeText = ''; pageIndex = 0; pending = true; paint();
    if (old) await old.pdf.destroy();
    try {
      if (file.size > engine.LIMITS.bytes) throw new engine.PdfError('tooLarge');
      await window.pdfReady;
      if (!window.pdfjsLib || !window.PDFLib) throw new engine.PdfError('unavailable');
      const loaded = await engine.inspect(new Uint8Array(await file.arrayBuffer()), window.pdfjsLib, window.PDFLib);
      if (version !== revision) { await loaded.pdf.destroy(); throw new engine.PdfError('changedDocument'); }
      model = loaded; model.name = file.name; activeText = loaded.text;
      return loaded;
    } catch (e) { if (version === revision) setError(e); throw e; }
    finally { pending = false; paint(); }
  }
  function request(source) {
    if (!model) return null;
    if (cleanText(source) !== cleanText(activeText)) return null;
    if (model.unsupported.length) return null;
    if (source.length > engine.LIMITS.rewriteChars) throw new engine.PdfError('tooMuchText');
    return model.blocks.map(b => ({ id: b.id, text: draft ? draft.find(r => r.id === b.id).text : b.text, editable: b.editable, maxChars: Math.ceil(b.text.length * 1.02) }));
  }
  const cleanText = s => String(s || '').trim();
  async function accept(rows, source, rewritten, version) {
    if (version !== revision || !model || cleanText(source) !== cleanText(activeText)) return;
    if (!rows) { error = t('mapping'); draft = null; result = null; paint(); return; }
    try {
      const validated = engine.validateReplacements(model.blocks, rows);
      if (cleanText(rewritten) !== cleanText(validated.map(r => r.text).join('\n'))) throw new engine.PdfError('mapping');
      draft = validated; activeText = rewritten; await generate();
    } catch (e) { setError(e); paint(); }
  }
  function sourceChanged(text) {
    if (!model || cleanText(text) === cleanText(activeText)) return;
    revision++; draft = null; result = null; error = t('missingSource'); paint();
  }
  window.resumePdf = { importFile, request, accept, clear, sourceChanged, getRevision: () => revision,
    setLanguage(value) { lang = value === 'zh' ? 'zh' : 'en'; paint(); },
    errorMessage(e) { return message(e?.code || 'error'); } };
})();
