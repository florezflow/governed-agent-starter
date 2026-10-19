# DESIGN.md: Swiss Pop Lite

How the demo site in `site/` looks. Humans and the agent read this before changing the site;
`node scripts/check-design.mjs` enforces the rules marked **[checked]**.

## The goal

> In five seconds a visitor knows what they get, believes it works, and sees how to try it.

Every section shows an outcome, a piece of proof and a next step. If it doesn't, it doesn't ship,
however good it looks.

## In two sentences

**Swiss decides where things go:** a strict grid, white space that does work, few type sizes, mono
for facts. **Pop decides what you notice:** ink outlines, flat fills, one hard offset shadow and
exactly one loud yellow.

## Tokens

All colours, fonts and shapes are CSS custom properties in the `:root` block at the top of
`site/styles.css`. Use the variable, never the value. **[checked: no colour literal outside that block]**

| Token | Value | Use for |
|---|---|---|
| `--ink` | `#131522` | text, outlines, arrows, the offset shadow |
| `--paper` | `#F5F4EE` | page background |
| `--card` | `#FFFEF9` | cards, steps, the receipts list |
| `--muted` | `#6D6C61` | secondary text, captions, metadata |
| `--hairline` | `#DCDAD0` | dividers |
| `--signal` | `#FFD600` | the one thing that matters on the page |
| `--works` / `--works-text` | `#4FD8B4` / `#0A7A5F` | a state that is on, done, passing |
| `--open` / `--open-text` | `#FFC266` / `#9E5300` | a state that is pending or manual |
| `--broken` / `--broken-text` | `#FF9AA9` / `#B3122F` | a state that is off, blocked, failing |
| `--code-bg` / `--code-fg` | `#131522` / `#E8EAF3` | the code card |
| `--font-sans` | system UI stack | words |
| `--font-mono` | system mono stack | facts: numbers, labels, section numbers, code |
| `--radius` / `--radius-pill` | `14px` / `999px` | cards / buttons, chips |
| `--shadow` | `6px 6px 0 var(--ink)` | the focus element only |

## Rules

1. **One yellow per page.** Exactly one element carries the class `is-signal`: the primary call to
   action. Yellow is a fill inside an ink outline, never text. **[checked]**
2. **Ink on every fill.** Text on yellow, green, orange or red is `--ink`.
3. **Outline, not shadow.** Cards have a 2px ink outline. The offset shadow (`--shadow`) marks the
   one thing to look at first: the primary button and the hero card. Nowhere else.
4. **Status colours mean state.** Green, orange and red appear only on chips that report a state.
   Never as decoration.
5. **Mono for facts.** Section numbers (`01 —`), times, counts, file names and code are mono.
   Headlines and sentences are sans.
6. **Few sizes.** Headline, section title, body, small. Hierarchy comes from weight and space.
7. **No external requests.** No web fonts, CDN scripts or remote stylesheets. The page loads from
   this repository only. **[checked]**
8. **Accessible by default.** Every page has `lang`, a `<title>` and a viewport meta tag; every
   image has an `alt` text. **[checked]** Contrast is at least 4.5:1 for text; the focus ring is a
   3px ink outline; motion respects `prefers-reduced-motion`.

## Components

| Component | Looks like | Notes |
|---|---|---|
| **Primary button** | yellow pill, 2px ink outline, `--shadow`, ink text | once per page (`is-signal`) |
| **Secondary button** | card-coloured pill, 2px ink outline, no shadow | any number |
| **Section label** | mono, muted, `01 — how it works` | every section starts with one |
| **Card** | `--card`, 2px ink outline, `--radius`, no shadow | the hero card may carry `--shadow` |
| **Step** | card with a big mono number and one sentence | steps read left to right, top to bottom on phones |
| **Receipt row** | a fact on the left, a status chip on the right | the proof that a guardrail is on |
| **Chip** | mono, pill, state fill + ink text | `works`, `open` or `broken` only |
| **Code card** | `--code-bg`, mono, a copy button | for things the visitor copies |

## Layout

- Content width at most `1080px`, side padding `24px` (`16px` on phones).
- An 8px spacing scale: 8, 16, 24, 32, 48, 64, 96.
- Sections are separated by space, not by lines. A hairline only separates items inside a list.
- Phones first: everything is one column below `720px`; steps and cards stack.

## Words

- Headlines name the outcome for the reader, not the topic: "Agents open the PRs. You still merge."
  not "About our agent workflow".
- One idea per sentence. No "seamless", "powerful", "revolutionary", no exclamation marks.
- Buttons say what happens: "Open an issue", not "Submit" or "Learn more".
- Facts beat adjectives: "keys stored: 0" over "secure".
