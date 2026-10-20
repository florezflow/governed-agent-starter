---
name: site-change
description: Make a change to the demo website in site/ with a plan, a passing design check and before/after screenshots taken with Playwright, ready for the deliver job to turn into a pull request. Use for every issue or comment that asks to add, change, fix or restyle anything on the site (content, sections, layout, colours, dark mode, mobile view), even if the request is one sentence.
---

# Change the site, ready for review

You produce a change a human can review in two minutes: the plan, the diff, the check result and
screenshots. Do the steps in order. `<n>` is the issue number from the prompt.

Use the Read, Edit and Write tools for files; `.agent/` already exists, so no `mkdir` is needed. The
only shell commands you have are the design check, `git status`, `git diff` and `ls`.

You don't commit, push or open the pull request, and you have no tools for it. When you finish, the
deliver job (no model) takes your changes in `site/` and `screenshots/`, checks them again and opens
the pull request with your title and summary. Changes anywhere else are dropped.

## 1. Understand and plan

- Read `CLAUDE.md` and `DESIGN.md`, then the files in `site/` you will touch.
- Write a plan of two to five bullets into `.agent/summary.md` under `## Plan`: what changes, which
  files, which `DESIGN.md` components you use.
- If the request conflicts with `DESIGN.md` (for example a second yellow button, a web font, a colour
  outside the tokens, a script, a link to another site), follow `DESIGN.md` and say in the summary
  what you did instead and why.
- If the request isn't a change to the site at all, change nothing, explain in `.agent/summary.md`
  and stop.

## 2. Screenshot the current page (before)

The site is already served at `http://localhost:4173/`.

1. `mcp__playwright__browser_navigate` → `http://localhost:4173/`
2. `mcp__playwright__browser_resize` → width `1280`, height `800`
3. `mcp__playwright__browser_take_screenshot` → `filename: "screenshots/<n>-before-desktop.png"`,
   `fullPage: true`

The filename is relative to the repository root, so the file lands in `screenshots/`.

## 3. Make the change

- Edit only `site/`: HTML, CSS, SVG and images. `.js` files are maintained by people; you can't
  change them, and no page may contain inline scripts or event handlers.
- Colours, fonts, radius and shadow come from the tokens in the `:root` block of `site/styles.css`.
  Add a new token there only if no existing one fits, and use it by name.
- Exactly one element keeps the class `is-signal`. New buttons are secondary (`btn` without
  `is-signal`).
- New sections start with a mono label (`04 — faq`) and an outcome headline.
- Keep it working on a 390px wide phone.

## 4. Run the design check

Run `node scripts/check-design.mjs`. If it reports problems, fix them and run it again until it says
`0 problems`. Copy its last line; it goes into the pull request.

## 5. Screenshot the result (after) and look at it

1. `mcp__playwright__browser_navigate` → `http://localhost:4173/` (reload to pick up the change)
2. `mcp__playwright__browser_resize` → `1280` × `800`, then
   `mcp__playwright__browser_take_screenshot` → `screenshots/<n>-after-desktop.png`, `fullPage: true`
3. `mcp__playwright__browser_resize` → `390` × `844`, then
   `mcp__playwright__browser_take_screenshot` → `screenshots/<n>-after-mobile.png`, `fullPage: true`
4. Read both PNG files and check them against `DESIGN.md`: one yellow element, ink outlines, nothing
   cut off or overlapping, readable on the phone. Fix and re-take them if something is wrong.

## 6. Write the title and summary

- `.agent/title.txt`: one line, at most 65 characters, outcome first, for example
  `site: fold the FAQ into one row per question`.
- `.agent/summary.md`, plain text the reviewer reads in the pull request:

```markdown
## Plan
- <the bullets from step 1, ticked off or with what changed>

## What changed
- <file>: <what and why, one line each>

## Design check
<last line of node scripts/check-design.mjs>

## Not done
- <anything from the request you skipped, and why; or "nothing">
```

Links and mentions in the summary don't render: the deliver job shows it as plain text and adds the
file list, its own check result and the screenshots.

## 7. Finish

Stop when the files are written. Never try to commit, push, merge or approve; a human reviews the
pull request and merges it.
