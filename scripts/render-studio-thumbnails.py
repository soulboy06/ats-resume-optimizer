"""Render the studio picker from real synthetic PDFs (run npm test first)."""
from pathlib import Path
import json
import fitz
from PIL import Image

root = Path(__file__).resolve().parents[1]
target = root / 'pages-deploy/studio/assets'
target.mkdir(parents=True, exist_ok=True)
catalog = json.loads((root / 'pages-deploy/studio/typst/catalog.json').read_text(encoding='utf8'))
for template in catalog:
    name = template['id']
    with fitz.open(root / 'tmp/pdfs/typst' / (name + '-en.pdf')) as pdf:
        pixels = pdf[0].get_pixmap(matrix=fitz.Matrix(.65, .65))
        image = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
        image.save(target / (name + '.webp'), quality=88)
