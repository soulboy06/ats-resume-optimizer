"""Render the studio picker from real synthetic PDFs (run npm test first)."""
from pathlib import Path
import fitz
from PIL import Image

root = Path(__file__).resolve().parents[1]
target = root / 'pages-deploy/studio/assets'
target.mkdir(parents=True, exist_ok=True)
for name in ('classic', 'modern', 'minimal'):
    with fitz.open(root / 'tmp/pdfs' / ('studio-en-' + name + '.pdf')) as pdf:
        pixels = pdf[0].get_pixmap(matrix=fitz.Matrix(.65, .65))
        image = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
        image.save(target / (name + '.webp'), quality=88)
