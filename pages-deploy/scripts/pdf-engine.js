/* CheckATS PDF layout and native-text export. All document processing is local. */
(function (root) {
  'use strict';
  const LIMITS = { bytes: 10 * 1024 * 1024, pages: 10, blocks: 240, rewriteChars: 8000 };
  const clean = s => String(s || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const comparable = s => clean(s).replace(/\s/gu, '');
  class PdfError extends Error {
    constructor(code, detail) { super(detail || code); this.code = code; }
  }

  // Read PDF syntax, not regular-expression matches inside strings. In particular,
  // literal strings may contain escaped parentheses, "BT", "ET", or "Tj".
  // Inline images are deliberately rejected: their arbitrary binary bytes cannot
  // safely be treated as content operators. XObject images are retained normally.
  function removeTextPaint(source) {
    let i = 0, instruction = 0, depth = 0, out = '';
    const white = c => /[\x00\t\n\f\r ]/.test(c);
    while (i < source.length) {
      const c = source[i];
      if (white(c)) { i++; continue; }
      if (c === '%') { while (i < source.length && !/[\r\n]/.test(source[i])) i++; continue; }
      if (c === '(') {
        let nesting = 1; i++;
        while (i < source.length && nesting) {
          if (source[i] === '\\') { i += 2; continue; }
          if (source[i] === '(') nesting++;
          if (source[i] === ')') nesting--;
          i++;
        }
        if (nesting) throw new PdfError('unsupportedStream');
        continue;
      }
      if (c === '<' && source[i + 1] !== '<') {
        const end = source.indexOf('>', i + 1);
        if (end < 0) throw new PdfError('unsupportedStream');
        i = end + 1; continue;
      }
      if (c === '[' || source.slice(i, i + 2) === '<<') { depth++; i += c === '[' ? 1 : 2; continue; }
      if (c === ']' || source.slice(i, i + 2) === '>>') { depth--; i += c === ']' ? 1 : 2; if (depth < 0) throw new PdfError('unsupportedStream'); continue; }
      if (c === '/') { i++; while (i < source.length && !/[\s()[\]<>/%]/.test(source[i])) i++; continue; }
      const start = i;
      while (i < source.length && !/[\s()[\]<>/%]/.test(source[i])) i++;
      if (i === start) throw new PdfError('unsupportedStream');
      const token = source.slice(start, i);
      if (depth || /^[+\-.\d]/.test(token) || /^(true|false|null)$/.test(token)) continue;
      if (token === 'BI' || token === 'ID') throw new PdfError('inlineImage');
      if (token === 'Tr') {
        const mode = Number(source.slice(instruction, start).trim());
        // Text clipping / invisible OCR layers cannot be reconstructed faithfully.
        if (mode !== 0) throw new PdfError('textRendering');
      }
      if (/^(Tj|TJ|'|")$/.test(token)) {
        if (token === "'") out += '\nT*\n';
        else if (token === '"') {
          const spacing = source.slice(instruction, start).match(/^[\s%\S]*?([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+[<(]/);
          if (!spacing) throw new PdfError('unsupportedStream');
          out += '\n' + spacing[1] + ' Tw ' + spacing[2] + ' Tc T*\n';
        }
        else out += '\n';
      } else out += source.slice(instruction, i);
      instruction = i;
    }
    if (depth) throw new PdfError('unsupportedStream');
    return out + source.slice(instruction);
  }

  function sanitizePageText(page, lib) {
    const { PDFName, PDFArray, PDFRawStream, decodePDFRawStream } = lib;
    const ctx = page.doc.context, seen = new Set();
    const resolve = value => value ? ctx.lookup(value) : null;
    function stripStream(stream) {
      if (!(stream instanceof PDFRawStream)) throw new PdfError('unsupportedStream');
      let decoded;
      try { decoded = decodePDFRawStream(stream).decode(); } catch (_) { throw new PdfError('unsupportedStream'); }
      const source = Array.from(decoded, byte => String.fromCharCode(byte)).join('');
      const stripped = removeTextPaint(source);
      const dict = stream.dict.clone(ctx);
      for (const key of ['Filter', 'DecodeParms', 'Length']) dict.delete(PDFName.of(key));
      return ctx.flateStream(Uint8Array.from(stripped, c => c.charCodeAt(0)), Object.fromEntries(dict.entries().map(([k, v]) => [k.decodeText(), v])));
    }
    function stripForms(resources) {
      if (!resources || seen.has(resources)) return;
      seen.add(resources);
      const forms = resolve(resources.get(PDFName.of('XObject')));
      if (!forms) return;
      for (const [name, value] of forms.entries()) {
        const stream = resolve(value);
        if (stream?.dict?.get(PDFName.of('Subtype'))?.toString() !== '/Form') continue;
        if (seen.has(stream)) continue;
        seen.add(stream);
        stripForms(resolve(stream.dict.get(PDFName.of('Resources'))) || resources);
        forms.set(name, ctx.register(stripStream(stream)));
      }
    }
    const contents = resolve(page.node.get(PDFName.of('Contents')));
    if (contents instanceof PDFArray) {
      // A PDF text instruction is allowed to span content streams. Parse the
      // concatenation; never sanitize streams independently.
      const pieces = [];
      for (let n = 0; n < contents.size(); n++) {
        const stream = contents.lookup(n);
        if (!(stream instanceof PDFRawStream)) throw new PdfError('unsupportedStream');
        pieces.push(decodePDFRawStream(stream).decode());
      }
      const joined = pieces.flatMap(bytes => [...bytes, 10]);
      const combined = ctx.stream(Uint8Array.from(joined));
      page.node.set(PDFName.of('Contents'), ctx.register(stripStream(combined)));
    } else if (contents) page.node.set(PDFName.of('Contents'), ctx.register(stripStream(contents)));
    stripForms(page.node.Resources());
    // Original widget appearances / links can contain stale text or unsafe URLs.
    page.node.delete(PDFName.of('Annots'));
  }

  function fontStyle(name, family) {
    const full = (name || '') + ' ' + (family || '');
    return { family: /courier|mono/i.test(full) ? 'mono' : /times|serif|georgia|cambria/i.test(full) && !/sans/i.test(full) ? 'serif' : 'sans', bold: /bold|black|heavy|semibold/i.test(full), italic: /italic|oblique/i.test(full) };
  }

  function layoutPage(textContent, info, fontNames = {}, colors = []) {
    const items = textContent.items.filter(item => typeof item.str === 'string' && item.str.trim()).map((item, index) => {
      const t = item.transform;
      return { text: item.str, x: t[4], y: t[5], width: item.width, size: Math.hypot(t[2], t[3]),
        rotated: Math.abs(t[1]) > .01 || Math.abs(t[2]) > .01 || t[0] < 0 || t[3] < 0,
        font: fontStyle(fontNames[item.fontName] || item.fontName, textContent.styles[item.fontName]?.fontFamily),
        color: colors[index] || [0, 0, 0], index };
    });
    const rows = [];
    for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      let row = rows.find(r => Math.abs(r.y - item.y) < Math.min(item.size * .25, 2));
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    const lines = [];
    let splitRows = 0;
    for (const row of rows) {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      const groups = [[]];
      sorted.forEach((item, n) => {
        if (n && item.x - (sorted[n - 1].x + sorted[n - 1].width) > Math.max(30, item.size * 3)) groups.push([]);
        groups[groups.length - 1].push(item);
      });
      if (groups.filter(g => g.reduce((n, i) => n + i.text.length, 0) > 20).length > 1) splitRows++;
      for (const group of groups) {
        let text = '';
        group.forEach((item, n) => {
          if (n && item.x - (group[n - 1].x + group[n - 1].width) > item.size * .12 && !/\s$/.test(text) && !/^\s/.test(item.text)) text += ' ';
          text += item.text;
        });
        lines.push({ items: group, text: text.trim(), x: group[0].x, y: row.y,
          right: Math.max(...group.map(i => i.x + i.width)), size: Math.max(...group.map(i => i.size)), font: group[0].font, color: group[0].color });
      }
    }
    const right = Math.min(info.box[2] - 12, Math.max(...items.map(i => i.x + i.width), info.box[2] - 48));
    const blocks = [];
    for (const line of lines) {
      const prev = blocks[blocks.length - 1], tail = prev?.lines[prev.lines.length - 1];
      const gap = tail ? tail.y - line.y : 0;
      const sameStyle = tail && Math.abs(tail.size - line.size) < .5 && JSON.stringify(tail.font) === JSON.stringify(line.font) && JSON.stringify(tail.color) === JSON.stringify(line.color);
      const newBullet = /^[•●▪◦\-*–—]\s|^\d+[.)]\s/u.test(line.text);
      // Join wrapped prose, but keep titles, bullets, side-by-side dates, and
      // differently styled text in independent fixed layout regions.
      if (prev && sameStyle && !newBullet && gap > line.size * .8 && gap < line.size * 1.65 && Math.abs(tail.x - line.x) < 8 && tail.right > right - 70 && !/[.!?:：。]$/.test(tail.text)) {
        prev.lines.push(line); prev.text += ' ' + line.text;
      } else blocks.push({ lines: [line], text: line.text, page: info.index });
    }
    blocks.forEach((block, n) => {
      block.id = 'p' + (info.index + 1) + 'b' + (n + 1);
      block.x = Math.min(...block.lines.map(l => l.x));
      block.y = block.lines[0].y;
      block.size = block.lines[0].size;
      block.font = block.lines[0].font;
      block.color = block.lines[0].color;
      const sameRow = lines.filter(l => Math.abs(l.y - block.y) < 2 && l.x > block.x + 10);
      block.width = Math.max(1, Math.min(right, ...sameRow.map(l => l.x - 8)) - block.x);
      block.leading = block.lines.length > 1 ? (block.y - block.lines[block.lines.length - 1].y) / (block.lines.length - 1) : block.size * 1.25;
      block.maxLines = block.lines.length;
      // Fixed regions are intentional: no silent overflow onto rules, sidebars,
      // or the next section in the original PDF.
      const cjk = (block.text.match(/[\u3400-\u9fff]/g) || []).length;
      block.editable = (block.text.length >= 45 || cjk >= 20) && block.size <= 14 && !/@|https?:\/\//i.test(block.text) && !/^[A-Z\s&/]+$/.test(block.text);
    });
    return { ...info, items, blocks, columns: splitRows >= 3, rotatedText: items.some(i => i.rotated) };
  }

  function textColors(ops, lib, items) {
    let color = [0, 0, 0], fontName = '', fontSize = 0, cursor = 0;
    const stack = [], painted = [];
    const { OPS } = lib;
    for (let n = 0; n < ops.fnArray.length; n++) {
      const fn = ops.fnArray[n], a = ops.argsArray[n];
      if (fn === OPS.save) stack.push([...color]);
      if (fn === OPS.restore && stack.length) color = stack.pop();
      if (fn === OPS.setFillRGBColor) color = Array.from(a, x => x / 255);
      if (fn === OPS.setFillGray) color = [a[0], a[0], a[0]];
      if (fn === OPS.setFillCMYKColor) color = [1 - Math.min(1, a[0] + a[3]), 1 - Math.min(1, a[1] + a[3]), 1 - Math.min(1, a[2] + a[3])];
      if (fn === OPS.setFont) { fontName = a[0]; fontSize = a[1]; }
      if (fn === OPS.showText || fn === OPS.showSpacedText) {
        const text = a[0].filter(g => g && typeof g === 'object').map(g => g.unicode || '').join('');
        for (const c of text) if (!/\s/.test(c)) painted.push({ c, color: [...color], fontName, fontSize });
      }
    }
    return items.filter(i => typeof i.str === 'string' && i.str.trim()).map(item => {
      const text = item.str.replace(/\s/g, '');
      const candidate = painted.slice(cursor, cursor + text.length).map(i => i.c).join('');
      if (candidate === text) { const c = painted[cursor]?.color; cursor += text.length; return c; }
      return [0, 0, 0];
    });
  }

  async function inspect(bytes, lib, pdfLib) {
    if (bytes.byteLength > LIMITS.bytes) throw new PdfError('tooLarge');
    const task = lib.getDocument({ data: bytes.slice(), isEvalSupported: false, standardFontDataUrl: '/vendor/standard_fonts/' });
    let pdf;
    try { pdf = await task.promise; } catch (e) { await task.destroy(); throw new PdfError(e.name === 'PasswordException' ? 'password' : 'invalid'); }
    try {
      if (pdf.numPages > LIMITS.pages) throw new PdfError('tooManyPages');
      const pages = [], unsupported = new Set();
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n), content = await page.getTextContent();
        const ops = await page.getOperatorList(), names = {};
        for (const name of Object.keys(content.styles)) {
          try { names[name] = page.commonObjs.get(name)?.name || name; } catch (_) { names[name] = name; }
        }
        const annotations = await page.getAnnotations();
        if (annotations.some(a => a.subtype === 'Widget')) unsupported.add('forms');
        const layout = layoutPage(content, { index: n - 1, box: page.view, rotation: page.rotate }, names, textColors(ops, lib, content.items));
        if (page.rotate || layout.rotatedText) unsupported.add('rotation');
        if (!layout.items.length) unsupported.add('imageOnly');
        pages.push(layout);
      }
      const blocks = pages.flatMap(p => p.blocks);
      if (blocks.length > LIMITS.blocks) unsupported.add('tooManyBlocks');
      const text = blocks.map(b => b.text).join('\n');
      if (text.includes('\uFFFD') || (text.match(/[\uE000-\uF8FF]/g) || []).length > 2) unsupported.add('garbled');
      if (pdfLib) {
        try {
          const source = await pdfLib.PDFDocument.load(bytes.slice());
          const temp = await pdfLib.PDFDocument.create();
          const copies = await temp.copyPages(source, source.getPageIndices());
          copies.forEach(p => { temp.addPage(p); sanitizePageText(p, pdfLib); });
        } catch (e) { unsupported.add(e.code || 'unsupportedStream'); }
      }
      return { bytes: bytes.slice(), pdf, pages, blocks, text, unsupported: [...unsupported],
        stats: { pages: pages.length, chars: text.replace(/\s/g, '').length, blocks: blocks.length,
          emptyPages: pages.filter(p => !p.items.length).length, columns: pages.some(p => p.columns),
          glyphs: pages.reduce((n, p) => n + p.items.length, 0) } };
    } catch (e) { await pdf.destroy(); throw e; }
  }

  function validateReplacements(blocks, replacements) {
    if (!Array.isArray(replacements) || replacements.length !== blocks.length) throw new PdfError('mapping');
    const map = new Map();
    for (const row of replacements) {
      if (!row || typeof row.id !== 'string' || typeof row.text !== 'string' || !row.text.trim() || row.text.length > 3000 || map.has(row.id)) throw new PdfError('mapping');
      map.set(row.id, row.text.trim());
    }
    return blocks.map(b => {
      if (!map.has(b.id)) throw new PdfError('mapping');
      const text = map.get(b.id);
      if (!b.editable && clean(text) !== clean(b.text)) throw new PdfError('protectedBlock');
      return { id: b.id, text };
    });
  }

  function segments(before, after) {
    const tokenize = s => s.match(/[\u3400-\u9fff]|[^\S\n]+|\n|[\p{L}\p{N}_+#]+|[^\s]/gu) || [];
    const a = tokenize(before), b = tokenize(after);
    if (a.length * b.length > 2000000) return b.map(text => ({ text, changed: true }));
    const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (j < b.length) {
      if (i < a.length && a[i] === b[j]) { out.push({ text: b[j++], changed: false }); i++; }
      else if (i < a.length && rows[i + 1][j] >= rows[i][j + 1]) i++;
      else out.push({ text: b[j++], changed: true });
    }
    return out;
  }

  function wrapTokens(tokens, font, size, width) {
    const lines = [[]]; let x = 0;
    for (const token of tokens) {
      if (token.text === '\n') { lines.push([]); x = 0; continue; }
      let w = font.widthOfTextAtSize(token.text, size);
      if (w > width) {
        for (const char of token.text) {
          const cw = font.widthOfTextAtSize(char, size);
          if (cw > width) throw new PdfError('overflow');
          if (x + cw > width && lines[lines.length - 1].length) { lines.push([]); x = 0; }
          lines[lines.length - 1].push({ text: char, changed: token.changed, x, width: cw }); x += cw;
        }
        continue;
      }
      if (x + w > width && !/^\s+$/.test(token.text)) { lines.push([]); x = 0; }
      if (!x && /^\s+$/.test(token.text)) continue;
      lines[lines.length - 1].push({ ...token, x, width: w }); x += w;
    }
    while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
    return lines;
  }

  async function createNative(model, replacements, deps) {
    if (model.unsupported.length) throw new PdfError(model.unsupported[0]);
    const rows = validateReplacements(model.blocks, replacements), map = new Map(rows.map(r => [r.id, r.text]));
    const lib = deps.pdfLib, { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } = lib;
    const doc = await PDFDocument.create();
    const original = await PDFDocument.load(model.bytes.slice());
    const pages = await doc.copyPages(original, original.getPageIndices());
    pages.forEach(page => { doc.addPage(page); sanitizePageText(page, lib); });
    const fonts = new Map(); let unicodeFont;
    async function getFont(style, text) {
      const variants = style.family === 'serif' ? ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'] : style.family === 'mono' ? ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'] : ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'];
      const name = variants[(style.bold ? 1 : 0) + (style.italic ? 2 : 0)];
      if (!fonts.has(name)) fonts.set(name, await doc.embedFont(StandardFonts[name]));
      const standard = fonts.get(name);
      try { standard.encodeText(text); return standard; } catch (_) {
        if (!unicodeFont) {
          if (!deps.fontkit || !deps.unicodeFont) throw new PdfError('font');
          doc.registerFontkit(deps.fontkit);
          const bytes = await deps.unicodeFont();
          const parsed = deps.fontkit.create(bytes), codepoints = new Set(parsed.characterSet);
          // fontkit's CJK subsetting can preserve ToUnicode while losing visible
          // glyph outlines. Embed the static font intact; parsing alone is not
          // enough to establish that a Chinese export is readable.
          unicodeFont = { font: await doc.embedFont(bytes, { subset: false }), codepoints };
        }
        if ([...text].some(c => !/\s/.test(c) && !unicodeFont.codepoints.has(c.codePointAt(0)))) throw new PdfError('font');
        return unicodeFont.font;
      }
    }
    const highlights = [], fitted = [];
    for (const block of model.blocks) {
      const page = pages[block.page], text = map.get(block.id), changed = text !== block.text;
      if (!changed) {
        for (const line of block.lines) for (const item of line.items) {
          const font = await getFont(item.font, item.text);
          const natural = font.widthOfTextAtSize(item.text, item.size);
          const scale = natural ? item.width / natural : 1;
          if (!Number.isFinite(scale) || scale < .2 || scale > 5) throw new PdfError('font');
          page.pushOperators(pushGraphicsState(), concatTransformationMatrix(scale, 0, 0, 1, item.x, item.y));
          page.drawText(item.text, { x: 0, y: 0, size: item.size, font, color: rgb(...item.color) });
          page.pushOperators(popGraphicsState());
        }
        continue;
      }
      const font = await getFont(block.font, text), tokens = segments(block.text, text);
      let size = block.size, lines;
      while (size >= block.size * .9 - .01) {
        lines = wrapTokens(tokens, font, size, block.width);
        if (lines.length <= block.maxLines) break;
        size -= .25;
      }
      if (!lines || lines.length > block.maxLines || size < block.size * .9 - .01) throw new PdfError('overflow', block.id);
      fitted.push({ id: block.id, size, originalSize: block.size });
      lines.forEach((line, n) => {
        const baseline = block.y - n * block.leading;
        for (const run of line) {
          page.drawText(run.text, { x: block.x + run.x, y: baseline, font, size, color: rgb(...block.color) });
          if (run.changed && run.text.trim()) highlights.push({ page: block.page, x: block.x + run.x, y: baseline - size * .2, width: run.width, height: size * 1.2 });
        }
      });
      // Deletions have no new glyph to highlight; outline the edited region.
      if (!tokens.some(t => t.changed && t.text.trim())) highlights.push({ page: block.page, x: block.x, y: block.y - (block.maxLines - 1) * block.leading - size * .2, width: block.width, height: (block.maxLines - 1) * block.leading + size * 1.2, deletion: true });
    }
    doc.setTitle('Optimized resume'); doc.setCreator('CheckATS'); doc.setProducer('CheckATS native-text PDF');
    const bytes = await doc.save();
    // Test the real downloadable bytes, not the canvas: new text must round-trip
    // through a separate parser, with no old hidden text, omissions, or duplicates.
    const verification = await deps.pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, standardFontDataUrl: '/vendor/standard_fonts/' }).promise;
    let extracted = '';
    try {
      for (let n = 1; n <= verification.numPages; n++) extracted += (await (await verification.getPage(n)).getTextContent()).items.map(i => i.str || '').join(' ');
      if (comparable(extracted) !== comparable(rows.map(r => r.text).join(' '))) throw new PdfError('roundTrip');
    } finally { await verification.destroy(); }
    return { bytes, highlights, fitted, text: rows.map(r => r.text).join('\n') };
  }

  const api = { LIMITS, PdfError, clean, comparable, removeTextPaint, sanitizePageText, layoutPage, inspect, validateReplacements, segments, wrapTokens, createNative };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CheckATSPdf = api;
})(typeof window === 'undefined' ? globalThis : window);
