import type { StitchOptions, StitchOutput } from '../types';
import { stitchImages } from './stitch-pipeline';
import { throwIfAborted, workerRequest, WorkerUnavailableError } from './async';
export async function runStitch(blobs: Blob[], options: StitchOptions, signal: AbortSignal, report: (value: number, message: string) => void): Promise<StitchOutput> {
    throwIfAborted(signal);
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
        return stitchImages(blobs, options, report, signal);
    try {
        return await workerRequest<StitchOutput>(() => new Worker(new URL('../workers/stitch.worker.ts', import.meta.url), { type: 'module' }), { blobs, options }, signal, report);
    }
    catch (error) {
        throwIfAborted(signal);
        if (!(error instanceof WorkerUnavailableError))
            throw error;
        report(0, 'Using this browser’s compatibility renderer');
        return stitchImages(blobs, options, report, signal);
    }
}
