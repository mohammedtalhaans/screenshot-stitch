# Screenshot Stitch

**The whole story. Not your secrets.**

A mobile-first, entirely client-side screenshot stitching and redaction studio. The interface uses a light screenshot workspace, locally hosted typography, readable controls, accurate zoom, and direct manipulation of privacy masks.

## Release status

**Version 1.2.0 — redesigned screenshot workspace.** Home-screen drag-and-drop, clearer mobile typography, keyboard-created manual masks, and complete deployment prerequisites. See [VALIDATION.md](VALIDATION.md) for the current verification results.

Episode materials: [script and recording kit](episode/EPISODE-KIT.md). Deployment: [GitHub Pages guide](docs/GITHUB-PAGES.md).

The source archive contains the committed dependency lockfile, regression suites, release-gated GitHub Pages workflow, and documentation. `npm ci` installs the locked dependencies; the build copies the OCR worker, WASM engine, English data, license notices, and source archive into the static output. No third-party OCR service is used. A separate compiled deployment bundle is produced from `dist/`.

## Run locally

Use Node 22.12 or newer and npm. From this directory:

```sh
npm ci
npm run dev
```

Open the loopback URL printed by Vite. The install hook copies the English OCR model and engine files from installed packages into `public/ocr/`. A browser visitor subsequently loads those assets from your own static site, not an OCR provider or CDN.

The tested `package-lock.json` is included. Keep it committed and use `npm ci` for reproducible installs. Dependency updates should regenerate the lockfile and pass the complete release gate before deployment.

To run on another device on your local network, explicitly opt in with `npm run dev -- --host 0.0.0.0`. Use HTTPS for production clipboard and native sharing. The default development and preview servers bind only to loopback.

## Build and verify

```sh
npx playwright install --with-deps chromium webkit
npm run audit:runtime
npm run verify
```

`verify` runs application/configuration/test typechecking, Vitest, the static production build, and Playwright against that production output. The Playwright suite includes desktop Chromium, mobile Chromium, and mobile WebKit. Actual OCR is not mocked in the main workflow or demo test. Failure-path tests explicitly block OCR assets to check graceful recovery.

```sh
npm run preview
```

The website itself is static. `scripts/serve-dist.mjs` is only a local test fixture server; it is never part of the deployed application. There is no upload endpoint, database, account service, or server-side image processing.

## GitHub Pages project deployment

1. Create a repository and add the contents of this directory, including the supplied `package-lock.json`.
2. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
3. Push to `main`. The included workflow requires a runtime dependency audit, typechecking, unit tests, a build, and browser tests before uploading the static artifact.
4. The successful deploy job reports the Pages address. A repository named `screenshot-stitch` normally uses a `/screenshot-stitch/` project prefix.

Vite uses `base: './'`. The same build uses relative assets to work at the site root or a project subdirectory. Playwright explicitly exercises `/screenshot-stitch/` and verifies that OCR assets stay inside that prefix. There is no client-side path router requiring a server fallback.

The workflow sets `VITE_SOURCE_URL` to the current GitHub repository. Outside that workflow, the visible **View source** link downloads a generated, allowlisted source archive. To link a repository manually, copy `.env.example` to `.env.local` and set a valid HTTPS GitHub URL.

## Use the app

Drop PNG, JPEG, or still WebP screenshots onto the home screen, or choose files. Add in scrolling order, or try the synthetic demo. Reorder with the drag handle, its arrow-key controls, or the explicit up/down buttons. Paste images into the landing/upload screen with Command/Ctrl+V.

Choose a privacy preset and working width, then stitch and scan. The matcher compares real pixels between consecutive images. A weak match produces a review warning rather than a fake confident result. **Adjust seams** provides a live join preview and an exact overlap input. Rebuilding reruns detection and intentionally resets mask edits; the dialog explains this before applying changes.

Inspect the result. Every detection is a suggestion. Select a mask on the canvas or in the inspector; move or resize it, enter exact coordinates, change its style, disable it, remove it, or add a manual mask. Pointer drags are single undo transactions. A tap in drawing mode creates a useful-sized mask. The comparison range supports pointer and keyboard input.

The export screen renders a fresh PNG and requires confirmation that the entire image has been reviewed. Saving is always available once rendering and review are complete. Clipboard copying and native file sharing appear only when supported. Changing output size invalidates the previous review confirmation.

## Privacy and safety

- Screenshots, extracted text, and edits are kept in the current tab's memory. The app implements no analytics, browser-history feature, localStorage database, cloud OCR, or user-data upload. It does not register a service worker.
- The host still serves page, code, and model files and may keep ordinary access logs. Browser caching of those static assets is normal. Image content and OCR text are not included in those requests.
- Resetting or closing the tab releases application references, but it is **not** a secure-erase guarantee. Downloads, clipboard contents, the browser, operating system, extensions, and a compromised host are outside that guarantee.
- **Use solid masks for actual secrets.** Blur and pixelation are visual treatments and can expose readable or reconstructable information. Solid masks are painted last, so an overlapping blur cannot reveal the pixels beneath them.
- Export is a newly rasterized PNG. It does not copy the source file's metadata or editable redaction layers. Downloaded and shared files are deliberately outside the tab's lifetime.
- Detection can miss information. Inspect names, photos, QR/barcodes, addresses, payment details, and the entire final image. There is no “guaranteed safe” classification.

See [SECURITY.md](SECURITY.md) for the threat model and reporting guidance.

## Supported work and practical limits

The stitcher is designed for **vertical scrolling screenshots** from the same app, at the same width and zoom. Aim for roughly 20–40% shared content. It is not a perspective panorama engine. Horizontal panning, mixed zoom, moving videos, changing chat bubbles, and similar repeated layouts may require a manual seam correction. Repeated header/footer trimming is conservative and optional.

| Resource | Default limit |
| --- | --- |
| Images per session | 12 |
| Compressed size per image | 20 MiB |
| Total compressed input | 100 MiB |
| Decoded pixels per image | 48 megapixels |
| Aggregate normalized working pixels | 40 megapixels |
| Export dimensions | 24 megapixels and 24,000px maximum height |
| Working width | Up to 1200px, or 800px in Compact mode |
| OCR language | English |

Limits reduce risk; they do not guarantee that every phone has enough memory. Images are processed sequentially where practical, OCR is tiled, workers are terminated on completion/cancel/failure, and transient image surfaces are released. Malformed signatures, animated inputs, and oversized declared dimensions are rejected before a full pixel decode where supported by the accepted format.

Names use local contextual heuristics and compromise. QR detection uses jsQR; other codes use ZXing best-effort decoding. Face detection is offered only through an available browser-native detector. There is no downloaded face-recognition model, identity recognition, or promise that avatars are automatically found.

## Keyboard controls

| Action | Control |
| --- | --- |
| Paste screenshots on upload screens | Command/Ctrl+V |
| Draw a mask | R, then draw with a pointer or press Enter/Space to place |
| Move selected mask | Arrow keys |
| Move by 10 pixels | Shift+arrows |
| Resize selected mask | Alt+arrows |
| Undo | Command/Ctrl+Z |
| Redo | Command/Ctrl+Shift+Z |
| Remove selected mask | Delete / Backspace |
| Deselect or leave drawing mode | Escape |
| Reorder a focused screenshot handle | Up / Down |

Editor shortcuts are suspended while typing or while a dialog is open. Native form controls, dialog primitives, reduced-motion preferences, and a skip-to-workspace link are retained.

## Project map

`src/components` contains the five screens, editor, inspector, seam dialog, and locally adapted UI primitives/effects. `src/lib` contains pure geometry/history/detection, image import and validation, pixel matching, worker orchestration, OCR, and final rendering. `src/workers` contains stitch, detection, and export entry points.

`tests/core-cases.ts` is the single source of the unit cases consumed by Vitest and the dependency-light runner. `tests/browser-cases.ts` tests native canvas pixels and workers. `e2e` tests the real bundled application. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/TESTING.md](docs/TESTING.md).

## Troubleshooting

**OCR assets fail to load:** run `npm run assets`, rebuild, and serve the entire `dist/` directory. Do not move only `index.html`. Check that the deployed worker, WASM, and `.traineddata.gz` responses are real assets, not an HTML error page. The app retains the stitch for manual editing when detection cannot finish.

**“Image memory” / canvas allocation error:** select Compact mode, remove a few screenshots, or use smaller source images. A browser's practical capacity can be below the configured limits.

**A seam repeats or skips content:** open Adjust seams, change the overlap, and inspect the join. Turn off repeated-chrome cleanup for pages whose non-scrolling areas are unusual.

**Copy/share is unavailable or denied:** save the PNG instead. These APIs depend on browser support, a secure context, and permissions.

**Source archive includes project documentation:** intentional. Never place real private screenshots or extracted secrets inside source or test directories. The build script does not archive arbitrary root-level files, environment secrets, symlinks, or installed dependencies.

## Capture every screen

After building, start `PORT=4174 node scripts/serve-dist.mjs` in one terminal. In another, run `node scripts/capture-release.mjs`. It writes a local HTML gallery, 40 real desktop/mobile UI screenshots, and example redacted PNGs to `release-screenshots/`. The input is the synthetic demo, but stitching, OCR and export are genuine. To capture very short loading states, the script briefly delays local engine asset delivery; it never seeds detections or substitutes results. `CAPTURE_URL` can point to another authorized deployment.

## License and acknowledgements

Application code is MIT licensed; dependency licenses remain their own. The visual system uses restyled shadcn/Radix primitives, Motion, local Magic UI adaptations, and original adaptations inspired by the selected free Aceternity components. No paid template or cloud service is required. See [NOTICE.md](NOTICE.md).
