"""Check published-page metadata, structured data, assets, and crawlable links."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import json
import struct
import xml.etree.ElementTree as ET

site = Path(__file__).resolve().parents[1] / 'pages-deploy'
host = 'https://checkats.online'

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.scripts = []
        self.script = None
        self.title = ''
        self.in_title = False
        self.faqs = []
        self.faq_question = None
        self.faq_answer = None
        self.capture = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.script = ''
        if tag == 'title':
            self.in_title = True
        if tag == 'h3':
            self.faq_question = ''
            self.capture = 'question'
        if tag == 'p' and self.faq_question is not None:
            self.faq_answer = ''
            self.capture = 'answer'

    def handle_data(self, value):
        if self.script is not None: self.script += value
        if self.in_title: self.title += value
        if self.capture == 'question': self.faq_question += value
        if self.capture == 'answer': self.faq_answer += value

    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            self.scripts.append(json.loads(self.script))
            self.script = None
        if tag == 'title': self.in_title = False
        if tag == 'h3': self.capture = None
        if tag == 'p' and self.capture == 'answer':
            self.faqs.append((self.faq_question, self.faq_answer))
            self.capture = None
            self.faq_question = None

def resolve(path):
    target = site / unquote(path).lstrip('/')
    return target / 'index.html' if path.endswith('/') else target

locations = [x.text for x in ET.parse(site / 'sitemap.xml').findall('.//{*}loc')]
assert len(locations) == len(set(locations)), 'Duplicate sitemap URLs'
titles = set()
links = {}
for url in locations:
    assert url.startswith(host + '/'), url
    path = urlparse(url).path
    file = resolve(path)
    text = file.read_text()
    assert 'ScoreMyResume' not in text and 'ATS Resume Optimizer' not in text, file
    page = Page(text)
    assert len([x for x in page.tags if x[0] == 'h1']) == 1, file
    assert page.title and page.title not in titles and 'CheckATS' in page.title, file
    titles.add(page.title)
    canonical = [a['href'] for t, a in page.tags if t == 'link' and a.get('rel') == 'canonical']
    assert canonical == [url], (file, canonical)
    assert any(t == 'meta' and a.get('name') == 'description' and a.get('content') for t, a in page.tags), file
    assert not any(t == 'meta' and a.get('name') == 'robots' and 'noindex' in a.get('content', '') for t, a in page.tags), file
    assert page.scripts, file
    for data in page.scripts:
        if data.get('@type') == 'FAQPage':
            faq = [(x['name'], x['acceptedAnswer']['text']) for x in data['mainEntity']]
            assert faq == page.faqs, 'FAQ schema does not match visible answers'
    links[path] = []
    for tag, a in page.tags:
        href = a.get('href') if tag in ('a', 'link') else a.get('src') if tag in ('script', 'img') else a.get('content') if tag == 'meta' and a.get('property') == 'og:image' else None
        if not href: continue
        parsed = urlparse(href)
        if parsed.netloc and parsed.netloc != 'checkats.online': continue
        if parsed.scheme and parsed.scheme not in ('http', 'https'): continue
        if not parsed.path: continue
        assert parsed.path.startswith('/'), (file, href)
        assert resolve(parsed.path).is_file(), (file, href)
        if tag == 'a' and parsed.path.endswith('/'): links[path].append(parsed.path)
    print('PASS', path)

visited = set()
pending = ['/']
while pending:
    current = pending.pop()
    if current in visited: continue
    visited.add(current)
    pending.extend(links.get(current, []))
assert all(urlparse(url).path in visited for url in locations), 'Sitemap page unreachable from homepage'
assert 'Sitemap: ' + host + '/sitemap.xml' in (site / 'robots.txt').read_text()
card = (site / 'assets/og-card.png').read_bytes()
assert card[:8] == b'\x89PNG\r\n\x1a\n'
assert struct.unpack('>II', card[16:24]) == (1200, 630)
print('PASS crawl graph, sitemap, robots, FAQ parity, and social image dimensions')
