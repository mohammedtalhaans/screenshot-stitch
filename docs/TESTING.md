# Test strategy

## Release gate (required)

```sh
npm ci                              # use the tested, committed lockfile
npx playwright install --with-deps chromium webkit
npm run audit:runtime
npm run verify
```

The complete gate must be run with installed real dependencies. It is not interchangeable with syntax parsing, engine-only tests, or a visually plausible screenshot.

## Unit suite

`tests/core-cases.ts` contains framework-neutral cases. `tests/core.test.ts` registers the same cases with Vitest. It covers pixel overlap matching, confidence boundaries, crop bounds, duplicate handling, geometry, sensitive-text detection, validation, filename sanitization, immutable history, abort/deadline behavior, and worker-lifetime messages.

Worker-lifetime unit cases deliberately use small fake Worker objects to test orchestration. They do not prove that an actual browser can load a production worker or its dependencies. Those are separate checks.

## Native browser image invariants

`tests/browser-cases.ts` uses actual browser image decoders, canvas operations, worker orchestration, and PNG encoding. Synthetic source images make expected pixels exact. Tests include chat-like text, odd-row overlaps, duplicate/intermediate images, headers/footers, manual seams, fallback paths, solid-mask coverage, overlay order, scales, metadata stripping, malformed masks, format import, cancellation, and header memory preflight.

The module-worker cases require a real worker result; a successful main-thread fallback cannot pass them. `e2e/engine.spec.ts` runs all of these cases without skipping module-worker checks.

## Full bundled application

`e2e/flow.spec.ts` runs the real static build, not the Vite development server. It covers:

- Landing controls, keyboard dialogs, and horizontal overflow.
- Actual multi-image imports, invalid file errors, removal, keyboard/button ordering.
- A synthetic screenshot pair through actual stitching and local English Tesseract OCR.
- Comparison, manual drawing, numeric correction, pointer movement/resizing, style warnings, toggles, undo/redo.
- Export review gating, resolution-change invalidation, real PNG download, signature and dimensions.
- Same-origin GET/HEAD-only network behavior during the workflow, and project-prefixed OCR asset paths.
- Explicit OCR asset failure and processing cancellation recovery.
- Real demo screenshots through OCR and QR detection, plus seam-editor controls.

These tests run in desktop Chromium, mobile Chromium, and mobile WebKit. Reports attach real UI screenshots, network/worker observations, and image invariant results. Synthetic test data only: traces and reports must never contain personal screenshots.

A real phone check remains necessary for platform sharing sheets, clipboard permissions, memory pressure, pinch/scroll interaction, and touch resize feel. Automated viewport emulation is not a complete physical-device usability audit.

## Accessibility and release assets

`e2e/accessibility.spec.ts` checks WCAG 2 A/AA and WCAG 2.1 AA rules with axe-core on eight screens/dialogs per browser project, exact manual-seam rebuilding and restoration of the automatic overlap, and the generated source ZIP including its real lockfile. An automated accessibility pass is not a complete manual assistive-technology audit.

## Restricted-environment checks

When package installation is unavailable but TypeScript is installed globally:

```sh
node scripts/test-offline.mjs
```

This strictly checks the dependency-free engine modules and executes the shared unit cases. It transpiles other TypeScript modules for syntax, but cannot establish React/Motion/Tesseract library compatibility.

With Python Playwright and a system Chromium installation:

```sh
python scripts/browser-offline.py
```

This runs local in-memory modules in actual Chromium, with no server or outbound request. The runner does not change managed browser policy. Module-worker capability is probed separately; blocked worker cases are marked **blocked**, not passed. Exit code 0 means all checks passed; 1 means a test failed; 2 means one or more checks were blocked. It cannot validate the React UI or Vite output.

The separate source delivery report states exactly which of these paths were actually executed. Do not publish a release based only on the restricted-environment checks.

## Manual acceptance checklist

For each deployment, inspect the real production build at its final project URL; supplement the automated release gate with a physical-phone check. Confirm screen layout, focus visibility, contrast, reduced motion, pointer/touch gestures, long-image scrolling, save/copy/share, cancellation during OCR, reset cleanup, and a fresh uncached model load. Review synthetic examples of chat, social posts, settings, product pages, repeating content, no overlap, image-only sensitive details, and deliberately incorrect redactions. Confirm there are no unexplained console errors or third-party runtime requests.
