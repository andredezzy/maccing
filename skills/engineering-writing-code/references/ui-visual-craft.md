# Visual craft — making a surface feel finished

Composition (ui.md) gets the structure right; this is the polish an operator notices by eye. Working is not done. Every rule here traces to an observed failure.

## Spacing breathes

Content needs a breath of space from its edges and from the section above it. The observed failure is a header sitting flush against the content below it — "missing a breath space from content to the header". Use the design system's spacing scale, not hand-picked pixels; when two groups mean different things, the gap between them is what says so.

## Every action gives feedback

An action with no visible response reads as broken. The observed failure is a control that does nothing the instant it is clicked — "nothing happens, no visual feedback, bad ux". Every interactive element acknowledges: a pressed/hover/focus state, a spinner or optimistic update while in flight, a toast or a state change when done. Nothing silent.

## Motion with intent

Reveal and reposition are transitions, not jumps. The observed failure is content that snaps into place — a button that should "re-center when appear, with transition". Animate entrance, position, and state change; keep it short; gate it behind `prefers-reduced-motion`. Motion serves orientation, never decoration — extra animation is how a design starts to feel generated.

## Restraint on effects

Less shadow, less chrome. The observed failure is a shadow doing too much — "decrease the shadow", "I dont want shadow over the inputs". Shadows, borders, and rings earn their weight; default to the lightest that still reads. Elegance is what you leave out.

## Reviewed by eye

Before a rendered surface is called finished, look at it: is it centered where it should be, does it breathe, does every control respond, does nothing shout. "pretty, beautiful and readable" is the bar for CLI output and generated docs too, not only screens — a report or a `--help` block gets the same eye.
