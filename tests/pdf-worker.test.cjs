const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../cloudflare/hr-review-worker.js'), 'utf8').replace('export default', 'const worker =');
function context(reply) {
  let called = false;
  const ctx = vm.createContext({ Response, Request, URL, console, Date, Map, Set, TextDecoder, crypto:require('node:crypto').webcrypto,
    fetch: async (_, options) => { called = true; const body = JSON.parse(options.body); assert.equal(body.messages[0].role,'system'); assert.deepEqual(JSON.parse(body.messages[1].content).untrustedDocumentData.pdfBlocks.map(b=>b.id),blocks.map(b=>b.id)); return Response.json({ choices: [{ message: { content: JSON.stringify({ blocks: reply }) }, finish_reason: 'stop' }] }); } });
  vm.runInContext(source + '\nthis.handleRewrite = handleRewrite; this.validatePdfBlocks = validatePdfBlocks; this.parsePdfRewrite = parsePdfRewrite;', ctx);
  return { ctx, called: () => called };
}
const blocks = [{ id: 'p1b1', text: 'ALEX EXAMPLE', editable: false }, { id: 'p1b2', text: 'Built Python services and wrote SQL queries for internal tools.', editable: true }];
const body = () => ({ resume: blocks.map(b => b.text).join('\n'), jd: 'Python developer', lang: 'en', pdfBlocks: blocks });
test('PDF Worker preserves mapped output and rejects hallucinated/missing headings', async () => {
  const output = blocks.map(b => ({ id: b.id, text: b.text }));
  const { ctx } = context(output);
  const req = new Request('https://test.local/api/rewrite', { method: 'POST', body: JSON.stringify(body()) });
  const r = await ctx.handleRewrite(req, { DEEPSEEK_API_KEY: 'synthetic-test-key' });
  assert.equal(r.status, 200);
  const result = await r.json(); assert.deepEqual(result.pdfBlocks, output); assert.equal(result.rewritten, body().resume);
  for (const invalid of [[output[0]], [{ id: 'p1b1', text: 'FAKE NAME' }, output[1]], [output[0], output[0]]]) {
    assert.throws(() => ctx.parsePdfRewrite(JSON.stringify({ blocks: invalid }), blocks));
  }
});
test('PDF Worker rejects oversized and mismatched source before contacting a model', async () => {
  for (const bad of [{ ...body(), resume: 'x'.repeat(8001) }, { ...body(), resume: 'wrong resume' }, { ...body(), pdfBlocks: [] }]) {
    const { ctx, called } = context([]);
    const r = await ctx.handleRewrite(new Request('https://test.local/api/rewrite', { method: 'POST', body: JSON.stringify(bad) }), { DEEPSEEK_API_KEY: 'synthetic-test-key' });
    assert.equal(r.status, 400); assert.equal(called(), false);
  }
});
