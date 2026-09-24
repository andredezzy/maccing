# REPL helpers

Each REPL helper is one file in `scripts/`, defining one function on `globalThis` that acts on `page`. Load a helper and the ones it needs:

| File | Defines | Needs |
|---|---|---|
| [`read-form.js`](../scripts/read-form.js) | `shpRead()`: the form's text inputs and the preview card | — |
| [`escape.js`](../scripts/escape.js) | `shpEscape()` | — |
| [`field.js`](../scripts/field.js) | `shpField()`: the field under a label in a snapshot | `escape.js` |
| [`list-open.js`](../scripts/list-open.js) | `shpListOpen()` | — |
| [`close-list.js`](../scripts/close-list.js) | `shpClose()` | `field.js`, `list-open.js` |
| [`options.js`](../scripts/options.js) | `shpOptions()`: a dropdown's options, read only | `field.js`, `close-list.js` |
| [`pick.js`](../scripts/pick.js) | `shpPick()`: one dropdown option | `escape.js`, `field.js`, `close-list.js` |
| [`add-item.js`](../scripts/add-item.js) | `shpAddItem()`: a value the dropdown lacks | `escape.js`, `field.js`, `list-open.js`, `close-list.js` |
| [`attributes.js`](../scripts/attributes.js) | `shpAttributes()`: every specification value | — |
| [`clear-attribute.js`](../scripts/clear-attribute.js) | `shpClearAttribute()` | `attributes.js` |
| [`type-into.js`](../scripts/type-into.js) | `shpTypeInto()`: the name, numbers and textbox attributes | — |
| [`read-description.js`](../scripts/read-description.js) | `shpReadDescription()` | — |
| [`type-description.js`](../scripts/type-description.js) | `shpTypeDescription()` | `read-description.js` |
| [`dismiss-tours.js`](../scripts/dismiss-tours.js) | `shpDismissTours()` | — |
| [`close-category-picker.js`](../scripts/close-category-picker.js) | `shpCloseCategoryPicker()` | — |
| [`image-sources.js`](../scripts/image-sources.js) | `shpImageSources()`: image URLs in page order | — |
| [`upload-image.js`](../scripts/upload-image.js) | `shpUploadImage()` | — |
| [`delete-image.js`](../scripts/delete-image.js) | `shpDeleteImage()` | — |

A helper looks the others up only when it runs, so any order works as long as all of them are loaded before the first call. Each file's header says what it takes and returns.

- **In a session that outlives the call** (`../aside/references/terminal.md`, "A session that outlives the call"), concatenate the files you need into one step and send it once, first.
- **From one-shot terminal calls**, concatenate the files before your task's code in every call:

  ```bash
  s=<skill dir>/scripts
  aside repl --account <id> "$(cat "$s/read-form.js" "$s/upload-image.js" "$s/delete-image.js" task.js)"
  ```
- **In the Aside agent's REPL**, run each file's contents once, in its own cell, before the cell that calls it.

## Outside the REPL

[`image-order.ts`](../scripts/image-order.ts) runs in the shell, with Bun: `bun <skill dir>/scripts/image-order.ts <declared file>... -- <live image URL>...`. It checks that the live images are the declared files, in order (`listings.md`, "Verify").
