import { z } from "zod";
import { blockMeta } from "./_envelope";

// meeting_notes (API 2026-03-11+) and its legacy alias transcription are read-only AI meeting-notes blocks.
// Fields include status, title, children refs (summary/notes/transcript block IDs), calendar_event, and recording.
// The internal payload is opaque to the renderer, so it is modeled as a passthrough record.
export const meetingNotes = z.object({
  ...blockMeta,
  type: z.literal("meeting_notes"),
  meeting_notes: z.record(z.string(), z.unknown()),
});

// transcription is the legacy name for meeting_notes (used in API versions before 2026-03-11).
export const transcription = z.object({
  ...blockMeta,
  type: z.literal("transcription"),
  transcription: z.record(z.string(), z.unknown()),
});
