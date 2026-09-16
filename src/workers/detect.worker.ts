import nlp from 'compromise';
import { detectSensitive } from '../lib/detection';
import { detectCodes } from '../lib/codes';
import type { OcrLine, Preset } from '../types';

type Request = {
    type: 'text';
    lines: OcrLine[];
    width: number;
    height: number;
    preset: Preset;
} | {
    type: 'codes';
    blob: Blob;
    width: number;
    height: number;
};
self.onmessage = async ({ data }: { data: Request }) => {
    try {
        if (data.type === 'text') {
            const text = data.lines.map(line => line.text).join('\n');
            const names = nlp(text).people().out('array') as string[];
            self.postMessage({ type: 'result', result: detectSensitive(data.lines, data.width, data.height, data.preset, names) });
            return;
        }
        const result = await detectCodes(data, undefined, value => self.postMessage({ type: 'progress', value }));
        self.postMessage({ type: 'result', result });
    }
    catch (error) {
        self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Local detection failed.' });
    }
};
