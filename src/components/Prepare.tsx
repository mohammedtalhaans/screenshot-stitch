import { useState } from 'react';
import { Reorder, AnimatePresence, useDragControls } from 'motion/react';
import { ArrowRight, ArrowUp, ArrowDown, GripVertical, Trash2, Layers, Info, Check, ChevronLeft, ChevronRight, SlidersHorizontal, ScanLine } from 'lucide-react';
import type { Screenshot, Preset, StitchOptions } from '../types';
import { FileUpload } from './aceternity/file-upload';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { formatBytes } from '../lib/utils';

function ScreenshotItem({ image, index, count, onMove, onRemove, onPreview, busy }: {
  image: Screenshot; index: number; count: number; onMove: (index: number, direction: number) => void;
  onRemove: (id: string) => void; onPreview: () => void; busy: boolean;
}) {
  const controls = useDragControls();
  return <Reorder.Item value={image} className="screenshot-item" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} whileDrag={{ zIndex: 20, boxShadow: '0 12px 30px #182b3820' }} dragListener={false} dragControls={controls}>
    <button className="reorder-handle" disabled={busy} aria-label={`Drag screenshot ${index + 1} to reorder, or use arrow keys`} onPointerDown={event => { if (!busy) controls.start(event); }} onKeyDown={event => { if (['ArrowUp','ArrowDown'].includes(event.key)) { event.preventDefault(); onMove(index, event.key === 'ArrowUp' ? -1 : 1); } }}><GripVertical size={18}/></button>
    <span className="order-number">{String(index + 1).padStart(2, '0')}</span>
    <button className="screenshot-thumb" onClick={onPreview} disabled={busy} aria-label={`Preview screenshot ${index + 1}`}><img src={image.url} alt={`Screenshot ${index + 1} thumbnail`} draggable={false}/><span>Preview</span></button>
    <div className="screenshot-info"><strong>{image.name}</strong><span>{image.width} × {image.height}<i/>{formatBytes(image.blob.size)}</span><button className="text-button preview-text" onClick={onPreview} disabled={busy}>View image</button></div>
    <div className="reorder-buttons"><Button size="icon" variant="ghost" disabled={busy || index === 0} aria-label={`Move screenshot ${index + 1} up`} onClick={() => onMove(index, -1)}><ArrowUp size={16}/></Button><Button size="icon" variant="ghost" disabled={busy || index === count - 1} aria-label={`Move screenshot ${index + 1} down`} onClick={() => onMove(index, 1)}><ArrowDown size={16}/></Button></div>
    <Button size="icon" variant="ghost" className="remove-file" disabled={busy} onClick={() => onRemove(image.id)} aria-label={`Remove ${image.name}`}><Trash2 size={16}/></Button>
  </Reorder.Item>;
}
export function Prepare({ images, onFiles, onReorder, onRemove, onRun, preset, setPreset, options, setOptions, onError, busy, isDemo, onResume }: {
  images: Screenshot[]; onFiles: (files: File[]) => void; onReorder: (items: Screenshot[]) => void; onRemove: (id: string) => void;
  onRun: () => void; preset: Preset; setPreset: (preset: Preset) => void; options: StitchOptions; setOptions: (options: StitchOptions) => void;
  onError: (message: string) => void; busy: boolean; isDemo: boolean; onResume?: () => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const previewImage = preview === null ? undefined : images[preview];
  const move = (index: number, direction: number) => { if (busy) return; const copy = [...images], other = index + direction; if (other < 0 || other >= copy.length) return; [copy[index], copy[other]] = [copy[other], copy[index]]; onReorder(copy); };
  return <main className="prepare-page workspace-page" id="main-content" tabIndex={-1}>
    <div className="page-heading"><div><span className="eyebrow">Your source images</span><h1>Arrange your screenshots.</h1><p>Put them in scrolling order. Click an image to take a closer look.</p></div>{onResume && <Button variant="secondary" onClick={onResume} disabled={busy}>Resume review<ArrowRight size={16}/></Button>}</div>
    <div className="prepare-grid"><section className="ingest-area" aria-label="Screenshot order">
      {!images.length ? <FileUpload onFiles={onFiles} disabled={busy} onError={onError}/> : <><div className="section-label"><span><Layers size={16}/>{images.length} screenshot{images.length === 1 ? '' : 's'}</span><span>{isDemo ? 'Synthetic demo · real processing' : 'Drag or use the arrows to reorder'}</span></div><Reorder.Group axis="y" values={images} onReorder={next => { if (!busy) onReorder(next); }} className="screenshot-list"><AnimatePresence initial={false}>{images.map((image, index) => <ScreenshotItem key={image.id} image={image} index={index} count={images.length} onMove={move} onRemove={onRemove} onPreview={() => setPreview(index)} busy={busy}/>)}</AnimatePresence></Reorder.Group><FileUpload onFiles={onFiles} compact disabled={busy || images.length >= 12} onError={onError}/></>}
      <div className="upload-tip"><div className="overlap-illustration" aria-hidden="true"><span/><span/><i/></div><p><strong>Leave a little overlap.</strong> About 20–40% shared content helps us find the join. Keep the app, width and zoom the same. A single image works for redaction, too.</p></div>
    </section><aside className="setup-panel" aria-label="Stitch settings"><div className="setup-heading"><SlidersHorizontal size={19}/><h2>Stitch settings</h2></div><p className="panel-intro">Choose which details to flag. You can adjust every mask before saving.</p>
      <div className="field-label">Suggest covers for</div><div className="preset-grid" role="group" aria-label="Privacy preset">{([{key:'strict',title:'Everything',description:'Personal details and web links'},{key:'chat',title:'Personal details',description:'Leave ordinary web links visible'}] as const).map(item => <button key={item.key} className={`preset-button ${preset === item.key || item.key === 'chat' && preset !== 'strict' ? 'active' : ''}`} onClick={() => setPreset(item.key)} disabled={busy} aria-pressed={item.key === 'strict' ? preset === 'strict' : preset !== 'strict'}><span className="preset-radio">{(item.key === 'strict' ? preset === 'strict' : preset !== 'strict') && <Check size={13}/>}</span><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</div>
      <details open className="advanced-settings"><summary><SlidersHorizontal size={15}/>Image settings<span>Optional</span></summary><div><label className="toggle-setting"><span><strong>Remove repeated headers</strong><small>Also checks for repeated bottom bars.</small></span><Switch disabled={busy} checked={options.trimChrome} onCheckedChange={checked => setOptions({ ...options, trimChrome: checked })} aria-label="Auto-crop repeated headers and footers"/></label><label className="resolution-field"><span>Working resolution</span><select disabled={busy} aria-label="Working resolution" value={options.maxWidth} onChange={e => setOptions({ ...options, maxWidth: Number(e.target.value) })}><option value={1200}>Full detail · up to 1200px wide</option><option value={800}>Compact · up to 800px wide</option></select></label><p className="field-hint">Compact uses less memory on smaller devices.</p></div></details>
      {onResume && <p className="rebuild-note"><Info size={15}/>A new scan replaces your current masks. Canceling keeps your previous edits.</p>}
      <div className="prepare-actionbar"><div><strong>{images.length} image{images.length === 1 ? '' : 's'}</strong><span>{images.length ? 'Ready when you are' : 'Add images to begin'}</span></div><Button variant="primary" size="lg" className="full-width" disabled={!images.length || busy} onClick={onRun}><ScanLine size={18}/>{busy ? 'Reading files…' : images.length === 1 ? 'Scan & protect' : 'Stitch & protect'}<ArrowRight size={18}/></Button></div>
      <p className="local-note">Processed in your browser. Your files stay here.</p>
    </aside></div>
    <Dialog open={!!previewImage} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="image-preview-dialog" onKeyDown={event => { if (event.key === 'ArrowLeft' && preview !== null) { event.preventDefault(); setPreview(Math.max(0, preview - 1)); } if (event.key === 'ArrowRight' && preview !== null) { event.preventDefault(); setPreview(Math.min(images.length - 1, preview + 1)); } }}><DialogTitle>{previewImage?.name}</DialogTitle><DialogDescription>Screenshot {(preview ?? 0) + 1} of {images.length} · {previewImage?.width} × {previewImage?.height} pixels. Check its place in the sequence.</DialogDescription><div className="source-preview-scroll" tabIndex={0} role="region" aria-label="Uploaded screenshot preview">{previewImage && <img src={previewImage.url} alt={`Full preview of ${previewImage.name}`}/>}</div><div className="source-preview-nav"><Button disabled={preview === 0} onClick={() => setPreview(value => Math.max(0, (value ?? 0) - 1))} aria-label="Previous screenshot"><ChevronLeft size={17}/>Previous</Button><span>{(preview ?? 0) + 1} / {images.length}</span><Button disabled={preview === images.length - 1} onClick={() => setPreview(value => Math.min(images.length - 1, (value ?? 0) + 1))} aria-label="Next screenshot">Next<ChevronRight size={17}/></Button></div></DialogContent></Dialog>
  </main>;
}
