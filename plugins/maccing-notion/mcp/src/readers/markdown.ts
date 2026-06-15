// Light cleanup of Notion's native /markdown output for agent consumption.

const CALLOUT = /<callout(?:\s+icon="([^"]*)")?(?:\s+color="[^"]*")?>\n([\s\S]*?)\n<\/callout>/g;

/** Convert Notion callout blocks (`<callout icon="X" …>…</callout>`) to `> X …` blockquotes. */
export function normalizeCallouts(markdown: string): string {
  return markdown.replace(CALLOUT, (_match, icon: string | undefined, body: string) => {
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
