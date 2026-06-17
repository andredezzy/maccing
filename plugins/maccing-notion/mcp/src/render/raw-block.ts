/** A raw Notion block with its children attached by the fetcher. Used by read_page for mockup rendering. */
export interface RawBlock {
  id?: string;
  type: string;
  has_children?: boolean;
  children?: RawBlock[];
  [key: string]: unknown;
}
