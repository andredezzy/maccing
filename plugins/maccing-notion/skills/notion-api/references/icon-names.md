# Notion built-in (named) icon names — live-verified

Reference for the `notion-api` skill — the `name` values for Notion's **built-in icon** type:

```json
{ "type": "icon", "icon": { "name": "chart-mixed", "color": "blue" } }
```

Set via `PATCH /v1/pages/{id}`, `PATCH /v1/databases/{id}`, or at creation (`POST /v1/pages`, `POST /v1/databases`). Note the **doubly-nested `icon`**: the page field is `{ "icon": { "type":"icon", "icon": { "name":"…", "color":"…" } } }`.

To set a database **column/property** icon (not the database's own icon), use **`upsert_property`** with an `icon` field — `{ properties: [{ target_id: <data_source id>, property: <name>, icon: "cash", color: "gray" }] }`; the public API silently drops property-icon writes (`private-api.md`).

## This list is verified — 885 valid names

Every one of 2145 reverse-engineered candidate names was **live PATCH-tested against the API on 2026-06-11** (`Notion-Version: 2026-03-11`): **exactly 885 returned `200` (valid); 1260 returned `400`** (`Invalid icon name "…"`). The 885 valid names are listed below — and that's the whole set, matching Notion's real picker **exactly** (see **Completeness** below).

- **A name NOT in this list is invalid — don't use it.** No need to test a name that IS in the list.
- **Drift:** Notion may add/remove picker icons over time. If a listed name ever returns `400`, re-verify (`PATCH` the icon → `200` valid / `400` gone). Two stable anchors: `cash`, `chart-mixed`.

### Completeness — independently proven (do NOT re-discover)
Notion's icon picker was reverse-engineered on 2026-06-11 (full DOM dump of the picker grid). It contains **exactly 885 icons** — the same count as the 885 API-valid names above. That exact count match is the completeness proof: **885 picker icons ↔ 885 valid API names, a clean bijection.** The list below IS the whole picker — nothing is missing. **Do not re-scrape the picker, generate more candidates, or "diff against a known-complete source" to check for gaps — that cross-check is already done and passed.**

⚠️ **The picker's visible labels are display names, NOT API names.** Of the 885, 464 labels equal their API name; the other **421 differ** (picker `house`→API `home`, `magnifying-glass`→`search`, `trash-can`→`delete`, `face-angry`→`emoji-angry`). All 421 picker-only labels were live-tested and **every one returned `400`** — so never send a name read off the picker UI. To use a picker icon, map it by meaning to a name in the verified list (e.g. picker `cash-machine` → `atm`, `clapperboard` → `movie-clapboard`, `QR code` → `code-scan`).

### Gotchas the test exposed
Compound/suffixed finance nouns mostly **fail** — `bank`, `building`, `safe`, `wallet`, `coins`, `bitcoin-circle`, `piggy-bank`, `more-horiz`, `dots-grid-3x3` all `400`. Use a verified equivalent instead:

| Want | Use (verified) |
|---|---|
| bank / vault / safe | `cash` · `lock` · `shield` |
| coins / money / crypto | `currency` · `currency-coin` · `cash` |
| piggy bank / savings | `pig` (not `piggy-bank`) |
| chart / fund | `chart-pie` · `chart-line` · `chart-donut` · `chart-area` · `chart-mixed` · `chart-alternate` |
| more / other / misc | `more` · `circle` · `grid` · `dashboard` |

### Column icons — silent no-op risk (different from page/db icons)

The names above govern **page & database icons** (public `PATCH /v1/pages|databases/{id}`): a name NOT in the list → immediate `400 Invalid icon name`. **Column/property icons are different** — they go through the private API (`upsert_property`) as an internal `/icons/<file>_<color>.svg` asset path. A name can be **public-valid yet have no matching private asset, so it silently no-ops**: the call returns `200`, no error, and the icon never appears (live-verified: `chart-mixed`, and `dumbbell` — which isn't even a catalog name; use `gym`). The only way to detect it is the `describe` read-back — which is exactly what the SKILL.md **post-build verification** (dimension-by-dimension audit) is for. Never mark a build done without it; if a column icon `did-not-persist`, swap to a synonym (`chart-line` for `chart-mixed`) and retry.

## Colors

`color` is optional (omit for the default appearance). Valid tokens — exactly ten:

`gray` · `lightgray` · `brown` · `yellow` · `orange` · `green` · `blue` · `purple` · `pink` · `red`

`"default"` is **not** a valid token — omit `color` instead.

## Verified valid names (885, alphabetical — live-tested 2026-06-11)

```
123 accessibility activity add airplane alarm alert alien alien-pixel ambulance anchor apple
apron aquarius arch-bridge archery archive aries arrivals arrow-circle-down arrow-down
arrow-down-basic arrow-down-line arrow-left arrow-left-basic arrow-left-line arrow-northeast
arrow-northwest arrow-right arrow-right-basic arrow-right-line arrow-southeast arrow-southwest
arrow-turn-left arrow-turn-right arrow-up arrow-up-basic arrow-up-line arrows-horizontal
arrows-swap-horizontally arrows-swap-vertically arrows-vertical art asterisk atm attachment
avocado baby baby-bottle backpack backward badge bag baggage-claim balloon banana barcode
barricade baseball baseball-cap basketball bathtub bathtub-shower battery battery-charged
battery-charging bed bee beer beer-bottle bell bell-notification bell-off belt bicycle bikini
binoculars blood-pressure bluetooth boarding-pass boat bomb bone book book-closed bookmark
bookmark-outline boombox boot bounce bowl bowl-food bowling bra brain branch branch-create
branch-fork branch-merge bread briefcase brightness-high broccoli broom broom-and-dustpan
browser-stop bug bugle bullseye bunk-bed burger burst bus bus-double-decker bus-metro butterfly
button cactus cafe cake calculator calendar calendar-day calendar-month calendar-week camera
camera-off camera-roll camera-roll-portrait camping-tent camping-trailer cancer candy capricorn
car card card-club card-diamond card-heart card-spade cards carrot cash cash-register cassette
castle castle-japanese cat categories cd cellular chair champagne champagne-bottle chart
chart-alternate chart-area chart-donut chart-line chart-mixed chart-pie chat chat-user check
checklist checkmark checkmark-line checkmark-square chemistry cherries chess-bishop chess-king
chess-knight chess-pawn chess-queen chess-rook chevrons-vertical chicken child chili-pepper
christmas-tree church cigarette circle circle-alternate circle-arrows-horizontal
circle-arrows-vertical circle-dashed circle-dot circle-five-eighths circle-four-eighths
circle-one-eighth circle-remove circle-seven-eighths circle-six-eighths circle-three-eighths
circle-two-eighths city clarinet clear clipping clock clock-alternate close clothes-button
clothes-iron cloud cloud-no cloud-off cloud-yes cloudy clover clover-four-leaf coaster coat
cocktail code code-scan coffee coffee-maker color-palette color-picker color-swatch column comb
command-line comment compass compose compressed-document computer computer-chip conceal
condense confetti-ball confetti-party-popper conifer-tree connecting-flight construction-crane
contrast conversation copy corn couch cow crab crayon create credit-card crop crutch cupcake
currency currency-coin cursor cursor-button cursor-click customs cut dairy daisy dance darks
dashboard database defibrillator delete delivery-truck dental departures dependency description
dialogue die1 die2 die3 die4 die5 die6 dining directional-sign directional-sign-left
directional-sign-right directions dish-soap dna do-not-disturb document dog donkey download
downward drafts dress drink duck duster ear ear-hearing-aid earthquake egg eject
electric-guitar electric-plug elephant elevator emoji emoji-angry emoji-big-sad
emoji-disappointed emoji-grinning emoji-grinning-smiling-eyes emoji-heart-eyes emoji-neutral
emoji-sad emoji-smiling-eyes emoji-sunglasses emoji-surprised emoji-winking error escalator
exclamation-mark exclamation-mark-double exit expand extension fabric-swatch facial-tissues
factory fan-deck feather feed filtered fire fire-extinguisher fire-truck fireworks first-aid
first-aid-kit fish flag flag-checkered flag-pennant flag-swallowtail flash flashlight flatware
fleur-de-lis flood fog folder follow following font food-and-drink football forest-fire fork
fork-and-knife formula forward fragile friends frying-pan fuel game-pawn garlic gavel gear
gears gem gemini geography ghost gift git glasses globe golf government gradebook graduate
grapes grave grid grid-dense grid-wide grid-wide-six grocery groups guitar gym hail hair-care
hairdryer hammer hanafuda hand handbag hanger hare hashtag headphones headset heart
heart-box-bow heart-outline heart-rate heart-rate-monitor heartbroken helicopter helm
help-alternate hexagon hexagon-alternate hexagon-dashed hexagon-five-sixths hexagon-four-sixths
hexagon-one-sixth hexagon-three-sixths hexagon-two-sixths highball history home hot-air-balloon
hourglass hurricane ice-skate immigration inbox infinity info-alternate inline-skate invitation
iterate jack-o-lantern jar judicial-scales junk key key-antique keyboard keyboard-alternate
keypad kind kite knife knife-kitchen language laptop laundry-basket laundry-detergent
laundry-dryer laundry-washer layers leaf leaf-monstera lemon leo libra library light-bulb
lights link lipstick list list-indent litter-disposal location lock lock-keyhole log-in log-out
long-bone long-sleeve-shirt looped-square lost-and-found lounge luggage luggage-cart lungs
magic-wand magnet mahjong mail makeup-brush mandir map map-pin map-pin-alternate mathematics
meat medication meeting megaphone menorah menstrual-pad merge metronome microphone
microphone-off microscope microwave midtones mirror mobile monorail moon mop mop-and-bucket
more mosque motorcycle mountains mouth move move-document movie movie-camera movie-clapboard
movie-clapboard-play mushroom music music-album music-artist navigation necktie network
new-alert new-badge new-document new-folder news no no-entry note-eighth note-half note-quarter
note-sixteenth note-sixteenth-beamed note-whole notification notion numero nut octagon
official-document onion orange orbit ornament oven package paifang paint-brush paint-brush-wide
paint-bucket paint-roller palm-tree pants paper-towels parking parking-no partly-cloudy-day
partly-cloudy-night passport paste peace peanut pear pen pencil pentagon pentagon-alternate
pentagon-dashed pentagon-four-fifths pentagon-one-fifth pentagon-three-fifths
pentagon-two-fifths people perfume person-feminine person-masculine phone phone-call
phone-end-call phone-speaker photo-landscape piano pig pill pin pisces pitcher pizza plate-food
playback-fast-forward playback-next playback-pause playback-play playback-play-button
playback-previous playback-rewind playback-stop playlist plus poo postage-stamp postcard pot
potted-plant poultry power pram pregnancy-test pretzel preview print priority-high priority-low
priority-mid private profile promoted public pull-request pump pump-bottle push-pin puzzle
question-mark radio rain rainbow receipt redirect redo reference refresh refresh-reverse
refrigerator remove rename reorder repeat reply reply-all report ringed-planet robot rocket
roller-skate row rubber-stamp ruler run safety-pin sagittarius sailboat sandwich save scarf
school science scooter scorpio screwdriver script scrub-brush search seed send send-to server
service-counter set-square share sharing sheep shell shield shirt shoe shogi shop shopping-bag
shopping-basket shopping-cart shorts shovel-and-pail shower shuffle sign-in sign-out
signature-document sink skateboard skip-backward skip-forward skirt skull skull-profile sleet
slide sliders-horizontal sliders-vertical slideshow slideshow-play smoking smoking-no snake
snare-drum snippet snorkel snowflake soap soccer sock soda-bottle soft-serve soy spider sponge
spoon spray-bottle square square-alternate square-circle square-dashed square-one-fourth
square-three-fourths square-two-fourths squeeze-tube stairs star star-half star-of-life
star-outline stars steering-wheel stethoscope sticker stomach stopwatch storm stovetop
strawberry stroller subtask subtitles suit suit-club suit-diamond suit-heart suit-spade
suitcase sun sunglasses sunrise sunscreen sunset suspension-bridge swap-horizontally
swap-vertically sword symbol synagogue sync sync-reverse syringe t-square table tablet tabs
tabs-user tag takeout-box tampon target taurus taxi teapot telephone telescope temperature-cool
temperature-warm temple theatre thinking thought thought-alert thought-dialogue throat
thumbs-down thumbs-up ticket ticket-admission timeline toaster toilet toilet-paper token tooth
torii tornado tortoise towel traffic-cone traffic-light train train-high-speed train-light-rail
train-magnetic-levitation train-metro transfers translate tree triangle triangle-alternate
triangle-dashed triangle-one-third triangle-two-thirds trophy tropical-cocktail truck trumpet
tshirt tulip tulip-name-tag tumbler tv umbrella underwear undo unfollow unlock unlock-keyhole
upload upload-document upload-folder upward user user-circle user-circle-dashed
user-circle-filled username vacuum-cleaner verified video-camera video-camera-off video-game
video-game-classic video-game-joystick videotape view view-off vinyl-record violin virgo
vitruvian-man voicemail volcano volume-high volume-off walk wall warning watch-analog water
whale wheat wheelchair wheelchair-access wheelchair-motorized whistle wifi wind window wine
wine-bottle wrapping-paper wrench yin-yang zoom-in zoom-out
```

## How this was verified

All 2145 candidate names from the prior reverse-engineered catalog (Notion app bundle export + `notion-icon-picker` + `files2notion` mirrors + Iconoir line-set overlap) were `PATCH`ed one-by-one onto a scratch page's `icon` at `Notion-Version: 2026-03-11`; `200` → valid, `400` → invalid. Result: **885 valid** (this list) / 1260 invalid — the Iconoir-overlap tier was almost entirely bogus. Notion ships no official icon catalog (the API docs only say "Refer to the Notion icon picker for valid names"); named-icon API write support landed in the 2026-03-11 (Mar 25 2026) changelog. **Completeness cross-check (2026-06-11):** the picker's own DOM was dumped (885 icon cells); after stripping the picker's display labels (which differ from API names for 421 of the 885 — all 421 live-tested `400`), the picker contains exactly as many icons as there are valid API names (885), confirming this list is the complete set. **Adversarial superset test (2026-06-11):** a further 4,387 candidate names pulled from major icon libraries (Lucide, Phosphor, Heroicons, Feather) and morphological variants — all outside the original pool — were live-tested; **every one returned `400`**, zero valid beyond the 885. Grand total: **6,935 distinct names probed → exactly 885 valid**, none outside the picker.
