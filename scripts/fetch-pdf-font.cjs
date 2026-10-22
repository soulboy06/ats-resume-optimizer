// One-time vendoring from the font's upstream project. The production browser
// downloads only this same-origin asset, and only for non-WinAnsi characters.
const fs = require('node:fs/promises');
const path = require('node:path');
async function main() {
  for (const [url, relative] of [
    ['https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf', 'fonts/NotoSansSC.ttf'],
    ['https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt', 'fonts/OFL.txt'],
    ['https://raw.githubusercontent.com/Hopding/fontkit/master/README.md', 'FONTKIT-README.md'],
  ]) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(url + ': ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(path.join(__dirname, '../pages-deploy/vendor', relative), bytes);
    console.log(relative + ': ' + bytes.length + ' bytes');
  }
  const conversion = require('node:child_process').spawnSync(process.env.PYTHON || 'python', [path.join(__dirname, 'instantiate-pdf-font.py')], { stdio: 'inherit' });
  if (conversion.status !== 0) throw new Error('Static font conversion requires Python fonttools: python -m pip install fonttools');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
