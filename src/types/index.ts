export type Phase = 'landing' | 'prepare' | 'processing' | 'review' | 'export';
export type RedactionStyle = 'solid' | 'pixelate' | 'blur';
export type Category = 'email' | 'phone' | 'handle' | 'name' | 'address' | 'identifier' | 'link' | 'payment' | 'code' | 'face' | 'manual';
export type Preset = 'strict' | 'chat' | 'social' | 'marketplace';
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Redaction extends Rect {
    id: string;
    category: Category;
    confidence: number;
    text: string;
    enabled: boolean;
    style: RedactionStyle;
    source: 'ocr' | 'code' | 'face' | 'manual';
}
export interface Screenshot {
    id: string;
    name: string;
    url: string;
    blob: Blob;
    width: number;
    height: number;
}
export interface Seam {
    index: number;
    overlap: number;
    autoOverlap?: number;
    autoConfidence?: number;
    confidence: number;
    error: number;
    duplicate: boolean;
    manual: boolean;
    position: number;
    maxOverlap: number;
}
export interface StitchOptions {
    trimChrome: boolean;
    maxWidth: number;
    manualOverlaps?: Record<number, number>;
}
export interface StitchOutput {
    blob: Blob;
    width: number;
    height: number;
    seams: Seam[];
    cropTop: number;
    cropBottom: number;
    warnings: string[];
}
export interface StitchedImage extends StitchOutput {
    url: string;
}
export interface Progress {
    stage: 'stitch' | 'ocr' | 'codes';
    value: number;
    message: string;
}
export interface OcrWord {
    text: string;
    confidence: number;
    bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
}
export interface OcrLine {
    text: string;
    words: OcrWord[];
    confidence: number;
}
export interface ScanResult {
    redactions: Redaction[];
    warnings: string[];
    faceSupported: boolean;
}
export const CATEGORY_LABELS: Record<Category, string> = {
    email: 'Email address', phone: 'Phone number', handle: 'Username', name: 'Possible name',
    address: 'Street address', identifier: 'Order / tracking ID', link: 'Link', payment: 'Payment detail',
    code: 'QR / barcode', face: 'Face', manual: 'Manual redaction'
};
export const PRESET_LABELS: Record<Preset, string> = { strict: 'Everything', chat: 'Conversation', social: 'Social post', marketplace: 'Marketplace' };
