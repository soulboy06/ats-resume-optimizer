// Banner CV, a Typst resume template.
//
// Compiles with Typst 0.12 or newer.
// Set in Raleway. Without it installed the text falls back;
// change the font argument in the show rule below to a family you
// do have, the layout does not depend on it.
//
// Licence: MIT-0. Use it, change it, publish the result as your own CV.
// No attribution has to travel with the document you make from it.
//
// Self-contained: no imports, nothing to install.
// Every design:     https://github.com/davidculemann/typst-templates
// Edit in a browser: https://www.jobsprout.ai/resume-templates/banner
#set page(fill: rgb("#ffffff"))

#let is-blank(v) = v == none or v == "" or v == []

// One accent + ink + one muted grey (cv-typography-standard rule 6). The accent
// is used as ONE tasteful block: the header band. On the band, ink/muted are
// replaced by near-white / a muted white tint for legibility (same two-tone
// secondary logic, not a second colour). Default accent is a deep on-brand green.
#let ink = rgb("#1f2430")
#let muted = rgb("#6b7280")
#let band-ink = rgb("#f5f7f6")
#let band-muted = rgb("#cdd8d2")

// Fixed size scale from body B = 10.5pt (standard rule 2), defined ONCE.
#let display-size = 21pt // ~2.0 x B - the name in the band
#let subhead-size = 12pt // ~1.14 x B - the profession line in the band
#let body-size = 10.5pt // B
#let label-size = 10pt // ~0.95 x B - section labels (the one uppercase + tracked role)
#let meta-size = 8.6pt // ~0.82 x B - dates, location, contact, fine print

// Document shell: set-rules + PDF metadata only. The band and every section are
// composed by wrapSections. Raleway is the single text family (standard rule 1);
// regular + semibold + bold, each with a role (body / labels+leads / name).
#let banner-cv(
  author: "",
  font: "Raleway",
  font-size: 10.5pt,
  paper: "a4",
  margin: 1.4cm,
  leading: 0.65em,
  lang: "en",
  body,
) = {
  let author-str = if type(author) == str { author } else { "CV" }
  set document(author: author-str, title: author-str + " - CV")

  set text(font: font, size: font-size, fill: ink, lang: lang, ligatures: false, hyphenate: false)
  set page(margin: margin, paper: paper)
  set par(justify: false, leading: leading)

  show link: set text(fill: muted)

  body
}

// Header band (the tasteful single accent block): a full-content-width filled
// rectangle at the top holding the name (bold near-white), the derived profession
// (muted white) and a quiet contact line (muted white). Guarded so an empty CV
// shows no empty green block. Inset within the page margins (not full-bleed) so it
// paginates cleanly and never bleeds into a page-2 header.
// photo (VFS path string) sits at the band's right edge as a circle; none
// renders the text stack alone, byte-identically.
#let banner-header(author: "", profession: "", contact: "", accent-color: "#2f4a3f", photo: none, photo-radius: 50%, photo-size: 2.2cm) = {
  let has-name = not is-blank(author)
  let has-prof = not is-blank(profession)
  let has-contact = not is-blank(contact)
  // The band is a NAME banner: show it only when there is a name or role, never a
  // lone contact line (which would leave an accent block floating over an empty
  // name slot).
  if has-name or has-prof {
    block(width: 100%, fill: rgb(accent-color), inset: (x: 18pt, y: 16pt), below: 1.3em, breakable: false, {
      set block(spacing: 0pt)
      set par(spacing: 0pt, leading: 0.5em, justify: false)
      // Links on the band must read as white, not the global muted-grey link colour
      // (grey on the dark accent is unreadable).
      show link: set text(fill: band-muted)
      let text-stack = {
        if has-name { text(size: display-size, weight: "bold", fill: band-ink, tracking: 0.3pt, author) }
        if has-prof {
          if has-name { linebreak(); v(3pt) }
          text(size: subhead-size, weight: "regular", fill: band-muted, profession)
        }
        if has-contact {
          if has-name or has-prof { v(7pt) }
          text(size: meta-size, weight: "regular", fill: band-muted, contact)
        }
      }
      if photo != none {
        grid(
          columns: (1fr, auto),
          column-gutter: 14pt,
          align: (left + horizon, right + horizon),
          text-stack,
          box(
            clip: true,
            radius: photo-radius,
            width: photo-size,
            height: photo-size,
            stroke: 1pt + rgb(255, 255, 255, 60),
            image(photo, width: photo-size, height: photo-size, fit: "cover"),
          ),
        )
      } else {
        text-stack
      }
    })
  }
}

// Section label: UPPERCASE + small tracking (the one place caps + tracking appear,
// standard rules 4 + 5), in the accent, over a thin accent rule. Sticky so a label
// never orphans at a page bottom.
#let cv-section(title, accent-color: "#2f4a3f") = {
  block(above: 1.25em, below: 0.9em, sticky: true, {
    set block(spacing: 0pt)
    set par(spacing: 0pt, justify: false)
    text(size: label-size, weight: "semibold", tracking: 0.8pt, fill: rgb(accent-color), upper(title))
    v(3pt)
    line(length: 100%, stroke: 0.6pt + rgb(accent-color))
  })
}

// Entry: the title (semibold ink) leads with the subtitle (muted) on the same line,
// dates right-aligned as muted meta; location and an optional meta line (URL) below;
// then the body copy. Title leads with weight, not uppercase (standard rule 4).
#let banner-entry(title: "", subtitle: "", dates: "", location: "", meta: "", body) = {
  block(breakable: true, {
    set block(spacing: 0pt)
    set par(spacing: 0pt)
    block(sticky: true, breakable: false, {
      set par(justify: false)
      grid(
        columns: (1fr, auto),
        align: (left + bottom, right + bottom),
        column-gutter: 0.75em,
        {
          if not is-blank(title) { text(weight: "semibold", fill: ink, title) }
          if not is-blank(title) and not is-blank(subtitle) { text(fill: muted)[ #sym.dash.en ] }
          if not is-blank(subtitle) { text(fill: muted, subtitle) }
        },
        if not is-blank(dates) { text(size: meta-size, fill: muted, dates) } else { [] },
      )
      if not is-blank(location) {
        v(3pt)
        text(size: meta-size, fill: muted, location)
      }
      if not is-blank(meta) {
        v(3pt)
        text(size: meta-size, fill: muted, meta)
      }
    })
    if not is-blank(body) {
      v(3.5pt)
      block(spacing: 0pt, { set text(fill: ink); body })
    }
  })
}

// Language row: language left, proficiency muted right, one line.
#let banner-language(language: "", level: "") = {
  grid(
    columns: (1fr, auto),
    align: (left + horizon, right + horizon),
    column-gutter: 0.75em,
    language,
    if not is-blank(level) { text(size: meta-size, fill: muted, level) } else { [] },
  )
}



