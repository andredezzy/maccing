// The render contract — every block & view shape the mockup renderer accepts (discriminated unions).
// Pure types; the zod mirror lives in ./schema.ts. No imports.

// ── model ───────────────────────────────────────────────────────────────────
export interface GalleryCard {
  icon?: string;
  name: string;
  lines?: string[];
}
export interface BoardGroup {
  name: string;
  cards: GalleryCard[];
  total?: number; // true card count when `cards` is capped (a "+N more" tail card stands in for the rest)
}
export interface ListItem {
  icon?: string;
  title: string;
  meta?: string;
}
export interface ColumnDef {
  ratio?: number;
  children: MockupBlock[];
}

export type MockupBlock =
  | { type: "paragraph"; text?: string; children?: MockupBlock[] }
  | { type: "heading"; text: string } // legacy: bare heading
  | { type: "heading_1" | "heading_2" | "heading_3"; text: string; toggle?: boolean; children?: MockupBlock[] }
  | { type: "bulleted_list_item"; text: string; children?: MockupBlock[] }
  | { type: "numbered_list_item"; text: string; children?: MockupBlock[] }
  | { type: "to_do"; text: string; checked?: boolean; children?: MockupBlock[] }
  | { type: "toggle"; text: string; children?: MockupBlock[] }
  | { type: "quote"; text: string; children?: MockupBlock[] }
  | { type: "callout"; icon?: string; lines: string[]; children?: MockupBlock[] }
  | { type: "divider" }
  | { type: "code"; language?: string; text: string; caption?: string }
  | { type: "equation"; expression: string }
  | { type: "image" | "video" | "audio" | "file" | "pdf"; url?: string; name?: string; caption?: string }
  | { type: "bookmark" | "link_preview"; url: string; caption?: string }
  | { type: "embed"; label: string }
  | { type: "column_list"; columns: ColumnDef[] }
  | { type: "simple_table"; rows: string[][]; hasColumnHeader?: boolean }
  | { type: "breadcrumb"; path?: string[] }
  | { type: "table_of_contents"; headings?: string[] }
  | { type: "synced_block"; from?: string; children?: MockupBlock[] }
  | { type: "page_link"; icon?: string; title: string; note?: string }
  | { type: "database"; database: DatabaseModel }
  | TableBlock
  | GalleryBlock
  | BoardBlock
  | ListViewBlock
  | CalendarBlock
  | TimelineBlock
  | ChartBlock
  | FormBlock
  | MapBlock
  | DashboardBlock
  | { type: "unsupported"; label?: string };

export interface TableBlock {
  type: "table";
  name: string;
  views?: string[];
  columns: string[];
  rows: string[][];
}
export interface GalleryBlock {
  type: "gallery";
  name: string;
  views?: string[];
  cardSize?: "small" | "medium";
  cards: GalleryCard[];
}
export interface BoardBlock {
  type: "board";
  name: string;
  views?: string[];
  groups: BoardGroup[];
}
export interface ListViewBlock {
  type: "list";
  name: string;
  views?: string[];
  items: ListItem[];
}
export interface CalendarEvent {
  day: number;
  title: string;
}
export interface CalendarBlock {
  type: "calendar";
  name: string;
  views?: string[];
  year: number;
  month: number; // 1-12
  events?: CalendarEvent[];
}
export interface TimelineRow {
  label: string;
  start: number; // fraction 0-1 of the axis
  end: number; // fraction 0-1
}
export interface TimelineBlock {
  type: "timeline";
  name: string;
  views?: string[];
  axis?: string;
  rows: TimelineRow[];
}
export interface ChartDatum {
  label: string;
  value: number;
}
export interface ChartBlock {
  type: "chart";
  name: string;
  views?: string[];
  chartType: "bar" | "line" | "donut" | "number";
  data?: ChartDatum[];
  value?: string; // for chartType "number"
  unit?: string;
}
export interface FormField {
  label: string;
  fieldType?: string; // text | checkbox | select | date | person | number
}
export interface FormBlock {
  type: "form";
  name: string;
  views?: string[];
  fields: FormField[];
}
export interface MapBlock {
  type: "map";
  name: string;
  views?: string[];
  pins?: number;
}
export interface DashboardWidget {
  title: string;
  view: MockupBlock;
}
export interface DashboardBlock {
  type: "dashboard";
  name: string;
  views?: string[];
  widgets: DashboardWidget[];
}
export type ViewBlock =
  | TableBlock
  | GalleryBlock
  | BoardBlock
  | ListViewBlock
  | CalendarBlock
  | TimelineBlock
  | ChartBlock
  | FormBlock
  | MapBlock
  | DashboardBlock;

export interface PageModel {
  title: string;
  icon?: string;
  cover?: string;
  description?: string;
  width?: number;
  blocks: MockupBlock[];
}
/** A database rendered on its own (standalone): a header + one or more view blocks. */
export interface DatabaseModel {
  title: string;
  icon?: string;
  description?: string;
  width?: number;
  views: ViewBlock[];
  /** which view to render: an index, or "all" for every view stacked. Default 0. */
  view?: number | "all";
}
