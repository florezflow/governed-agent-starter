---
name: site-change
description: Make a change to the demo website in site/ and deliver it as a complete pull request with a plan, a passing design check and before/after screenshots taken with Playwright. Use for every issue or comment that asks to add, change, fix or restyle anything on the site (content, sections, layout, colours, dark mode, mobile view), even if the request is one sentence.
---

# Change the site and open the pull request

You deliver a change a human can review in two minutes: the plan, the diff, the check result and
screenshots. Do the steps in order. `<n>` is the issue or PR number from the prompt, `<owner>/<repo>`
is the repository from the prompt.

## 1. Understand and plan

- Read `CLAUDE.md` and `DESIGN.md`, then the files in `site/` you will touch.
- Write a plan of two to five bullets into your tracking comment: what changes, which files, which
  `DESIGN.md` components you use.
- If the request conflicts with `DESIGN.md` (for example a second yellow button, a web font, a colour
  outside the tokens), follow `DESIGN.md` and say in the comment what you did instead and why.

## 2. Screenshot the current page (before)

The site is already served at `http://localhost:4173/`.

1. `mcp__playwright__browser_navigate` → `http://localhost:4173/`
2. `mcp__playwright__browser_resize` → width `1280`, height `800`
3. `mcp__playwright__browser_take_screenshot` → `filename: "screenshots/<n>-before-desktop.png"`,
   `fullPage: true`

The filename is relative to the repository root, so the file lands in `screenshots/`.

## 3. Make the change

- Edit only `site/` (and a doc file if the issue explicitly asks).
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

## 6. Commit and push

- `git add site/ screenshots/` (plus a doc file if you changed one)
- Commit message: `site: <what changed, outcome first> (#<n>)`
- Push with the push script named in your instructions.
- `git rev-parse HEAD` → the commit SHA for the image links.

## 7. Open the pull request yourself

On an **issue**: call `mcp__github__create_pull_request` with `owner`, `repo`, `base: "main"`,
`head: <your branch>`, a title of at most 65 characters that names the outcome, and this body
(it follows `.github/pull_request_template.md`):

```markdown
## Plan
- <the bullets from step 1>

## What changed
- <file>: <what and why, one line each>

## Design check
`<last line of node scripts/check-design.mjs>`

## Screenshots
| Before | After, desktop | After, phone |
|---|---|---|
| ![before](https://raw.githubusercontent.com/<owner>/<repo>/<sha>/screenshots/<n>-before-desktop.png) | ![after desktop](https://raw.githubusercontent.com/<owner>/<repo>/<sha>/screenshots/<n>-after-desktop.png) | ![after phone](https://raw.githubusercontent.com/<owner>/<repo>/<sha>/screenshots/<n>-after-mobile.png) |

Closes #<n>
```

On an **open pull request** (a follow-up `@claude` comment): push to the existing branch, replace the
screenshots with new ones under the same names, and update the body with
`mcp__github__update_pull_request` instead of opening a new PR.

## 8. Finish

Update your tracking comment: the plan ticked off, the PR link, and anything you did not do. Never
merge or approve the pull request; a human does that.
