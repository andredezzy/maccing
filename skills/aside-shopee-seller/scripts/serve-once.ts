/**
 * Hands one secret to one local fetch, then exits. It lets an `aside repl`
 * call fill a password gate while the secret stays out of the transcript
 * (`references/password-gate.md`).
 *
 * Usage: TOKEN=<random hex> [PORT=18979] 2password run --env "SECRET=op://<vault>/<item id>/password" -- bun serve-once.ts
 *
 * Serves SECRET on http://127.0.0.1:<PORT>/<TOKEN> and 404 on any other path.
 * Exits 0 after the one answer, 1 when no fetch came within 110 s, 2 when
 * SECRET or TOKEN is missing. Prints nothing.
 *
 * Needs: Bun. No packages.
 */

const secret = process.env.SECRET;
const token = process.env.TOKEN;
if (!secret || !token) {
  process.exit(2);
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 18979),
  fetch(request) {
    if (new URL(request.url).pathname !== `/${token}`) {
      return new Response("", { status: 404 });
    }
    setTimeout(() => process.exit(0), 100);
    return new Response(secret);
  },
});

setTimeout(() => {
  server.stop();
  process.exit(1);
}, 110_000);
