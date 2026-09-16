# Security model

Screenshot Stitch assists redaction; it does not certify that an image is safe to publish.

## What is protected by the implementation

The application has no upload API, analytics, accounts, database, cloud OCR, remote recognition request, or session persistence feature. Runtime OCR assets use explicit same-site URLs. Production HTML includes a restrictive Content Security Policy: same-site code and connections, blob workers/images, no object plugins, and no form submission. There are no third-party fonts or runtime CDN imports.

Input handling checks actual file signatures, accepted-format headers, compressed size, dimensions, animation flags, batch count, and working pixel budgets. Native decoding remains responsible for validating the actual compressed image. Image engines are not a sandbox for malicious browser exploits; browsers must be kept current.

Image data stays in local objects and canvases until the user deliberately saves, copies, or shares the flattened output. Object URLs, canvases, workers, and session history are released on completion/reset/unmount where applicable. Export validates geometry and dimensions before rendering. Solid masks are painted after visual effects. The final file is encoded from a new canvas, not copied from the original container.

## What is not guaranteed

OCR, named-entity rules, face detection, and barcode localization can miss details or select too little of a region. A correctly rendered solid rectangle only protects the pixels it actually covers. The user must inspect the entire image and every important boundary.

Blur/pixelation is not cryptographic or secure redaction. The app warns about these styles in both editing and export. Automatic completion does not mean privacy completeness.

Closing a tab is not secure erasure. Browser/OS memory, extensions, swap, screenshots taken by the OS, cached static assets, downloads, and clipboard contents are not controlled by this project. The host can serve modified JavaScript; use a trusted deployment or build and serve the source yourself. CSP narrows some attack paths but does not make malicious same-origin code trustworthy.

There is no independent security audit or certification. See VALIDATION.md for the tests actually executed for this source delivery.

## Release hygiene

Install from the declared dependencies, commit and review package-lock.json, use npm ci for release builds, run the runtime dependency audit, and require the unit/browser gates. Do not publish a build with failed OCR, project-path, export, or no-outbound-data tests. Do not treat a dependency-free test run as a substitute for those gates.

Test data must be synthetic. Never attach personal screenshots, payment details, original OCR text, or private tokens to a public issue. Do not put them into this repository's documentation or test directories, which are included in its downloadable source archive.

## Reporting a problem

Use a private security advisory on the repository hosting your copy when enabled. Include the affected version, browser, a minimal synthetic reproduction, and the failing behavior. Without a configured private reporting channel, contact that deployment's maintainer privately; do not post the sensitive image publicly. This source package does not invent a maintainer address or promise a response SLA.
