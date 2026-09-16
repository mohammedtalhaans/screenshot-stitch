/** Build-time only. Nothing in this script runs in a visitor's browser. */
import { mkdir, readdir, copyFile, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import('./prepare-notices.mjs');
const target = path.join(root, 'public/ocr');
await mkdir(path.join(target, 'core'), { recursive: true });
await mkdir(path.join(target, 'lang'), { recursive: true });
await copyFile(path.join(root, 'node_modules/tesseract.js/dist/worker.min.js'), path.join(target, 'worker.min.js'));
const core = path.join(root, 'node_modules/tesseract.js-core');
let coreCount = 0;
for (const file of await readdir(core)) {
  if (!/^tesseract-core.*\.(wasm|js)$/.test(file)) continue;
  await copyFile(path.join(core, file), path.join(target, 'core', file)); coreCount++;
}
if (!coreCount) throw new Error('Tesseract WASM assets are missing. Run npm install.');
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file)); else files.push(file);
  }
  return files;
}
const languageFiles = (await walk(path.join(root, 'node_modules/@tesseract.js-data/eng'))).filter(file => file.endsWith('eng.traineddata.gz'));
const language = languageFiles.find(file => file.includes('4.0.0_best_int')) ?? languageFiles[0];
if (!language) throw new Error('The packaged English OCR model is missing. Reinstall dependencies.');
await copyFile(language, path.join(target, 'lang/eng.traineddata.gz'));
const manifest = { schema: 1, language: 'English', files: {} };
for (const file of (await walk(target)).sort()) {
  if (file.endsWith('manifest.json')) continue;
  const bytes = await readFile(file);
  manifest.files[path.relative(target, file).replaceAll('\\', '/')] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(path.join(root, 'public/.nojekyll'), '');

// Strict source allowlist: never archive a developer's uploads, environment,
// credentials, node_modules, generated reports, or arbitrary root-level files.
const sourceFiles = ['package.json', 'package-lock.json', 'index.html', 'README.md', 'LICENSE', 'NOTICE.md', 'SECURITY.md', 'VALIDATION.md', 'CHANGELOG.md', '.env.example', '.gitignore', '.node-version', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.tests.json', 'components.json', 'public/favicon.svg', '.github/dependabot.yml'];
const allowedExtensions = /\.(?:tsx?|m?js|json|css|md|txt|html|ya?ml|py)$/;
for (const directory of ['src', 'scripts', 'tests', 'e2e', 'docs', 'episode', '.github/workflows']) {
  try {
    for (const file of await walk(path.join(root, directory))) {
      const relative = path.relative(root, file).replaceAll('\\', '/');
      if (allowedExtensions.test(relative) && !relative.split('/').some(part => part.startsWith('.env') || ['__pycache__', 'node_modules', 'fixtures-private'].includes(part))) sourceFiles.push(relative);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const archive = {};
for (const relative of [...new Set(sourceFiles)].sort()) {
  const file = path.join(root, relative);
  try {
    const info = await lstat(file); if (!info.isFile() || info.isSymbolicLink()) continue;
    archive[`screenshot-stitch/${relative}`] = [new Uint8Array(await readFile(file)), { mtime: new Date('2026-01-01T00:00:00Z') }];
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
// A downloadable source release must be able to rebuild and deploy itself.
// Fail instead of silently publishing an archive with broken CI prerequisites.
for (const required of ['package.json', 'package-lock.json', '.node-version', '.github/workflows/pages.yml', 'scripts/prepare-assets.mjs', 'scripts/prepare-notices.mjs']) {
  if (!archive[`screenshot-stitch/${required}`]) throw new Error(`Required source release file is missing: ${required}`);
}
await mkdir(path.join(root, 'public/source'), { recursive: true });
await writeFile(path.join(root, 'public/source/screenshot-stitch-source.zip'), zipSync(archive, { level: 6 }));
console.log(`Prepared ${coreCount} local OCR engine files, English language data, and an allowlisted source archive.`);
