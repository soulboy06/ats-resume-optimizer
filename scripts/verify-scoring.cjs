// Verify the published worked example against the actual browser scoring functions.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const site = path.join(__dirname, '../pages-deploy');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (!match[0].includes('application/ld+json') && match[1].trim()) new vm.Script(match[1]);
}
const context = vm.createContext({ Intl, console });
const declarations = html.match(/var stopwords = [\s\S]*?var chineseStopwords = [^\n]+/)[0];
const functions = html.slice(html.indexOf('      function normalizeExactText'), html.indexOf('      function verdictFor(', html.indexOf('      function scoreResume')));
assert(functions.length > 0 && functions.length < 25000);
// Do not run the page or make requests. Load only its pure scoring functions.
vm.runInContext(declarations + '\n' + functions.replace('      loadSkillsDict();', ''), context);
const chinese = html.match(/      function isChineseText\(text\)\s*\{[\s\S]*?\n      \}/)[0];
const cjk = html.match(/      function cjkChars\(text\)[^\n]*/)[0];
vm.runInContext(cjk + '\n' + chinese, context);
context.dictionary = JSON.parse(fs.readFileSync(path.join(site, 'skills-dict.json'), 'utf8'));
vm.runInContext(`skillsDictLatin = {}; skillsDictCjk = {};
  dictionary.terms.forEach(term => { const key = dictTokenKey(term); if (key && !skillsDictLatin[key]) skillsDictLatin[key] = term; });`, context);
context.resume = 'Alex Example\nalex@example.com\n2024-01 2025-06\nPython SQL Docker\n' + 'Built reliable internal services and documented their operation for the team. '.repeat(6);
context.jd = 'Python SQL Docker Kubernetes AWS';
const example = vm.runInContext('scoreResume(resume, jd)', context);
assert.equal(example.keywords.length, 5);
assert.equal(example.matched.length, 3);
assert.equal(example.keywordScore, 60);
assert.equal(example.parseabilityScore, 100);
assert.equal(example.atsScore, 76);
assert.equal(vm.runInContext('exactWordCount("K8s", "Kubernetes")', context), 0);
assert.equal(vm.runInContext('exactWordCount("Amazon Web Services", "AWS")', context), 0);
assert.equal(vm.runInContext('exactWordCount("python", "Python")', context), 1);
assert.equal(vm.runInContext('scoreResume(resume + " Python Python", jd).keywordScore', context), 60);
assert.equal(vm.runInContext('scoreParseability(resume.replace("2024-01 2025-06", "Jan 2024 Jun 2025")).checks[1].pass', context), false);
assert.equal(vm.runInContext('scoreParseability(resume).checks[0].pass', context), true);
const localeSource = html.slice(html.indexOf('      var i18n = {'), html.indexOf('      function t('));
vm.runInContext(localeSource, context);
assert.equal(context.i18n.en.title, 'Free ATS Resume Checker & JD Matcher | CheckATS');
for (const locale of ['en', 'zh']) {
  for (const key of ['resourcesTitle', 'resourcesCopy', 'guideLink', 'methodLink', 'allGuidesLink', 'faqQuotaQ', 'faqQuotaA']) assert(context.i18n[locale][key], `${locale}.${key}`);
  assert(!context.i18n[locale].homeAria.includes('ScoreMyResume'));
}
console.log('PASS JavaScript syntax, 76/100 worked example, matching limits, date-format limitation, and both language dictionaries');
