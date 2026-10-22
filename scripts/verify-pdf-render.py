"""Independent native-text and visible-glyph QA using PyMuPDF, not PDF.js.

Run npm test first to generate the synthetic fixtures. Never use real resumes.
"""
from pathlib import Path
import fitz

root = Path(__file__).resolve().parents[1]
for name in ('original', 'optimized', 'chinese-original', 'chinese-optimized'):
    file = root / 'tmp/pdfs' / (name + '.pdf')
    with fitz.open(file) as pdf:
        glyphs = 0
        for page in pdf:
            assert page.get_text().strip(), (name, 'no extractable text')
            assert not page.get_images(), (name, 'text was rasterized')
            for block in page.get_text('rawdict')['blocks']:
                for line in block.get('lines', []):
                    for span in line['spans']:
                        for char in span['chars']:
                            if char['c'].isspace():
                                continue
                            clip = fitz.Rect(char['bbox']) & page.rect
                            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip, colorspace=fitz.csGRAY)
                            assert sum(x < 210 for x in pix.samples) >= 2, (name, 'missing visible glyph', char['c'])
                            glyphs += 1
            assert glyphs, name
        pdf[0].get_pixmap(matrix=fitz.Matrix(1.4, 1.4)).save(root / 'tmp/pdfs' / (name + '.png'))
        print('PASS', name, len(pdf), 'pages;', glyphs, 'extractable visible glyphs; no raster text')

download = Path.home() / 'Downloads/original-optimized.pdf'
if download.exists():
    with fitz.open(download) as pdf:
        text = ''.join(page.get_text() for page in pdf)
        assert 'reliable Python' in text
        assert 'Built Python services and wrote' not in text
        print('PASS actual browser download: native rewritten text, no hidden original sentence')
