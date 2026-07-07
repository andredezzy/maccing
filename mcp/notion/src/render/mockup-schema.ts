// Canon-based mockup schema for the render_mockup tool. Accepts the three official API shapes:
//   • PageRender  — { page: PageObject, blocks: BlockObject[] }
//   • BlockObject — any single official Notion block
//   • BlockObject[] — an array of official Notion blocks
//   • DatabaseRender — { database, dataSource, views, rows }
//
// The old simplified `database` inline-block shape (DatabaseModel / DatabaseView) is no longer accepted
// here — render_mockup now takes official API objects directly.

import { z } from "zod";
import { block } from "../notion/blocks/block";
import { databaseRender, pageRender } from "../notion/render-bundles";

export const mockupSchema = z.union([pageRender, databaseRender, block, z.array(block)]);
