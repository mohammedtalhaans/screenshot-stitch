import type { Category, OcrLine, Preset, Redaction, Rect } from '../types';
import { expandRect, intersection, intersectionOverUnion, unionRect } from './geometry';
export function luhnValid(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits))
        return false;
    let sum = 0, double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = Number(digits[i]);
        if (double) {
            n *= 2;
            if (n > 9)
                n -= 9;
        }
        sum += n;
        double = !double;
    }
    return sum % 10 === 0;
}
export function ibanValid(value: string): boolean {
    const s = value.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s))
        return false;
    const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let remainder = 0;
    for (const digit of digits)
        remainder = (remainder * 10 + Number(digit)) % 97;
    return remainder === 1;
}
const uiWords = new Set(['Order Summary', 'Order Details', 'Payment Details', 'Shipping Address', 'Delivery Address', 'Contact Information', 'Account Settings', 'Privacy Settings', 'Customer Support', 'New Message', 'Read More', 'See More', 'Good Morning', 'Thank You', 'Add Friend', 'Your Order', 'Payment Method']);
export function enabledForPreset(category: Category, preset: Preset): boolean {
    // Context presets only preserve ordinary links; personal identifiers stay protected.
    if (category === 'link' && preset !== 'strict')
        return false;
    return true;
}
function lineMapping(line: OcrLine) {
    let text = '';
    const ranges: {
        start: number;
        end: number;
        rect: Rect;
    }[] = [];
    for (const word of line.words) {
        if (text)
            text += ' ';
        const start = text.length;
        text += word.text;
        ranges.push({ start, end: text.length, rect: { x: word.bbox.x0, y: word.bbox.y0, width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0 } });
    }
    return { text, ranges };
}
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function detectSensitive(lines: OcrLine[], width: number, height: number, preset: Preset = 'strict', personNames: string[] = []): Redaction[] {
    const result: Redaction[] = [];
    let nextId = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex], { text, ranges } = lineMapping(line);
        if (!text.trim())
            continue;
        const add = (category: Category, start: number, end: number, confidence: number) => {
            const boxes = ranges.filter(r => r.end > start && r.start < end).map(r => r.rect);
            if (!boxes.length)
                return;
            const rect = expandRect(unionRect(boxes), Math.max(4, unionRect(boxes).height * .16), width, height);
            result.push({ ...rect, id: `ocr-${lineIndex}-${nextId++}`, category, confidence: Math.max(.2, Math.min(.99, confidence * (.7 + .3 * (Number.isFinite(line.confidence) ? Math.max(0, Math.min(100, line.confidence)) : 70) / 100))), text: text.slice(start, end), enabled: enabledForPreset(category, preset), style: 'solid', source: 'ocr' });
        };
        const match = (regex: RegExp, category: Category, confidence: number, validate?: (s: string) => boolean) => {
            for (const m of text.matchAll(regex))
                if (!validate || validate(m[0]))
                    add(category, m.index!, m.index! + m[0].length, confidence);
        };
        match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi, 'email', .99);
        match(/(?<![\w@])@[A-Za-z0-9_][A-Za-z0-9_.-]{1,31}\b/g, 'handle', .96);
        // Private URL tokens stay protected even when a context preset preserves ordinary links.
        match(/\bhttps?:\/\/[^\s<>]*[?&](?:access_token|token|auth|api_key|key|session|email|user_?id|order_?id|signature|code)=[^\s<>]+/gi, 'identifier', .98);
        match(/\b(?:https?:\/\/|www\.)[^\s<>]+/gi, 'link', .96);
        match(/\b(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:com|org|net|io|co|app|dev|me|au|uk)(?:\/[^\s]*)?/gi, 'link', .82);
        match(/(?<![\w])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d[\d\s().-]{5,}\d(?![\w])/g, 'phone', .91, value => {
            const digits = value.replace(/\D/g, '');
            return digits.length >= 7 && digits.length <= 15 && !/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(value.trim()) && !luhnValid(value);
        });
        match(/(?<!\w)(?:\d[ -]?){12,18}\d(?!\w)/g, 'payment', .99, luhnValid);
        match(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g, 'payment', .98, ibanValid);
        match(/\b(?:card(?:\s+(?:number|ending|ends\s+in))?|account(?:\s+(?:number|no\.?))?|routing(?:\s+number)?|BSB|IBAN|SWIFT|CVV|CVC|expiry|expires)\s*[:#-]?\s*(?=[\w *•.-]*\d)[\w *•./-]{3,40}/gi, 'payment', .89);
        match(/\b(?:order|tracking|reference|confirmation|transaction|invoice|booking|receipt|shipment)(?:\s+(?:id|no\.?|number))?\s*[:#-]?\s*(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{3,35}\b/gi, 'identifier', .96);
        match(/\b1Z[A-HJ-NP-Z0-9]{16}\b/gi, 'identifier', .96);
        match(/\b\d{1,6}[A-Z]?\s+(?:[A-Z0-9.'-]+\s+){1,7}(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|way|court|ct\.?|place|pl\.?|terrace|crescent)\b(?:[^\n;]{0,45})/gi, 'address', .92);
        match(/\bP\.?\s*O\.?\s+Box\s+\d+(?:[^\n;]{0,35})/gi, 'address', .93);
        // Explicit labels provide a useful second signal when English NER misses a name.
        const named = text.match(/\b(?:name|recipient|customer|ship to|deliver to|from|to)\s*:\s*([A-Z][a-z]+(?:[ '-][A-Z][a-z]+){1,3})\b/i);
        if (named) {
            const start = text.indexOf(named[1], named.index);
            add('name', start, start + named[1].length, .82);
        }
        for (const name of new Set(personNames)) {
            if (name.length < 3 || uiWords.has(name))
                continue;
            match(new RegExp(`(?<![\\w@])${escapeRegex(name)}(?!\\w)`, 'g'), 'name', name.includes(' ') ? .78 : .59);
        }
        // Address continuation lines are included, not just the first street line.
        const previous = lines[lineIndex - 1]?.text ?? '';
        if (/\b(?:address|ship to|deliver to)\s*:?\s*$/i.test(previous) && text.length < 100)
            add('address', 0, text.length, .68);
        if (/\b(?:street|road|avenue|lane|drive|boulevard)\b/i.test(previous) && /\b[A-Z]{2}\s+\d{4,6}\b/.test(text))
            add('address', 0, text.length, .8);
    }
    return deduplicateRedactions(result);
}
export function deduplicateRedactions(items: Redaction[]): Redaction[] {
    const priority: Partial<Record<Category, number>> = { payment: 10, email: 9, address: 8, identifier: 7, phone: 6, handle: 5, code: 5, name: 3, link: 1 };
    const sorted = [...items].sort((a, b) => (priority[b.category] ?? 0) - (priority[a.category] ?? 0) || b.confidence - a.confidence);
    const kept: Redaction[] = [];
    for (const item of sorted) {
        const redundant = kept.some(existing => {
            const common = intersection(existing, item);
            // Never let a disabled suggestion suppress a protected one.
            if (item.enabled && !existing.enabled)
                return false;
            return intersectionOverUnion(existing, item) > .58 || common / Math.max(1, item.width * item.height) > .84;
        });
        if (!redundant)
            kept.push(item);
    }
    return kept.sort((a, b) => a.y - b.y || a.x - b.x).map((item, index) => ({ ...item, id: `detected-${index}-${Math.round(item.x)}-${Math.round(item.y)}` }));
}
