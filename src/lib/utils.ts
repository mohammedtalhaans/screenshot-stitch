import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
export { uid } from './identity';
export const formatBytes = (bytes: number) => bytes < 1000000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1000000).toFixed(1)} MB`;
export const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
export { abortError, throwIfAborted } from './async';
export const assetUrl = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;
