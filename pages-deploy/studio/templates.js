/**
 * Resume templates for CheckATS Studio.
 * Each template defines: id, name (zh/en), and render functions.
 * Templates are ATS-safe: single column, real text, standard fonts.
 */

const StudioTemplates = (() => {
  // Shared helpers
  const COLORS = {
    classic: { primary: '#1a1a1a', accent: '#1a1a1a', muted: '#555555', line: '#cccccc' },
    modern: { primary: '#1a1a1a', accent: '#2563eb', muted: '#555555', line: '#e5e7eb' },
    minimal: { primary: '#222222', accent: '#666666', muted: '#777777', line: '#dddddd' },
  };

  const templates = [
    {
      id: 'classic',
      name: { zh: '经典', en: 'Classic' },
      desc: { zh: '传统衬线标题，黑白配色，适合保守行业', en: 'Serif headings, black & white, for conservative industries' },
      colors: COLORS.classic,
    },
    {
      id: 'modern',
      name: { zh: '现代', en: 'Modern' },
      desc: { zh: '无衬线字体，蓝色点缀，干净利落', en: 'Sans-serif with blue accents, clean and sharp' },
      colors: COLORS.modern,
    },
    {
      id: 'minimal',
      name: { zh: '简约', en: 'Minimal' },
      desc: { zh: '大量留白，灰色系，突出内容本身', en: 'Generous whitespace, grayscale, content-first' },
      colors: COLORS.minimal,
    },
  ];

  function get(id) {
    return templates.find(t => t.id === id) || templates[0];
  }

  function list() {
    return templates.map(t => ({ id: t.id, name: t.name, desc: t.desc }));
  }

  return { get, list };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = StudioTemplates;
else window.StudioTemplates = StudioTemplates;
