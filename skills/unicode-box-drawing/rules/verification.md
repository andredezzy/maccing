# Verification Rules

How to verify box drawing alignment before committing.

---

## Method 1: Editor Column Counter

1. Enable "show column number" in your editor
2. Place cursor at end of border line, note column (e.g., 65)
3. Check EVERY content line ends at same column
4. If different: add/remove spaces before closing `│`

### Editor Settings

| Editor | Setting |
|--------|---------|
| VS Code | `editor.renderLineHighlight` |
| Vim | `:set ruler` |
| Sublime | View > Show Column |

---

## Method 2: Visual Ruler

Copy this ruler and align your box beneath it:

```
         1         2         3         4         5         6
123456789012345678901234567890123456789012345678901234567890123456789
┌───────────────────────────────────────────────────────────────┐
│  Your content here, padded to column 64 before │              │
└───────────────────────────────────────────────────────────────┘
```

---

## Method 3: Select All Lines

1. Select all lines in a box
2. If edges are jagged: lines have different lengths
3. Fix padding until edges are perfectly aligned

This method works in any editor and immediately shows misalignment.

---

## Common Issues and Fixes

### Right Edge Floats Away from Box

**Cause**: Content lines are shorter than border

**Fix**: Add more spaces BEFORE the closing `│` on each content line

```
Wrong:  │  Short content         │   (missing spaces)
Right:  │  Short content                                    │
```

### Right Edge Cuts Into Box

**Cause**: Content lines are longer than border

**Fix**: Remove content or abbreviate to fit within width

```
Wrong:  │  Content that is too long and overflows the border│
Right:  │  Content that fits within the border width        │
```

### Nested Boxes Misalign Outer Box

**Cause**: Inner elements don't sum to correct content width

**Fix**: Calculate: left_pad + inner_content + right_pad = content_width

### Boxes Look Broken in GitHub/Terminal

**Cause**: Font substitution, fallback font has different glyph widths

**Fix**: Use simpler characters, test in target environment

### Vertical Lines Don't Connect

**Cause**: Line height settings in some editors/terminals

**Fix**: Usually a display issue, not content issue

### Unicode Characters Not Rendering

**Cause**: Font doesn't support box drawing block

**Fix**: Use a font with full Unicode support (Fira Code, JetBrains Mono)

---

## Pre-Commit Checklist

Run through this checklist before committing any box diagram:

- [ ] All lines in each box have IDENTICAL character count
- [ ] Content lines have right-padding before closing `│`
- [ ] Empty line AFTER every `┌───┐` opening (top breathing room)
- [ ] Empty line AFTER every `├───┤` divider (section breathing room)
- [ ] Empty line BEFORE every `└───┘` closing (bottom breathing room)
- [ ] Empty line BEFORE every `├───┤` divider (section breathing room)
- [ ] Nested boxes have breathing room at ALL levels
- [ ] Flow content is CENTERED within parent box
- [ ] Total width ≤ 70 characters
- [ ] Tested in target rendering environment
- [ ] Nested boxes math adds up correctly
- [ ] No mixed ASCII/Unicode characters

---

## Workflow

1. **Draw in tool** (ASCIIFlow recommended)
2. **Export to text**
3. **Verify character counts** in editor (CRITICAL)
4. **Adjust right-padding** on every content line
5. **Test rendering** in target (GitHub, terminal)
6. **Commit**
