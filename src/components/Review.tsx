import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Layers, ChevronDown, Info } from 'lucide-react';
import { clampRect } from '../lib/geometry';
import type { RedactionStyle, Screenshot, StitchedImage } from '../types';
import { EditorCanvas, type RedactionHistory } from './EditorCanvas';
import { Inspector } from './Inspector';
import { SeamDialog } from './SeamDialog';
import { Button } from './ui/button';
export function Review({ result, images, history, warnings, onExport, onRestitch, onBackToScreenshots, active = true }: {
  result: StitchedImage; images: Screenshot[]; history: RedactionHistory; warnings: string[]; onExport: () => void;
  onRestitch: (overlaps: Record<number, number>) => void; onBackToScreenshots: () => void; active?: boolean;
}) {
  const [selected, setSelected] = useState<string|null>(null), [tool, setTool] = useState<'move'|'draw'>('move'), [style, setStyle] = useState<RedactionStyle>('solid'), [seams, setSeams] = useState(false), [showWarnings, setShowWarnings] = useState(false);
  const weak = result.seams.filter(s => s.confidence < .72 && !s.duplicate), allWarnings = [...new Set([...result.warnings, ...warnings])];
  const scanIncomplete = allWarnings.some(warning => /OCR did not finish|scan could not finish|No readable text|Code detection was unavailable/i.test(warning));
  const select = (id: string|null) => {
    setSelected(id);
    if (id) requestAnimationFrame(() => {
      const mask = document.getElementById(`mask-${id}`), viewport = mask?.closest('.canvas-viewport');
      if (!mask || !viewport) return;
      const box = mask.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
      viewport.scrollTo({ top: viewport.scrollTop + box.top - bounds.top - bounds.height/2 + box.height/2, left: viewport.scrollLeft + box.left - bounds.left - bounds.width/2 + box.width/2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[role=dialog][data-state=open]')) return;
      if (event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? history.redo() : history.undo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); history.redo(); }
      else if (selected && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
        event.preventDefault(); const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0, dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        history.set(history.value.map(r => r.id === selected ? { ...r, ...clampRect(event.altKey ? { ...r, width: r.width+dx, height: r.height+dy } : { ...r, x: r.x+dx, y: r.y+dy }, result.width, result.height) } : r));
      } else if (['Delete','Backspace'].includes(event.key) && selected) { event.preventDefault(); history.set(history.value.filter(r => r.id !== selected)); setSelected(null); }
      else if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) setTool('draw');
      else if (event.key === 'Escape') { setTool('move'); setSelected(null); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [active, history, selected, result.width, result.height]);
  return <main className="review-page" hidden={!active} id={active ? 'main-content' : undefined} tabIndex={-1}>
    <div className="review-heading"><div className="review-title"><Button variant="ghost" size="icon" onClick={onBackToScreenshots} aria-label="Back to screenshots"><ArrowLeft size={19}/></Button><div><h1>Review your image</h1><span>{images.length} screenshot{images.length === 1 ? '' : 's'} · {result.width} × {result.height} px</span></div></div><div className="review-heading-actions"><div className="review-seam-status">{result.seams.length > 0 && <Button variant="secondary" size="sm" onClick={() => setSeams(true)}><Layers size={15}/>{weak.length ? `${weak.length} seam${weak.length === 1 ? '' : 's'} to review` : 'Adjust seams'}</Button>}</div><Button className="review-primary-action" variant="primary" onClick={onExport}>Review & export<ArrowRight size={16}/></Button></div></div>
    <div className={`review-notice ${scanIncomplete ? 'has-warnings' : ''}`}><span>{scanIncomplete ? <AlertTriangle size={17}/> : <Info size={17}/>}<span>{scanIncomplete ? 'The scan is incomplete. Add masks for any missed details.' : 'Review each cover, then check the rest of the image.'}<span className="notice-secondary"> Automatic detection can miss details.</span></span></span><button onClick={() => setShowWarnings(!showWarnings)} aria-expanded={showWarnings} aria-controls="review-notes">{showWarnings ? 'Hide notes' : 'Review notes'}<ChevronDown size={14}/></button></div>
    {showWarnings && <div className="review-warnings" id="review-notes">{allWarnings.map((warning,index) => <p key={index}><Info size={14}/>{warning}</p>)}<p><Info size={14}/>Check names, addresses, photos and codes. English text recognition can miss details; solid masks are the best choice for secrets.</p></div>}
    <div className="review-grid"><EditorCanvas result={result} history={history} selected={selected} setSelected={setSelected} tool={tool} setTool={setTool} defaultStyle={style}/><Inspector history={history} result={result} selected={selected} onSelect={select} onAdd={() => setTool('draw')} defaultStyle={style} setDefaultStyle={setStyle}/></div>
    <SeamDialog open={seams && active} onOpenChange={setSeams} result={result} images={images} onApply={onRestitch}/>
  </main>;
}
