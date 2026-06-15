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
