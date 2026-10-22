# PDF processing assets

- PDF.js 4.10.38: Mozilla contributors, Apache-2.0; see PDFJS-LICENSE.
- PDF-LIB 1.17.1: Andrew Dillon and contributors, MIT; see PDFLIB-LICENSE.md.
- @pdf-lib/fontkit 1.1.1: fork of foliojs/fontkit, MIT; the upstream distributed
  README with the license declaration is retained in FONTKIT-README.md.
- Noto Sans SC: Google / Adobe font contributors, SIL Open Font License 1.1;
  see fonts/OFL.txt. Loaded lazily for characters outside the standard PDF fonts.

JavaScript assets are copied from the versions pinned in package-lock.json by
`npm run vendor`. `node scripts/fetch-pdf-font.cjs` fetches the font and upstream
license notices. Uploaded resumes are never sent to these projects or a CDN.
