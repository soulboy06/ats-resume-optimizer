"""Vendor the audited MIT-0 template snapshot and local font assets."""
from pathlib import Path
import gzip, hashlib, json, re, shutil, urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'resume-template-research/catalog'
TARGET = ROOT / 'pages-deploy/studio'
VENDOR = ROOT / 'pages-deploy/vendor/typst'

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'CheckATS-template-vendor'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()

def templates():
    metadata = TARGET / 'typst/upstream.json'
    catalog = json.loads((metadata if metadata.exists() else SOURCE / 'catalog.json').read_text(encoding='utf8'))
    records = []
    for item in catalog['selected']:
        slug = item['id']
        original = TARGET / 'typst' / slug / 'upstream.typ'
        source = (original if original.exists() else SOURCE / 'templates' / slug / 'main.typ').read_text(encoding='utf8')
        assert 'Licence: MIT-0' in source and '#show:' in source
        definition, example = source.split('#show:', 1)
        dest = TARGET / 'typst' / slug
        dest.mkdir(parents=True, exist_ok=True)
        adapted = definition.replace('hyphenate: true', 'hyphenate: false')
        parts = re.split(r'(?=#let )', adapted)
        for index, part in enumerate(parts):
            if re.match(r'#let (?:[\w-]+-entry|caption-section)\(', part):
                parts[index] = part.replace('block(breakable: false,', 'block(breakable: true,', 1)
        (dest / 'layout.typ').write_text(''.join(parts), encoding='utf8')
        (dest / 'upstream.typ').write_text(source, encoding='utf8')
        funcs = {name: re.sub(r'//[^\n]*', '', args).strip() for name, args in re.findall(r'#let ([\w-]+)\((.*?)\)\s*=\s*', definition, re.S)}
        signature = funcs[slug + '-cv']
        accent = re.search(r'accent-color: "(#[\da-fA-F]+)"', example)
        records.append({
            'id': slug, 'name': {'en': item['name'], 'zh': item['zh']},
            'desc': {'en': item['name'] + ' · Typst layout', 'zh': item['description']},
            'engine': 'typst', 'accent': accent[1] if accent else '#2f4a3f',
            'font': item['font'], 'margin': 40, 'source': item['source'],
            'leading': float(re.search(r'leading:\s*([\d.]+)em', signature)[1]),
            'credit': 'Adapted from davidculemann/typst-templates (MIT-0)',
            'params': re.findall(r'([\w-]+)\s*:', signature),
            'functions': {name: re.findall(r'([\w-]+)\s*:', args) for name, args in funcs.items()},
        })
    (TARGET / 'typst').mkdir(exist_ok=True)
    (TARGET / 'typst/catalog.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf8')
    if (SOURCE / 'LICENSE.txt').exists():
        (TARGET / 'licenses/typst-templates-MIT-0.txt').write_text((SOURCE / 'LICENSE.txt').read_text(encoding='utf8'), encoding='utf8')
    content = '/* Audited MIT-0 template collection. See studio/licenses and credits.html. */\n(function(root){\n const templates=' + json.dumps(records, ensure_ascii=False, separators=(',', ':')) + ';\n const api={list:()=>templates,get:id=>templates.find(t=>t.id===id)||templates.find(t=>t.id==="refined")};\n if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.StudioTemplates=api;\n})(typeof window==="undefined"?globalThis:window);\n'
    (TARGET / 'templates.js').write_text(content, encoding='utf8')
    print('Vendored', len(records), 'actual layouts', flush=True)

def compiler():
    package = ROOT / 'node_modules/@myriaddreamin/typst-ts-web-compiler'
    VENDOR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(package / 'pkg/typst_ts_web_compiler.mjs', VENDOR / 'compiler.mjs')
    data = (package / 'pkg/typst_ts_web_compiler_bg.wasm').read_bytes()
    (VENDOR / 'compiler.wasm.gz').write_bytes(gzip.compress(data, compresslevel=9, mtime=0))
    (VENDOR / 'COMPILER-LICENSE.txt').write_bytes(fetch('https://raw.githubusercontent.com/Myriad-Dreamin/typst.ts/v0.7.0/LICENSE'))
    print('Compiler gzip bytes:', (VENDOR / 'compiler.wasm.gz').stat().st_size, flush=True)

def fonts():
    dest = VENDOR / 'fonts'
    dest.mkdir(parents=True, exist_ok=True)
    families = ['nunitosans', 'raleway', 'bitter', 'sourcesans3', 'sourceserif4', 'ebgaramond', 'hankengrotesk', 'inter', 'roboto']
    commit = '45e3d5269e4a17d823f6d84470bc084dc5ae46f6'
    manifest = []
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from io import BytesIO
    for family in families:
        listing = json.loads(fetch(f'https://api.github.com/repos/google/fonts/contents/ofl/{family}?ref={commit}'))
        normal = next(item for item in listing if item['name'].endswith('.ttf') and 'Italic' not in item['name'])
        license_file = next(item for item in listing if item['name'] == 'OFL.txt')
        data = fetch(normal['download_url'])
        (dest / (family + '-OFL.txt')).write_bytes(fetch(license_file['download_url']))
        for weight in [400, 700]:
            font = TTFont(BytesIO(data))
            if 'fvar' in font:
                axes = {axis.axisTag: (weight if axis.axisTag == 'wght' else axis.defaultValue) for axis in font['fvar'].axes}
                font = instantiateVariableFont(font, axes, inplace=True)
            filename = f'{family}-{weight}.ttf'
            font.save(dest / filename)
            manifest.append(filename)
        print('Font:', family, flush=True)
    for family in ['LibertinusSerif', 'NewCM10']:
        for weight in ['Regular', 'Bold']:
            filename = family + '-' + weight + '.otf'
            (dest / filename).write_bytes(fetch('https://raw.githubusercontent.com/typst/typst-assets/v0.13.1/files/fonts/' + filename))
            manifest.append(filename)
    for name in ['LICENSE', 'NOTICE']:
        (VENDOR / ('ASSETS-' + name + '.txt')).write_bytes(fetch('https://raw.githubusercontent.com/typst/typst-assets/v0.13.1/' + name))
    (VENDOR / 'fonts.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    (VENDOR / 'FONT-SOURCES.md').write_text(f'Google Fonts snapshot: {commit}\nhttps://github.com/google/fonts\nFamily OFL notices are retained next to each font. Static regular/bold instances generated from upstream variable fonts and renamed CheckATS Studio 01-09 in the order Nunito Sans, Raleway, Bitter, Source Sans 3, Source Serif 4, EB Garamond, Hanken Grotesk, Inter, Roboto.\n\nLibertinus and New Computer Modern: https://github.com/typst/typst-assets/tree/v0.13.1/files/fonts\n', encoding='utf8')
    rename_fonts()

def rename_fonts():
    from fontTools.ttLib import TTFont
    families = ['nunitosans', 'raleway', 'bitter', 'sourcesans3', 'sourceserif4', 'ebgaramond', 'hankengrotesk', 'inter', 'roboto']
    for index, family in enumerate(families, 1):
        for weight, style in [(400, 'Regular'), (700, 'Bold')]:
            path = VENDOR / 'fonts' / f'{family}-{weight}.ttf'
            font = TTFont(path)
            name = f'CheckATS Studio {index:02d}'
            values = {1:name, 2:style, 4:name+' '+style, 6:f'CheckATSStudio{index:02d}-{style}', 16:name, 17:style}
            for record in font['name'].names:
                if record.nameID in values:
                    font['name'].setName(values[record.nameID],record.nameID,record.platformID,record.platEncID,record.langID)
            font['name'].setName(name,16,3,1,0x409)
            font['name'].setName(style,17,3,1,0x409)
            font.save(path)
    print('Renamed derived static fonts; upstream OFL notices retained', flush=True)

if __name__ == '__main__':
    import sys
    for step in (sys.argv[1:] or ['templates', 'compiler', 'fonts']):
        globals()[step]()
