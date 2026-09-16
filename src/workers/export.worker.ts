import { renderExport } from '../lib/render';
import type { Redaction } from '../types';
self.onmessage = async ({ data }: {
    data: {
        blob: Blob;
        width: number;
        height: number;
        redactions: Redaction[];
        scale: number;
    };
}) => {
    try {
        const blob = await renderExport(data.blob, data.width, data.height, data.redactions, data.scale);
        self.postMessage({ type: 'result', result: blob });
    }
    catch (error) {
        self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Export failed.' });
    }
};
