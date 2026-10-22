// Folio CV, a Typst resume template.
//
// Compiles with Typst 0.12 or newer.
// Set in Source Serif 4. Without it installed the text falls back;
// change the font argument in the show rule below to a family you
// do have, the layout does not depend on it.
//
// Licence: MIT-0. Use it, change it, publish the result as your own CV.
// No attribution has to travel with the document you make from it.
//
// Self-contained: no imports, nothing to install.
// Every design:     https://github.com/davidculemann/typst-templates
// Edit in a browser: https://www.jobsprout.ai/resume-templates/folio
#set page(fill: rgb("#ffffff"))

// Shared predicate for values that render nothing. Apply BEFORE wrapping a
// value in strong()/emph()/text(): styled empty content is not blank.
// Byte-synced with TYPST_IS_BLANK in utils/typst-blocks.ts (typst-codegen.test.ts).
#let is-blank(v) = v == none or v == "" or v == []

// One accent + ink + one muted grey (cv-typography-standard rule 6). The accent is the
// masthead rule, the running-head rule and the section labels; the muted grey carries
// secondary text and the hairline under each label. Nothing else is drawn.
#let ink = rgb("#1f2430")
#let muted = rgb("#6b7280")

// Fixed size scale (standard rule 2), defined ONCE and expressed as em multiples of
// the resolved body size B - the `font-size` parameter, which the user can move between
// 9pt and 13pt. Absolute pt would detach the scale from that knob: at 9pt a 10pt label
// ends up LARGER than the body and meta stops being meta, and at 13pt the subhead falls
// below the body. em keeps every ratio intact at both ends of the range.
#let display-size = 2.2em // ~2.2 x B - the name
#let subhead-size = 1.2em // ~1.2 x B - the profession line
#let label-size = 0.9em // 0.9 x B - section labels (the one uppercase + tracked role)
#let meta-size = 0.82em // 0.82 x B - dates, location, contact, level, fine print

// Document shell + the two signatures: a SPLIT letterhead masthead (name and role
// left, the contact stacked flush right) over a heavy accent rule, and page
// FURNITURE - a running head repeating the name and email from page two, and an
// "n / m" folio on every page - so a multi-page CV never loses its owner.
// Source Serif 4 is the single family (standard rule 1): regular + semibold + bold.
#let folio-cv(
  author: "",
  profession: "",
  contact-items: (),
  running-contact: "",
  font: "Source Serif 4",
  font-size: 10.5pt,
  paper: "a4",
  margin: 1.9cm,
  leading: 0.62em,
  lang: "en",
  accent-color: "#35424e",
  body,
) = {
  let author-str = if type(author) == str { author } else { "CV" }
  set document(author: author-str, title: author-str + " - CV")

  set text(font: font, size: font-size, fill: ink, lang: lang, ligatures: false, hyphenate: false)
  set page(
    margin: margin,
    paper: paper,
    // Running head: identifies continuation pages only (page one carries the masthead).
    header: context {
      if counter(page).get().first() > 1 and not is-blank(author) {
        block(width: 100%, {
          set block(spacing: 0pt)
          set par(spacing: 0pt, justify: false)
          set text(size: meta-size, fill: muted)
          grid(
            columns: (1fr, auto),
            align: (left + bottom, right + bottom),
            column-gutter: 1em,
            text(fill: ink, weight: "semibold", author),
            if is-blank(running-contact) { [] } else { running-contact },
          )
          // Clear of the descenders: at 2.5pt the rule was cut by the "y" of a name and
          // the "p"/"@" of an email on every continuation page.
          v(5pt)
          line(length: 100%, stroke: 0.5pt + rgb(accent-color))
        })
      }
    },
    // Folio on every page of a multi-page CV: the quiet "n / m" that makes two sheets
    // read as one document. Suppressed on a one-pager, where it would only be noise.
    footer: context {
      let total = counter(page).final().first()
      if total > 1 {
        block(width: 100%, {
          set block(spacing: 0pt)
          set par(spacing: 0pt, justify: false)
          set align(right)
          text(size: meta-size, fill: muted, [#counter(page).display() #sym.slash #total])
        })
      }
    },
  )
  set par(justify: false, leading: leading)

  show link: set text(fill: muted)

  // Split letterhead masthead: name + role left, contact stacked flush right, both
  // hanging off one top baseline, closed by a heavy accent rule. Fully guarded so an
  // empty CV shows neither a floating rule nor an empty grid.
  let has-name = not is-blank(author)
  let has-prof = not is-blank(profession)
  let has-contact = contact-items.len() > 0
  if has-name or has-prof or has-contact {
    block(above: 0pt, below: 1.3em, breakable: false, {
      set block(spacing: 0pt)
      set par(spacing: 0pt, leading: 0.38em, justify: false)
      grid(
        columns: (1fr, auto),
        align: (left + top, right + top),
        column-gutter: 1.6em,
        {
          if has-name { text(size: display-size, weight: "bold", fill: ink, author) }
          if has-name and has-prof { v(display-size * 0.38) }
          if has-prof { text(size: subhead-size, weight: "regular", fill: muted, profession) }
        },
        {
          set text(size: meta-size, fill: muted)
          set align(right)
          for item in contact-items {
            block(above: 0pt, below: 3.5pt, item)
          }
        },
      )
      // The heavy rule CLOSES the name; with no name and no role there is nothing to
      // close, so a contact-only document gets its contact line and no floating rule.
      if has-name or has-prof {
        v(9pt)
        line(length: 100%, stroke: 1.4pt + rgb(accent-color))
      }
    })
  }

  body
}

// Section label: accent UPPERCASE + tracking over a muted hairline (the accent rules
// belong to the masthead and the running head, so section rules stay quiet).
// `gap` is the section separation resolved from the sectionSpacing knob (see the
// adapter), so section gaps keep scaling with entry gaps instead of converging.
#let cv-section(title, accent-color: "#35424e", gap: 1.7em) = {
  block(above: gap, below: 1em, sticky: true, {
    set block(spacing: 0pt)
    set par(spacing: 0pt, justify: false)
    text(size: label-size, weight: "semibold", tracking: 0.9pt, fill: rgb(accent-color), upper(title))
    v(4pt)
    line(length: 100%, stroke: 0.4pt + muted)
  })
}

// Entry: semibold-ink title leading a muted subtitle, dates flush right; location and
// an optional URL below in meta; then the body.
#let folio-entry(title: "", subtitle: "", dates: "", location: "", meta: "", body) = {
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
          if not is-blank(title) and not is-blank(subtitle) { text(fill: muted)[ #sym.dash.en ] }
          if not is-blank(subtitle) { text(fill: muted, subtitle) }
        },
        if not is-blank(dates) { text(size: meta-size, fill: muted, dates) } else { [] },
      )
      if not is-blank(location) {
        v(0.68em)
        text(size: meta-size, fill: muted, location)
      }
      if not is-blank(meta) {
        v(0.68em)
        text(size: meta-size, fill: muted, meta)
      }
    })
    // Wider than the 3pt above the location line, so the location binds to its title
    // instead of floating midway between the title and the first bullet.
    if not is-blank(body) {
      v(0.85em)
      block(spacing: 0pt, { set text(fill: ink); body })
    }
  })
}

// Language row: language left, level muted right.
#let folio-language(language: "", level: "") = {
  grid(
    columns: (1fr, auto),
    align: (left + horizon, right + horizon),
    column-gutter: 0.6em,
    language,
    if not is-blank(level) { text(size: meta-size, fill: muted, level) } else { [] },
  )
}



