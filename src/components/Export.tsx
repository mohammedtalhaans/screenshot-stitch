import { useEffect, useRef, useState } from 'react';
import { Download, Copy, Share2, ArrowLeft, ArrowUpRight, Check, Image, AlertTriangle, LoaderCircle } from 'lucide-react';
import type { Redaction, StitchedImage } from '../types';
import { createExport, saveBlob, safeFilename } from '../lib/export-client';
import { formatBytes } from '../lib/utils';
import { Button } from './ui/button';

type ExportAction = '' | 'copy' | 'copied' | 'share' | 'shared';

export function Export({ result, redactions, onBack, onNew, onError }: {
    result: StitchedImage;
    redactions: Redaction[];
    onBack: () => void;
    onNew: () => void;
    onError: (message: string) => void;
}) {
    const [blob, setBlob] = useState<Blob | null>(null);
    const [url, setUrl] = useState('');
    const [scale, setScale] = useState(1);
    const [name, setName] = useState('screenshot-stitch');
    const [reviewed, setReviewed] = useState(false);
    const [busy, setBusy] = useState(true);
    const [failure, setFailure] = useState('');
    const [saved, setSaved] = useState(false);
    const [action, setAction] = useState<ExportAction>('');
    const [previewZoom, setPreviewZoom] = useState<'fit' | 'actual'>('fit');
    const pendingAction = useRef(false);
    const generation = useRef(0);
    const preview = useRef<HTMLDivElement>(null);
    const active = redactions.filter(redaction => redaction.enabled);
    const visual = active.some(redaction => redaction.style !== 'solid');
    const exportWidth = Math.round(result.width * scale);
    const exportHeight = Math.round(result.height * scale);
    const actionPending = action === 'copy' || action === 'share';
    const ready = !!blob && reviewed && !busy && !failure && !actionPending;
    const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
    const shareFile = blob ? new File([blob], safeFilename(name), { type: 'image/png' }) : null;
    const canShare = (() => {
        try {
            return !!shareFile && typeof navigator.share === 'function'
                && typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] });
        } catch {
            return false;
        }
    })();

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        generation.current += 1;
        pendingAction.current = false;
        setBusy(true);
        setFailure('');
        setBlob(null);
        setUrl('');
        setSaved(false);
        setReviewed(false);
        setAction('');

        createExport(result, redactions, scale, controller.signal)
            .then(exported => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(exported);
                setBlob(exported);
                setUrl(objectUrl);
            })
            .catch(error => {
                if (!controller.signal.aborted) setFailure(error instanceof Error ? error.message : 'Export failed.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setBusy(false);
            });

        return () => {
            generation.current += 1;
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [result, redactions, scale]);

    useEffect(() => {
        if (action !== 'copied' && action !== 'shared') return;
        const timer = window.setTimeout(() => setAction(''), 3500);
        return () => window.clearTimeout(timer);
    }, [action]);

    useEffect(() => {
        if (preview.current) {
            preview.current.scrollTop = 0;
            preview.current.scrollLeft = 0;
        }
    }, [url]);

    const changeName = (value: string) => {
        setName(value);
        setSaved(false);
        setAction('');
    };

    const save = () => {
        if (!blob || !ready || pendingAction.current) return;
        saveBlob(blob, safeFilename(name));
        setAction('');
        setSaved(true);
    };

    const copy = async () => {
        if (!blob || !ready || pendingAction.current) return;
        const currentGeneration = generation.current;
        pendingAction.current = true;
        setAction('copy');
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            if (currentGeneration === generation.current) setAction('copied');
        } catch {
            if (currentGeneration === generation.current) {
                setAction('');
                onError('Clipboard access was denied or is unsupported for this image. Save the PNG instead.');
            }
        } finally {
            if (currentGeneration === generation.current) pendingAction.current = false;
        }
    };

    const share = async () => {
        if (!shareFile || !ready || pendingAction.current) return;
        const currentGeneration = generation.current;
        pendingAction.current = true;
        setAction('share');
        try {
            await navigator.share({ files: [shareFile], title: 'Screenshot Stitch' });
            if (currentGeneration === generation.current) setAction('shared');
        } catch (error) {
            if (currentGeneration === generation.current) {
                setAction('');
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    onError('This device could not share the file. Save the PNG instead.');
                }
            }
        } finally {
            if (currentGeneration === generation.current) pendingAction.current = false;
        }
    };

    const status = busy ? 'Preparing your PNG…'
        : failure ? 'Export could not finish. Return to editing and try again.'
        : action === 'copy' ? 'Copying image to clipboard…'
        : action === 'copied' ? 'Image copied to clipboard.'
        : action === 'share' ? 'Opening your device’s share sheet…'
        : action === 'shared' ? 'Image shared.'
        : saved ? 'Download requested. Check your browser’s downloads.'
        : reviewed ? 'Ready to download.' : '';

    return <main className="export-page workspace-page" id="main-content" tabIndex={-1}>
        <div className="page-heading">
            <div>
                <span className="eyebrow">Export</span>
                <h1>{saved ? 'Download requested' : 'Save your image'}</h1>
                <p>{saved ? 'Check your browser’s downloads for the PNG.' : 'Check the full image, then download a PNG with your edits applied.'}</p>
            </div>
            <Button variant="ghost" onClick={onBack} disabled={actionPending}><ArrowLeft size={15}/>Back to editing</Button>
        </div>

        <div className="export-grid">
            <section className="export-preview-shell" aria-label="Export preview">
                <div className="export-preview-header">
                    <span><Image size={15}/>Final image</span>
                    <div className="export-preview-controls" role="group" aria-label="Preview zoom">
                        <Button size="sm" variant="ghost" aria-pressed={previewZoom === 'fit'} disabled={busy || !!failure} onClick={() => setPreviewZoom('fit')}>Fit width</Button>
                        <Button size="sm" variant="ghost" aria-pressed={previewZoom === 'actual'} disabled={busy || !!failure} onClick={() => setPreviewZoom('actual')}>Actual size</Button>
                    </div>
                </div>
                <div ref={preview} className={'export-paper-wrap preview-' + previewZoom} tabIndex={0} role="region" aria-label="Final image preview" aria-busy={busy}>
                    {busy ? <div className="export-building"><LoaderCircle size={28} className="spinning"/><span>Preparing your PNG…</span></div>
                        : failure ? <div className="export-building"><AlertTriangle size={26}/><strong>Couldn’t create this export</strong><p>{failure}</p><Button onClick={onBack}>Return to editor</Button></div>
                            : <img className="export-paper" src={url} width={exportWidth} height={exportHeight} style={{ width: exportWidth, maxWidth: previewZoom === 'actual' ? 'none' : '100%', height: 'auto', flexShrink: 0 }} alt="Final flattened redacted screenshot. Inspect the entire image before confirming."/>}
                </div>
                <div className="export-preview-footer"><span>{previewZoom === 'actual' ? 'Actual pixels · scroll to inspect' : 'Scroll to inspect the full image'}</span><span className="export-dimensions">{exportWidth} × {exportHeight} px</span></div>
            </section>

            <aside className="export-panel" aria-labelledby="export-settings-title">
                <h2 id="export-settings-title">Export settings</h2>
                <p className="export-summary"><strong>{active.length}</strong> area{active.length === 1 ? '' : 's'} covered. Edits are flattened into the PNG.</p>

                <div className="export-file-field">
                    <label htmlFor="export-filename">FILE NAME</label>
                    <div><input id="export-filename" value={name} onChange={event => changeName(event.target.value)} maxLength={80} disabled={actionPending} autoComplete="off" spellCheck={false}/><span>.png</span></div>
                </div>
                <label className="resolution-field"><span>EXPORT SIZE</span><select value={scale} onChange={event => setScale(Number(event.target.value))} aria-label="Export size" disabled={actionPending}>
                    <option value={1}>Full resolution · {result.width}px wide</option>
                    <option value={.75}>Medium · {Math.round(result.width * .75)}px wide</option>
                    <option value={.5}>Small · {Math.round(result.width * .5)}px wide</option>
                </select></label>
                <div className="export-file-details"><span><Image size={14}/>PNG image</span><span>{blob ? formatBytes(blob.size) : failure ? 'Unavailable' : 'Preparing…'}</span></div>

                {visual && <div className="export-warning"><AlertTriangle size={17}/><p><strong>This image contains blur or pixelation.</strong> Those effects may be reversible or readable. For sensitive information, return to the editor and use solid masks.</p></div>}

                <div className="export-actions">
                    <label className="review-confirmation"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={busy || !!failure || actionPending}/><span>I’ve reviewed the <strong>entire image</strong>. I understand automatic detection can miss personal details.</span></label>
                    {!reviewed && !busy && !failure && <p id="export-review-hint" className="export-review-hint">Confirm your review above to enable download, copy, and sharing.</p>}
                    <Button size="lg" variant="primary" className="full-width" disabled={!ready} aria-describedby={!reviewed && !busy && !failure ? 'export-review-hint' : undefined} onClick={save}><Download size={18}/>{saved ? 'Save another copy' : 'Save clean image'}</Button>
                    <div className="export-secondary">
                        {canCopy && <Button disabled={!ready} onClick={copy}>{action === 'copy' ? <LoaderCircle size={15} className="spinning"/> : action === 'copied' ? <Check size={15}/> : <Copy size={15}/>} {action === 'copy' ? 'Copying…' : action === 'copied' ? 'Copied' : 'Copy image'}</Button>}
                        {canShare && <Button disabled={!ready} onClick={share}>{action === 'share' ? <LoaderCircle size={15} className="spinning"/> : <Share2 size={15}/>} {action === 'share' ? 'Sharing…' : 'Share'}</Button>}
                    </div>
                    <p className="export-action-status" role="status" aria-live="polite" aria-atomic="true">{status}</p>
                    {saved && <Button variant="ghost" className="full-width new-session" onClick={onNew} disabled={actionPending}>Start a new story<ArrowUpRight size={14}/></Button>}
                </div>
                <p className="export-local-promise">Created on your device. Your original screenshots stay in this tab.</p>
            </aside>
        </div>
    </main>;
}
