// Feed view renderer — single-column scrollable stack of page-preview cards.

import { box } from "../../../box";
import { clip } from "../../../text";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

interface FeedPost {
  icon?: string;
  title: string;
  preview?: string;
  meta?: string;
}

export interface FeedBlock {
  type: "feed";
  name: string;
  views?: string[];
  posts: FeedPost[];
}

registerView("feed", (block: FeedBlock, width: number) => {
  const lines = [databaseHeader(block.name, block.views, width)];

  if (block.posts.length === 0) {
    return [...lines, ...box(["(empty)"], width - 2)];
  }

  for (const post of block.posts) {
    const head = clip(`${post.icon ? `${post.icon} ` : ""}${post.title}`, width - 4);
    const body = [
      head,
      ...(post.preview ? [clip(post.preview, width - 4)] : []),
      ...(post.meta ? [clip(post.meta, width - 4)] : []),
    ];
    lines.push(...box(body, width - 2));
  }

  return lines;
});
