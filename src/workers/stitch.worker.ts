import { stitchImages } from '../lib/stitch-pipeline';
import type { StitchOptions } from '../types';
self.onmessage = async (event: MessageEvent<{
    blobs: Blob[];
    options: StitchOptions;
}>) => {
    try {
        const result = await stitchImages(event.data.blobs, event.data.options, (value, message) => self.postMessage({ type: 'progress', value, message }));
        self.postMessage({ type: 'result', result });
    }
    catch (error) {
        self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Stitching failed.' });
    }
};
