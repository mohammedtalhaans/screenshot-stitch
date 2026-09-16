# Notices and credits

Application code is covered by LICENSE. Third-party dependencies retain their respective copyrights and license terms; the application license does not relicense them. The compiled site includes generated THIRD_PARTY_NOTICES.txt and dependency-inventory.json; the source archive contains the script that produces them from locked, installed runtime packages.

## UI component acknowledgements

The local, restyled primitive wrappers in `src/components/ui` follow the shadcn/ui approach and use Radix primitives. shadcn/ui: **Copyright (c) 2023 shadcn**, MIT License. Upstream: https://github.com/shadcn-ui/ui/blob/main/LICENSE.md

The local Number Ticker, Border Beam, and Blur Fade adaptations acknowledge Magic UI: **Copyright (c) Magic UI**, MIT License. Upstream: https://github.com/magicuidesign/magicui/blob/main/LICENSE.md

The MIT permission and warranty terms in this repository's LICENSE apply to these MIT-licensed adaptations as well, with the preceding upstream copyright notices preserved.

The file upload, glowing-border interaction, and comparison implementations in `src/components/aceternity` are customized local adaptations inspired by the selected free Aceternity UI component patterns, using Motion and react-dropzone. No Aceternity Pro block, paid template, or paid product is bundled. Upstream component catalogue: https://ui.aceternity.com/components

## Runtime and build dependencies

React / React DOM, TypeScript, Vite, Tailwind CSS, Motion, Lucide, Radix UI, class-variance-authority, clsx, tailwind-merge, react-dropzone, Tesseract.js and its core/English language package, compromise, jsQR, ZXing, qrcode, fflate, Vitest, and Playwright are declared in package.json. Preserve the license files distributed with those packages when distributing their assets. The release build records 116 installed runtime packages and preserves their shipped root license/notice files. Packages without a root license text are explicitly identified by their declared license and upstream repository rather than assigned an invented copyright notice.

Relevant primary implementation references:

- Tesseract.js API: https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- Tesseract local installation: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
- Vite static deployment: https://vite.dev/guide/static-deploy.html
- Playwright test documentation: https://playwright.dev/docs/intro
- PNG header and chunk layout: https://www.w3.org/TR/PNG-Chunks.html
- WebP container layout: https://developers.google.com/speed/webp/docs/riff_container

The English trained model is Apache-2.0 independently of the npm wrapper: https://github.com/naptha/tessdata. The Apache license and Leptonica license are also preserved in docs/licenses and the generated static notices.

All included screenshot fixtures are synthetic. No externally sourced photos, copyrighted screenshot collections, or font files are included. The interface uses platform fonts.
