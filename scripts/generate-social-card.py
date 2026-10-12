"""Generate the site's Open Graph card with Pillow; no network assets required."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

site = Path(__file__).resolve().parents[1] / 'pages-deploy'
out = site / 'assets/og-card.png'
out.parent.mkdir(exist_ok=True)
image = Image.new('RGB', (1200, 630), '#faf7f0')
draw = ImageDraw.Draw(image)
fonts = Path('/usr/share/fonts/truetype/dejavu')
sans = lambda n: ImageFont.truetype(str(fonts / 'DejaVuSans.ttf'), n)
serif = lambda n: ImageFont.truetype(str(fonts / 'DejaVuSerif.ttf'), n)
draw.text((78, 60), 'CheckATS', font=sans(32), fill='#B44D30')
draw.text((74, 155), 'Free ATS', font=serif(78), fill='#252621')
draw.text((74, 251), 'resume checker.', font=serif(78), fill='#B44D30')
draw.text((78, 390), 'Match your resume to a job description.', font=sans(30), fill='#5a5c55')
draw.text((78, 438), 'Find missing keywords. No account needed.', font=sans(30), fill='#5a5c55')
draw.line((78, 530, 1122, 530), fill='#dedbd3', width=2)
draw.text((78, 555), 'checkats.online', font=sans(25), fill='#5a5c55')
draw.text((793, 555), 'Local checks · Optional AI', font=sans(23), fill='#5a5c55')
image.save(out, optimize=True)
print('Generated', out.relative_to(site))
