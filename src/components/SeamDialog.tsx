import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Info, Layers } from 'lucide-react';
import type { Screenshot, StitchedImage } from '../types';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
export function SeamDialog({ open, onOpenChange, result, images, onApply }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    result: StitchedImage;
    images: Screenshot[];
    onApply: (overlaps: Record<number, number>) => void;
}) {
    const [index, setIndex] = useState(0), [overrides, setOverrides] = useState<Record<number, number>>({}), [viewWidth, setViewWidth] = useState(240);
    const previewRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        setIndex(0);
        setOverrides(Object.fromEntries(result.seams.filter(seam => seam.manual).map(seam => [seam.index, seam.overlap])));
    }, [open, result]);
    useEffect(() => {
        if (!open)
            return;
        // Portals mount after the parent render. Wait one frame before measuring.
        let observer: ResizeObserver | undefined;
        const frame = requestAnimationFrame(() => {
            const element = previewRef.current;
            if (!element)
                return;
            setViewWidth(element.clientWidth);
            observer = new ResizeObserver(entries => setViewWidth(entries[0].contentRect.width));
            observer.observe(element);
        });
        return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
    }, [open]);
    const seam = result.seams[Math.min(index, result.seams.length - 1)];
    if (!seam)
        return null;
    const automatic = seam.autoOverlap ?? seam.overlap, value = overrides[seam.index] ?? automatic;
    const first = images[seam.index], second = images[seam.index + 1];
    if (!first || !second)
        return null;
    const h1 = Math.round(first.height * result.width / first.width), h2 = Math.round(second.height * result.width / second.width);
    const scale = viewWidth / result.width, focus = h1 - result.cropBottom, startSecond = result.cropTop + value;
    const setValue = (value: number) => setOverrides(previous => ({ ...previous, [seam.index]: Math.min(seam.maxOverlap, Math.max(0, Math.round(Number.isFinite(value) ? value : 0))) }));
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="seam-dialog">
    <span className="eyebrow">PIXEL-PERFECT, WITH A HUMAN TOUCH</span><DialogTitle>Make the seam disappear.</DialogTitle>
    <DialogDescription>Adjust how many pixels the next image overlaps. Check that no content is repeated or missing. Rebuilding reruns detection and resets existing mask edits.</DialogDescription>
    <div className="seam-tabs" role="group" aria-label="Choose a seam">{result.seams.map(item => <button key={item.index} onClick={() => setIndex(item.index)} className={index === item.index ? 'active' : ''} aria-pressed={index === item.index}>Seam {item.index + 1}<i className={item.confidence < .72 ? 'uncertain' : ''}/></button>)}</div>
    <div className="seam-preview"><div className="seam-image-window" ref={previewRef} style={{ width: '100%', maxWidth: 280, height: 260 }}>
      <img alt="End of the previous screenshot" src={first.url} style={{ position: 'absolute', width: viewWidth, height: h1 * scale, top: 130 - focus * scale, left: 0 }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 130, height: 130, overflow: 'hidden' }}><img alt="Start of the next screenshot after overlap" src={second.url} style={{ position: 'absolute', width: viewWidth, height: h2 * scale, left: 0, top: -startSecond * scale }}/></div>
      <div className="seam-cut"><span>THE JOIN</span></div>
    </div></div>
    <div className="seam-value"><label htmlFor="overlap-pixels">OVERLAP</label><span><input id="overlap-pixels" type="number" value={value} min={0} max={seam.maxOverlap} onChange={event => setValue(Number(event.target.value))}/>px</span></div>
    <Slider min={0} max={seam.maxOverlap} step={1} value={[Math.min(seam.maxOverlap, value)]} onValueChange={([value]) => setValue(value)} aria-label="Overlap in pixels"/>
    <div className="seam-hint"><Info size={14}/><span>Automatic match: {automatic}px · {Math.round((seam.autoConfidence ?? seam.confidence) * 100)}% confidence{seam.duplicate ? ' · duplicate detected' : ''}</span></div>
    <div className="dialog-actions"><Button variant="ghost" onClick={() => setOverrides({})}>Use automatic values</Button><Button variant="primary" onClick={() => { onApply(overrides); onOpenChange(false); }}><Layers size={16}/>Rebuild & scan<ArrowRight size={15}/></Button></div>
  </DialogContent></Dialog>;
}
