// Shared Notion block-children API shapes — used by read-page.ts and read-agents-md.ts.

export interface NotionChildBlock {
  id: string;
  type: string;
  has_children?: boolean;
  child_page?: { title?: string };
  child_database?: { title?: string };
  [key: string]: unknown;
}

export interface NotionChildrenResponse {
  results?: NotionChildBlock[];
  has_more?: boolean;
  next_cursor?: string | null;
}
