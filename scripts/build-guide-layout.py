"""Apply the shared bilingual guide layout, preserving article HTML and metadata."""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parents[1] / 'pages-deploy'
ITEMS = [
    ('ats-resume-checklist-software-engineers', 'ATS 检查清单', 'ATS resume checklist', '软件工程师检查清单', 'Software engineer resume checklist', '对照目标岗位，把关键词和真实成果一项项检查。', 'Check job terminology, formatting, dates and honest evidence of your work.'),
    ('ats-resume-template-software-engineers', 'ATS 友好简历模板', 'ATS-friendly template', 'ATS 友好简历模板', 'ATS-friendly resume template', '按板块填写经历，选对版式，再验证导出的文本。', 'Fill each section, choose a clear layout and verify the exported text.'),
    ('checkats-vs-jobscan', 'CheckATS 与 Jobscan', 'CheckATS vs Jobscan', 'CheckATS 与 Jobscan', 'CheckATS vs Jobscan', '了解两种工具的检查方式、免费额度和适用场景。', 'Compare checks, free allowances and the strengths of each tool.'),
    ('free-jobscan-alternative', '免费 Jobscan 替代方案', 'Free Jobscan alternatives', '免费 Jobscan 替代方案', 'Free Jobscan alternatives', '按自己的需求选择，清楚每种方案能做什么。', 'Find a useful free option and understand what each tool can do.'),
]


def text(value):
    return html.escape(value, quote=True)


def build(zh):
    tr = lambda a, b: a if zh else b
    base = '/zh/guide/' if zh else '/guide/'
    method = '/zh/methodology/' if zh else '/methodology/'
    home = '/?lang=zh' if zh else '/'
    studio = '/studio/?lang=zh' if zh else '/studio/'
    label = tr('使用指南', 'Guides')
    idx = 1 if zh else 2
    paths = [ROOT / base.strip('/') / 'index.html', *[ROOT / base.strip('/') / row[0] / 'index.html' for row in ITEMS], ROOT / method.strip('/') / 'index.html']
    for path in paths:
        source = path.read_text(encoding='utf8')
        is_home = path == paths[0]
        current = '' if is_home else 'methodology' if path == paths[-1] else path.parent.name
        title_match = re.search(r'<h1[^>]*>(.*?)</h1>', source, re.S)
        title = re.sub('<[^>]+>', '', title_match[1])
        alternate = ('/guide/' if zh else '/zh/guide/') + (current + '/' if current and current != 'methodology' else '')
        if current == 'methodology':
            alternate = '/methodology/' if zh else '/zh/methodology/'
        nav = f'''<a class="skip-link" href="#docs-main">{tr('跳到正文','Skip to content')}</a>
<header class="nav-shell"><nav class="nav product-nav" aria-label="{tr('主导航','Main navigation')}">
<a class="brand" href="{home}"><span class="brand-mark"><img class="brand-symbol" src="/brand-mark.svg" width="25" height="25" alt=""></span><span>CheckATS</span></a>
<div class="nav-links product-nav-links"><a href="{home}">{tr('简历分析','Resume analyzer')}</a><a href="{studio}">{tr('PDF 工作台','PDF Studio')}</a><a href="{base}" aria-current="page">{label}</a></div>
<div class="language-toggle" aria-label="{tr('语言','Language')}"><a class="lang-option{' active' if not zh else ''}" href="{alternate if zh else path_url(path)}" lang="en" hreflang="en"{' aria-current="true"' if not zh else ''}>EN</a><a class="lang-option{' active' if zh else ''}" href="{path_url(path) if zh else alternate}" lang="zh-CN" hreflang="zh-CN"{' aria-current="true"' if zh else ''}>中文</a></div></nav></header>'''

        def side_link(url, name, active=False):
            return f'<a href="{url}"'+(' aria-current="page"' if active else '')+f'>{text(name)}</a>'

        sidebar = f'<aside class="docs-sidebar"><details class="docs-menu"><summary>{tr("文档目录", "Guide menu")}{site_icon("chevronUp")}</summary><nav aria-label="{tr("文档目录", "Guide navigation")}"><h2>{label}</h2><a class="docs-overview" href="{base}"'+(' aria-current="page"' if is_home else '')+f'><span aria-hidden="true">{book_icon()}</span>{tr("指南总览", "Guide overview")}</a>'
        for group, rows in [(tr('简历写法', 'Resume writing'), ITEMS[:2]), (tr('工具对比', 'Tool comparisons'), ITEMS[2:])]:
            sidebar += f'<div class="docs-nav-group"><p>{group}</p>' + ''.join(side_link(base + r[0] + '/', r[idx], current == r[0]) for r in rows) + '</div>'
        sidebar += f'<div class="docs-nav-group"><p>{tr("了解 CheckATS", "About CheckATS")}</p>{side_link(method,tr("计分方法与数据说明", "Scoring and data"),current=="methodology")}</div><div class="docs-side-cta"><p>{tr("准备好检查简历了？", "Ready to check your resume?")}</p><a href="{home}#analyzer">{tr("前往简历分析", "Check your resume")} ↗</a></div></nav></details></aside>'
        search = f'<form class="docs-search" role="search" action="{base}"><label class="sr-only" for="guide-search">{tr("搜索指南", "Search guides")}</label><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg><input id="guide-search" name="q" type="search" placeholder="{tr("搜索指南…", "Search guides…")}" autocomplete="off"></form>'
        if is_home:
            content = f'<main id="docs-main" class="docs-main docs-home"><header class="docs-home-heading"><p class="docs-breadcrumb">{tr("资源 / 使用指南", "Resources / Guides")}</p><div class="docs-title-row"><h1>{tr("写好简历的每一步。", "Every step to a better resume.")}</h1>{search}</div><p class="lede">{tr("从职位关键词到 PDF 排版，找到你需要的实用指南。", "Practical guidance, from job keywords to your final PDF.")}</p></header>'
            content += f'<section class="docs-feature" aria-labelledby="start-title"><div><p class="docs-eyebrow">{tr("从这里开始", "Start here")}</p><h2 id="start-title">{tr("投递之前，<br>先做一次完整检查。", "Before you apply,<br>give your resume a check.")}</h2><p>{tr("用 10 项清单，检查关键词、经历表达和可解析性。", "A ten-point checklist for keywords, experience and readable text.")}</p><a class="docs-text-link" href="{base}{ITEMS[0][0]}/">{tr("阅读 ATS 简历检查清单", "Read the ATS resume checklist")} →</a></div><div class="docs-feature-list"><h3>{tr("投递前的三个重点", "Three things to check")}</h3><ul>'+''.join(f'<li>{site_icon("check")}{t}</li>' for t in tr(['职位要求是否对应真实经历','关键成果是否具体、可验证','导出的文字能否正常解析'],['Match requirements to real experience','Make your results specific and verifiable','Check that exported text is readable']))+'</ul></div></section>'
            for group, rows in [(tr('简历写法', 'Resume writing'), [ITEMS[1], ITEMS[0]]), (tr('工具与方法', 'Tools and methods'), ITEMS[2:])]:
                content += f'<section class="docs-category" data-guide-group><h2>{group}</h2><div class="docs-cards">'
                for r in rows:
                    name, desc = (r[3], r[5]) if zh else (r[4], r[6])
                    position = ITEMS.index(r)
                    icon = ['check', 'doc', 'copy', 'score'][position]
                    category = tr(['投递准备','版式与排版','工具对比','工具选择'], ['Before you apply','Layout and formatting','Tool comparison','Choosing a tool'])[position]
                    content += f'<a class="docs-card" href="{base}{r[0]}/" data-guide-entry><span class="docs-card-category">{site_icon(icon)}{category}</span><h3>{name}</h3><p>{desc}</p><span class="docs-text-link">{tr("阅读指南", "Read guide")} ↗</span></a>'
                content += '</div></section>'
            content += f'<a class="docs-method" href="{method}" data-guide-entry><div><h2>{tr("分数意味着什么？", "What does the score mean?")}</h2><p>{tr("查看关键词覆盖、文本检查、AI 点评与数据处理方式。", "Understand keywords, text checks, AI reviews and data handling.")}</p></div><span class="docs-text-link">{tr("了解计分方法", "Explore the scoring method")} →</span></a><div class="docs-no-results" hidden role="status"><p>{tr("没有找到匹配的指南。", "No matching guides.")}</p><button type="button" class="button button-secondary button-sm" data-clear-search>{tr("清除搜索", "Clear search")}</button></div></main>'
        else:
            original = re.search(r'<!-- docs-content:start -->(.*?)<!-- docs-content:end -->', source, re.S)
            original = original[1] if original else re.search(r'<main\b[^>]*>(.*?)</main>', source, re.S)[1]
            if zh and current == ITEMS[0][0]:
                original = re.sub(r'(<h1[^>]*>软件工程师)\s+(ATS)', r'\1<br>\2', original)
            original = re.sub(r'<div class="table-scroll"[^>]*>(<table.*?</table>)</div>', r'\1', original, flags=re.S)
            original = re.sub(r'<table\b.*?</table>', lambda m: '<div class="table-scroll" role="region" tabindex="0" aria-label="'+tr('数据表格，可横向滚动', 'Data table, scroll horizontally')+'">'+m[0]+'</div>', original, flags=re.S)
            headings = []
            def heading(match):
                attrs, words = match[1], match[2]
                existing = re.search(r'\bid="([^"]+)"', attrs)
                anchor = existing[1] if existing else 'section-' + str(len(headings)+1)
                headings.append((anchor, re.sub('<[^>]+>', '', words)))
                return '<h2'+attrs+('' if existing else f' id="{anchor}"')+'>'+words+'</h2>'
            original = re.sub(r'<h2([^>]*)>(.*?)</h2>', heading, original, flags=re.S)
            toc_links = ''.join(f'<a href="#{anchor}">{words}</a>' for anchor, words in headings)
            toc = f'<nav aria-label="{tr("本页内容", "On this page")}">{toc_links}</nav>'
            mobile_toc = f'<details class="docs-mobile-toc"><summary>{tr("本页内容", "On this page")}{site_icon("chevronUp")}</summary>{toc}</details>'
            # Keep the original text intact; the detail-page design adapts to each article.
            content = f'<main id="docs-main" class="docs-main"><p class="docs-breadcrumb"><a href="{base}">{label}</a> / {tr("计分与数据", "Scoring and data") if current=="methodology" else tr("工具对比", "Tool comparisons") if current in [r[0] for r in ITEMS[2:]] else tr("简历写法", "Resume writing")}</p>{mobile_toc}<article class="docs-article"><!-- docs-content:start -->{original}<!-- docs-content:end --></article><div class="docs-article-footer"><a href="{base}">← {tr("所有使用指南", "All guides")}</a><a href="{base}{ITEMS[1 if current!=ITEMS[1][0] else 0][0]}/">{tr("继续阅读", "Keep reading")} →</a></div></main><aside class="docs-toc"><h2>{tr("本页内容", "On this page")}</h2>{toc}<a class="docs-toc-cta" href="{home}#analyzer">{tr("检查我的简历", "Check my resume")} ↗</a></aside>'
        footer = f'<footer class="docs-footer"><span>CheckATS · {tr("简历指南", "Resume guides")}</span><a href="{home}">{tr("回到简历分析", "Back to resume analyzer")} ↗</a></footer>'
        head = source.split('</head>')[0]
        head = re.sub(r'<link[^>]+href="/styles/(?:guide|components|design)\.css"[^>]*>', '', head)
        head = re.sub(r'<script[^>]+src="/scripts/guides\.js"[^>]*></script>', '', head)
        if 'fonts.googleapis.com/css2?' not in head:
            head += '\n<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Noto+Sans+SC:wght@400;500;600&amp;family=Noto+Serif+SC:wght@400;500;600&amp;display=swap" rel="stylesheet">'
        head = '\n'.join(line.rstrip() for line in head.splitlines() if line.strip())
        head += '\n<link rel="stylesheet" href="/styles/components.css"><link rel="stylesheet" href="/styles/design.css"><link rel="stylesheet" href="/styles/guide.css"><script src="/scripts/guides.js" defer></script>\n'
        result = head + '</head><body class="docs-page">' + nav + '<div class="docs-layout'+(' docs-layout-home' if is_home else ' docs-layout-article')+'">'+sidebar+content+'</div>'+footer+'</body></html>\n'
        path.write_text('\n'.join(line.rstrip() for line in result.splitlines())+'\n', encoding='utf8')


def path_url(path):
    return '/' + path.relative_to(ROOT).as_posix().removesuffix('index.html')


def book_icon():
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v14m0-14C9 4 5 4 2 5v15c3-1 7-1 10 1 3-2 7-2 10-1V5c-3-1-7-1-10 2Z"></path></svg>'


def site_icon(kind):
    # Reuse the site's supplied UI icon assets rather than a second icon dependency.
    source = (ROOT / 'index.html').read_text(encoding='utf8')
    paths = re.search(r"\b" + kind + r":'([^']+)'", source)[1]
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+paths+'</svg>'


if __name__ == '__main__':
    build(False)
    build(True)
