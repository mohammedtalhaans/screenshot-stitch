import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const compiled = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.offline-check');
async function localModules(directory = compiled, result: Record<string, string> = {}) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory())
            await localModules(filename, result);
        else if (entry.name.endsWith('.js'))
            result[path.relative(compiled, filename).split(path.sep).join('/')] = await readFile(filename, 'utf8');
    }
    return result;
}
test('real canvas, module workers, fallback, metadata and export pixel invariants', async ({ page }, testInfo) => {
    // Chromium requires a same-origin document for module-worker blob imports.
    // This isolated fixture has no app CSP because we inject the actual engine
    // modules as blobs. Application tests separately enforce the production CSP.
    await page.route('**/__engine__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Engine checks</title><body></body></html>' }));
    await page.goto('/__engine__');
    const requests: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url()))
        requests.push(request.url()); });
    const modules = await localModules();
    // Uses the actual engine modules, not mocked pixel operations. Worker cases
    // require the native canvas capability that the app itself checks; browsers
    // without it still run every canvas fallback and exact redaction assertion.
    const results = await page.evaluate(async (modules) => {
        const urls = new Map<string, string>();
        const resolve = (base: string, relative: string) => {
            const parts = base.split('/');
            parts.pop();
            for (const part of relative.split('/')) {
                if (part === '..')
                    parts.pop();
                else if (part !== '.')
                    parts.push(part);
            }
            return parts.join('/');
        };
        const load = (filename: string): string => {
            const cached = urls.get(filename);
            if (cached)
                return cached;
            let source = modules[filename];
            if (!source)
                throw new Error(`Missing engine module: ${filename}`);
            source = source.replace(/(from\s*['"]|import\s*['"])(\.[^'"]+)(['"])/g, (_, before, target, after) => before + load(resolve(filename, target)) + after);
            source = source.replace(/(new URL\(['"])(\.[^'"]+)(['"])/g, (_, before, target, after) => before + load(resolve(filename, target)) + after);
            const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
            urls.set(filename, url);
            return url;
        };
        try {
            const { browserCases } = await import(/* @vite-ignore */ load('tests/browser-cases.js')) as {
                browserCases: {
                    name: string;
                    run: () => Promise<void>;
                    requiresModuleWorker?: boolean;
                }[];
            };
            const outcomes = [];
            for (const item of browserCases) {
                if (item.requiresModuleWorker && (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')) {
                    outcomes.push({ name: item.name, passed: false, skipped: true, reason: 'Native OffscreenCanvas worker rendering is unavailable; canvas fallback cases run below.' });
                    continue;
                }
                try {
                    await item.run();
                    outcomes.push({ name: item.name, passed: true });
                }
                catch (error) {
                    outcomes.push({ name: item.name, passed: false, error: String(error) });
                }
            }
            return outcomes;
        }
        finally {
            for (const url of urls.values())
                URL.revokeObjectURL(url);
        }
    }, modules);
    await testInfo.attach('pixel-invariants', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    expect(results.filter(item => !item.passed && !('skipped' in item && item.skipped))).toEqual([]);
    expect(requests).toEqual([]);
});
