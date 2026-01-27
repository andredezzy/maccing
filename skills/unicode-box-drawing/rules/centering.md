# Centering Rules

Layout alignment for nested content and flow diagrams.

---

## layout-centering: Center Flow Content

**Priority**: HIGH

ALWAYS center nested boxes and flow diagrams within the parent box.

### Why

Uncentered content looks unbalanced and unprofessional.

### Wrong

```
┌───────────────────────────────────────────────────────────────┐
│   ┌───────────┐      ┌───────────┐      ┌───────────────┐     │
│   │  Step 1   │─────▶│  Step 2   │─────▶│    Step 3     │     │
│   └───────────┘      └───────────┘      └───────────────┘     │
└───────────────────────────────────────────────────────────────┘
```

Uneven padding: 3 spaces left, 5 spaces right.

### Correct

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│    ┌───────────┐      ┌───────────┐      ┌───────────────┐    │
│    │  Step 1   │─────▶│  Step 2   │─────▶│    Step 3     │    │
│    └───────────┘      └───────────┘      └───────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Equal padding: 4 spaces on each side.

### Centering Technique

1. Calculate total width of inner content (boxes + arrows + spaces between)
2. Calculate remaining space: content_width - inner_content_width
3. Divide remaining by 2 for left padding
4. Apply equal padding on both sides

### Title Centering

Titles should also be centered within the box.

```
┌───────────────────────────────────────────────────────────────┐
│                         TITLE                                 │
├───────────────────────────────────────────────────────────────┤
```

Count characters before and after "TITLE" to ensure equal spacing.

---

## layout-width-limit: Maximum Width

**Priority**: HIGH

Keep diagrams under 70 characters for compatibility.

### Why

- Terminal default width: 80 characters
- GitHub code blocks: ~80 characters
- Email clients: often wrap at 72 characters
- Indented code: loses 4-8 characters

### Safe Widths

| Context | Max Width |
|---------|-----------|
| Root level documentation | 70 chars |
| Indented in code comments | 60 chars |
| Deeply nested | 50 chars |

### Verification

Use editor column markers or the visual ruler:

```
         1         2         3         4         5         6         7
1234567890123456789012345678901234567890123456789012345678901234567890
┌────────────────────────────────────────────────────────────────────┐
│  This box is exactly 70 characters wide                           │
└────────────────────────────────────────────────────────────────────┘
```
