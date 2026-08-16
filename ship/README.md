# SHIP-3 — Pages → TWA → Play Store

The build is one self-contained HTML file with no external requests, so this is packaging
rather than porting. Everything that can be done without a Play account is done and is in
the repository. What is left needs your Google account, your signing key, and a device —
none of which can be faked or guessed, so they are listed here rather than half-built.

## What the build already produces

`npm run ship` writes into `docs/`, which GitHub Pages serves:

| file | why it matters |
|---|---|
| `index.html` | the whole game, inlined |
| `manifest.webmanifest` | Bubblewrap reads this to generate the Android project |
| `icon-maskable-512.png` | a real maskable icon — see the note below |
| `privacy.html` | Play requires a policy URL for every app, including one that collects nothing |
| `sw.js` | offline shell |
| `.nojekyll` | **load-bearing.** Without it Pages runs Jekyll, and Jekyll drops dot-directories — so `.well-known/assetlinks.json` would 404 and the TWA would silently keep its URL bar |

**The maskable icon is its own file, not the plain one relabelled.** Android's safe zone is
the centred circle of 80% diameter; the plain artwork does not fit it (the bottom hold sits
about 208px from centre against a 205px radius), so a round launcher mask would shave it and
lose the contour lines entirely. `icon-maskable-512.png` is the same artwork at 80%.

**Screenshots are deliberately absent** from the manifest and this checklist does not fake
them. They have to come off the real build on a real device — that is `ART-3`, and it has
said so since v6.7.

## What only you can do

1. **Play Console account** — one-off US$25, `play.google.com/console`.
2. **Package name.** The build and `ship/twa-manifest.json` assume **`com.rcjlabs.sandbagged`**.
   It is permanent once published and cannot be changed, so confirm it before the first
   upload. If you change it, change it in `twa-manifest.json` *and* pass
   `SANDBAGGED_PKG=your.package.name` to the build.
3. **Generate a signing key** and keep it somewhere you will not lose it:
   ```
   keytool -genkeypair -v -keystore ship/android.keystore -alias sandbagged \
           -keyalg RSA -keysize 2048 -validity 10000
   ```
   `ship/android.keystore` is gitignored. **If you lose it and are not on Play App Signing,
   you can never update the app again.** Use Play App Signing (the default) so Google holds
   the upload key's counterpart.
4. **Build the APK/AAB:**
   ```
   npm i -g @bubblewrap/cli
   cd ship && bubblewrap init --manifest https://rcjlabs.github.io/sandbagged/manifest.webmanifest
   # it will offer to use the twa-manifest.json already here — accept it
   bubblewrap build
   ```
5. **Upload the AAB**, then read the **SHA-256 certificate fingerprint** off
   *Play Console → Setup → App integrity → App signing key certificate*.
6. **Publish `assetlinks.json` with that fingerprint** — this is the step that removes the
   URL bar, and it can only happen after step 5 because Play App Signing mints the
   certificate at upload:
   ```
   SANDBAGGED_SHA256='AA:BB:...:FF' npm run ship   # 32 colon-separated hex pairs
   git add docs/.well-known/assetlinks.json && git commit && git push
   ```
   The build **refuses to write a placeholder**. A stub would serve, fail verification
   silently, and leave a URL bar with no obvious cause.
   Verify afterwards:
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://rcjlabs.github.io&relation=delegate_permission/common.handle_all_urls`
7. **Store listing** — short and full description, feature graphic and cover exist from
   v6.7 (`ART-3`); screenshots do not.
8. **Content rating questionnaire**, **Data safety form** (answer: no data collected — see
   `docs/privacy.html`, which was written against the built file and not from memory), and
   **target audience**.
9. **Privacy policy URL:** `https://rcjlabs.github.io/sandbagged/privacy.html`

## itch.io

Nothing to build. Upload `docs/index.html` on its own and tick "This file will be played in
the browser". It is fully self-contained, so it works as a single-file HTML5 project with no
further configuration.

## Things that will bite

- **Target API level.** Play enforces a minimum that rises every August. Bubblewrap pins a
  recent one; if an upload is rejected for it, re-run `bubblewrap update` and rebuild.
- **`appVersionCode` must increase on every upload.** Bubblewrap bumps it; check it did.
- **The TWA is a browser view**, so the service worker's update path still applies — see
  `DEV-7`. A store update ships new Android shell, not new game; the game updates itself
  from Pages on the next launch.
- **`start_url` and `id`.** The manifest declares `id: '/sandbagged/'`. Do not change it
  after publishing — it is the app's identity to the browser, and moving it orphans
  installed copies.
