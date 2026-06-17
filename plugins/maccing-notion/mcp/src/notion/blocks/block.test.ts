// Tests for the recursive block object schema — mirrors developers.notion.com/reference/block
import { expect, test } from "bun:test";
import { block } from "./block";

// Each case: [label, input, shouldPass]
const cases: Array<[string, unknown, boolean]> = [
  [
    "paragraph",
    {
      object: "block",
      id: "abc123",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "Hello world" } }],
        color: "default",
      },
    },
    true,
  ],
  [
    "heading_1",
    {
      type: "heading_1",
      heading_1: {
        rich_text: [{ type: "text", text: { content: "Title" } }],
        color: "default",
        is_toggleable: false,
      },
    },
    true,
  ],
  [
    "heading_4 (confirmed real type)",
    {
      type: "heading_4",
      heading_4: {
        rich_text: [{ type: "text", text: { content: "Heading 4" } }],
        color: "default",
        is_toggleable: true,
      },
    },
    true,
  ],
  [
    "to_do",
    {
      type: "to_do",
      to_do: {
        rich_text: [{ type: "text", text: { content: "Buy milk" } }],
        checked: false,
        color: "default",
      },
    },
    true,
  ],
  [
    "callout with emoji icon",
    {
      type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: "Important note" } }],
        icon: { type: "emoji", emoji: "💡" },
        color: "yellow_background",
      },
    },
    true,
  ],
  [
    "code block",
    {
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: "const x = 1;" } }],
        caption: [],
        language: "javascript",
      },
    },
    true,
  ],
  [
    "image (external)",
    {
      type: "image",
      image: {
        type: "external",
        external: { url: "https://example.com/img.png" },
        caption: [],
      },
    },
    true,
  ],
  [
    "column_list with column children",
    {
      type: "column_list",
      column_list: {},
      has_children: true,
    },
    true,
  ],
  [
    "table with table_width",
    {
      type: "table",
      table: {
        table_width: 3,
        has_column_header: true,
        has_row_header: false,
      },
    },
    true,
  ],
  [
    "table_row with cells",
    {
      type: "table_row",
      table_row: {
        cells: [[{ type: "text", text: { content: "Cell 1" } }], [{ type: "text", text: { content: "Cell 2" } }]],
      },
    },
    true,
  ],
  [
    "child_database",
    {
      type: "child_database",
      child_database: { title: "My Database" },
    },
    true,
  ],
  [
    "synced_block (original — synced_from null)",
    {
      type: "synced_block",
      synced_block: { synced_from: null },
      has_children: true,
    },
    true,
  ],
  [
    "synced_block (copy — synced_from block_id)",
    {
      type: "synced_block",
      synced_block: {
        synced_from: { type: "block_id", block_id: "def456" },
      },
    },
    true,
  ],
  [
    "toggle with recursive paragraph child",
    {
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "Toggle heading" } }],
        color: "default",
        children: [
          {
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: "Inside the toggle" } }],
            },
          },
        ],
      },
    },
    true,
  ],
  [
    "tab with paragraph child",
    {
      type: "tab",
      tab: {
        children: [
          {
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: "Tab label" } }],
            },
          },
        ],
      },
    },
    true,
  ],
  [
    "meeting_notes (read-only, opaque payload)",
    {
      type: "meeting_notes",
      meeting_notes: {
        status: "notes_ready",
      },
    },
    true,
  ],
  [
    "transcription (legacy alias for meeting_notes)",
    {
      type: "transcription",
      transcription: {
        status: "transcription_in_progress",
      },
    },
    true,
  ],
  [
    "missing type — should reject",
    {
      paragraph: { rich_text: [] },
    },
    false,
  ],
];

for (const [label, input, shouldPass] of cases) {
  test(label, () => {
    const result = block.safeParse(input);

    if (shouldPass) {
      expect(result.success).toBe(true);
    } else {
      expect(result.success).toBe(false);
    }
  });
}

// Spot-check parsed values for key types
test("paragraph parsed value has correct shape", () => {
  const result = block.safeParse({
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: "Test" } }],
    },
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.type).toBe("paragraph");
    if (result.data.type === "paragraph") {
      expect(result.data.paragraph.rich_text).toHaveLength(1);
    }
  }
});

test("recursive toggle: parsed children contain paragraph", () => {
  const result = block.safeParse({
    type: "toggle",
    toggle: {
      rich_text: [{ type: "text", text: { content: "Toggle" } }],
      children: [
        {
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: "Child" } }] },
        },
      ],
    },
  });
  expect(result.success).toBe(true);
  if (result.success && result.data.type === "toggle") {
    expect(result.data.toggle.children).toHaveLength(1);
    const child = result.data.toggle.children?.[0];
    expect(child?.type).toBe("paragraph");
  }
});

test("paragraph accepts the tab-child icon (emoji or native icon)", () => {
  const emojiIcon = block.safeParse({
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: "Tab one" } }], icon: { type: "emoji", emoji: "📁" } },
  });
  expect(emojiIcon.success).toBe(true);

  const native = block.safeParse({
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: "Tab two" } }],
      icon: { type: "icon", icon: { name: "chart-mixed" } },
    },
  });
  expect(native.success).toBe(true);
});

test("numbered_list_item carries list_start_index and list_format on the first item", () => {
  const result = block.safeParse({
    type: "numbered_list_item",
    numbered_list_item: {
      rich_text: [{ type: "text", text: { content: "First" } }],
      list_start_index: 5,
      list_format: "roman",
    },
  });
  expect(result.success).toBe(true);
  if (result.success && result.data.type === "numbered_list_item") {
    expect(result.data.numbered_list_item.list_start_index).toBe(5);
    expect(result.data.numbered_list_item.list_format).toBe("roman");
  }
});
