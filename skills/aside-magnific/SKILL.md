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

Umbrella skill for https://www.magnific.com/app, driven through Aside.

> **Depends on:** the `aside` skill (`../aside/SKILL.md`). ALWAYS load it first and follow its Iron Laws: update and load Aside's official `aside-browser` skill, and let an Aside built-in Magnific skill lead if one exists. Inside the Aside app, a builtin skill is also named `aside`; that one covers the app's settings, not this.

**Step 0, whenever Unlimited is in play** (the user wants no credits spent, or the switch is on): read `references/unlimited.md` in full before the first Generate click. It holds Magnific's terms on automation and the guard.

Open a reference when the task needs it:

| Task | Read |
|---|---|
| No credits (Unlimited) | `references/unlimited.md`, as step 0 above |
| Image Generator: model picker, settings dialogs, prompt, reference upload and reuse | `references/image-generator.md` |
| Writing the prompt: sizes, crops, what to leave out | `references/prompts.md` |
| Finding your own new card in the Creations feed, and downloading the full-size file, never a preview | `references/creations.md` |
| Any Generate from a terminal: paid runs, several images, the 120 s limit | `references/terminal-runs.md` |
| Loading the REPL helpers (`magnificSettings`, `magnificGenerate`, `magnificFeedTop`, `magnificDownload`, …) and their load order | `references/helpers.md` |
| Before the first Generate: every question for the user in one message | `references/asking-the-user.md` |
| The app's layout: tool picker, generation panel, dialogs | `references/image-generator.md`, "The app's layout" |
| The Magnific MCP, and checking it is on the same account | `references/creations.md`, "The Magnific MCP" |
| Getting a reference image into the REPL from a terminal | `../aside/references/terminal.md` |

For any other tool (video, audio, 3D, upscaler, Spaces, editing), snapshot the page and read its controls. Nothing here describes those tools yet, so don't assume they match the Image Generator.

## Nothing volatile is fixed here

Models, credit costs, plans, what Unlimited covers and control labels all change often. Read them from the page on every run. Labels quoted in these files are dated examples of what the app showed.

## Opening the app

- **List the tabs first**, every time you come back: `listBrowserTabs()`. A tab you opened can be gone. If yours is missing, open a new one and restore your settings.
- **Open your own tab.** Other sessions may be working in an existing Magnific tab; never attach to one you didn't open. Use `openTab('https://www.magnific.com/app')` and pick the tool from the left navigation, or the tool's own URL if you know it (2026-09-23: the Image Generator was `/app/ai-image-generator`).
- **From a terminal**, a one-shot call's tab closes when the call ends. For a long run, keep one background session with its own tab (`../aside/references/terminal.md`, "A session that outlives the call"). `references/terminal-runs.md` plans the calls.
- **Restore what you change.** A new tab opens with each model's settings as last used in any tab. Record a baseline on opening and another after picking your model, and restore both before your task's last tab closes: your model's settings, the Unlimited switch included, then the model the panel opened on (`references/image-generator.md`, "Read the panel, not the page").
- Close your tab with `closeTab(page)` when done.

## The account check

Before any Generate, paid or Unlimited, read which Magnific account is logged in. Open the account menu (top right) and read the email in the dialog it opens; the dialog also shows the plan and the credits. Print only that line, then press Escape. Tell the user the email, and go on only once it is the account they mean. The profile (`--account u1`, …) tells you nothing about this (`../aside/references/profiles.md`).

## Spending credits

A Generate click can spend credits. Before one:

- **For no-credit work**, use `magnificGenerate` from `references/unlimited.md`. It clicks only while the Unlimited signal and the settings you pass are all present.
- **For paid work**, read the credit cost the panel shows for the current settings. Tell the user the account, the model, the settings, the count and that cost, and click Generate only after their yes. From a terminal the tab is gone by the time they answer: follow `references/terminal-runs.md`, "Paid work".
- **The Unlimited switch.** Turn it on only for no-credit work, and never off to make a paid run happen. Turn it the way `references/unlimited.md`, "The switch", says: a click may open a dialog.

Generate only what the user asked for, with the count set to exactly that. If a generation fails, report it instead of retrying.

