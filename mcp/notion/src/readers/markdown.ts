// Light cleanup of Notion's native /markdown output for agent consumption.

// Match the whole open tag's attributes (any order: icon/color, either first, plus any others), then
// pull `icon` out of them — Notion emits icon-first, but a color-first tag must normalize identically.
const CALLOUT = /<callout([^>]*)>\n?([\s\S]*?)\n?<\/callout>/g;

/** Convert Notion callout blocks (`<callout icon="X" …>…</callout>`) to `> X …` blockquotes. */
export function normalizeCallouts(markdown: string): string {
  return markdown.replace(CALLOUT, (_match, attributes: string, body: string) => {
    const icon = /icon="([^"]*)"/.exec(attributes)?.[1];
    const lines = body.split("\n").map((line) => line.replace(/^\t/, ""));
    if (icon) {
      lines[0] = `${icon} ${lines[0]}`;
    }
    return lines.map((line) => `> ${line}`).join("\n");
  });
}

/** Shape of the Notion /v1/pages/{id}/markdown endpoint response. */
export interface NotionMarkdownResponse {
  markdown?: string;
  unknown_block_ids?: string[];
}
