/** Dependency-light verification of the SAME cases used by Vitest.
 * It does not replace a Vite build or browser UI tests. Requires TypeScript,
 * installed either in this project or globally, and Node 22 or newer.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch { const global = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(); ts = require(path.join(global, 'typescript/lib/typescript.js')); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.offline-check');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
let parsed = 0;
async function compile(dir) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) { await compile(relative); continue; }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const source = await readFile(path.join(root, relative), 'utf8');
    const result = ts.transpileModule(source, { fileName: relative, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true, verbatimModuleSyntax: true } });
    const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [];
    if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
    // Node ESM needs extensions; browser tests use this same directory.
    const code = result.outputText.replace(/(from\s*['"]|import\s*['"])(\.[^'"]+)(['"])/g, (all, before, target, after) => {
      if (/\.(js|json|css)$/.test(target)) return all;
      return `${before}${target.endsWith('/types') ? target + '/index.js' : target + '.js'}${after}`;
    }).replace(/(new URL\(['"])([^'"]+)\.ts(['"])/g, '$1$2.js$3');
    const dest = path.join(out, relative.replace(/\.tsx?$/, '.js'));
    await mkdir(path.dirname(dest), { recursive: true }); await writeFile(dest, code); parsed++;
  }
}
await compile('src'); await compile('tests'); await compile('e2e');
await writeFile(path.join(out, 'package.json'), '{"type":"module"}');
// Strict-check the real dependency-free engine modules, not library stubs.
const pure = ['types/index', 'lib/async', 'lib/limits', 'lib/image-header', 'lib/filename', 'lib/history', 'lib/geometry', 'lib/identity', 'lib/detection', 'lib/stitch-algorithm', 'lib/stitch-pipeline', 'lib/stitch-client', 'lib/export-client', 'lib/render', 'lib/files'];
const program = ts.createProgram(pure.map(name => path.join(root, 'src', `${name}.ts`)), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true, skipLibCheck: true, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.webworker.d.ts'] });
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
console.log(`Parsed ${parsed} TypeScript modules; strictly type-checked ${pure.length} engine modules.`);
const { cases } = await import(pathToFileURL(path.join(out, 'tests/core-cases.js')).href);
let failed = 0;
const results = [];
for (const testCase of cases) {
  const start = performance.now();
  try { await testCase.run(); results.push({ name: testCase.name, passed: true, milliseconds: Math.round(performance.now() - start) }); console.log(`PASS ${testCase.name}`); }
  catch (error) { failed++; results.push({ name: testCase.name, passed: false, error: String(error) }); console.error(`FAIL ${testCase.name}\n  ${error.stack ?? error}`); }
}
await writeFile(path.join(out, 'unit-results.json'), JSON.stringify({ runner: 'dependency-light shared-case runner (not Vitest)', parsedModules: parsed, strictModules: pure.length, passed: cases.length - failed, failed, results }, null, 2));
console.log(`\n${cases.length - failed}/${cases.length} shared regression cases passed.`);
process.exitCode = failed ? 1 : 0;
