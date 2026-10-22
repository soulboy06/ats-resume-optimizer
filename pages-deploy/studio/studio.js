/**
 * CheckATS Resume Studio - Workbench logic
 * Template selection, content editing, photo upload, live preview, PDF export.
 */
(() => {
  const state = {
    template: 'classic',
    photo: null, // data URL
    data: {
      name: '',
      title: '',
      contact: '',
      summary: '',
      experience: '',
      projects: '',
      education: '',
      skills: '',
      certs: '',
    }
  };

  // ---------- Template picker ----------
  function renderTemplateGrid() {
    const grid = document.getElementById('templateGrid');
    const lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
    grid.innerHTML = StudioTemplates.list().map(t => `
      <div class="template-card ${t.id === state.template ? 'active' : ''}" data-id="${t.id}">
        <div class="tname">${t.name[lang]}</div>
        <div class="tdesc">${t.desc[lang]}</div>
      </div>
    `).join('');
    grid.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        state.template = card.dataset.id;
        renderTemplateGrid();
        renderPreview();
      });
    });
  }

  // ---------- Data binding ----------
  function bindInputs() {
    const map = {
      fName: 'name', fTitle: 'title', fContact: 'contact',
      fSummary: 'summary', fExperience: 'experience',
      fEducation: 'education', fSkills: 'skills', fProjects: 'projects', fCerts: 'certs'
    };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.value = state.data[key] || '';
      el.addEventListener('input', () => {
        state.data[key] = el.value;
        renderPreview();
      });
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('checkats_studio_data');
      if (raw) {
        const d = JSON.parse(raw);
        Object.assign(state.data, d);
        if (d.template) state.template = d.template;
      }
      // AI rewrite handoff
      const aiText = localStorage.getItem('checkats_ai_rewrite');
      if (aiText) {
        parseAiRewrite(aiText);
        localStorage.removeItem('checkats_ai_rewrite');
      }
    } catch (e) { console.warn('load failed', e); }
  }

  function saveToStorage() {
    try {
      localStorage.setItem('checkats_studio_data', JSON.stringify({ ...state.data, template: state.template }));
    } catch (e) {}
  }

  // Heuristic: parse AI rewrite plain text into structured fields.
  function parseAiRewrite(text) {
    const lines = text.split('\n');
    // Try to find name (first non-empty line, short)
    let idx = 0;
    while (idx < lines.length && !lines[idx].trim()) idx++;
    if (idx < lines.length && lines[idx].trim().length < 30) {
      state.data.name = lines[idx].trim();
      idx++;
    }
    // Contact line (contains @ or phone pattern)
    if (idx < lines.length && /@|\d{3,}/.test(lines[idx])) {
      state.data.contact = lines[idx].trim();
      idx++;
    }
    // Rest: try to split into sections by common headings
    const rest = lines.slice(idx).join('\n');
    const sections = splitSections(rest);
    if (sections.summary) state.data.summary = sections.summary;
    if (sections.experience) state.data.experience = sections.experience;
    if (sections.education) state.data.education = sections.education;
    if (sections.skills) state.data.skills = sections.skills;
    if (sections.projects) state.data.projects = sections.projects;
    if (sections.certs) state.data.certs = sections.certs;
    // Fallback: put everything in experience if no sections found
    if (!sections.summary && !sections.experience && rest.trim()) {
      state.data.experience = rest.trim();
    }
    syncInputs();
  }

  function splitSections(text) {
    const out = {};
    const headings = {
      summary: /^(个人简介|简介|summary|profile)/im,
      experience: /^(工作经历|工作经验|experience|work(?!\s*experience))/im,
      projects: /^(项目经历|项目|projects)/im,
      education: /^(教育背景|教育|education)/im,
      skills: /^(专业技能|技能|skills)/im,
      certs: /^(证书|认证|certifications?)/im,
    };
    const lines = text.split('\n');
    let current = null, buf = [];
    const flush = () => {
      if (current && buf.length) out[current] = buf.join('\n').trim();
      buf = [];
    };
    for (const line of lines) {
      const t = line.trim();
      let matched = null;
      for (const [key, re] of Object.entries(headings)) {
        if (re.test(t) && t.length < 20) { matched = key; break; }
      }
      if (matched) { flush(); current = matched; }
      else if (current) buf.push(line);
      else buf.push(line);
    }
    flush();
    // If no headings found, treat first paragraph as summary
    if (!out.summary && !out.experience && buf.length) {
      const paras = text.split(/\n\s*\n/);
      if (paras.length > 1) {
        out.summary = paras[0].trim();
        out.experience = paras.slice(1).join('\n\n').trim();
      }
    }
    return out;
  }

  function syncInputs() {
    const map = {
      fName: 'name', fTitle: 'title', fContact: 'contact',
      fSummary: 'summary', fExperience: 'experience',
      fEducation: 'education', fSkills: 'skills', fProjects: 'projects', fCerts: 'certs'
    };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.value = state.data[key] || '';
    }
    renderPreview();
    saveToStorage();
  }

  // ---------- Photo ----------
  function bindPhoto() {
    const input = document.getElementById('photoInput');
    const preview = document.getElementById('photoPreview');
    const removeBtn = document.getElementById('photoRemove');
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.photo = reader.result;
        preview.innerHTML = `<img src="${state.photo}" alt="photo">`;
        removeBtn.style.display = '';
        renderPreview();
      };
      reader.readAsDataURL(file);
    });
    removeBtn.addEventListener('click', () => {
      state.photo = null;
      preview.innerHTML = '未上传';
      removeBtn.style.display = 'none';
      input.value = '';
      renderPreview();
    });
  }

  // ---------- Preview ----------
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderPreview() {
    const tpl = StudioTemplates.get(state.template);
    const d = state.data;
    const el = document.getElementById('resumePreview');
    el.className = 'tpl-' + tpl.id;

    let html = '';
    if (state.photo) html += `<img class="resume-photo" src="${state.photo}" alt="">`;
    html += `<h1>${esc(d.name) || '姓名'}</h1>`;
    if (d.title) html += `<div style="font-size:16px; color:#555; margin-bottom:8px;">${esc(d.title)}</div>`;
    if (d.contact) html += `<div class="resume-contact">${esc(d.contact)}</div>`;

    if (d.summary) {
      html += `<div class="resume-section"><h2>${tpl.id === 'classic' ? '个人简介' : '个人简介'}</h2><p style="font-size:14px;">${esc(d.summary).replace(/\n/g, '<br>')}</p></div>`;
    }
    if (d.experience) {
      html += `<div class="resume-section"><h2>工作经历</h2>${renderExperience(d.experience)}</div>`;
    }
    if (d.education) {
      html += `<div class="resume-section"><h2>教育背景</h2><p style="font-size:14px;">${esc(d.education).replace(/\n/g, '<br>')}</p></div>`;
    }
    if (d.projects) {
      html += `<div class="resume-section"><h2>项目经历</h2>${renderExperience(d.projects)}</div>`;
    }
    if (d.skills) {
      html += `<div class="resume-section"><h2>专业技能</h2><p style="font-size:14px;">${esc(d.skills)}</p></div>`;
    }
    if (d.certs) {
      html += `<div class="resume-section"><h2>证书认证</h2><p style="font-size:14px;">${esc(d.certs).replace(/\n/g, '<br>')}</p></div>`;
    }
    el.innerHTML = html || '<p style="color:#999;">在左侧输入内容，实时预览简历效果</p>';
    saveToStorage();
  }

  function renderExperience(text) {
    // Flexible parser: handles both single-line "Title | Company | Dates"
    // and multi-line headers (Title \n Dates \n Company | Location).
    const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
    return blocks.map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return '';
      let title = '', dates = '', company = '';
      const bullets = [];
      const dateRe = /(\d{4}\s*年|\d{4}[-/]\d{1,2}|至今|present)/i;
      let i = 0;
      // Case 1: first line has pipes -> "Title | Company | Dates"
      if (lines[0].includes('|')) {
        const parts = lines[0].split('|').map(s => s.trim());
        title = parts[0] || ''; company = parts[1] || ''; dates = parts[2] || '';
        i = 1;
      } else {
        // Case 2: multi-line header. Consume leading non-bullet lines.
        while (i < lines.length && !/^[-•*]/.test(lines[i])) {
          const ln = lines[i];
          if (dateRe.test(ln) && !dates) dates = ln;
          else if (!title) title = ln;
          else if (!company) company = ln;
          else break;
          i++;
        }
      }
      for (; i < lines.length; i++) {
        const b = lines[i].replace(/^[-•*]\s*/, '').trim();
        if (b) bullets.push(b);
      }
      let html = '<div class="resume-item">';
      html += `<div class="resume-item-header"><span>${esc(title)}</span><span>${esc(dates)}</span></div>`;
      if (company) html += `<div class="resume-item-sub">${esc(company)}</div>`;
      if (bullets.length) {
        html += '<ul class="resume-bullets">' + bullets.map(b => `<li>${esc(b)}</li>`).join('') + '</ul>';
      }
      html += '</div>';
      return html;
    }).join('');
  }

  // ---------- PDF Export ----------
  async function exportPdf() {
    // 直接用浏览器打印：所见即所得，文字可选，ATS 可解析
    // 比手写 pdf-lib 绘制更可靠（无字体嵌入/字距问题）
    window.print();
    return;
    const status = document.getElementById('exportStatus');
    const btn = document.getElementById('exportPdfBtn');
    btn.disabled = true;
    status.textContent = '正在生成...';
    try {
      const bytes = await generatePdf();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-${state.template}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      status.textContent = '已导出';
    } catch (e) {
      console.error(e);
      status.textContent = '导出失败: ' + (e.message || e);
    } finally {
      btn.disabled = false;
      setTimeout(() => status.textContent = '', 3000);
    }
  }

  async function generatePdf() {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    const tpl = StudioTemplates.get(state.template);
    const d = state.data;

    // Fonts: Helvetica for Latin, NotoSansSC for CJK (if available)
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
    let cjk = null, cjkBold = null;
    try {
      const fontBytes = await fetch('/vendor/fonts/NotoSansSC.ttf').then(r => r.arrayBuffer());
      doc.registerFontkit(fontkit);
      cjk = await doc.embedFont(fontBytes, { subset: false });
      cjkBold = cjk; // NotoSansSC has no bold; use same
    } catch (e) { console.warn('CJK font not available', e); }

    const page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const margin = 48;
    let y = height - margin;

    // WinAnsi-encodable -> standard font, else CJK font (same logic as pdf-engine.js fontRuns)
    function isStdChar(ch) {
      try { helv.encodeText(ch); return true; } catch (_) { return false; }
    }
    function drawText(text, x, yPos, size, bold, color) {
      // Split by font runs (same fix as pdf-engine.js)
      const runs = splitRuns(text, bold);
      let cx = x;
      for (const run of runs) {
        page.drawText(run.text, { x: cx, y: yPos, size, font: run.font, color: color || rgb(0, 0, 0) });
        cx += run.font.widthOfTextAtSize(run.text, size);
      }
      return cx - x;
    }
    function splitRuns(text, bold) {
      const runs = [];
      let buf = '', bufStd = true;
      for (const ch of text) {
        const s = isStdChar(ch);
        if (buf && s !== bufStd) { runs.push({ text: buf, font: bufStd ? (bold ? helvBold : helv) : (bold ? cjkBold : cjk) }); buf = ''; }
        buf += ch; bufStd = s;
      }
      if (buf) runs.push({ text: buf, font: bufStd ? (bold ? helvBold : helv) : (bold ? cjkBold : cjk) });
      // Validate CJK coverage
      for (const r of runs) {
        if (r.font === cjk || r.font === cjkBold) {
          // already validated via isStdChar fallback; ensure cjk exists
          if (!cjk) throw new Error('CJK font not loaded but needed for: ' + r.text.slice(0, 20));
        }
      }
      return runs;
    }
    function textWidth(text, size, bold) {
      return splitRuns(text, bold).reduce((s, r) => s + r.font.widthOfTextAtSize(r.text, size), 0);
    }
    function wrapLine(text, maxWidth, size, bold) {
      // Simple greedy wrap by characters
      const lines = [];
      let line = '';
      for (const ch of text) {
        if (textWidth(line + ch, size, bold) > maxWidth && line) {
          lines.push(line); line = ch;
        } else line += ch;
      }
      if (line) lines.push(line);
      return lines;
    }

    const contentWidth = width - margin * 2;
    const accent = tpl.colors.accent;

    // Photo (top right)
    if (state.photo) {
      try {
        const imgBytes = await fetch(state.photo).then(r => r.arrayBuffer());
        const img = state.photo.includes('png') ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes);
        const pw = 80, ph = 100;
        page.drawImage(img, { x: width - margin - pw, y: y - ph, width: pw, height: ph });
      } catch (e) { console.warn('photo embed failed', e); }
    }

    // Name
    const nameSize = 26;
    drawText(d.name || '姓名', margin, y - nameSize, nameSize, true);
    y -= nameSize + 8;
    if (d.title) {
      drawText(d.title, margin, y - 14, 14, false, rgb(0.33, 0.33, 0.33));
      y -= 20;
    }
    if (d.contact) {
      drawText(d.contact, margin, y - 12, 12, false, rgb(0.33, 0.33, 0.33));
      y -= 24;
    }

    // Helper for section
    function section(title, contentFn) {
      y -= 8;
      // Section title
      const tSize = 14;
      drawText(title, margin, y - tSize, tSize, true, hexToRgb(accent));
      y -= tSize + 4;
      // Line
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: hexToRgb(tpl.colors.line) });
      y -= 12;
      contentFn();
    }
    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      return rgb(parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255);
    }
    function paragraph(text, size) {
      const lines = wrapLine(text, contentWidth, size, false);
      for (const line of lines) {
        if (y < margin + 20) { /* TODO: new page */ break; }
        drawText(line, margin, y - size, size, false);
        y -= size * 1.5;
      }
      y -= 4;
    }

    if (d.summary) section('个人简介', () => paragraph(d.summary, 11));
    if (d.experience) {
      section('工作经历', () => {
        const blocks = d.experience.split(/\n\s*\n/).filter(b => b.trim());
        for (const block of blocks) {
          const lines = block.split('\n').filter(l => l.trim());
          if (!lines.length) continue;
          const header = lines[0].split('|').map(s => s.trim());
          // Title + dates
          const tSize = 12;
          drawText(header[0] || '', margin, y - tSize, tSize, true);
          if (header[2]) {
            const dw = textWidth(header[2], 11, false);
            drawText(header[2], width - margin - dw, y - 11, 11, false, rgb(0.33,0.33,0.33));
          }
          y -= tSize + 4;
          if (header[1]) {
            drawText(header[1], margin, y - 11, 11, false, rgb(0.33,0.33,0.33));
            y -= 16;
          }
          for (const bullet of lines.slice(1)) {
            const bt = bullet.replace(/^[-•*]\s*/, '');
            const lines2 = wrapLine('• ' + bt, contentWidth - 12, 11, false);
            for (const l of lines2) {
              drawText(l, margin + 12, y - 11, 11, false);
              y -= 16;
            }
          }
          y -= 8;
        }
      });
    }
    if (d.projects) {
      section('项目经历', () => {
        const blocks = d.projects.split(/\n\s*\n/).filter(b => b.trim());
        for (const block of blocks) {
          const lines = block.split('\n').filter(l => l.trim());
          if (!lines.length) continue;
          const header = lines[0].split('|').map(s => s.trim());
          const tSize = 12;
          drawText(header[0] || '', margin, y - tSize, tSize, true);
          y -= tSize + 4;
          if (header[1]) {
            drawText(header[1], margin, y - 11, 11, false, rgb(0.33,0.33,0.33));
            y -= 16;
          }
          for (const bullet of lines.slice(1)) {
            const bt = bullet.replace(/^[-•*]\s*/, '');
            const lines2 = wrapLine('• ' + bt, contentWidth - 12, 11, false);
            for (const l of lines2) {
              drawText(l, margin + 12, y - 11, 11, false);
              y -= 16;
            }
          }
          y -= 8;
        }
      });
    }
    if (d.education) section('教育背景', () => paragraph(d.education, 11));
    if (d.skills) section('专业技能', () => paragraph(d.skills, 11));
    if (d.certs) section('证书认证', () => paragraph(d.certs, 11));

    return await doc.save();
  }

  // ---------- Init ----------
  function init() {
    renderTemplateGrid();
    bindInputs();
    bindPhoto();
    loadFromStorage();
    renderPreview();
    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);
    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    document.getElementById('loadAiBtn').addEventListener('click', () => {
      const t = localStorage.getItem('checkats_ai_rewrite');
      if (t) { parseAiRewrite(t); localStorage.removeItem('checkats_ai_rewrite'); }
      else alert('没有找到AI改写内容，请先在首页完成AI改写');
    });
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (!confirm('清空所有内容？')) return;
      state.data = { name:'', title:'', contact:'', summary:'', experience:'', projects:'', education:'', skills:'', certs:'' };
      state.photo = null;
      document.getElementById('photoPreview').innerHTML = '未上传';
      document.getElementById('photoRemove').style.display = 'none';
      syncInputs();
    });
    // Auto-save on input (already in bindInputs via renderPreview)
  }

  document.addEventListener('DOMContentLoaded', init);
})();
