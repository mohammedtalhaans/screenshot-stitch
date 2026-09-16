# Architecture

## Runtime data path

```
File picker / drop / paste
  → signature, header, animation, dimensions and budget checks
  → ordered Screenshot[] (Blob + temporary object URL)
  → stitch worker: normalization → overlap search → conservative chrome removal
  → StitchedImage (fresh PNG Blob + seams + warnings)
  → local Tesseract worker: English OCR in overlapping tiles
  → detection worker: patterns, contextual names, QR / barcodes
  → optional native FaceDetector
  → Review: immutable Redaction[] + bounded edit history
  → export worker: original pixels → visual patches → solid patches → fresh PNG
  → user-confirmed download / clipboard / native share
```

The diagram describes code execution, not network transmission. Worker messages transfer local Blobs and objects within the browser. No user content is sent to a server.

## State and cancellation

App owns the current phase, source images, stitched image, progress, findings, and warnings. A session-generation counter invalidates late import/demo work. AbortControllers cancel processing and export. Worker orchestration handles construction failure, progress messages, timeout, abort, deserialization error, normal result, and cleanup.

The history reducer is independent of React. It holds present/past/future and an optional transaction. Pointer-down begins a transaction, movement previews, and pointer-up commits one undo entry. Pointer cancellation restores the transaction's original value. A new edit clears redo. Reset removes all retained edit states. History is bounded to 60 prior entries.

Changing seams rebuilds the image and intentionally reruns detection instead of applying old image-coordinate masks to potentially different content. The dialog warns the user before this destructive edit.

## Pixel matching

Images normalize to a common working width. A 144px-wide grayscale view preserves full vertical resolution. Every eligible vertical offset is scored using horizontally distributed samples with texture/gradient weighting. Promising candidates are rescored at higher density. Flat regions, high error, and ambiguous repetitive patterns reduce confidence. Exact duplicate detection is separate from ordinary overlapping content.

Chrome trimming searches for shared structured top/bottom bands with a boundary where screenshots differ. It avoids trimming only because whitespace matches. The first header and last footer remain in the final image. All actual export rows are composed from the normalized image surfaces, not the grayscale matching data.

The algorithm handles vertical translation at a shared width. It does not estimate perspective, rotation, arbitrary horizontal displacement, animation, or changes in screenshot zoom. Low confidence prompts manual review.

## OCR and detection

Tesseract receives explicitly configured same-origin worker, core, and language paths. Structured blocks are requested because text-only output has insufficient geometry. Overlapping tiles bound the per-recognition canvas. Words map back to full-image coordinates before redaction rules run. Pattern findings can appear progressively during reading.

Rules combine positional text patterns and context, including email/phone/handle/address/order/tracking/links/payment candidates, Luhn/IBAN checks, and name suggestions. Contextual NER uses compromise in a detection worker. Confidence indicates a heuristic suggestion, not a calibrated probability of safety. Presets leave ordinary contextual links visible but retain credential-bearing URL detections.

The code detector uses iterative QR decoding followed by best-effort barcode decoding. Barcode result points can underdescribe the full code, so an enlarged, lower-confidence box requires inspection. Native face detection is capability-dependent and cannot guarantee every avatar/photo is found.

OCR failure does not discard a successful stitch. The review screen remains usable for manual masking and displays warnings. There is no fallback to cloud recognition.

## Rendering and review

Redaction geometry is always stored in original working-image coordinates, independent of zoom. The canvas viewport transforms those coordinates for display. Pixel patches are in a separate layer from interactive outlines/handles. Visual patch paint order puts solids last; selecting an outline cannot change that order.

Export validates sizes and active geometry, draws the source on an opaque surface, paints blur/pixelated effects, paints solid masks last, and encodes a fresh PNG. The application does not copy source metadata. Output size is limited and lowering it requires a new review confirmation. Clipboard/native sharing are optional capability-driven alternatives to downloading.

## Build and hosting

Vite emits a static bundle with relative asset URLs. The build asset script copies the local English model, Tesseract worker, and all required core variants out of installed npm packages. A hash manifest describes those copied assets. A source ZIP is generated from an allowlist and contains no runtime image sessions, secrets, symlink targets, node_modules, or arbitrary root files.

The generated source archive and OCR data can make the final site much larger than the initial UI JavaScript. OCR is dynamically imported when processing begins. There is no service worker or promise of offline operation before the necessary static assets have loaded.

The GitHub Actions workflow deploys only after its release gates pass, from a committed lockfile. The local test server verifies root and project-prefix hosting without becoming part of the runtime architecture.
