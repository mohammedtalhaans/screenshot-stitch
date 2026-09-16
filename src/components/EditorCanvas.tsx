import { uid } from '../lib/identity';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, Maximize, MousePointer2, SquareDashedMousePointer, Columns2, ChevronsLeftRight, Undo2, Redo2 } from 'lucide-react';
import type { Redaction, Rect, StitchedImage } from '../types';
import { CATEGORY_LABELS } from '../types';
import { useHistory } from '../hooks/use-history';
import { paintPatch } from '../lib/render';
import { clampRect } from '../lib/geometry';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';
export type RedactionHistory = ReturnType<typeof useHistory<Redaction[]>>;
type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'draw';
interface Gesture {
    id: string;
    mode: Mode;
    clientX: number;
    clientY: number;
    initial: Rect;
    base: Redaction[];
    pointerId: number;
}
function MaskPatch({ image, redaction }: {
    image: HTMLImageElement | null;
    redaction: Redaction;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => { const canvas = ref.current; if (!canvas || !image)
        return; canvas.width = Math.max(1, Math.ceil(redaction.width)); canvas.height = Math.max(1, Math.ceil(redaction.height)); const ctx = canvas.getContext('2d'); if (ctx)
        paintPatch(ctx, image, redaction, redaction.style); }, [image, redaction.x, redaction.y, redaction.width, redaction.height, redaction.style]);
    return <canvas ref={ref} className="mask-patch" aria-hidden="true"/>;
}
export function EditorCanvas({ result, history, selected, setSelected, tool, setTool, defaultStyle }: {
    result: StitchedImage;
    history: RedactionHistory;
    selected: string | null;
    setSelected: (id: string | null) => void;
    tool: 'move' | 'draw';
    setTool: (tool: 'move' | 'draw') => void;
    defaultStyle: Redaction['style'];
}) {
    const [view, setView] = useState<{ mode: 'width' | 'image' | 'custom'; scale: number }>({ mode: 'width', scale: 1 });
    const [compare, setCompare] = useState(false), [comparePosition, setComparePosition] = useState(50);
    const [viewportSize, setViewportSize] = useState({ width: 600, height: 600, chromeHeight: 110 }), [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null), layoutRef = useRef<HTMLDivElement>(null), stageRef = useRef<HTMLDivElement>(null), gestureRef = useRef<Gesture | null>(null);
    const zoomAnchor = useRef<{ x: number; y: number } | null>(null);
    useEffect(() => {
        const viewport = viewportRef.current, layout = layoutRef.current;
        if (!viewport || !layout)
            return;
        const ruler = layout.querySelector<HTMLElement>('.canvas-ruler'), end = layout.querySelector<HTMLElement>('.canvas-end');
        const occupiedHeight = (element: HTMLElement | null) => {
            if (!element)
                return 0;
            const style = getComputedStyle(element);
            return element.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
        };
        const measure = () => {
            // Review stays mounted while exporting or returning to the inputs.
            // Hidden layout must not replace the last usable fit dimensions.
            if (!viewport.clientWidth || !viewport.clientHeight)
                return;
            const style = getComputedStyle(layout);
            const chromeHeight = occupiedHeight(ruler) + occupiedHeight(end) + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) + 2 * (parseFloat(style.rowGap) || 0);
            const next = { width: viewport.clientWidth, height: viewport.clientHeight, chromeHeight };
            setViewportSize(previous => previous.width === next.width && previous.height === next.height && previous.chromeHeight === next.chromeHeight ? previous : next);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        if (ruler)
            observer.observe(ruler);
        if (end)
            observer.observe(end);
        return () => observer.disconnect();
    }, []);
    const padding = viewportSize.width < 500 ? 30 : 100;
    const widthScale = Math.min(1, Math.max(1, viewportSize.width - padding) / result.width);
    const imageScale = Math.min(widthScale, Math.max(1, viewportSize.height - viewportSize.chromeHeight - 2) / result.height);
    const scale = view.mode === 'width' ? widthScale : view.mode === 'image' ? imageScale : view.scale;
    const displayWidth = result.width * scale;
    const setZoom = (mode: 'width' | 'image' | 'custom', nextScale = scale) => {
        const viewport = viewportRef.current, stage = stageRef.current;
        if (viewport && stage) {
            const viewportBounds = viewport.getBoundingClientRect(), stageBounds = stage.getBoundingClientRect();
            zoomAnchor.current = mode === 'image' ? { x: result.width / 2, y: result.height / 2 } : {
                x: (viewportBounds.left + viewport.clientLeft + viewport.clientWidth / 2 - stageBounds.left) / scale,
                y: (viewportBounds.top + viewport.clientTop + viewport.clientHeight / 2 - stageBounds.top) / scale,
            };
        }
        setView({ mode, scale: Math.min(4, Math.max(.05, nextScale)) });
    };
    useLayoutEffect(() => {
        const anchor = zoomAnchor.current, viewport = viewportRef.current, stage = stageRef.current;
        if (!anchor || !viewport || !stage)
            return;
        const viewportBounds = viewport.getBoundingClientRect(), stageBounds = stage.getBoundingClientRect();
        viewport.scrollLeft += stageBounds.left + anchor.x * scale - (viewportBounds.left + viewport.clientLeft + viewport.clientWidth / 2);
        viewport.scrollTop += stageBounds.top + anchor.y * scale - (viewportBounds.top + viewport.clientTop + viewport.clientHeight / 2);
        zoomAnchor.current = null;
    }, [scale, view]);
    const start = (event: ReactPointerEvent, id: string, mode: Mode) => {
        if (compare || event.button !== 0)
            return;
        event.stopPropagation();
        const initial = history.value.find(r => r.id === id);
        if (!initial)
            return;
        // A first touch selects without capturing the pointer, so a vertical
        // swipe over an unselected detail still scrolls the screenshot.
        if (event.pointerType === 'touch' && mode === 'move' && selected !== id) {
            setSelected(id);
            return;
        }
        event.preventDefault();
        history.begin();
        setSelected(id);
        gestureRef.current = { id, mode, clientX: event.clientX, clientY: event.clientY, initial: { ...initial }, base: history.value, pointerId: event.pointerId };
        stageRef.current?.setPointerCapture(event.pointerId);
    };
    const startDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (tool !== 'draw' || compare || event.button !== 0) {
            const target = event.target instanceof Element ? event.target : null;
            if (!compare && !target?.closest('.redaction-mask, input, button'))
                setSelected(null);
            return;
        }
        const bounds = stageRef.current!.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / scale, y = (event.clientY - bounds.top) / scale;
        if (x < 0 || y < 0 || x > result.width || y > result.height)
            return;
        event.preventDefault();
        const id = uid();
        const rect: Redaction = { id, x, y, width: 4, height: 4, category: 'manual', confidence: 1, text: 'Added by you', source: 'manual', enabled: true, style: defaultStyle };
        history.begin();
        history.preview([...history.value, rect]);
        setSelected(id);
        gestureRef.current = { id, mode: 'draw', clientX: event.clientX, clientY: event.clientY, initial: rect, base: [...history.value, rect], pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const move = (event: ReactPointerEvent<HTMLDivElement>) => {
        const g = gestureRef.current;
        if (!g || event.pointerId !== g.pointerId)
            return;
        const dx = (event.clientX - g.clientX) / scale, dy = (event.clientY - g.clientY) / scale;
        let rect = { ...g.initial };
        if (g.mode === 'move') {
            rect.x += dx;
            rect.y += dy;
        }
        else if (g.mode === 'draw') {
            rect = { x: Math.min(g.initial.x, g.initial.x + dx), y: Math.min(g.initial.y, g.initial.y + dy), width: Math.max(4, Math.abs(dx)), height: Math.max(4, Math.abs(dy)) };
        }
        else {
            if (g.mode.includes('e'))
                rect.width = Math.max(4, g.initial.width + dx);
            if (g.mode.includes('s'))
                rect.height = Math.max(4, g.initial.height + dy);
            if (g.mode.includes('w')) {
                rect.x = Math.min(g.initial.x + g.initial.width - 4, g.initial.x + dx);
                rect.width = g.initial.width + g.initial.x - rect.x;
            }
            if (g.mode.includes('n')) {
                rect.y = Math.min(g.initial.y + g.initial.height - 4, g.initial.y + dy);
                rect.height = g.initial.height + g.initial.y - rect.y;
            }
        }
        rect = clampRect(rect, result.width, result.height);
        history.preview(g.base.map(item => item.id === g.id ? { ...item, ...rect } : item));
    };
    const finish = (event: ReactPointerEvent<HTMLDivElement>, cancel = false) => {
        const g = gestureRef.current;
        if (!g || g.pointerId !== event.pointerId)
            return;
        gestureRef.current = null;
        if (stageRef.current?.hasPointerCapture(event.pointerId))
            stageRef.current.releasePointerCapture(event.pointerId);
        if (cancel)
            history.cancel();
        else {
            if (g.mode === 'draw' && Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) < 5) {
                const rect = clampRect({ ...g.initial, width: 180, height: 48 }, result.width, result.height);
                history.preview(g.base.map(item => item.id === g.id ? { ...item, ...rect } : item));
            }
            history.commit();
        }
        if (g.mode === 'draw')
            setTool('move');
    };
    const keyboard = (event: KeyboardEvent, id: string) => {
        const directions: Record<string, [
            number,
            number
        ]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const d = directions[event.key];
        if (!d)
            return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 10 : 1;
        history.set(history.value.map(r => r.id === id ? { ...r, ...clampRect(event.altKey ? { ...r, width: r.width + d[0] * step, height: r.height + d[1] * step } : { ...r, x: r.x + d[0] * step, y: r.y + d[1] * step }, result.width, result.height) } : r));
    };
    const placeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget || tool !== 'draw' || compare || !['Enter', ' '].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey)
            return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat || gestureRef.current)
            return;
        const bounds = event.currentTarget.getBoundingClientRect(), viewport = viewportRef.current!.getBoundingClientRect();
        const left = Math.max(bounds.left, viewport.left, 0), right = Math.min(bounds.right, viewport.right, window.innerWidth);
        const top = Math.max(bounds.top, viewport.top, 0), bottom = Math.min(bounds.bottom, viewport.bottom, window.innerHeight);
        const centerX = right > left ? ((left + right) / 2 - bounds.left) / scale : result.width / 2;
        const centerY = bottom > top ? ((top + bottom) / 2 - bounds.top) / scale : result.height / 2;
        const id = uid();
        const rect = clampRect({ x: centerX - 90, y: centerY - 24, width: 180, height: 48 }, result.width, result.height);
        history.set([...history.value, { ...rect, id, category: 'manual', confidence: 1, text: 'Added by you', source: 'manual', enabled: true, style: defaultStyle }]);
        setSelected(id);
        setTool('move');
        requestAnimationFrame(() => document.getElementById(`mask-${id}`)?.focus({ preventScroll: true }));
    };
    useEffect(() => {
        if (tool === 'draw') {
            setCompare(false);
            stageRef.current?.focus({ preventScroll: true });
        }
    }, [tool]);
    const masks = [...history.value].sort((a, b) => Number(a.style === 'solid') - Number(b.style === 'solid'));
    return <section className="editor-shell" aria-label="Image editor"><div className="canvas-toolbar">
      <div className="tool-group">
        <Tooltip label="Select and move masks (Esc)"><Button variant="ghost" size="sm" className={`select-tool ${tool === 'move' ? 'active' : ''}`} onClick={() => setTool('move')} aria-label="Select and move" aria-pressed={tool === 'move'}><MousePointer2 size={17}/><span className="tool-label">Select</span></Button></Tooltip>
        <Tooltip label="Cover an area (R)"><Button variant="ghost" size="sm" className={`draw-tool ${tool === 'draw' ? 'active' : ''}`} onClick={() => { setTool(tool === 'draw' ? 'move' : 'draw'); setCompare(false); }} aria-label="Draw redaction" aria-pressed={tool === 'draw'}><SquareDashedMousePointer size={18}/><span className="tool-label">Cover area</span></Button></Tooltip>
        <span className="toolbar-divider"/>
        <Tooltip label="Undo (⌘/Ctrl Z)"><Button variant="ghost" size="icon" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo"><Undo2 size={16}/></Button></Tooltip>
        <Tooltip label="Redo (⌘/Ctrl Shift Z)"><Button variant="ghost" size="icon" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo"><Redo2 size={16}/></Button></Tooltip>
      </div>
      <div className="tool-group zoom-tools">
        <Tooltip label="Zoom out"><Button size="icon" variant="ghost" onClick={() => setZoom('custom', scale / 1.25)} disabled={scale <= .05} aria-label="Zoom out"><Minus size={15}/></Button></Tooltip>
        <Tooltip label="Show the original image dimensions"><Button size="sm" variant="ghost" className="zoom-level" onClick={() => setZoom('custom', 1)} aria-label="Actual size (100%)">{Math.round(scale * 100)}%</Button></Tooltip>
        <Tooltip label="Zoom in"><Button size="icon" variant="ghost" onClick={() => setZoom('custom', scale * 1.25)} disabled={scale >= 4} aria-label="Zoom in"><Plus size={15}/></Button></Tooltip>
        <Tooltip label="Fit the screenshot width"><Button size="sm" variant="ghost" className={`fit-width-button ${view.mode === 'width' ? 'active' : ''}`} onClick={() => setZoom('width')} aria-label="Fit width" aria-pressed={view.mode === 'width'}><ChevronsLeftRight size={15}/><span className="tool-label">Fit width</span></Button></Tooltip>
        <Tooltip label="See the entire screenshot"><Button size="sm" variant="ghost" className={`fit-image-button ${view.mode === 'image' ? 'active' : ''}`} onClick={() => setZoom('image')} aria-label="Fit image" aria-pressed={view.mode === 'image'}><Maximize size={14}/><span className="tool-label">Fit image</span></Button></Tooltip>
      </div>
      <Button aria-label="Compare" className={`compare-button ${compare ? 'active' : ''}`} variant="ghost" size="sm" onClick={() => { setCompare(!compare); setTool('move'); }} aria-pressed={compare}><Columns2 size={15}/><span className="tool-label">Compare</span></Button>
    </div>
    <div className={`canvas-viewport ${tool === 'draw' ? 'draw-mode' : ''}`} ref={viewportRef}><div className="canvas-layout" ref={layoutRef} style={{ minWidth: displayWidth + padding }}><div className="canvas-ruler" style={{ width: displayWidth }}><span>0</span><span>{Math.round(result.width / 2)}</span><span>{result.width} PX</span></div><div ref={stageRef} className={`image-stage ${compare ? 'is-comparing' : ''}`} role="region" aria-label="Screenshot canvas" aria-describedby="canvas-instructions" tabIndex={0} style={{ width: displayWidth, height: result.height * scale, touchAction: tool === 'draw' ? 'none' : 'pan-x pan-y' }} onKeyDown={placeWithKeyboard} onPointerDown={startDrawing} onPointerMove={move} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}>
      <img className="original-image" src={result.url} onLoad={e => setSourceImage(e.currentTarget)} alt="Your stitched screenshot. Use the privacy inspector to select and edit redactions." draggable={false}/>
      <div className="mask-visual-layer" aria-hidden="true" style={compare ? { clipPath: `inset(0 0 0 ${comparePosition}%)` } : undefined}>
        {masks.filter(r => r.enabled).map(r => <div key={r.id} className="mask-visual" style={{ left: r.x * scale, top: r.y * scale, width: r.width * scale, height: r.height * scale }}><MaskPatch image={sourceImage} redaction={r}/></div>)}
      </div>
      <div className="mask-layer" style={compare ? { clipPath: `inset(0 0 0 ${comparePosition}%)` } : undefined}>
        {masks.map((r, index) => <motion.div key={r.id} id={`mask-${r.id}`} className={`redaction-mask ${selected === r.id ? 'is-selected' : ''} ${!r.enabled ? 'is-disabled' : ''}`} style={{ left: r.x * scale, top: r.y * scale, width: r.width * scale, height: r.height * scale }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .15, delay: Math.min(.4, index * .012) }} onPointerDown={e => start(e, r.id, 'move')} onKeyDown={e => keyboard(e, r.id)} onFocus={() => setSelected(r.id)} tabIndex={compare ? -1 : 0} role="button" aria-label={`Detail ${history.value.findIndex(item => item.id === r.id) + 1}: ${CATEGORY_LABELS[r.category]}, ${r.enabled ? 'protected' : 'visible'}. Arrow keys move, Alt plus arrow keys resize.`} aria-pressed={selected === r.id}>
          {!compare && <><span className="mask-index">{history.value.findIndex(item => item.id === r.id) + 1}</span>{selected === r.id && (['nw', 'ne', 'sw', 'se'] as const).map(handle => <span key={handle} className={`resize-handle ${handle}`} onPointerDown={e => start(e, r.id, handle)} aria-hidden="true"/>)}</>}
        </motion.div>)}
      </div>
      {compare && <><span className="editor-compare-label left">ORIGINAL</span><span className="editor-compare-label right">PROTECTED</span><div className="editor-compare-divider" style={{ left: `${comparePosition}%` }}><span><ChevronsLeftRight size={18}/></span></div><input className="editor-compare-range" type="range" min={0} max={100} value={comparePosition} onChange={e => setComparePosition(Number(e.target.value))} aria-label="Compare original and redacted image"/></>}
    </div><div className="canvas-end"><span /><span>END OF IMAGE</span><span /></div></div></div>
    <div className="canvas-status"><span id="canvas-instructions"><span className="status-dot"/>{tool === 'draw' ? 'DRAW A BOX · ENTER / SPACE TO PLACE' : compare ? 'ORIGINAL ← → PROTECTED' : 'SELECT A MASK TO FINE-TUNE IT'}</span><span>{result.width} × {result.height} PX</span></div>
  </section>;
}
