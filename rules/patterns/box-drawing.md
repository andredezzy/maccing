# Unicode Box Drawing Patterns

<rules>
## Rules

| Rule | Description |
|------|-------------|
| Fixed width | Every line in a box MUST have identical character count |
| Right-pad content | Content lines need spaces at END before closing │ |
| Breathing room | Empty line AFTER every ┌───┐ or ├───┤ AND BEFORE every └───┘ or ├───┤ |
| Center flow content | ALWAYS center nested boxes and flow diagrams within parent |
| Under 70 chars | Keep diagrams under 70 characters for compatibility |
| Count characters | Use editor column markers to verify alignment |
| Monospace font | Only renders correctly in monospace fonts |
| Single charset | Never mix Unicode box chars with ASCII on same line |
| Test rendering | Verify in target environment before committing |
| Use tools | Prefer ASCIIFlow or Monodraw over manual drawing |
</rules>

<critical_rule>
## CRITICAL: Right-Padding Pattern

**The #1 mistake is forgetting to pad content to the FULL width before the closing │**

### WRONG (content too short):
```
┌───────────────────────────────────────────────────────────────┐
│                           TITLE                               │
├───────────────────────────────────────────────────────────────┤
│  Content line padded with spaces to reach exact width        │  <- WRONG!
└───────────────────────────────────────────────────────────────┘
```

### CORRECT (content padded to full width):
```
┌───────────────────────────────────────────────────────────────┐
│                           TITLE                               │
├───────────────────────────────────────────────────────────────┤
│  Content line padded with spaces to reach exact width         │  <- CORRECT!
└───────────────────────────────────────────────────────────────┘
```

**The difference**: One space before the closing `│` in the content line.
</critical_rule>

<breathing_room>
## Breathing Room: Empty Lines at TOP and BOTTOM

**Always add empty lines AFTER every opening ┌───┐ or divider ├───┤ AND BEFORE every closing └───┘ or divider ├───┤.**

### WRONG (no breathing room):
```
┌───────────────────────────────────────────────────────────────┐
│                         TITLE                                 │
├───────────────────────────────────────────────────────────────┤
│   Content line here                                           │
│   More content                                                │
├───────────────────────────────────────────────────────────────┤
│   Section 2 content                                           │
└───────────────────────────────────────────────────────────────┘
```

### CORRECT (breathing room at top AND bottom of each section):
```
┌───────────────────────────────────────────────────────────────┐
│                         TITLE                                 │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   Content line here                                           │
│   More content                                                │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   Section 2 content                                           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Pattern**: After every ┌───┐ or ├───┤, add empty line. Before every ├───┤ or └───┘, add empty line.

**Why**: Creates visual separation, makes the box feel less cramped, improves readability.

### Nested Boxes: Apply to ALL Levels

**WRONG** (missing breathing room after opening borders):
```
┌───────────────────────────────────────────────────────────────┐
│   ┌───────────────────────────────────────────────────────┐   │
│   │   ┌───────────────────────────────────────────────┐   │   │
│   │   │   Child content                               │   │   │
│   │   │                                               │   │   │
│   │   └───────────────────────────────────────────────┘   │   │
│   │                                                       │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**CORRECT** (breathing room AFTER every ┌ AND BEFORE every └):
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │                                                       │   │
│   │   ┌───────────────────────────────────────────────┐   │   │
│   │   │                                               │   │   │
│   │   │   Child content                               │   │   │
│   │   │                                               │   │   │
│   │   └───────────────────────────────────────────────┘   │   │
│   │                                                       │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```
</breathing_room>

<formula>
## Box Width Formula

For a 65-character wide box:

```
Border formula:    ┌ + (63 × ─) + ┐ = 65 total chars
Content formula:   │ + (63 chars) + │ = 65 total chars
                       ↑
                       This MUST be exactly 63 chars
                       (content + right-padding spaces)
```

### Step-by-Step Process

1. **Decide total width** (e.g., 65 characters)
2. **Calculate content width**: total - 2 (for │ on each side) = 63
3. **Draw border**: ┌ + 63×─ + ┐
4. **For each content line**:
   - Write your content after │ and a space
   - Count remaining chars needed: 63 - len(content)
   - Add that many spaces before closing │

### Quick Reference

| Total Width | Border Dashes | Content Chars |
|-------------|---------------|---------------|
| 50 | 48 | 48 |
| 60 | 58 | 58 |
| 65 | 63 | 63 |
| 70 | 68 | 68 |
</formula>

<characters>
## Unicode Box Drawing Characters (U+2500–U+257F)

### Light Lines (Recommended)
```
Corners:     ┌ ┐ └ ┘
Lines:       ─ │
T-junctions: ├ ┤ ┬ ┴
Cross:       ┼
```

### Arrows
```
Simple:      → ← ↓ ↑
Filled:      ▶ ◀ ▼ ▲
Double:      ⇒ ⇐ ⇓ ⇑
```

### Character Reference

| Character | Unicode | Name | Use |
|-----------|---------|------|-----|
| `┌` | U+250C | Light Down and Right | Top-left corner |
| `┐` | U+2510 | Light Down and Left | Top-right corner |
| `└` | U+2514 | Light Up and Right | Bottom-left corner |
| `┘` | U+2518 | Light Up and Left | Bottom-right corner |
| `─` | U+2500 | Light Horizontal | Horizontal line |
| `│` | U+2502 | Light Vertical | Vertical line |
| `├` | U+251C | Light Vertical and Right | Left T-junction |
| `┤` | U+2524 | Light Vertical and Left | Right T-junction |
| `┬` | U+252C | Light Down and Horizontal | Top T-junction |
| `┴` | U+2534 | Light Up and Horizontal | Bottom T-junction |
| `┼` | U+253C | Light Vertical and Horizontal | Cross |
</characters>

<verification>
## Verification Process

### Method 1: Editor Column Counter
1. Enable "show column number" in your editor
2. Place cursor at end of border line, note column (e.g., 65)
3. Check EVERY content line ends at same column
4. If different → add/remove spaces before closing │

### Method 2: Visual Ruler
```
         1         2         3         4         5         6
123456789012345678901234567890123456789012345678901234567890123456789
┌───────────────────────────────────────────────────────────────┐
│  Your content here, padded to column 64 before │              │
└───────────────────────────────────────────────────────────────┘
```

### Method 3: Select All Lines
1. Select all lines in a box
2. If edges are jagged → lines have different lengths
3. Fix padding until edges are perfectly aligned
</verification>

<nested_boxes>
## Nested Boxes Math

When placing boxes inside boxes:

```
Outer: 65 chars total → 63 chars content space
Inner: Must fit within 63 chars (including padding)

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   ┌───────────┐      ┌───────────┐      ┌─────────────────┐   │
│   │ Inner 1   │─────▶│ Inner 2   │─────▶│ Inner 3         │   │
│   └───────────┘      └───────────┘      └─────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘

Content breakdown (63 chars between outer │):
│ + 3 spaces + inner1(13) + 6 spaces + inner2(13) + 6 spaces + inner3(19) + 3 spaces + │
  = 3 + 13 + 6 + 13 + 6 + 19 + 3 = 63 ✓
```

**Key formula**: left_pad + inner_boxes_with_arrows + right_pad = content_width

### Centering Technique

**ALWAYS center flow content within the parent box.**

To center:
1. Calculate total width of inner content (boxes + arrows + spaces between)
2. Calculate remaining space: content_width - inner_content_width
3. Divide remaining by 2 for left padding
4. Apply equal padding on both sides

Example:
```
┌───────────────────────────────────────────────────────────────┐
│                         TITLE                                 │  <- title centered
│                                                               │
│    ┌───────────┐      ┌───────────┐      ┌───────────────┐    │  <- flow centered
│    │  Step 1   │─────▶│  Step 2   │─────▶│    Step 3     │    │
│    └───────────┘      └───────────┘      └───────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

**NOT centered (wrong)**:
```
│   ┌───────────┐      ┌───────────┐      ┌───────────────┐     │  <- uneven padding
```

**Centered (correct)**:
```
│    ┌───────────┐      ┌───────────┐      ┌───────────────┐    │  <- equal padding
```
</nested_boxes>

<patterns>
  <simple_box>
  ## Simple Box (65 chars)

  ```
  ┌───────────────────────────────────────────────────────────────┐
  │                           TITLE                               │
  ├───────────────────────────────────────────────────────────────┤
  │  Content line 1 with proper padding                           │
  │  Content line 2 with proper padding                           │
  └───────────────────────────────────────────────────────────────┘
  ```
  </simple_box>

  <horizontal_flow>
  ## Horizontal Flow

  ```
  ┌───────────┐      ┌───────────┐      ┌───────────┐
  │  Step 1   │─────▶│  Step 2   │─────▶│  Step 3   │
  └───────────┘      └───────────┘      └───────────┘
  ```

  **Arrow**: `─────▶` (5× horizontal line + filled arrow)
  </horizontal_flow>

  <vertical_flow>
  ## Vertical Flow

  ```
  ┌─────────────────┐
  │     Parent      │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │     Child       │
  └─────────────────┘
  ```

  **Key**: Center `│` and `▼` under the box
  </vertical_flow>

  <branching>
  ## Branching Flow

  ```
       ┌─────────────┐
       │   Start     │
       └──────┬──────┘
              │
         ┌────┴────┐
         ▼         ▼
  ┌──────────┐ ┌──────────┐
  │  Path A  │ │  Path B  │
  └──────────┘ └──────────┘
  ```
  </branching>

  <table>
  ## Data Table

  ```
  ┌────────────────┬─────────┬──────────────────────┐
  │ Column 1       │ Col 2   │ Column 3             │
  ├────────────────┼─────────┼──────────────────────┤
  │ Data           │ Value   │ Description          │
  │ More data      │ 123     │ Another description  │
  └────────────────┴─────────┴──────────────────────┘
  ```
  </table>

  <state_machine>
  ## State Machine

  ```
       ┌──────────┐
       │  ACTIVE  │
       └────┬─────┘
            │
       ┌────┴────┐
       ▼         ▼
  ┌────────┐ ┌────────┐
  │   OK   │ │  FAIL  │
  └────────┘ └───┬────┘
                 │
                 ▼
           ┌──────────┐
           │ COOLDOWN │
           └──────────┘
  ```
  </state_machine>
</patterns>

<tools>
## Recommended Tools

| Tool | URL | Platform | Notes |
|------|-----|----------|-------|
| ASCIIFlow | asciiflow.com | Web | Free, supports Unicode |
| Monodraw | monodraw.helftone.com | macOS | Paid, excellent quality |
| Textik | textik.com | Web | Free, ASCII only |
| Diagon | arthursonzogni.com/Diagon | Web | Multiple formats |

### Workflow

1. **Draw in tool** (ASCIIFlow recommended)
2. **Export to text**
3. **Verify character counts** in editor (CRITICAL!)
4. **Adjust right-padding** on every content line
5. **Test rendering** in target (GitHub, terminal)
6. **Commit**
</tools>

<troubleshooting>
## Common Issues

### Right Edge Floats Away from Box
**Cause**: Content lines are shorter than border
**Fix**: Add more spaces BEFORE the closing │ on each content line
**Example**:
```
Wrong:  │  Short content         │   (missing spaces before │)
Right:  │  Short content                                    │
```

### Right Edge Cuts Into Box
**Cause**: Content lines are longer than border
**Fix**: Remove content or abbreviate to fit within width
**Example**:
```
Wrong:  │  Content that is too long and overflows the border│
Right:  │  Content that fits within the border width        │
```

### Nested Boxes Misalign Outer Box
**Cause**: Inner elements don't sum to correct content width
**Fix**: Calculate: left_pad + inner_content + right_pad = content_width

### Boxes Look Broken in GitHub/Terminal
**Cause**: Font substitution - fallback font has different glyph widths
**Fix**: Use simpler characters, test in target environment

### Vertical Lines Don't Connect
**Cause**: Line height settings in some editors/terminals
**Fix**: Usually a display issue, not content issue

### Unicode Characters Not Rendering
**Cause**: Font doesn't support box drawing block
**Fix**: Use a font with full Unicode support (Fira Code, JetBrains Mono)
</troubleshooting>

<avoid>
## Avoid

| Pattern | Why |
|---------|-----|
| Width > 70 chars | Breaks in terminals, emails, GitHub |
| Not right-padding | Causes floating right edge |
| No breathing room | Content touching border looks cramped |
| Not centering flow | Looks unbalanced and unprofessional |
| Mixing with ASCII | Different character widths |
| Heavy lines (━ ┃) | Inconsistent font support |
| Double lines (║ ═) | Complex, poor support |
| Manual editing | Error-prone, use tools |
| Not counting chars | Guaranteed misalignment |
| Trusting visual only | Editor zoom/font affects display |
</avoid>

<checklist>
## Pre-Commit Checklist

- [ ] All lines in each box have IDENTICAL character count
- [ ] Content lines have right-padding before closing │
- [ ] Empty line AFTER every ┌───┐ opening (top breathing room)
- [ ] Empty line AFTER every ├───┤ divider (section breathing room)
- [ ] Empty line BEFORE every └───┘ closing (bottom breathing room)
- [ ] Empty line BEFORE every ├───┤ divider (section breathing room)
- [ ] Nested boxes have breathing room at ALL levels
- [ ] Flow content is CENTERED within parent box
- [ ] Total width ≤ 70 characters
- [ ] Tested in target rendering environment
- [ ] Nested boxes math adds up correctly
- [ ] No mixed ASCII/Unicode characters
</checklist>

<references>
## References

- [ASCIIFlow](https://asciiflow.com/) - Free web-based Unicode diagram editor
- [Box-drawing characters (Wikipedia)](https://en.wikipedia.org/wiki/Box-drawing_characters)
- [ASCII Art & Unicode — Helftone](https://blog.helftone.com/ascii-art-unicode/)
- [Box Drawing on the Web](https://velvetcache.org/2024/02/12/box-drawing-on-the-web/)
- [Unicode Box Drawing Block](https://www.unicode.org/charts/PDF/U2500.pdf)
</references>
