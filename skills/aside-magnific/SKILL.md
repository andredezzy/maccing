---
name: aside-magnific
description: "Use whenever you work in the Magnific web app (magnific.com, formerly Freepik) through the Aside browser: generating or editing images, video, audio or 3D, upscaling, removing backgrounds, Spaces, the Creations feed, or downloading results. Also use it when the user wants Magnific work done without spending credits (Unlimited): open references/unlimited.md before any Generate click."
autoInject:
  keywords:
    - magnific
    - freepik
    - magnific unlimited
    - unlimited generations
    - image generator
    - gerar imagem magnific
    - sem gastar créditos
  url:
    - www.magnific.com/*
    - magnific.com/*
---

# Magnific (web app)

Umbrella skill for https://www.magnific.com/app, driven through Aside. It covers what works the same across the app's tools.

> **Depends on:** the `aside` skill (Aside required, profiles, one-shot `aside repl`, REPL behaviour). ALWAYS load it first. Its files: `../aside/SKILL.md` and `../aside/references/`. Inside the Aside app, a builtin skill is also named `aside`; that one covers the app's settings, not this.

**Step 0, whenever Unlimited is in play** (the user wants no credits spent, or the Unlimited switch is on): read `references/unlimited.md` in full before the first Generate click. It holds Magnific's terms on automation, the risk accepted, and the guard helper.

Open a reference when the task needs it:

| Task | Read |
|---|---|
| No credits (Unlimited) | `references/unlimited.md`, as step 0 above |
| Image Generator: model picker, settings dialogs, prompt, reference upload | `references/image-generator.md` |
| Finding your own result in the Creations feed and downloading the full-size file | `references/creations.md` |
| Getting a reference image into the REPL from a terminal | `../aside/references/terminal.md` |

For any other tool (video, audio, 3D, upscaler, Spaces, editing), snapshot the page and read its controls. Nothing here describes those tools yet, so don't assume they match the Image Generator.

**The Magnific MCP** exists for coding agents; the Aside agent cannot reach it. Its generation tools always spend credits, even on models the plan covers without limit. Its read tools, such as `creations_search` and `creations_get`, spend none.

## Nothing volatile is fixed here

Models, credit costs, plans, what Unlimited covers and control labels all change often. Read them from the page on every run. Labels quoted in these files are dated examples of what the app showed.

## Opening the app

- **List the tabs first**, every time you come back to the app: `listBrowserTabs()`. A tab you opened earlier can be gone, closed by the user or another session. If yours is missing, open a new one and restore your settings.
- **Open your own tab.** Other sessions may be working in an existing Magnific tab; never attach to one you didn't open. Use `openTab('https://www.magnific.com/app')` and pick the tool from the left navigation, or the tool's own URL if you know it (2026-09-23: the Image Generator was `/app/ai-image-generator`).
- **From a terminal**, your tab closes when the call ends (`../aside/references/terminal.md`). So each call opens its own tab and does a whole step in it: set the prompt and generate in one call, download in a later one. The app keeps model settings across tabs; a typed prompt or an open dialog is lost.
- **Restore what you change.** A new tab opens with each model's settings as last used in any tab, so restore a model's settings before you close.
- Close your tab with `closeTab(page)` when done.

## Layout shared across tools

- **The tool picker** is in the left navigation (the generators, Spaces, Design, 3D, "All tools"), plus a column of tool categories inside each generator.
- **The generation panel** is the page's `<aside>`, on the left of each generator. Top to bottom it holds the model picker, references, the prompt, a count (−, number, +), format and quality buttons, the Unlimited switch, and Generate. Snapshot it alone (`selector: 'aside'`).
- **Each button opens a dialog.** Dialogs appear at the end of the snapshot tree as `- dialog:`, but `snapshot(page, { selector: '[role=dialog]' })` returns nothing for them. Take the whole interactive tree and keep only the dialog: `tree.match(/- dialog:[\s\S]*/)?.[0]`. Press Escape to close one. A dialog stays open between REPL calls.
- The panel buttons show the current values. Dialogs do not mark the selected option.
- **The Creations feed** fills the right side. It is shared by the whole account and live, and it prints other people's prompts and results: never open, download or describe them. See `references/creations.md`.

## Spending credits

A Generate click can spend credits. Before one:

- **For no-credit work**, use `magnificGenerate` from `references/unlimited.md`. It clicks only while the Unlimited signal is present.
- **For paid work**, read the credit cost the panel shows for the current settings. Tell the user, and click Generate only after their yes.

Generate only what the user asked for, with the count set to exactly that. If a generation fails, report it instead of retrying.
