# ASCII Box Drawing Patterns

<rules>
## Rules

| Rule | Description |
|------|-------------|
| Fixed width | Every line must have identical character count |
| Under 80 chars | Keep diagrams under 80 characters for compatibility |
| Count characters | Manually count to ensure alignment |
| Monospace only | Only renders correctly in monospace fonts |
| Test rendering | Verify in target environment (editor, terminal, docs) |
</rules>

<characters>
## Box Drawing Characters

```
Corners:     ┌ ┐ └ ┘
Lines:       ─ │
T-junctions: ├ ┤ ┬ ┴
Cross:       ┼
Arrows:      ← → ↑ ↓ ▲ ▼ ◄ ►
```

| Character | Unicode | Use |
|-----------|---------|-----|
| `┌` | U+250C | Top-left corner |
| `┐` | U+2510 | Top-right corner |
| `└` | U+2514 | Bottom-left corner |
| `┘` | U+2518 | Bottom-right corner |
| `─` | U+2500 | Horizontal line |
| `│` | U+2502 | Vertical line |
| `├` | U+251C | Left T-junction |
| `┤` | U+2524 | Right T-junction |
| `┬` | U+252C | Top T-junction |
| `┴` | U+2534 | Bottom T-junction |
| `┼` | U+253C | Cross junction |
</characters>

<patterns>
  <box>
  ## Simple Box (width = 40)

  ```
  ┌──────────────────────────────────────┐
  │              TITLE                   │
  ├──────────────────────────────────────┤
  │  Content here                        │
  │  More content                        │
  └──────────────────────────────────────┘
  ```

  Count: `┌` + 38×`─` + `┐` = 40 chars
  </box>

  <nested>
  ## Nested Boxes

  ```
  ┌────────────────────────────────────────────────┐
  │                   OUTER                        │
  │                                                │
  │  ┌──────────────┐  ┌──────────────┐            │
  │  │    Inner 1   │  │    Inner 2   │            │
  │  └──────────────┘  └──────────────┘            │
  │                                                │
  └────────────────────────────────────────────────┘
  ```

  Spacing: 2 spaces between inner boxes
  Padding: 2 spaces from outer edge
  </nested>

  <flow>
  ## Flow Diagram

  ```
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │  Step 1 │────►│  Step 2 │────►│  Step 3 │
  └─────────┘     └─────────┘     └─────────┘
  ```

  Arrow connector: `─` + `─` + `─` + `─` + `►`
  </flow>

  <vertical>
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

  Center the `│` and `▼` under the box
  </vertical>

  <tree>
  ## Directory Tree

  ```
  project/
  ├── src/
  │   ├── index.ts
  │   └── utils/
  │       └── helper.ts
  └── package.json
  ```

  Use `├──` for items, `└──` for last item
  Use `│   ` for continuation
  </tree>
</patterns>

<alignment>
## Alignment Technique

1. **Define width first**: Pick total width (e.g., 78)
2. **Build outer box**: `┌` + (width-2)×`─` + `┐`
3. **Content lines**: `│` + (width-2)×content + `│`
4. **Verify**: Count every line matches

<wrong>
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        TITLE                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```
Lines have different lengths (broken)
</wrong>

<correct>
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                  TITLE                                   │
└──────────────────────────────────────────────────────────────────────────┘
```
All lines = 76 characters
</correct>
</alignment>

<tools>
## Recommended Tools

| Tool | URL | Notes |
|------|-----|-------|
| ASCIIFlow | asciiflow.com | Web-based, exports text |
| MonoSketch | monocraft.io | Free, open source |
| Mermaid | mermaidjs.github.io | Alternative: text-to-diagram |
</tools>

<avoid>
## Avoid

| Pattern | Why |
|---------|-----|
| Width > 80 | Breaks in terminals, emails, diffs |
| Mixed character sets | Some chars have different widths |
| Proportional fonts | Alignment breaks |
| Manual editing without counting | Leads to misalignment |
| Complex nested structures | Hard to maintain |
</avoid>

<references>
## References

- [Box-drawing characters (Wikipedia)](https://en.wikipedia.org/wiki/Box-drawing_character)
- [ASCII Diagrams GitHub](https://gist.github.com/dsample/79a97f38bf956f37a0f99ace9df367b9)
- [Taking ASCII Drawings Seriously (CHI 2024)](https://dl.acm.org/doi/full/10.1145/3613904.3642683)
</references>
