const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lib = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const engine = require('../pages-deploy/scripts/pdf-engine.js');
const tmp = path.join(__dirname, '../tmp/pdfs');
fs.mkdirSync(tmp, { recursive: true });
let pdfjs;
async function dependencies() {
  if (!pdfjs) {
    const actual = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs = { ...actual, getDocument(options) { return actual.getDocument({ ...options, standardFontDataUrl: path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts/') }); } };
  }
  return { pdfLib: lib, pdfjs, fontkit, unicodeFont: async () => new Uint8Array(fs.readFileSync(path.join(__dirname, '../pages-deploy/vendor/fonts/NotoSansSC.ttf'))) };
}
async function fixture(options = {}) {
  const doc = await lib.PDFDocument.create();
  const regular = await doc.embedFont(lib.StandardFonts.TimesRoman);
  const bold = await doc.embedFont(lib.StandardFonts.TimesRomanBold);
  for (let n = 0; n < (options.pages || 1); n++) {
    const p = doc.addPage([595, 842]);
    if (options.rotation) p.setRotation(lib.degrees(90));
    p.drawRectangle({ x: 32, y: 32, width: 531, height: 778, borderColor: lib.rgb(.4, .4, .5), borderWidth: .5 });
    if (!options.scan) {
      p.drawText('ALEX EXAMPLE', { x: 48, y: 782, size: 20, font: bold, color: lib.rgb(.1, .2, .4) });
      p.drawText('alex@example.com | 2024-01 - 2025-06', { x: 48, y: 758, size: 10, font: regular });
      p.drawLine({ start: { x: 48, y: 745 }, end: { x: 547, y: 745 }, color: lib.rgb(.1, .2, .4), thickness: 1 });
      p.drawText('EXPERIENCE', { x: 48, y: 720, size: 13, font: bold });
      p.drawText('Built Python services and wrote SQL queries for internal tools.', { x: 48, y: 698, size: 11, font: regular });
      p.drawText('Documented deployments and tested services with the engineering team.', { x: 48, y: 676, size: 11, font: regular });
      p.drawText('EDUCATION', { x: 48, y: 640, size: 13, font: bold });
      p.drawText('Example University - Computer Science - 2020-09 to 2024-06', { x: 48, y: 618, size: 11, font: regular });
      p.drawText('Page ' + (n + 1), { x: 280, y: 48, size: 9, font: regular });
    }
    if (options.form) doc.getForm().createTextField('original').addToPage(p, { x: 48, y: 530, width: 200, height: 22 });
  }
  return doc.save();
}

test('content sanitizer removes only real text painting, not tokens inside names or strings', () => {
  const source = 'q /BT 1 Tf BT (SECRET \\( Tj \\) ET) Tj [<4142> -20 (OLD)] TJ ET 1 0 0 rg 0 0 10 10 re f Q';
  const sanitized = engine.removeTextPaint(source);
  assert(!sanitized.includes('SECRET')); assert(!sanitized.includes('4142'));
  assert(sanitized.includes('/BT 1 Tf')); assert(sanitized.includes('10 10 re f'));
  assert.throws(() => engine.removeTextPaint('BI /W 1 ID binary EI'), { code: 'inlineImage' });
  assert.throws(() => engine.removeTextPaint('BT 3 Tr (hidden) Tj ET'), { code: 'textRendering' });
  assert(!engine.removeTextPaint('BT (line) \' 2 1 (other) " ET').includes('other'));
});

test('native export retains page geometry/graphics and replaces text without hidden originals', async () => {
  const deps = await dependencies(), bytes = await fixture({ pages: 2 });
  fs.writeFileSync(path.join(tmp, 'original.pdf'), bytes);
  const model = await engine.inspect(bytes, deps.pdfjs, lib);
  try {
    assert.deepEqual(model.unsupported, []);
    assert.equal(model.stats.pages, 2);
    assert(model.blocks.some(b => b.font.bold));
    const replacements = model.blocks.map(b => ({ id: b.id, text: b.text.startsWith('Built Python') ? 'Built reliable Python services and SQL queries for internal tools.' : b.text }));
    const output = await engine.createNative(model, replacements, deps);
    fs.writeFileSync(path.join(tmp, 'optimized.pdf'), output.bytes);
    assert(output.highlights.length > 0);
    assert(output.highlights.every(h => h.width > 0 && h.height > 0));
    const reopened = await lib.PDFDocument.load(output.bytes);
    assert.equal(reopened.getPageCount(), 2); assert.deepEqual(reopened.getPage(0).getSize(), { width: 595, height: 842 });
    const parsed = await deps.pdfjs.getDocument({ data: output.bytes.slice(), isEvalSupported: false }).promise;
    try {
      let text = '';
      for (let n = 1; n <= parsed.numPages; n++) {
        const p = await parsed.getPage(n), ops = await p.getOperatorList();
        assert(ops.fnArray.includes(deps.pdfjs.OPS.constructPath));
        assert(!ops.fnArray.includes(deps.pdfjs.OPS.paintImageXObject));
        text += (await p.getTextContent()).items.map(i => i.str || '').join(' ') + '\n';
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] === deps.pdfjs.OPS.setFillRGBColor) assert.notDeepEqual(Array.from(ops.argsArray[i]), [86, 217, 135]);
        }
      }
      assert.equal((text.match(/reliable\s+Python/g) || []).length, 2);
      assert(!text.includes('Built Python services and wrote'));
      assert.equal(engine.comparable(text), engine.comparable(replacements.map(r => r.text).join(' ')));
    } finally { await parsed.destroy(); }
  } finally { await model.pdf.destroy(); }
});

test('oversized rewrites fail instead of overlapping the next section', async () => {
  const deps = await dependencies(), model = await engine.inspect(await fixture(), deps.pdfjs, lib);
  try {
    const replacements = model.blocks.map(b => ({ id: b.id, text: b.editable ? b.text.repeat(8) : b.text }));
    await assert.rejects(engine.createNative(model, replacements, deps), { code: 'overflow' });
  } finally { await model.pdf.destroy(); }
});

test('scanned, rotated and interactive PDFs are diagnosed and cannot silently export', async () => {
  const deps = await dependencies();
  for (const [options, reason] of [[{ scan: true }, 'imageOnly'], [{ rotation: true }, 'rotation'], [{ form: true }, 'forms']]) {
    const model = await engine.inspect(await fixture(options), deps.pdfjs, lib);
    try {
      assert(model.unsupported.includes(reason));
      await assert.rejects(engine.createNative(model, model.blocks.map(b => ({ id: b.id, text: b.text })), deps));
    } finally { await model.pdf.destroy(); }
  }
});

test('Chinese native text round-trips through embedded fonts', async () => {
  const deps = await dependencies(), doc = await lib.PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await deps.unicodeFont(), { subset: false }), p = doc.addPage([595, 842]);
  p.drawText('张三 软件工程师', { x: 48, y: 780, size: 20, font });
  p.drawText('负责开发内部工具，使用 Python 和 SQL 处理业务数据，并编写测试。', { x: 48, y: 720, size: 11, font });
  p.drawText('维护部署流程，记录技术方案，协助团队排查问题并保证服务稳定运行。', { x: 48, y: 696, size: 11, font });
  const bytes = await doc.save(); fs.writeFileSync(path.join(tmp, 'chinese-original.pdf'), bytes);
  const model = await engine.inspect(bytes, deps.pdfjs, lib);
  try {
    assert.deepEqual(model.unsupported, []);
    const rows = model.blocks.map(b => ({ id: b.id, text: b.editable ? b.text.replace('负责开发', '开发并维护') : b.text }));
    const output = await engine.createNative(model, rows, deps);
    fs.writeFileSync(path.join(tmp, 'chinese-optimized.pdf'), output.bytes);
    assert(output.text.includes('开发并维护'));
    assert(output.highlights.length > 0);
  } finally { await model.pdf.destroy(); }
});

test('mapped rewrites cannot omit, duplicate or replace protected source blocks', () => {
  const blocks = [{ id: 'p1b1', text: 'Name', editable: false }, { id: 'p1b2', text: 'Worked on reliable internal tools.', editable: true }];
  assert.throws(() => engine.validateReplacements(blocks, [{ id: 'p1b1', text: 'Name' }]), { code: 'mapping' });
  assert.throws(() => engine.validateReplacements(blocks, [{ id: 'p1b1', text: 'Name' }, { id: 'p1b1', text: 'Dup' }]), { code: 'mapping' });
  assert.throws(() => engine.validateReplacements(blocks, [{ id: 'p1b1', text: 'Other name' }, { id: 'p1b2', text: 'Worked' }]), { code: 'protectedBlock' });
});

test('text in shared Form XObjects is removed before drawing native replacement text', async () => {
  const deps = await dependencies(), child = await lib.PDFDocument.create();
  const p = child.addPage([595, 842]); p.drawText('Built Python services and wrote SQL queries for internal tools.', { x: 48, y: 700, size: 11 });
  const outer = await lib.PDFDocument.create(), embedded = await outer.embedPdf(await child.save());
  outer.addPage([595, 842]).drawPage(embedded[0]);
  const model = await engine.inspect(await outer.save(), deps.pdfjs, lib);
  try {
    assert.deepEqual(model.unsupported, []);
    const result = await engine.createNative(model, model.blocks.map(b => ({ id: b.id, text: 'Built reliable Python services and SQL queries for internal tools.' })), deps);
    assert(result.highlights.length > 0);
  } finally { await model.pdf.destroy(); }
});

test('mixed ASCII/CJK text round-trips without digit glyph corruption', async () => {
  // Regression test: pdf-lib/fontkit's layout() substitutes digit glyphs that
  // follow Latin letters in this NotoSansSC file, emitting glyph IDs absent
  // from the ToUnicode CMap. Digits came back as unrelated CJK characters
  // (e.g. "S3" -> "S睢"), failing the round-trip check on real-world PDFs.
  const deps = await dependencies(), doc = await lib.PDFDocument.create();
  const p = doc.addPage([595, 842]);
  p.drawText('placeholder', { x: 48, y: 700, size: 11 });
  const model = await engine.inspect(await doc.save(), deps.pdfjs, lib);
  try {
    assert.deepEqual(model.unsupported, []);
    // Simulate a real-world (Word-exported) extraction: one item mixing
    // Latin letters, digits and CJK, as pdf.js returns for such PDFs.
    const block = model.blocks[0], item = block.lines[0].items[0];
    item.text = 'AWS（ECS、S3、CloudWatch）p95测试18000';
    block.text = item.text;
    const output = await engine.createNative(model, model.blocks.map(b => ({ id: b.id, text: b.text })), deps);
    assert(output.text.includes('S3'));
    assert(output.text.includes('p95'));
    assert(output.text.includes('18000'));
    assert(!output.text.includes('睢'));
  } finally { await model.pdf.destroy(); }
});
