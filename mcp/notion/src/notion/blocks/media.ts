import { z } from "zod";
import { fileObject } from "../file";
import { blockMeta } from "./_envelope";

// image, video, audio, file, pdf all share a fileObject payload.
// fileObject already carries an optional caption on each variant, so no intersection is needed.
// Each variant gets its own z.literal so the union in block.ts can identify them.

export const image = z.object({ ...blockMeta, type: z.literal("image"), image: fileObject });

export const video = z.object({ ...blockMeta, type: z.literal("video"), video: fileObject });

export const audio = z.object({ ...blockMeta, type: z.literal("audio"), audio: fileObject });

// "file" is reserved as a JS identifier, so export as fileBlock
export const fileBlock = z.object({ ...blockMeta, type: z.literal("file"), file: fileObject });

export const pdf = z.object({ ...blockMeta, type: z.literal("pdf"), pdf: fileObject });
