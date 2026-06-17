// Assembles the recursive block union. This is the ONLY file that imports all member schemas —
// member files never value-import this file, so the runtime import graph stays acyclic.
// z.union is required here; z.discriminatedUnion does not type-check inside z.lazy with
// a z.ZodType<BlockObject> annotation in zod v4.
import { z } from "zod";
import type { Icon } from "../file";
import type { ParentRef } from "../parent";
import type { RichTextObject } from "../rich-text";
import type { UserObject } from "../user";
import { bookmark, embed, linkPreview } from "./bookmark";
import { breadcrumb } from "./breadcrumb";
import { callout } from "./callout";
import { childDatabase, childPage } from "./child-page";
import { code } from "./code";
import { column, columnList } from "./column";
import { divider } from "./divider";
import { equation } from "./equation";
import { heading1, heading2, heading3, heading4 } from "./heading";
import { linkToPage } from "./link-to-page";
import { bulletedListItem, numberedListItem } from "./list-item";
import { audio, fileBlock, image, pdf, video } from "./media";
import { meetingNotes, transcription } from "./meeting-notes";
import { paragraph } from "./paragraph";
import { quote } from "./quote";
import { syncedBlock } from "./synced-block";
import { tab } from "./tab";
import { table, tableRow } from "./table";
import { tableOfContents } from "./table-of-contents";
import { template } from "./template";
import { toDo } from "./to-do";
import { toggle } from "./toggle";
import { unsupported } from "./unsupported";

interface BlockBase {
  object?: "block";
  id?: string;
  parent?: ParentRef;
  created_time?: string;
  last_edited_time?: string;
  created_by?: UserObject;
  last_edited_by?: UserObject;
  has_children?: boolean;
  archived?: boolean;
  in_trash?: boolean;
}

export type BlockObject = BlockBase &
  (
    | {
        type: "paragraph";
        paragraph: { rich_text: RichTextObject[]; color?: string; icon?: Icon | null; children?: BlockObject[] };
      }
    | {
        type: "heading_1";
        heading_1: {
          rich_text: RichTextObject[];
          color?: string;
          is_toggleable?: boolean;
          children?: BlockObject[];
        };
      }
    | {
        type: "heading_2";
        heading_2: {
          rich_text: RichTextObject[];
          color?: string;
          is_toggleable?: boolean;
          children?: BlockObject[];
        };
      }
    | {
        type: "heading_3";
        heading_3: {
          rich_text: RichTextObject[];
          color?: string;
          is_toggleable?: boolean;
          children?: BlockObject[];
        };
      }
    | {
        type: "heading_4";
        heading_4: {
          rich_text: RichTextObject[];
          color?: string;
          is_toggleable?: boolean;
          children?: BlockObject[];
        };
      }
    | {
        type: "bulleted_list_item";
        bulleted_list_item: { rich_text: RichTextObject[]; color?: string; children?: BlockObject[] };
      }
    | {
        type: "numbered_list_item";
        numbered_list_item: {
          rich_text: RichTextObject[];
          color?: string;
          list_start_index?: number;
          list_format?: "numbers" | "letters" | "roman";
          children?: BlockObject[];
        };
      }
    | {
        type: "to_do";
        to_do: { rich_text: RichTextObject[]; checked?: boolean; color?: string; children?: BlockObject[] };
      }
    | {
        type: "toggle";
        toggle: { rich_text: RichTextObject[]; color?: string; children?: BlockObject[] };
      }
    | {
        type: "quote";
        quote: { rich_text: RichTextObject[]; color?: string; children?: BlockObject[] };
      }
    | {
        type: "callout";
        callout: { rich_text: RichTextObject[]; icon?: Icon; color?: string; children?: BlockObject[] };
      }
    | { type: "divider"; divider: Record<string, unknown> }
    | { type: "code"; code: { rich_text: RichTextObject[]; caption?: RichTextObject[]; language: string } }
    | { type: "equation"; equation: { expression: string } }
    | { type: "image"; [k: string]: unknown }
    | { type: "video"; [k: string]: unknown }
    | { type: "audio"; [k: string]: unknown }
    | { type: "file"; [k: string]: unknown }
    | { type: "pdf"; [k: string]: unknown }
    | { type: "bookmark"; bookmark: { url: string; caption?: RichTextObject[] } }
    | { type: "link_preview"; link_preview: { url: string } }
    | { type: "embed"; embed: { url: string } }
    | { type: "column_list"; column_list: Record<string, unknown>; [k: string]: unknown }
    | { type: "column"; column: { width_ratio?: number; children?: BlockObject[] } }
    | {
        type: "table";
        table: {
          table_width: number;
          has_column_header?: boolean;
          has_row_header?: boolean;
          children?: BlockObject[];
        };
      }
    | { type: "table_row"; table_row: { cells: RichTextObject[][] } }
    | { type: "breadcrumb"; breadcrumb: Record<string, unknown> }
    | { type: "table_of_contents"; table_of_contents: { color?: string } }
    | {
        type: "synced_block";
        synced_block: {
          synced_from: { type: "block_id"; block_id: string } | null;
          children?: BlockObject[];
        };
      }
    | { type: "child_page"; child_page: { title: string } }
    | { type: "child_database"; child_database: { title: string } }
    | { type: "link_to_page"; [k: string]: unknown }
    | { type: "template"; template: { rich_text: RichTextObject[]; children?: BlockObject[] } }
    | { type: "tab"; tab: { children?: BlockObject[] } & Record<string, unknown> }
    | { type: "meeting_notes"; meeting_notes: Record<string, unknown> }
    | { type: "transcription"; transcription: Record<string, unknown> }
    | { type: "unsupported"; [k: string]: unknown }
  );

// z.lazy breaks the self-reference; z.ZodType<BlockObject> annotation catches schema/type drift
// at compile time. Member factories receive `block` as their blockChild argument.
export const block: z.ZodType<BlockObject> = z.lazy(() =>
  z.union([
    paragraph(block),
    heading1(block),
    heading2(block),
    heading3(block),
    heading4(block),
    bulletedListItem(block),
    numberedListItem(block),
    toDo(block),
    toggle(block),
    quote(block),
    callout(block),
    divider,
    code,
    equation,
    image,
    video,
    audio,
    fileBlock,
    pdf,
    bookmark,
    linkPreview,
    embed,
    columnList(block),
    column(block),
    table(block),
    tableRow,
    breadcrumb,
    tableOfContents,
    syncedBlock(block),
    childPage,
    childDatabase,
    linkToPage,
    template(block),
    tab(block),
    meetingNotes,
    transcription,
    unsupported,
  ]),
);
