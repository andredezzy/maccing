# Padding Rules

The most critical rules for box drawing alignment.

---

## padding-right: Right-Pad Content Lines

**Priority**: CRITICAL

Every content line MUST be padded with spaces to reach the exact width before the closing `│`.

### Why

The #1 mistake is forgetting to pad content to the FULL width. This causes the right edge to "float away" from where it should be.

### Wrong

```
┌───────────────────────────────────────────────────────────────┐
│                           TITLE                               │
├───────────────────────────────────────────────────────────────┤
│  Content line padded with spaces to reach exact width        │
└───────────────────────────────────────────────────────────────┘
```

The content line is shorter than the border, missing spaces before `│`.

### Correct

```
┌───────────────────────────────────────────────────────────────┐
│                           TITLE                               │
├───────────────────────────────────────────────────────────────┤
│  Content line padded with spaces to reach exact width         │
└───────────────────────────────────────────────────────────────┘
```

One additional space before the closing `│` makes all lines equal.

### Verification

1. Place cursor at end of border line, note column number
2. Check EVERY content line ends at same column
3. If different: add/remove spaces before closing `│`

---

## padding-fixed-width: Fixed Width Lines

**Priority**: CRITICAL

Every line in a box MUST have identical character count.

### Formula

For a box of total width W:

```
Border:  ┌ + (W-2 × ─) + ┐ = W chars
Content: │ + (W-2 chars) + │ = W chars
```

### Example: 65-character box

```
Border formula:    ┌ + (63 × ─) + ┐ = 65 total chars
Content formula:   │ + (63 chars) + │ = 65 total chars
                       ↑
                       This MUST be exactly 63 chars
                       (content + right-padding spaces)
```

### Step-by-Step Process

1. Decide total width (e.g., 65 characters)
2. Calculate content width: total - 2 (for │ on each side) = 63
3. Draw border: `┌` + 63×`─` + `┐`
4. For each content line:
   - Write your content after `│` and a space
   - Count remaining chars needed: 63 - len(content)
   - Add that many spaces before closing `│`

### Quick Reference

| Total Width | Border Dashes | Content Chars |
|-------------|---------------|---------------|
| 50 | 48 | 48 |
| 60 | 58 | 58 |
| 65 | 63 | 63 |
| 70 | 68 | 68 |
