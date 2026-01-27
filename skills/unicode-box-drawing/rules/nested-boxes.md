# Nested Box Rules

Mathematical calculations for boxes within boxes.

---

## layout-nested-math: Nested Box Calculations

**Priority**: HIGH

When placing boxes inside boxes, the math must add up exactly.

### Formula

```
left_pad + inner_boxes_with_arrows + right_pad = content_width
```

### Example Breakdown

For a 65-character outer box (63 content chars):

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   ┌───────────┐      ┌───────────┐      ┌─────────────────┐   │
│   │ Inner 1   │─────▶│ Inner 2   │─────▶│ Inner 3         │   │
│   └───────────┘      └───────────┘      └─────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Content breakdown (63 chars between outer │):

```
│ + 3 spaces + inner1(13) + 6 spaces + inner2(13) + 6 spaces + inner3(19) + 3 spaces + │
  = 3 + 13 + 6 + 13 + 6 + 19 + 3 = 63 ✓
```

### Step-by-Step Process

1. **Determine outer box content width**: outer_width - 2
2. **Design inner content**: boxes, arrows, spaces
3. **Calculate inner content width**: sum all elements
4. **Calculate remaining space**: content_width - inner_width
5. **Divide for padding**: remaining / 2 = left_pad = right_pad
6. **Verify**: left_pad + inner + right_pad = content_width

### Common Arrow Widths

| Arrow Type | Characters | Width |
|------------|------------|-------|
| Simple | `─────▶` | 6 |
| Short | `──▶` | 3 |
| Long | `────────▶` | 9 |
| Labeled | `──[label]──▶` | varies |

### Verification Checklist

- [ ] Outer box lines all same length
- [ ] Inner boxes fit within outer content width
- [ ] Padding is equal on left and right
- [ ] All inner box lines same length
- [ ] Arrows connect properly

---

## Vertical Nesting

For vertically nested structures, maintain consistent widths.

### Example

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                        Parent                           │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │                                                         │   │
│   │   ┌─────────────────────────────────────────────────┐   │   │
│   │   │                    Child                        │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Each nesting level reduces content width by:
- 2 chars for outer │ borders
- 2 chars for padding (1 each side minimum)
- Total: ~4 chars per level
