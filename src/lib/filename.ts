export function safeFilename(value: string): string {
    const name = value.replace(/\.png$/i, '').replace(/[^a-zA-Z0-9_ -]/g, '').trim().slice(0, 80);
    // Avoid Windows device names, including a name with an extension removed.
    const safe = !name || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name) ? 'screenshot-stitch' : name;
    return `${safe}.png`;
}
