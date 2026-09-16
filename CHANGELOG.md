# Changelog

## 1.2.0 — screenshot workspace redesign

- Light workspace with locally hosted Manrope and IBM Plex Sans, restrained screenshot geometry and readable controls.
- Compact mobile editor with Details and Mask controls tabs; stable detail numbering.
- Accurate pixel zoom, Fit width, Fit image, screenshot previews and intentional numeric edits.
- Resume review and recover canceled/failed rebuilds without losing edits.
- Improved export zoom, clipboard/share handoff states, review guidance and mobile error placement.
- Refreshed episode script notes, captures, source and GitHub Pages packages.


## 1.1.1 — episode and Pages polish

- Added home-screen drag-and-drop with useful validation and paste guidance.
- Improved mobile headline fit, reading sizes, editor instructions and desktop inspector labels.
- Added keyboard-only manual-mask creation with selection, movement and undo/redo.
- Prevented image pastes from changing the workspace while a dialog is open.
- Restored the missing Node version file required by GitHub Actions; enforce essential files in source archives.
- Isolated browser tests from unrelated preview servers and made the test port configurable.
- Added a shared QR/barcode decoder with a cancellable canvas fallback for browsers without worker canvas support.
- Kept exact solid-mask/alpha checks while accounting for verified one-level PNG color rounding on WebKit.
- Added episode scripts, recording directions, actual UI captures, Pages instructions and a release packager.

## 1.1.0 — verified static release

- Installed and locked actual dependencies, verified a fresh `npm ci`, and upgraded Vitest to 4.1.11; dependency audit reported zero vulnerabilities.
- Passed complete TypeScript, 90 genuine Vitest cases, Vite production build, and 30 Playwright tests across desktop Chromium, mobile Chromium, and mobile WebKit.
- Verified real Tesseract OCR, QR detection, module workers, canvas pixels, mask gestures, PNG downloads, failure handling, and project-prefixed assets.
- Fixed the hidden upload input's accessible-name collision, mobile footer icon labels, and keyboard scrolling in the export preview.
- Added automated accessibility checks, manual-seam rebuild regression coverage, and downloadable-source ZIP integrity checks.
- Corrected the engine test fixture's opaque origin; real module-worker checks now pass without skipping or weakening the application CSP.
- Added reproducible capture of 40 real desktop/mobile screens, generated dependency notices, model/engine licenses, and updated release documentation.

## 1.1.0-rc.1 — hardening pass

### Correctness and privacy

- Vertical matcher now scores every pixel offset, fixing missed odd-row seams.
- Export rejects malformed rectangles and source dimension mismatches.
- Independent visual-mask and editing-control layers prevent selected blur overlays from repainting solid redactions.
- Solid export masks remain the final paint operation; fractional output edges are conservatively covered.
- Preflight PNG/JPEG/WebP dimensions before native pixel allocation; reject animation, disguised formats, invalid headers, and oversized batches.
- Correct case-insensitive contextual `Name:` detection and prioritize credential-bearing links.
- Repair transaction-based undo/redo, pointer cancellation, canceled async imports, and stale demo/processing results.
- Add worker cleanup, progress-rearmed timeouts, explicit same-origin OCR asset URLs, and late-worker disposal.
- Restrict the downloadable source archive to project files rather than arbitrary developer files.

### Interaction

- Functional drag handles plus keyboard and button reordering.
- Manual-mask tap defaults, reliable drawing-mode exit from comparison, exact geometry controls, and accessible comparison naming.
- Manual seam corrections preserve prior corrections and retain automatic values independently.
- Larger mobile touch targets and clearer control typography.
- Clear OCR/face/barcode limitations, source-host logging disclosure, and persistent access to privacy information.
- Export review confirmation resets when output resolution changes.

### Delivery and testing

- Real Vitest shared cases and full-app Playwright suites, rather than empty configuration files.
- Native pixel tests for stitching, metadata removal, solid coverage, format imports, fallback, and cancellation.
- Separate explicit module-worker tests; a fallback cannot count as worker success.
- GitHub Pages release gates, committed lockfile requirement, dependency audit, browser reports, and Dependabot configuration.
- Setup, deployment, architecture, security, test, and validation documentation.

This entry records implementation changes, not a claim that all production-build gates have already passed. See VALIDATION.md.
