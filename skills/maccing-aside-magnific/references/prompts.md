# Writing the prompt

What prompt wording did to images in real runs. Models differ and change: treat each point as something to check on the model you use, and look at every result before you report it.

## Say what is there

- **Keep measurements out.** A size written in the prompt, such as "12 cm tall", can come back printed in the image as a caption. Show scale with things instead: a hand, a mug, a book.
- **Name what fills the scene, not what to keep out of it.** "No filament spool" put a spool in the picture. Describe what belongs in that space ("a plain linen backdrop", "an empty wooden desk").
- **Name the colour of each piece; name no colour to avoid.** A colour named to exclude came back: "no green, no pink, no purple" gave a green shoe and a purple one, and "no gold bear" gave a gold bear. Naming the wanted colour for each piece by its position, with no negation, gave only those colours.
- **Crop by naming what the frame cuts off.** With a reference image attached, "macro close-up filling the frame" still showed the whole object with space around it. Stating what falls outside the frame ("the base and the top of the head are cut off by the frame edges") gave the tight crop.
- **Plain walls and shelves need saying.** Scenes with walls or shelves filled up with framed pictures and invented text on book spines. Ask for "no framed pictures" and "plain book spines". Those two held, unlike the spool above and the text below. Why some negations hold and others backfire is not known.
- **Call the product plain instead of banning print on it.** A closing line "No text, no logos, no watermark" twice put printed text on the product itself. "A plain, undecorated plastic miniature" stopped it in every later image.

## Dated examples (not rules)

- 2026-09-24: two product-photo runs, with a reference image of the object attached, found every point above except the colours and the print. The models used are not recorded here.
- 2026-09-26: the colour point, on Google Nano Banana 2.
- 2026-09-27: the print point. The two failures were a white sneaker with lettering on it and a heart with gold "LOVE & PEACE" on it.
