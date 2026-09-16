export function abortError(): DOMException { return new DOMException('Operation cancelled', 'AbortError'); }
export function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted)
    throw abortError(); }
/** Reject promptly on cancellation/timeout, while always observing late rejections. */
export function withDeadline<T>(promise: Promise<T>, milliseconds: number, signal?: AbortSignal, message = 'The operation timed out. Try a smaller image.'): Promise<T> {
    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => { if (timer)
            clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
        const cancel = () => { cleanup(); reject(abortError()); };
        promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
        if (signal?.aborted) {
            cancel();
            return;
        }
        signal?.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => { cleanup(); reject(new Error(message)); }, milliseconds);
    });
}
export class WorkerUnavailableError extends Error {
    constructor(message = 'The browser could not start the image worker.') { super(message); this.name = 'WorkerUnavailableError'; }
}
type WorkerResponse<T> = {
    type: 'result';
    result: T;
} | {
    type: 'progress';
    value: number;
    message?: string;
} | {
    type: 'error';
    message: string;
};
/** All worker requests have cancellation, an inactivity timeout and deterministic cleanup. */
export function workerRequest<T>(factory: () => Worker, payload: unknown, signal?: AbortSignal, progress?: (value: number, message: string) => void, timeout = 120000): Promise<T> {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        let worker: Worker;
        try {
            worker = factory();
        }
        catch {
            reject(new WorkerUnavailableError());
            return;
        }
        let settled = false;
        let timer: ReturnType<typeof setTimeout>;
        const cleanup = () => { clearTimeout(timer); worker.terminate(); signal?.removeEventListener('abort', cancel); };
        const fail = (error: Error) => { if (settled)
            return; settled = true; cleanup(); reject(error); };
        const cancel = () => fail(abortError());
        const arm = () => { clearTimeout(timer); timer = setTimeout(() => fail(new Error('Processing stopped responding. Try fewer images or the compact resolution.')), timeout); };
        worker.onmessage = ({ data }: MessageEvent<WorkerResponse<T>>) => {
            if (settled)
                return;
            if (data.type === 'progress') {
                arm();
                progress?.(data.value, data.message ?? 'Processing locally');
            }
            else if (data.type === 'result') {
                settled = true;
                cleanup();
                resolve(data.result);
            }
            else if (data.type === 'error')
                fail(data.message === 'OFFSCREEN_UNAVAILABLE' ? new WorkerUnavailableError() : new Error(data.message));
        };
        worker.onerror = event => { event.preventDefault(); fail(new WorkerUnavailableError()); };
        worker.onmessageerror = () => fail(new Error('The browser could not read the image worker’s result.'));
        signal?.addEventListener('abort', cancel, { once: true });
        if (signal?.aborted) {
            cancel();
            return;
        }
        arm();
        try {
            worker.postMessage(payload);
        }
        catch {
            fail(new WorkerUnavailableError('The browser could not send images to its worker.'));
        }
    });
}
