/** Preserve installed runtime dependency licenses in the published static build. */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const notices = ['SCREENSHOT STITCH — THIRD-PARTY NOTICES', 'Generated from the committed dependency lockfile. Packages retain their own licenses.'];
const inventory = [];
for (const [relative, entry] of Object.entries(lock.packages)) {
  if (!relative.startsWith('node_modules/') || entry.dev) continue;
  const folder = path.join(root, relative);
  let pkg;
  try { pkg = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && entry.optional) continue; throw error; }
  const licenseFiles = (await readdir(folder)).filter(name => /^(license|licence|copying|notice)(\.|$)/i.test(name));
  const item = { name: pkg.name, version: pkg.version, license: pkg.license ?? 'See package license', repository: pkg.repository, files: licenseFiles };
  inventory.push(item);
  notices.push('\n' + '='.repeat(72), `${pkg.name}@${pkg.version}`, `Declared license: ${item.license}`);
  if (pkg.author) notices.push(`Author: ${typeof pkg.author === 'string' ? pkg.author : JSON.stringify(pkg.author)}`);
  if (pkg.repository) notices.push(`Repository: ${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url}`);
  for (const name of licenseFiles) { try { notices.push(`\n--- ${name} ---\n` + await readFile(path.join(folder, name), 'utf8')); } catch (error) { if (error.code !== 'EISDIR') throw error; } }
  if (!licenseFiles.length) notices.push('This package does not ship a root license text. Its declared license and upstream repository are recorded above.');
}
// The English trained model is Apache-2.0 independently of its npm wrapper.
notices.push('\n' + '='.repeat(72), 'English Tesseract trained model', 'Source: https://github.com/naptha/tessdata', 'License: Apache-2.0', await readFile(path.join(root, 'node_modules/tesseract.js-core/LICENSE'), 'utf8'));
const extra = path.join(root, 'docs/licenses');
try { for (const name of (await readdir(extra)).sort()) notices.push(`\n--- ${name} ---\n`, await readFile(path.join(extra, name), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(path.join(root, 'public'), { recursive: true });
await writeFile(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'), notices.join('\n') + '\n');
await writeFile(path.join(root, 'public/dependency-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(`Preserved license notices for ${inventory.length} installed runtime packages.`);
