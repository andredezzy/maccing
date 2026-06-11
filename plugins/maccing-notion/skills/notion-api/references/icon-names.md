# Notion built-in (named) icon names

Reference for the `notion-api` skill — the catalog of `name` values for Notion's **built-in icon** type:

```json
{ "type": "icon", "icon": { "name": "chart-mixed", "color": "blue" } }
```

Set via `PATCH /v1/pages/{id}`, `PATCH /v1/databases/{id}`, or at creation (`POST`). Notion does **not** officially publish this list — the catalog below was reverse-engineered (see Sources).

## Reliability — read before picking a name

Notion's named icons are a **proprietary set of ~885 icons** (the icon picker). They overlap heavily with the open-source [Iconoir](https://iconoir.com) line set but are **not identical** — e.g. `chart-mixed` exists in Notion but not in Iconoir — so treat Notion's set as authoritative, *not* "Iconoir".

This file lists a **superset of 2145 names** in two tiers:

- **Production-safe (~885)** — names extracted live from Notion's own app bundle and cross-validated by two independent public mirrors (`notion-icon-picker`, `files2notion`). These are the real picker names.
- **Extended (Iconoir overlap)** — additional Iconoir line-icon names, included for completeness. They match Notion's visual style but are **untested against the API** and some may return `400 validation_error`.

The two tiers are merged alphabetically below (the sources can't be cleanly separated post-merge). **When in doubt, verify:** `PATCH` the icon and check `200` vs `400 validation_error` (invalid name). Two confirmed-valid anchors: `cash`, `chart-mixed`. Best practice — prefer a name you can already see on an existing page in the workspace.

## Colors

`color` is optional (omit for the default appearance). Valid tokens — exactly ten:

`gray` · `lightgray` · `brown` · `yellow` · `orange` · `green` · `blue` · `purple` · `pink` · `red`

`"default"` is **not** a valid token — omit `color` instead.

## Catalog (2145 names, alphabetical)

```
123 22 accessibility accessibility-sign accessibility-tech activity add adobe-after-effects
adobe-illustrator adobe-indesign adobe-lightroom adobe-photoshop adobe-xd african-tree agile
air-conditioner airplane airplane-helix airplane-helix-45deg airplane-off airplane-rotation airplay
alarm album album-carousel album-list album-open alert alien alien-pixel align-bottom-box
align-center align-horizontal-centers align-horizontal-spacing align-justify align-left
align-left-box align-right align-right-box align-top-box align-vertical-centers
align-vertical-spacing ambulance anchor angle-tool antenna antenna-off antenna-signal
antenna-signal-tag app-notification app-store app-window apple apple-half apple-imac-2021
apple-imac-2021-side apple-mac apple-shortcuts apple-swift apple-wallet apron aquarius ar-tag
arc-3d arc-3d-center-point arcade arch arch-bridge archery archery-match archive archive-book
area-search areas aries arrivals arrow-archery arrow-circle-down arrow-down arrow-down-basic
arrow-down-circle arrow-down-left arrow-down-left-circle arrow-down-left-square arrow-down-line
arrow-down-right arrow-down-right-circle arrow-down-right-square arrow-down-tag arrow-email-forward
arrow-enlarge-tag arrow-left arrow-left-basic arrow-left-circle arrow-left-line arrow-left-tag
arrow-northeast arrow-northwest arrow-reduce-tag arrow-right arrow-right-basic arrow-right-circle
arrow-right-line arrow-right-tag arrow-separate arrow-separate-vertical arrow-southeast
arrow-southwest arrow-turn-left arrow-turn-right arrow-union arrow-union-vertical arrow-up
arrow-up-basic arrow-up-circle arrow-up-left arrow-up-left-circle arrow-up-left-square
arrow-up-line arrow-up-right arrow-up-right-circle arrow-up-right-square arrow-up-tag
arrows-horizontal arrows-swap-horizontally arrows-swap-vertically arrows-up-from-line
arrows-vertical art asana asterisk at-sign at-sign-circle atm atom attach attachment
augmented-reality auto-flash avi-format avocado award axes baby baby-bottle backpack backward
backward-15-seconds badge badge-check bag baggage-claim balcony balloon banana bank barcode
barricade baseball baseball-cap basketball basketball-field bathroom bathtub bathtub-shower battery
battery-25 battery-50 battery-75 battery-charged battery-charging battery-empty battery-full
battery-indicator battery-slash battery-warning bbq beach-bag bed bed-ready bee beer beer-bottle
behance behance-tag bell bell-notification bell-off belt bicycle bikini bin bin-full bin-half
bin-minus-in bin-plus-in binocular binoculars birthday-cake bishop bitbucket bitcoin-circle
bitcoin-rotate-out blood-pressure bluetooth bluetooth-tag boarding-pass boat bold bold-square bomb
bone bonfire book book-closed book-lock book-stack bookmark bookmark-book bookmark-circle
bookmark-outline boombox boot border-bl border-bottom border-br border-inner border-left border-out
border-right border-tl border-top border-tr bounce bounce-left bounce-right bowl bowl-food bowling
bowling-ball box box-3d-center box-3d-point box-3d-three-points box-iso boxing-glove bra brain
brain-electricity brain-research brain-warning branch branch-create branch-fork branch-merge bread
bread-slice bridge-3d bridge-surface briefcase bright-crown bright-star brightness brightness-high
brightness-window broccoli broom broom-and-dustpan browser-stop bubble-download bubble-income
bubble-outcome bubble-search bubble-star bubble-upload bubble-warning bubble-xmark bug bugle
building bullseye bunk-bed burger burst bus bus-double-decker bus-green bus-metro bus-stop
butterfly button c-square cable-tag cactus cafe cake calculator calendar calendar-arrow-down
calendar-arrow-up calendar-check calendar-day calendar-minus calendar-month calendar-plus
calendar-rotate calendar-week calendar-xmark camera camera-off camera-roll camera-roll-portrait
camping-tent camping-trailer cancer candlestick-chart candy capricorn car card card-club
card-diamond card-heart card-lock card-no-access card-reader card-shield card-spade card-wallet
cards carrot cart cart-alt cart-minus cart-plus cash cash-register cassette castle castle-japanese
cat categories cd cell-2x2 cellar cellular center-align chair champagne champagne-bottle chart
chart-alternate chart-area chart-donut chart-line chart-mixed chart-pie chat chat-bubble
chat-bubble-check chat-bubble-empty chat-bubble-question chat-bubble-translate chat-bubble-warning
chat-bubble-xmark chat-lines chat-minus-in chat-plus-in chat-user check check-circle check-square
checklist checkmark checkmark-line checkmark-square chemistry cherries chess-bishop chess-king
chess-knight chess-pawn chess-queen chess-rook chevrons-vertical chicken child chili-pepper
chocolate christmas-tree chromecast chromecast-active church church-side cigarette cigarette-slash
cinema-old circle circle-alternate circle-arrows-horizontal circle-arrows-vertical circle-dashed
circle-dot circle-five-eighths circle-four-eighths circle-one-eighth circle-remove
circle-seven-eighths circle-six-eighths circle-spark circle-three-eighths circle-two-eighths city
clarinet clear clipboard-check clipping clock clock-alternate clock-rotate-right close
closed-captions-tag closet clothes-button clothes-iron cloud cloud-bookmark cloud-check
cloud-desync cloud-download cloud-no cloud-off cloud-square cloud-sunny cloud-sync cloud-upload
cloud-xmark cloud-yes cloudy clover clover-four-leaf coaster coat cocktail code code-brackets
code-brackets-square code-scan codepen coffee coffee-cup coffee-maker coin-slash coins coins-swap
collage-frame collapse color-filter color-palette color-picker color-swatch color-wheel column comb
combine command-line comment commodity community comp-align-bottom comp-align-left comp-align-right
comp-align-top compact-disc compass component compose compress compress-lines compressed-document
computer computer-chip conceal condense confetti-ball confetti-party-popper conifer-tree
connecting-flight constrained-surface construction-crane consumable contactless contrast
control-slider conversation cookie cooling-square copy copyright corn corner-bottom-left
corner-bottom-right corner-top-left corner-top-right couch cow cpu cpu-warning crab cracked-egg
crayon create creative-commons credit-card credit-card-slash credit-cards crib crop crop-rotate-bl
crop-rotate-br crop-rotate-tl crop-rotate-tr crown crown-circle crutch css3 cube cube-bandage
cube-cut-with-curve cube-dots cube-hole cube-replace-face cube-scan cupcake currency currency-coin
cursor cursor-button cursor-click cursor-pointer curve-array customs cut cutlery cycling cylinder
dairy daisy dance darks dash-flag dashboard dashboard-dots dashboard-speed data-transfer-both
data-transfer-check data-transfer-down data-transfer-up data-transfer-warning database
database-backup database-check database-export database-monitor database-restore database-script
database-script-minus database-script-plus database-search database-settings database-star
database-stats database-tag database-warning database-xmark de-compress defibrillator delete
delivery delivery-truck dental departures dependency depth description design-nib design-pencil
desk developer dew-point dialogue dialpad diameter dice-five dice-four dice-one dice-six dice-three
dice-two die1 die2 die3 die4 die5 die6 dimmer-switch dining directional-sign directional-sign-left
directional-sign-right directions director-chair discord dish-soap dishwasher display-4k divide
divide-three dna dns do-not-disturb doc-magnifying-glass doc-magnifying-glass-in doc-star
doc-star-in document dog dogecoin-circle dogecoin-rotate-out dollar dollar-circle domotic-warning
donate donkey dot-arrow-down dot-arrow-left dot-arrow-right dot-arrow-up dots-grid-3x3 double-check
download download-circle download-data-window download-square downward drafts drag
drag-hand-gesture drawer dress dribbble drink drone drone-charge-full drone-charge-half
drone-charge-low drone-check drone-landing drone-refresh drone-take-off drone-xmark droplet
droplet-check droplet-half droplet-snow-flake-in duck duster ear ear-hearing-aid earthquake
ease-curve-control-points ease-in ease-in-control-point ease-in-out ease-out ease-out-control-point
ecology-book edit edit-pencil egg eject electric-guitar electric-plug electronics-chip
electronics-transistor elephant elevator ellipse-3d ellipse-3d-three-points emacs emoji emoji-angry
emoji-ball emoji-big-sad emoji-blink-left emoji-blink-right emoji-disappointed emoji-grinning
emoji-grinning-smiling-eyes emoji-heart-eyes emoji-look-down emoji-look-left emoji-look-right
emoji-look-up emoji-neutral emoji-puzzled emoji-quite emoji-really emoji-sad emoji-satisfied
emoji-sing-left emoji-sing-left-note emoji-sing-right emoji-sing-right-note emoji-smiling-eyes
emoji-sunglasses emoji-surprise emoji-surprise-alt emoji-surprised emoji-talking-angry
emoji-talking-happy emoji-think-left emoji-think-right emoji-winking empty-page energy-usage-window
enlarge erase error escalator eslint estateguru ethereum-circle ethereum-rotate-out euro
euro-square ev-charge ev-charge-alt ev-plug ev-plug-charging ev-plug-xmark ev-station ev-tag
exclamation-mark exclamation-mark-double exclude exit expand expand-lines extension extrude eye
eye-closed f-square fabric-swatch face-3d-draft face-id facebook facebook-tag facetime
facial-tissues factory fan-deck farm fast-arrow-down fast-arrow-down-square fast-arrow-left
fast-arrow-left-square fast-arrow-right fast-arrow-right-square fast-arrow-up fast-arrow-up-square
fast-down-circle fast-left-circle fast-right-circle fast-up-circle favourite-book favourite-window
feather feed female figma file-not-found fill-color fillet-3d filter filter-alt filter-list
filter-list-circle filtered finder fingerprint fingerprint-check-circle fingerprint-circle
fingerprint-lock-circle fingerprint-scan fingerprint-square fingerprint-window
fingerprint-xmark-circle fire fire-extinguisher fire-flame fire-truck fireworks first-aid
first-aid-kit fish fishing flag flag-checkered flag-pennant flag-swallowtail flake flare flash
flash-off flashlight flask flatware fleur-de-lis flip flip-reverse flood floppy-disk
floppy-disk-arrow-in floppy-disk-arrow-out flower fog folder folder-minus folder-plus
folder-settings folder-warning follow following font font-question food-and-drink football
football-ball forest-fire fork fork-and-knife formula forward forward-15-seconds forward-message
fragile frame frame-alt frame-alt-empty frame-minus-in frame-plus-in frame-select frame-simple
frame-tool fridge friends frying-pan fuel fullstacks fx fx-tag game-pawn gamepad garage garlic gas
gas-tank gas-tank-droplet gavel gear gears gem gemini geography ghost gif-format gift git
git-branch git-cherry-pick-commit git-commit git-compare git-fork git-merge git-pull-request
git-pull-request-closed github github-circle gitlab-full glass-empty glass-fragile glass-half
glass-half-alt glasses globe goal golf google google-circle google-docs google-drive
google-drive-check google-drive-sync google-drive-warning google-home google-one government gps
gradebook graduate graduation-cap grapes graph-down graph-up grave grid grid-dense grid-minus
grid-plus grid-wide grid-wide-six grid-xmark grocery group groups guitar gym h-square habit hail
hair-care hairdryer half-cookie half-moon hammer hanafuda hand hand-brake hand-card hand-cash
hand-contactless handbag hanger hard-drive hare hashtag hat hd hd-display hdr headphones headset
headset-bolt headset-help headset-warning health-shield healthcare heart heart-arrow-down
heart-box-bow heart-outline heart-rate heart-rate-monitor heartbroken heating-square heavy-rain
helicopter helm help-alternate help-circle help-square heptagon hexagon hexagon-alternate
hexagon-dashed hexagon-dice hexagon-five-sixths hexagon-four-sixths hexagon-one-sixth hexagon-plus
hexagon-three-sixths hexagon-two-sixths highball historic-shield historic-shield-alt history home
home-alt home-alt-slim home-alt-slim-horiz home-hospital home-sale home-secure home-shield
home-simple home-simple-door home-table home-temperature-in home-temperature-out home-user
horiz-distribution-left horiz-distribution-right horizontal-merge horizontal-split hospital
hospital-circle hot-air-balloon hourglass house-rooms html html5 hurricane ice-cream ice-skate
iconoir immigration import inbox inclination industry infinite infinity info-alternate info-circle
inline-skate input-field input-output input-search instagram internet intersect intersect-alt
invitation ios-settings ip-address-tag iris-scan italic italic-square iterate jack-o-lantern jar
jellyfish journal journal-page jpeg-format jpg-format judge judicial-scales junk kanban-board key
key-antique key-back key-command key-minus key-plus key-xmark keyboard keyboard-alternate keyframe
keyframe-align-center keyframe-align-horizontal keyframe-align-vertical keyframe-minus
keyframe-minus-in keyframe-plus keyframe-plus-in keyframe-position keyframes keyframes-couple
keyframes-minus keyframes-plus keypad kind kite knife knife-kitchen label lamp language laptop
laptop-charging laptop-dev-mode laptop-fix laptop-warning laundry-basket laundry-detergent
laundry-dryer laundry-washer layer layers layout-left layout-right leaderboard leaderboard-star
leaf leaf-monstera learning lemon lens lens-plus leo libra library lifebelt light-bulb
light-bulb-off light-bulb-on lights line-space linear link link-slash link-xmark linkedin linux
lipstick list list-indent list-select litecoin-circle litecoin-rotate-out litter-disposal location
lock lock-keyhole lock-slash lock-square loft-3d log-in log-no-access log-out long-arrow-down-left
long-arrow-down-right long-arrow-left-down long-arrow-left-up long-arrow-right-down
long-arrow-right-up long-arrow-up-left long-arrow-up-right long-bone long-sleeve-shirt
looped-square lost-and-found lot-of-cash lounge luggage luggage-cart lullaby lungs mac-control-key
mac-dock mac-option-key mac-os-window magic-wand magnet magnet-energy mahjong mail mail-in
mail-open mail-out makeup-brush male mandir map map-pin map-pin-alternate map-pin-minus
map-pin-plus map-pin-xmark map-xmark maps-arrow maps-arrow-diagonal maps-arrow-xmark
maps-go-straight maps-turn-back maps-turn-left maps-turn-right mask-square mastercard-card mastodon
math-book mathematics maximize meat medal medal-1st media-image media-image-folder media-image-list
media-image-plus media-image-xmark media-video media-video-folder media-video-list media-video-plus
media-video-xmark medication medium meeting megaphone menorah menstrual-pad menu menu-scale merge
message message-alert message-text messages meter-arrow-down-right metro metronome microphone
microphone-check microphone-minus microphone-mute microphone-off microphone-plus
microphone-speaking microphone-warning microscope microwave midtones minus minus-circle
minus-hexagon minus-square minus-square-dashed mirror mobile mobile-dev-mode mobile-fingerprint
mobile-voice modern-tv modern-tv-4k money-square monitor monitor-mobile monorail moon moon-sat mop
mop-and-bucket more more-horiz more-horiz-circle more-vert more-vert-circle mosque motorcycle
mountains mouse-button-left mouse-button-right mouse-scroll-wheel mouth move move-document movie
movie-camera movie-clapboard movie-clapboard-play mpeg-format multi-bubble multi-mac-os-window
multi-window multiple-pages multiple-pages-empty multiple-pages-minus multiple-pages-plus
multiple-pages-xmark mushroom music music-album music-artist music-double-note
music-double-note-plus music-note music-note-plus n-square nav-arrow-down nav-arrow-left
nav-arrow-right nav-arrow-up navigation navigator navigator-alt necktie neighbourhood network
network-left network-reverse network-right new-alert new-badge new-document new-folder new-tab news
nintendo-switch no no-entry no-smoking-circle non-binary note-eighth note-half note-quarter
note-sixteenth note-sixteenth-beamed note-whole notebook notes notification notion npm npm-square
number-0-square number-1-square number-2-square number-3-square number-4-square number-5-square
number-6-square number-7-square number-8-square number-9-square numbered-list-left
numbered-list-right numero nut o-square octagon off-tag official-document oil-industry okrs on-tag
one-finger-select-hand-gesture one-point-circle onion open-book open-in-browser open-in-window
open-new-window open-select-hand-gesture open-vpn orange orange-half orange-slice orange-slice-alt
orbit organic-food organic-food-square ornament orthogonal-view oven package package-lock packages
pacman page page-down page-edit page-flip page-left page-minus page-minus-in page-plus page-plus-in
page-right page-search page-star page-up paifang paint-brush paint-brush-wide paint-bucket
paint-roller palette palm-tree panorama-enlarge panorama-reduce pants pants-pockets paper-towels
parking parking-no partly-cloudy-day partly-cloudy-night passport password-check password-cursor
password-xmark paste paste-clipboard path-arrow pause pause-window paypal pc-check pc-firewall
pc-mouse pc-no-entry pc-warning peace peace-hand peanut pear peerlist pen pen-connect-bluetooth
pen-connect-wifi pen-tablet pen-tablet-connect-usb pen-tablet-connect-wifi pencil pentagon
pentagon-alternate pentagon-dashed pentagon-four-fifths pentagon-one-fifth pentagon-three-fifths
pentagon-two-fifths people people-tag percent-rotate-out percentage percentage-circle
percentage-square perfume person-feminine person-masculine perspective-view pharmacy-cross-circle
pharmacy-cross-tag phone phone-call phone-disabled phone-end-call phone-income phone-minus
phone-outcome phone-paused phone-plus phone-speaker phone-xmark photo-landscape piano pig
piggy-bank pill pillow pin pin-slash pine-tree pinterest pipe-3d pisces pitcher pizza pizza-slice
planet planet-alt planet-sat planimetry plate-food play playback-fast-forward playback-next
playback-pause playback-play playback-play-button playback-previous playback-rewind playback-stop
playlist playlist-play playlist-plus playstation-gamepad plug-type-a plug-type-c plug-type-g
plug-type-l plus plus-circle plus-square plus-square-dashed png-format pocket podcast pokeball
polar-sh poo position position-align post postage-stamp postcard pot potion potted-plant poultry
pound power pram precision-tool pregnancy-test presentation pretzel preview print printer
printing-page priority-down priority-high priority-low priority-medium priority-mid priority-up
privacy-policy private private-wifi profile profile-circle prohibition project-curve-3d promoted
public pull-request pump pump-bottle push-pin puzzle python qr-code question-mark quote
quote-message radiation radio radius rain rainbow raw-format receipt receipt-edit receive-dollars
receive-euros receive-pounds receive-yens redirect redo redo-action redo-circle reduce reference
refresh refresh-circle refresh-double refresh-reverse refrigerator reload-window
reminder-hand-gesture remove rename reorder repeat repeat-once reply reply-all reply-to-message
report report-columns reports repository restart rewind rhombus rhombus-arrow-right ringed-planet
rings robot rocket roller-skate rook rotate-camera-left rotate-camera-right round-flask
rounded-mirror routine row rss-feed rss-feed-tag rubber-stamp rubik-cube ruler ruler-arrows
ruler-combine ruler-minus ruler-pen ruler-plus run running rust safari safe safe-arrow-left
safe-arrow-right safe-open safety-pin sagittarius sailboat sandals sandwich save
scale-frame-enlarge scale-frame-reduce scan-barcode scan-qr-code scanning scarf school science
scissor scissor-alt scooter scorpio screenshot screwdriver script scrub-brush sea-and-sun sea-waves
search search-engine search-window secure-window security-pass seed select-edge-3d select-face-3d
select-point-3d select-window selective-tool send send-diagonal send-dollars send-euros send-mail
send-pounds send-to send-yens server server-connection service-counter set-square setting settings
settings-profiles share share-android share-ios sharing sheep shell shield shield-alert shield-alt
shield-broken shield-check shield-download shield-eye shield-loading shield-minus shield-plus-in
shield-question shield-search shield-upload shield-xmark shirt shirt-tank-top shoe shogi shop
shop-four-tiles shop-four-tiles-window shop-window shopping-bag shopping-bag-arrow-down
shopping-bag-arrow-up shopping-bag-check shopping-bag-minus shopping-bag-plus shopping-bag-pocket
shopping-bag-warning shopping-basket shopping-cart shopping-code shopping-code-check
shopping-code-xmark short-pants short-pants-pockets shortcut-square shorts shovel-and-pail shower
shuffle sidebar-collapse sidebar-expand sigma-function sign-in sign-out signature-document
simple-cart sine-wave single-tap-gesture sink skateboard skateboarding skip-backward skip-forward
skip-next skip-prev skirt skull skull-profile slack slash slash-square sleeper-chair sleet slide
sliders-horizontal sliders-vertical slideshow slideshow-play slips small-lamp small-lamp-alt
smartphone-device smoking smoking-no snake snapchat snare-drum snippet snorkel snow snow-flake
snowflake soap soccer soccer-ball sock soda-bottle sofa soft-serve soil soil-alt sort sort-down
sort-up sound-high sound-low sound-min sound-off soy spades spark sparks sphere spider spiral
split-area split-square-dashed spock-hand-gesture sponge spoon spotify spray-bottle square
square-3d-corner-to-corner square-3d-from-center square-3d-three-points square-alternate
square-circle square-cursor square-dashed square-one-fourth square-three-fourths square-two-fourths
square-wave squeeze-tube stackoverflow stairs star star-dashed star-half star-half-dashed
star-of-life star-outline stars stat-down stat-up stats-down-square stats-report stats-up-square
status-up steering-wheel stethoscope sticker stomach stopwatch storm stovetop strategy strawberry
stretching strikethrough stroller strongbox style-border submit-document substract subtask
subtitles suggestion suit suit-club suit-diamond suit-heart suit-spade suitcase sun sun-light
sunglasses sunrise sunscreen sunset suspension-bridge svg-format swap-horizontally swap-vertically
sweep-3d swimming swipe-down-gesture swipe-left-gesture swipe-right-gesture
swipe-two-fingers-down-gesture swipe-two-fingers-left-gesture swipe-two-fingers-right-gesture
swipe-two-fingers-up-gesture swipe-up-gesture switch-off switch-on sword symbol synagogue sync
sync-reverse syringe system-restart system-shut t-square table table-2-columns table-rows tablet
tabs tabs-user tag takeout-box tampon target task-list taurus taxi teacher teapot telegram
telegram-circle telephone telescope temperature-cool temperature-down temperature-high
temperature-low temperature-up temperature-warm temple tennis-ball tennis-ball-alt terminal
terminal-tag test-tube text text-arrows-up-down text-box text-magnifying-glass text-size
text-square theatre thinking thought thought-alert thought-dialogue threads three-points-circle
three-stars throat thumbs-down thumbs-up thunderstorm ticket ticket-admission tif-format
tiff-format tiktok time-zone timeline timer timer-off toaster toilet toilet-paper token tools tooth
torii tornado tortoise tournament towel tower tower-check tower-no-access tower-warning trademark
traffic-cone traffic-light train train-high-speed train-light-rail train-magnetic-levitation
train-metro tram transfers transition-down transition-left transition-right transition-up translate
trash treadmill tree trekking trello triangle triangle-alternate triangle-dashed triangle-flag
triangle-flag-circle triangle-flag-two-stripes triangle-one-third triangle-two-thirds trophy
tropical-cocktail truck truck-green truck-length trumpet ts tshirt tulip tulip-name-tag tumbler
tunnel tv tv-fix tv-warning twitter two-circles two-points-circle two-seater-sofa type
u-turn-arrow-left u-turn-arrow-right umbrella underline underline-square underwear undo undo-action
undo-circle unfollow union union-alt union-horiz-alt unity unity-5 unjoin-3d unlock unlock-keyhole
upload upload-data-window upload-document upload-folder upload-square upward usb user
user-badge-check user-bag user-cart user-circle user-circle-dashed user-circle-filled user-crown
user-group user-love user-plus user-scan user-square user-star user-tag user-xmark username
vacuum-cleaner vegan vegan-circle vegan-square vehicle-green verified vertical-merge vertical-split
vials video video-camera video-camera-off video-game video-game-classic video-game-joystick
video-projector videotape view view-360 view-columns-2 view-columns-3 view-grid view-off
view-structure-down view-structure-up vim vinyl-record violin virgo vitruvian-man voice voice-check
voice-circle voice-lock-circle voice-scan voice-square voice-xmark voicemail volcano volume-high
volume-off vr-tag vue-js waist walk walking wall wallet warning warning-circle warning-hexagon
warning-square warning-triangle warning-window wash washing-machine watch-analog water
watering-soil web-window web-window-energy-consumption web-window-xmark webp-format weight
weight-alt whale whatsapp wheat wheelchair wheelchair-access wheelchair-motorized whistle
white-flag wifi wifi-off wifi-signal-none wifi-tag wifi-warning wifi-xmark wind window window-check
window-lock window-no-access window-tabs window-xmark windows wine wine-bottle wolf wrap-text
wrapping-paper wrench wristwatch www x x-square xbox-a xbox-b xbox-x xbox-y xmark xmark-circle
xmark-square xray-view y-square yelp yen yen-square yin-yang yoga youtube z-square zoom-in zoom-out
```

## Sources

- https://app.notion.com (webpack module 581539, export Q — 885 names extracted live from Notion's authenticated app bundle via JS execution; most authoritative)
- https://raw.githubusercontent.com/YuvrajSingh099/notion-icon-picker/main/script.js (884 names; both confirmed names present; icons stored as space-separated phrases converted to kebab-case)
- https://www.files2notion.com/free-tools/icons (884 names; independently confirms notion-icon-picker set)
- https://www.npmjs.com/package/iconoir (iconoir@7.11.0 npm package — 1383 regular/line-style icons; 'chart-mixed' absent from iconoir, proving Notion is NOT a pure iconoir subset)
- https://raw.githubusercontent.com/ASafaeirad/notion-automation/main/src/entities/Icon.ts (68 curated names; partial/project-specific set, lowest confidence)

_Notion ships no official icon catalog; this is reverse-engineered and may drift as Notion updates its picker. Named-icon API write support landed in the Notion 2026-03-11 / Mar 25 2026 changelog._
