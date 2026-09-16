# Screenshot Stitch 1.2.0 — validation

Verified September 12, 2026 on Windows with Node 24 and the locked dependencies.

- TypeScript application/configuration/tests: passed.
- Production build: passed. Fonts, OCR, workers and assets are local to the site.
- Vitest: 90 passed. The shared offline runner also passed the same 90 cases.
- Browser coverage: 60 distinct tests across desktop Chromium, mobile Chromium and WebKit, verified using full-suite runs and focused reruns after fixes. All scenarios passed; the last focused session-restoration run passed in all three profiles.
- Accessibility: axe checks passed on eight major screens/dialogs in each browser profile after contrast fixes.
- Responsive landing: no horizontal overflow at 320, 390, 768 and 1280px.
- Captures: 12 current desktop/mobile screens plus two actual downloaded synthetic examples in release-screenshots/1.2.0.

Browser tests cover real stitching, English OCR, QR detection, exact solid-mask pixels, source ZIP and project-prefix URLs, screenshot ordering, manual mask gestures and keyboard controls, true pixel zoom and both fit modes, preserved image position during zoom, numeric edits, undo/redo, comparison, flattened PNG downloads, review gating, device handoff states, cancellation, failure recovery and resumed sessions.

The last checks found and fixed a mobile error toast overlapping the fixed scan button. Canceled and failed rebuilds retain the previous masks, source images, undo history, zoom and selection. A completed new build replaces the old edit. Modal Escape no longer clears the selected mask, and reduced-motion styles no longer animate geometry during zoom.

Windows WebKit lacks OffscreenCanvas: three worker-only pixel subcases are explicitly marked unsupported, while canvas compatibility and real app flows run. Chromium verifies native canvas workers. PNG round-trip comparisons allow the previously established one-level RGB rounding; solid mask color, alpha, dimensions and coverage remain exact.

This is browser emulation, not physical-device testing or an arbitrary-image accuracy benchmark. Review the entire output and use solid masks for secrets. Clipboard/share support varies by browser. The site is prepared for GitHub Pages but has not been deployed to a repository.

Reproduce with npm ci, npx playwright install --with-deps chromium webkit, and npm run verify. Do not rebuild dist while tests are running. Current test port: 5187 (override with TEST_PORT).
