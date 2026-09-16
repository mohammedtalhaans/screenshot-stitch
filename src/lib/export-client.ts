import type { Redaction, StitchedImage } from '../types';
import { renderExport } from './render';
import { throwIfAborted, workerRequest, WorkerUnavailableError } from './async';
export { safeFilename } from './filename';
export async function createExport(image: StitchedImage, redactions: Redaction[], scale: number, signal?: AbortSignal): Promise<Blob> {
    throwIfAborted(signal);
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
        return renderExport(image.blob, image.width, image.height, redactions, scale, signal);
    try {
        return await workerRequest<Blob>(() => new Worker(new URL('../workers/export.worker.ts', import.meta.url), { type: 'module' }), { blob: image.blob, width: image.width, height: image.height, redactions, scale }, signal);
    }
    catch (error) {
        throwIfAborted(signal);
        if (!(error instanceof WorkerUnavailableError))
            throw error;
        return renderExport(image.blob, image.width, image.height, redactions, scale, signal);
    }
}
export function saveBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
