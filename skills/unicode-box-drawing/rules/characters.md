# Character Rules

Unicode box drawing character selection and consistency.

---

## chars-single-set: Single Character Set

**Priority**: MEDIUM

Never mix Unicode box characters with ASCII characters on the same line.

### Why

Unicode and ASCII characters have different widths in some fonts, causing misalignment.

### Wrong

```
+-------------------+
|  Mixed with ASCII |
└───────────────────┘
```

Mixing `+` and `-` (ASCII) with `└` and `─` (Unicode).

### Correct

```
┌───────────────────┐
│  Pure Unicode     │
└───────────────────┘
```

Or pure ASCII:

```
+-------------------+
|  Pure ASCII       |
+-------------------+
```

---

## chars-light-lines: Use Light Lines

**Priority**: MEDIUM

Use light box drawing characters for best compatibility.

### Recommended: Light Lines

```
Corners:     ┌ ┐ └ ┘
Lines:       ─ │
T-junctions: ├ ┤ ┬ ┴
Cross:       ┼
```

### Avoid: Heavy Lines

```
Heavy:       ┏ ┓ ┗ ┛ ━ ┃
```

Heavy lines have inconsistent font support.

### Avoid: Double Lines

```
Double:      ╔ ╗ ╚ ╝ ═ ║
```

Double lines are complex and poorly supported.

---

## chars-monospace: Monospace Requirement

**Priority**: MEDIUM

Box drawing only renders correctly in monospace fonts.

### Supported Fonts

| Font | Box Drawing Support |
|------|---------------------|
| Fira Code | Excellent |
| JetBrains Mono | Excellent |
| Cascadia Code | Excellent |
| Monaco | Good |
| Consolas | Good |
| Courier New | Basic |

### Verification

Test in your target environment before committing. Common rendering contexts:
- Terminal emulators
- GitHub markdown
- IDE code editors
- Documentation sites

---

## Character Reference Table

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

### Arrow Characters

| Character | Unicode | Name |
|-----------|---------|------|
| `→` | U+2192 | Rightwards Arrow |
| `←` | U+2190 | Leftwards Arrow |
| `↓` | U+2193 | Downwards Arrow |
| `↑` | U+2191 | Upwards Arrow |
| `▶` | U+25B6 | Black Right-Pointing Triangle |
| `◀` | U+25C0 | Black Left-Pointing Triangle |
| `▼` | U+25BC | Black Down-Pointing Triangle |
| `▲` | U+25B2 | Black Up-Pointing Triangle |
