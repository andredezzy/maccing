import { z } from "zod";
import { block } from "./blocks/block";
import { dataSource } from "./data-source";
import { database } from "./database";
import { page } from "./page";
import { view } from "./view";

// A page's visual = the page object + its block tree (the API returns them via separate calls).
export const pageRender = z.object({ page, blocks: z.array(block) });
export type PageRender = z.infer<typeof pageRender>;

// A database's visual = the wrapper + its data source schema + its views + sampled rows.
export const databaseRender = z.object({
  database,
  dataSource,
  views: z.array(view),
  rows: z.array(page),
});
export type DatabaseRender = z.infer<typeof databaseRender>;
