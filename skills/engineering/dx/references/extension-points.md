# Extension points — discoverability, open/closed, consistency

## Discoverability

Extension points must be obvious. Listing a directory or following a definition should reveal where a new case is meant to be added; a reader should never have to already know the codebase to find the seam. A directory of handlers with one file per case IS the documentation of "add yours here".

## Open/closed on extension

Adding a new case should mean creating a new file and a single point of registration — never editing a conditional that is buried inside a file that keeps growing with every case. The growing dispatch block is the failure: each addition raises the cost of the next one and buries the seam deeper.

## Consistency of mental model

If one pluggable concern uses a given pattern, every pluggable concern should use that same pattern. One thing to learn, applied everywhere, beats several locally-optimal but mutually different approaches.

## Self-documenting architecture

Structure is the documentation: an interface together with its list of implementations replaces prose docs, file names replace comments, and following definitions is the intended reading path. Design so that this reading path exists.

## The registry recipe — and when NOT to use it

The judgment (also in SKILL.md): a registry earns its place when it makes the next case cheaper AND the current code simpler to read. Two or three short branches usually stay a conditional; five cases with real bodies usually don't. State the judgment either way — extending by pattern-matching without evaluating the seam is the failure.

Before, a growing conditional (fine at 2–3 log lines, failing as bodies grow):

```ts
export function sendNotification(channel: Channel, to: string, message: string) {
  if (channel === "email") { /* … */ }
  else if (channel === "sms") { /* … */ }
  else if (channel === "push") { /* … */ }
  else if (channel === "whatsapp") { /* … */ } // every new channel edits this file
}
```

After, one file per channel plus a single registration:

```ts
// channels/whatsapp.ts — a new channel is a new file…
export const whatsapp: ChannelHandler = (to, message) =>
  console.log(`[whatsapp] to=${to} body=wa:${message}`);

// channels/registry.ts — …plus one registration line.
import { email } from "./email";
import { sms } from "./sms";
import { push } from "./push";
import { whatsapp } from "./whatsapp";

export const channels = { email, sms, push, whatsapp } satisfies Record<Channel, ChannelHandler>;

// notifier.ts — dispatch never changes again.
export function sendNotification(channel: Channel, to: string, message: string) {
  channels[channel](to, message);
}
```

The registry version is worth it exactly when the handler bodies are real work, the case count keeps growing, or several people add channels independently. For three one-line console.logs, the conditional was simpler — and saying so is the skill.
