/** Package the built site, reproducible source and episode assets without dependencies. */
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync, unzipSync, strFromU8 } from 'fflate';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '..');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const prefix = `screenshot-stitch-${version}`;
await mkdir(out, { recursive: true });
async function files(directory, prefix = '', archive = {}) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const file = path.join(directory, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) await files(file, name + '/', archive);
    else archive[name] = new Uint8Array(await readFile(file));
  }
  return archive;
}
const source = await readFile(path.join(root, 'dist/source/screenshot-stitch-source.zip'));
const sourceEntries = unzipSync(new Uint8Array(source));
if (JSON.parse(strFromU8(sourceEntries['screenshot-stitch/package.json'])).version !== version)
  throw new Error('Build the current source before packaging.');
for (const file of ['.node-version', '.github/workflows/pages.yml', 'episode/EPISODE-KIT.md'])
  if (!sourceEntries[`screenshot-stitch/${file}`]) throw new Error(`Source archive is missing ${file}`);
const sourceName = `${prefix}-source.zip`;
await copyFile(path.join(root, 'dist/source/screenshot-stitch-source.zip'), path.join(out, sourceName));
const site = await files(path.join(root, 'dist'));
for (const file of ['index.html', '.nojekyll', 'ocr/worker.min.js', 'ocr/lang/eng.traineddata.gz'])
  if (!(file in site)) throw new Error(`Deployment is missing ${file}`);
const siteName = `${prefix}-github-pages.zip`;
await writeFile(path.join(out, siteName), zipSync(site, { level: 6 }));
const episode = await files(path.join(root, 'episode'), 'episode/');
await files(path.join(root, 'release-screenshots', version), 'gallery/', episode);
const episodeName = `${prefix}-episode-kit.zip`;
await writeFile(path.join(out, episodeName), zipSync(episode, { level: 6 }));
const sums = [];
for (const name of [sourceName, siteName, episodeName]) {
  const bytes = await readFile(path.join(out, name));
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
  console.log(`${name}: ${(bytes.length / 1024 / 1024).toFixed(1)} MiB`);
}
await writeFile(path.join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
