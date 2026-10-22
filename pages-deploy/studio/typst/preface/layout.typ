// Preface CV, a Typst resume template.
//
// Compiles with Typst 0.12 or newer.
// Set in Libertinus Serif, which ships with Typst, so it renders as
// intended with nothing to install.
//
// Licence: MIT-0. Use it, change it, publish the result as your own CV.
// No attribution has to travel with the document you make from it.
//
// Self-contained: no imports, nothing to install.
// Every design:     https://github.com/davidculemann/typst-templates
// Edit in a browser: https://www.jobsprout.ai/resume-templates/preface
#set page(fill: rgb("#ffffff"))

// Shared predicate for values that render nothing. Apply BEFORE wrapping a
// value in strong()/emph()/text(): styled empty content is not blank.
// Byte-synced with TYPST_IS_BLANK in utils/typst-blocks.ts (typst-codegen.test.ts).
#let is-blank(v) = v == none or v == "" or v == []

// One accent + ink + one muted grey (cv-typography-standard rule 6). The accent is the
// masthead rule and the section labels; ink on white otherwise.
#let ink = rgb("#1f2430")
#let muted = rgb("#6b7280")

// Fixed size scale (standard rule 2), defined ONCE and expressed as em multiples of
// the resolved body size B - the `font-size` parameter, which the user can move between
// 9pt and 13pt. Absolute pt would detach the scale from that knob: at 9pt a 10pt label
// ends up LARGER than the body and meta stops being meta, and at 13pt the subhead falls
// below the body. em keeps every ratio intact at both ends of the range.
#let display-size = 2.35em // ~2.35 x B - the name
#let subhead-size = 1.22em // ~1.22 x B - the profession line
#let label-size = 0.9em // 0.9 x B - section labels (the one uppercase + tracked role)
#let meta-size = 0.82em // 0.82 x B - dates, location, contact, level, fine print

// Document shell + masthead. The signature is the LEDE: the profile paragraph is set
// at subhead size across the full measure with no label above it, exactly as a
// magazine opens a feature, and every section below it stays quiet. Libertinus Serif
// is the single family (standard rule 1); its italic carries every secondary line.
#let preface-cv(
  author: "",
  profession: "",
  contact: "",
  font: "Libertinus Serif",
  font-size: 11pt,
  paper: "a4",
  margin: 2cm,
  leading: 0.68em,
  lang: "en",
  accent-color: "#3f5a72",
  body,
) = {
  let author-str = if type(author) == str { author } else { "CV" }
  set document(author: author-str, title: author-str + " - CV")

  set text(font: font, size: font-size, fill: ink, lang: lang, ligatures: true, hyphenate: false)
  set page(margin: margin, paper: paper)
  set par(justify: false, leading: leading)

  show link: set text(fill: muted)

  // Masthead: name, then the role in italic and the contact on one shared baseline,
  // closed by a thin accent rule the lede sits under.
  let has-name = not is-blank(author)
  let has-prof = not is-blank(profession)
  let has-contact = not is-blank(contact)
  if has-name or has-prof or has-contact {
    block(above: 0pt, below: 1.25em, breakable: false, {
      set block(spacing: 0pt)
      set par(spacing: 0pt, leading: 0.38em, justify: false)
      if has-name { text(size: display-size, weight: "bold", fill: ink, author) }
      if has-prof or has-contact {
        if has-name { v(display-size * 0.38) }
        grid(
          columns: (auto, 1fr),
          align: (left + bottom, right + bottom),
          column-gutter: 1.2em,
          if has-prof { text(size: subhead-size, style: "italic", fill: muted, profession) } else { [] },
          if has-contact { text(size: meta-size, fill: muted, contact) } else { [] },
        )
      }
      // The rule CLOSES the name; with no name and no role there is nothing to close,
      // so a contact-only document gets its contact line and no floating rule.
      if has-name or has-prof {
        v(8pt)
        line(length: 100%, stroke: 0.7pt + rgb(accent-color))
      }
    })
  }

  body
}

// The lede: the profile paragraph set one step up from the body across the full
// measure, with no section label - the opening of a feature, not a labelled field.
#let preface-lede(body) = {
  block(above: 0.2em, below: 1.1em, {
    set par(leading: 0.72em, justify: false)
    set text(size: subhead-size, fill: ink)
    body
  })
}

// Section label: accent UPPERCASE + tracking, no rule (the masthead owns the only
// rule). `below: 0.9em` gives the first entry natural air.
#let cv-section(title, accent-color: "#3f5a72", gap: 1.7em) = {
  block(above: gap, below: 1em, sticky: true, {
    set block(spacing: 0pt)
    set par(spacing: 0pt, justify: false)
    text(size: label-size, weight: "semibold", tracking: 1.1pt, fill: rgb(accent-color), upper(title))
  })
}

// Entry: title in semibold roman leading an italic subtitle, dates flush right in
// italic meta; location and an optional URL below; then the body.
#let preface-entry(title: "", subtitle: "", dates: "", location: "", meta: "", body) = {
  // ATOMIC on purpose. Letting an entry break fills the page foot, but it also lets a
  // single trailing bullet start the next page, which the review bar treats as an
  // automatic fail; measured over the fixture matrix the orphans cost more than the
  // whitespace. Same choice as every other template in the fleet.
  block(breakable: true, {
    set block(spacing: 0pt)
    set par(spacing: 0pt)
    block(sticky: true, breakable: false, {
      set par(justify: false)
      grid(
        columns: (1fr, auto),
        align: (left + top, right + top),
        column-gutter: 0.75em,
        {
          if not is-blank(title) { text(weight: "semibold", fill: ink, title) }
          if not is-blank(title) and not is-blank(subtitle) { text(fill: muted)[, ] }
          if not is-blank(subtitle) { text(style: "italic", fill: muted, subtitle) }
        },
        if not is-blank(dates) { text(size: meta-size, style: "italic", fill: muted, dates) } else { [] },
      )
      if not is-blank(location) {
        v(0.68em)
        text(size: meta-size, style: "italic", fill: muted, location)
      }
      if not is-blank(meta) {
        v(0.68em)
        text(size: meta-size, style: "italic", fill: muted, meta)
      }
    })
    // Wider than the 4pt above the location line, so the location binds to its title
    // instead of floating midway between the title and the first bullet.
    if not is-blank(body) {
      v(0.85em)
      block(spacing: 0pt, { set text(fill: ink); body })
    }
  })
}

// Language row: language left, level in italic meta right.
#let preface-language(language: "", level: "") = {
  grid(
    columns: (1fr, auto),
    align: (left + horizon, right + horizon),
    column-gutter: 0.6em,
    language,
    if not is-blank(level) { text(size: meta-size, style: "italic", fill: muted, level) } else { [] },
  )
}



