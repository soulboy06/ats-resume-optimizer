"""Create a static regular TTF; fontkit cannot reliably subset this variable font."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

target = Path(__file__).resolve().parents[1] / 'pages-deploy/vendor/fonts/NotoSansSC.ttf'
font = TTFont(target)
if 'fvar' in font:
    instantiateVariableFont(font, {'wght': 400}, inplace=True)
    font.save(target)
print('Static Noto Sans SC regular font ready:', target.stat().st_size, 'bytes')
