// Local-only browser QA server. AI is mocked; no document is sent to a provider.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../pages-deploy');
const fixtures = path.resolve(__dirname, '../tmp/pdfs');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.pfb': 'application/octet-stream', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      let text = ''; for await (const part of req) { text += part; if (text.length > 100000) throw new Error('large request'); }
      const body = JSON.parse(text || '{}');
      res.setHeader('Content-Type', 'application/json');
      if (pathname === '/api/rewrite') {
        const blocks = body.pdfBlocks?.map(b => ({ id: b.id, text: b.editable ? b.text.replace('Built Python services and wrote SQL queries', 'Built reliable Python services and SQL queries').replace('负责开发', '开发并维护') : b.text }));
        res.end(JSON.stringify({ ok: true, rewritten: blocks ? blocks.map(b => b.text).join('\n') : body.resume, pdfBlocks: blocks, model: 'local-fixture' }));
      } else res.end(JSON.stringify({ ok: true, dimensions: ['expression', 'quantify', 'specificity', 'relevance'].map(key => ({ key, score: 70, name: key, comment: 'Synthetic local review', evidence: 'Python' })), overall: 'Local browser QA fixture.', model: 'local-fixture' }));
      return;
    }
    const isFixture = pathname.startsWith('/__fixtures__/');
    const base = isFixture ? fixtures : root;
    const file = path.resolve(base, '.' + (isFixture ? pathname.slice('/__fixtures__'.length) : pathname));
    if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
    const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    let bytes = fs.readFileSync(target);
    if (target === path.join(root, 'index.html')) bytes = Buffer.from(bytes.toString('utf8')
      .replace(/var WORKER_ORIGIN = '[^']+';/, "var WORKER_ORIGIN = '';")
      .replace('</body>', `<div style="position:fixed;bottom:12px;left:12px;z-index:1000;background:#fff;padding:8px;border:1px solid #aaa"><strong>LOCAL QA ONLY</strong>
        <button type="button" id="loadFixture">Load synthetic English PDF</button>
        <button type="button" id="loadChineseFixture">Load synthetic Chinese PDF</button></div>
        <script>async function loadFixture(name){const response=await fetch('/__fixtures__/'+name+'.pdf');const file=new File([await response.arrayBuffer()],name+'.pdf',{type:'application/pdf'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.getElementById('pdfInput');input.files=transfer.files;input.dispatchEvent(new Event('change'));}document.getElementById('loadFixture').onclick=()=>loadFixture('original');document.getElementById('loadChineseFixture').onclick=()=>loadFixture('chinese-original');</script></body>`));
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(bytes);
  } catch (_) { res.writeHead(404); res.end('Not found'); }
}).listen(4178, '127.0.0.1', () => console.log('Local PDF QA preview: http://127.0.0.1:4178 (AI mocked)'));
