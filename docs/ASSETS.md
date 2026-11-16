# Assets and licenses

The MIT license in the root of this repo covers the code. It does not cover every image, font, or audio file.

## Not included in the public repo

These files are kept out because we do not have the right to redistribute them:

- `apps/web/public/avatars/` — reaction images and GIFs collected from Imgflip and Giphy. Most are someone else's work.
- `apps/web/public/alve/` — pixel art by Waneella, commissioned by Valve for the Steam Spring Sale in 2023. The upstream attribution file says it has no redistribution license. Replace it with your own art before shipping a public build.
- `apps/web/public/samples/hold-my-hand.lrc` — the full lyrics of a commercial song.
- `apps/web/public/badge-approval.html` — an internal moderation page, not part of the product.

If you want these features locally, supply your own assets. The avatar picker shows an empty state without them, and the Alve Town stage falls back to a plain gradient.

## Included with credit

- `apps/web/public/photos/` — stock photos from Unsplash, Pexels, and Pixabay. See `attributions.txt` in the same folder.
- `apps/web/public/fonts/material-symbols-outlined.woff2` — Google Material Symbols, Apache 2.0.
- `apps/web/public/am-lyrics.js` — MIT, copyright Microsoft Corporation. The license header is in the file.
- `apps/web/public/icons/betterlyrics.svg` and `apps/web/public/lrclib.png` — logos of services we link to. The marks belong to their owners.

## Fonts to check

- The Alve Town billboard asks for `PixeloidSans.ttf` and `PixeloidSansBold.ttf`. They are part of the excluded Alve assets, so the stage falls back to the system font stack. Check the font's license before you add it back.
- The interface uses system fonts and the bundled Material Symbols font. No other font files are included.

## Brand

The OpenLyryc name and logo are not part of the MIT grant. You can fork the code and change it, but do not publish your fork under the OpenLyryc name or logo.

## If you are unsure

Assume you cannot use it. Open an issue and ask before adding a new asset to the repo.
