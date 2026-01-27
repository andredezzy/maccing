# Breathing Room Rules

Whitespace management for readable box diagrams.

---

## spacing-breathing-room: Empty Lines at Borders

**Priority**: HIGH

Always add empty lines AFTER every opening `┌───┐` or divider `├───┤` AND BEFORE every closing `└───┘` or divider `├───┤`.

### Why

Creates visual separation, makes the box feel less cramped, improves readability.

### Wrong

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

Content touches borders directly, looks cramped.

### Correct

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

Empty lines provide visual breathing room.

### Pattern

- After every `┌───┐`: add empty line
- After every `├───┤`: add empty line
- Before every `├───┤`: add empty line
- Before every `└───┘`: add empty line

---

## spacing-nested-breathing: Nested Box Breathing Room

**Priority**: HIGH

Apply breathing room at ALL nesting levels.

### Wrong

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

Missing breathing room after opening borders.

### Correct

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

Every level has breathing room AFTER `┌` AND BEFORE `└`.
