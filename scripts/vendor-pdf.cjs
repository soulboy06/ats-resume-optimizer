const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const target = path.join(root, 'pages-deploy/vendor');
fs.mkdirSync(target, { recursive: true });
for (const [from, to] of [
  ['pdfjs-dist/build/pdf.min.mjs', 'pdf.min.mjs'],
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ['pdfjs-dist/LICENSE', 'PDFJS-LICENSE'],
  ['pdf-lib/dist/pdf-lib.min.js', 'pdf-lib.min.js'],
  ['pdf-lib/LICENSE.md', 'PDFLIB-LICENSE.md'],
  ['@pdf-lib/fontkit/dist/fontkit.umd.min.js', 'fontkit.umd.min.js'],
]) fs.copyFileSync(path.join(root, 'node_modules', from), path.join(target, to));
fs.cpSync(path.join(root, 'node_modules/pdfjs-dist/standard_fonts'), path.join(target, 'standard_fonts'), { recursive: true });
fs.mkdirSync(path.join(target, 'fonts'), { recursive: true });
console.log('Pinned PDF.js, PDF-LIB, fontkit, standard fonts and licenses copied to static assets.');
