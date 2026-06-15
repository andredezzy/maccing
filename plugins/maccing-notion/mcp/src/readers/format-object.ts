// Pure formatter for a Notion object's icon/cover field — the public `.icon`/`.cover` shapes
// (emoji, named icon, external/file url, or null). Used by `describe` to show a page's or database's
// own icon (these ARE public, unlike property/column icons). No API calls.

interface NotionNamedIconRef {
  name?: string;
  color?: string;
}

export interface NotionIcon {
  type?: string;
  emoji?: string;
  icon?: NotionNamedIconRef;
  external?: { url?: string };
  file?: { url?: string };
}

/** "💰" | "chart-mixed·gray" | "https://…" | "none". */
export function iconLabel(icon: NotionIcon | null | undefined): string {
  if (!icon) {
    return "none";
  }
  switch (icon.type) {
    case "emoji":
      return icon.emoji ?? "none";
    case "icon": {
      const name = icon.icon?.name;
      if (!name) {
        return "none";
      }
      const color = icon.icon?.color;
      return color && color !== "default" ? `${name}·${color}` : name;
    }
    case "external":
      return icon.external?.url ?? "none";
    case "file":
      return icon.file?.url ?? "none";
    default:
      return "none";
  }
}

/** Map a Notion icon to a compact string for the render model: emoji, named-icon name, or 🖼 for any
 * image (external/file/custom). Distinct from `iconLabel`, which returns 'none'/urls for the `describe` tool. */
export function iconToString(icon: NotionIcon | null | undefined): string | undefined {
  if (!icon) {
    return undefined;
  }
  if (icon.type === "emoji") {
    return icon.emoji;
  }
  if (icon.type === "icon") {
    return icon.icon?.name;
  }
  return icon.type ? "🖼" : undefined; // external/file/custom image icon
}
