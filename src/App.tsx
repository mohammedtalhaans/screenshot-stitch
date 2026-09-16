import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Github, ArrowUpRight, LockKeyhole, ShieldCheck, X, Check, ChevronRight, Keyboard, LoaderCircle } from 'lucide-react';
import { Brand } from './components/Brand';
import { Landing } from './components/Landing';
import { Prepare } from './components/Prepare';
import { Processing } from './components/Processing';
import { Review } from './components/Review';
import { Export } from './components/Export';
import { PrivacyDialog } from './components/PrivacyDialog';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './components/ui/dialog';
import { TooltipProvider } from './components/ui/tooltip';
import { useHistory } from './hooks/use-history';
import { importScreenshots, releaseScreenshots } from './lib/files';
import { runStitch } from './lib/stitch-client';
import { assetUrl } from './lib/utils';
import type { Phase, Progress, Preset, Redaction, Screenshot, StitchedImage, StitchOptions } from './types';
const initialProgress: Progress = { stage: 'stitch', value: 0, message: 'Preparing your screenshots' };
const initialOptions: StitchOptions = { trimChrome: true, maxWidth: 1200 };
export default function App() {
    const [phase, setPhase] = useState<Phase>('landing'), [images, setImages] = useState<Screenshot[]>([]), [result, setResult] = useState<StitchedImage | null>(null);
    const [resultImages, setResultImages] = useState<Screenshot[]>([]), [processingResult, setProcessingResult] = useState<StitchedImage | null>(null), [processingImages, setProcessingImages] = useState<Screenshot[]>([]);
    const [progress, setProgress] = useState<Progress>(initialProgress), [findings, setFindings] = useState<Redaction[]>([]), [warnings, setWarnings] = useState<string[]>([]);
    const [preset, setPreset] = useState<Preset>('strict'), [options, setOptions] = useState<StitchOptions>(initialOptions), [busy, setBusy] = useState(false), [isDemo, setIsDemo] = useState(false), [demoLoading, setDemoLoading] = useState(false);
    const [privacy, setPrivacy] = useState(false), [resetDialog, setResetDialog] = useState(false), [shortcuts, setShortcuts] = useState(false), [errors, setErrors] = useState<string[]>([]);
    const versionRef = useRef(0), importAbortRef = useRef<AbortController | null>(null), phaseRef = useRef(phase), focusPhaseRef = useRef<Phase | null>(null), previousPhaseRef = useRef(phase);
    const history = useHistory<Redaction[]>([]), abortRef = useRef<AbortController | null>(null), inputRef = useRef<HTMLInputElement>(null), imagesRef = useRef(images), resultRef = useRef(result), importing = useRef(false);
    const resultImagesRef = useRef(resultImages);
    imagesRef.current = images;
    resultRef.current = result;
    resultImagesRef.current = resultImages;
    phaseRef.current = phase;
    const notify = useCallback((message: string) => setErrors(prev => [...prev.slice(-3), message]), []);
    const swapResult = (image: StitchedImage | null) => { if (resultRef.current)
        URL.revokeObjectURL(resultRef.current.url); resultRef.current = image; setResult(image); };
    // Completed stitches own separate preview URLs, so changing draft uploads cannot
    // invalidate the previous review or the original images in its seam editor.
    const swapResultImages = (next: Screenshot[]) => { releaseScreenshots(resultImagesRef.current); resultImagesRef.current = next; setResultImages(next); };
    const reset = () => { versionRef.current++; importAbortRef.current?.abort(); abortRef.current?.abort(); abortRef.current = null; setDemoLoading(false); importing.current = false; releaseScreenshots(imagesRef.current); setImages([]); imagesRef.current = []; swapResult(null); swapResultImages([]); setProcessingResult(null); setProcessingImages([]); history.reset([]); setFindings([]); setWarnings([]); setErrors([]); setBusy(false); setIsDemo(false); setPreset('strict'); setOptions(initialOptions); setPhase('landing'); setResetDialog(false); };
    const home = () => { if (images.length || result || busy)
        setResetDialog(true);
    else
        reset(); };
    const replaceImages = (next: Screenshot[]) => { imagesRef.current = next; setImages(next); };
    const ingest = useCallback(async (files: File[]) => {
        if (importing.current || !['landing', 'prepare'].includes(phaseRef.current))
            return;
        importing.current = true;
        setBusy(true);
        const version = versionRef.current, controller = new AbortController();
        importAbortRef.current = controller;
        try {
            const imported = await importScreenshots(files, imagesRef.current, controller.signal);
            if (controller.signal.aborted || version !== versionRef.current) {
                releaseScreenshots(imported.images);
                return;
            }
            if (imported.images.length) {
                const next = [...imagesRef.current, ...imported.images];
                imagesRef.current = next;
                setImages(next);
                setPhase('prepare');
                setIsDemo(false);
            }
            imported.errors.forEach(notify);
        }
        catch (error) {
            if (!controller.signal.aborted && version === versionRef.current)
                notify(error instanceof Error ? error.message : 'Those files could not be read.');
        }
        finally {
            if (version === versionRef.current) {
                importing.current = false;
                setBusy(false);
            }
        }
    }, [notify]);
    const process = async (input: Screenshot[] = images, overlaps?: Record<number, number>) => {
        if (!input.length || importing.current)
            return;
        abortRef.current?.abort();
        const controller = new AbortController(), version = versionRef.current;
        abortRef.current = controller;
        const current = () => !controller.signal.aborted && abortRef.current === controller && versionRef.current === version;
        let candidate: StitchedImage | null = null;
        setPhase('processing');
        setProcessingImages(input);
        setProcessingResult(null);
        setProgress(initialProgress);
        setFindings([]);
        setErrors([]);
        try {
            const output = await runStitch(input.map(image => image.blob), { ...options, manualOverlaps: overlaps }, controller.signal, (value, message) => { if (current())
                setProgress({ stage: 'stitch', value, message }); });
            if (!current())
                return;
            const stitched = { ...output, url: URL.createObjectURL(output.blob) };
            candidate = stitched;
            setProcessingResult(stitched);
            setProgress({ stage: 'ocr', value: 0, message: 'Starting local OCR' });
            let nextRedactions: Redaction[] = [], nextWarnings: string[] = [];
            try {
                const { scanImage } = await import('./lib/ocr');
                if (!current())
                    return;
                const scan = await scanImage(stitched, preset, controller.signal, (value, message, stage = 'ocr') => { if (current())
                    setProgress({ stage, value, message }); }, items => { if (current())
                    setFindings(items); });
                if (!current())
                    return;
                nextRedactions = scan.redactions;
                nextWarnings = scan.warnings;
            }
            catch (error) {
                if (!current())
                    return;
                nextWarnings = [`The scan could not finish: ${error instanceof Error ? error.message : 'unknown error'}. Your stitch is ready for manual redaction.`];
            }
            if (!current())
                return;
            const snapshot = input.map(image => ({ ...image, url: URL.createObjectURL(image.blob) }));
            swapResultImages(snapshot);
            swapResult(stitched);
            candidate = null; // Ownership moves to resultRef only after the full job completes.
            history.reset(nextRedactions);
            setWarnings(nextWarnings);
            setProcessingResult(null);
            setPhase('review');
        }
        catch (error) {
            if (!current())
                return;
            notify(error instanceof Error ? error.message : 'Something went wrong while stitching.');
            setPhase(resultRef.current ? 'review' : 'prepare');
        }
        finally {
            // Pending output belongs to this job, including after reset/unmount.
            // An older job must never release or clear a newer job's preview.
            if (candidate)
                URL.revokeObjectURL(candidate.url);
            if (abortRef.current === controller) {
                abortRef.current = null;
                setProcessingResult(null);
                setProcessingImages([]);
                setFindings([]);
            }
        }
    };
    const cancelProcessing = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setProcessingResult(null);
        setProcessingImages([]);
        setFindings([]);
        setPhase(resultRef.current ? 'review' : 'prepare');
    };
    const demo = async () => {
        if (demoLoading || importing.current)
            return;
        setDemoLoading(true);
        const version = versionRef.current;
        try {
            const { makeDemo } = await import('./lib/demo');
            if (version !== versionRef.current)
                return;
            const demoImages = await makeDemo();
            if (version !== versionRef.current) {
                releaseScreenshots(demoImages);
                return;
            }
            releaseScreenshots(imagesRef.current);
            replaceImages(demoImages);
            setIsDemo(true);
            void process(demoImages);
        }
        catch (error) {
            if (version === versionRef.current)
                notify(error instanceof Error ? error.message : 'The demo could not load.');
        }
        finally {
            if (version === versionRef.current)
                setDemoLoading(false);
        }
    };
    useEffect(() => {
        const handler = (event: ClipboardEvent) => {
            if (demoLoading || document.querySelector('[role=dialog][data-state=open]') || !['landing', 'prepare'].includes(phase) || event.target instanceof HTMLElement && (event.target.matches('input,textarea') || event.target.isContentEditable))
                return;
            const files = Array.from(event.clipboardData?.files ?? []);
            if (files.length) {
                event.preventDefault();
                void ingest(files);
            }
        };
        document.addEventListener('paste', handler);
        return () => document.removeEventListener('paste', handler);
    }, [phase, ingest, demoLoading]);
    useEffect(() => {
        if (!images.length && !result)
            return;
        const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', prevent);
        return () => window.removeEventListener('beforeunload', prevent);
    }, [images.length, result]);
    useEffect(() => {
        if (previousPhaseRef.current === phase)
            return;
        previousPhaseRef.current = phase;
        window.scrollTo({ top: 0, behavior: 'instant' });
        focusPhaseRef.current = phase === 'landing' ? null : phase;
        // Review stays mounted to retain zoom, selection and inspector preferences.
        const frame = requestAnimationFrame(() => { if (phase === 'review' && focusPhaseRef.current === phase) { document.getElementById('main-content')?.focus({ preventScroll: true }); focusPhaseRef.current = null; } });
        return () => cancelAnimationFrame(frame);
    }, [phase]);
    useEffect(() => () => { versionRef.current++; importAbortRef.current?.abort(); abortRef.current?.abort(); abortRef.current = null; releaseScreenshots(imagesRef.current); releaseScreenshots(resultImagesRef.current); if (resultRef.current)
        URL.revokeObjectURL(resultRef.current.url); }, []);
    const currentStep = phase === 'prepare' ? 0 : phase === 'processing' ? 1 : phase === 'review' ? 2 : 3;
    const configuredSource = import.meta.env.VITE_SOURCE_URL as string | undefined;
    const repositorySource = configuredSource && /^https:\/\/github\.com\//.test(configuredSource) ? configuredSource : undefined;
    const source = repositorySource ?? assetUrl('source/screenshot-stitch-source.zip');
    return <MotionConfig reducedMotion="user"><TooltipProvider delayDuration={350}><div className={`app-shell phase-${phase}`}><a className="skip-link" href="#main-content">Skip to workspace</a><header className="site-header"><Brand onClick={home}/>{phase === 'landing' ? <nav className="header-nav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><button onClick={() => setPrivacy(true)}>Privacy <span className="tiny-dot"/></button></nav> : <div className="header-session"><span className="status-dot"/> {isDemo ? 'DEMO SESSION' : 'PRIVATE SESSION'}</div>}<div className="header-actions">{phase !== 'landing' && <button className="header-privacy" onClick={() => setPrivacy(true)} aria-label="Privacy information"><ShieldCheck size={18}/></button>}<a className="source-link" href={source} target={repositorySource ? '_blank' : undefined} rel="noopener noreferrer" download={repositorySource ? undefined : 'screenshot-stitch-source.zip'}><Github size={16}/><span>View source</span><ArrowUpRight size={13}/></a></div></header>
    {phase !== 'landing' && <nav className="workflow-nav" aria-label="Workflow progress">{['Upload', 'Stitch & scan', 'Review', 'Export'].map((name, index) => <div key={name} className={`workflow-step ${currentStep === index ? 'current' : ''} ${currentStep > index ? 'complete' : ''}`} aria-current={currentStep === index ? 'step' : undefined}><span>{currentStep > index ? <Check size={12}/> : String(index + 1).padStart(2, '0')}</span><strong>{name}</strong>{index < 3 && <ChevronRight size={13}/>}</div>)}<span className="workflow-private"><LockKeyhole size={11}/> ON-DEVICE ONLY</span></nav>}
    <input type="file" hidden className="visually-hidden" accept="image/png,image/jpeg,image/webp" multiple ref={inputRef} aria-label="Upload screenshots" tabIndex={-1} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void ingest(files); }}/>
    {phase !== 'review' && <motion.div key={phase} className="phase-container" onAnimationComplete={() => { if (focusPhaseRef.current === phase) { document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true }); focusPhaseRef.current = null; } }} initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0 }}>
      {phase === 'landing' && <Landing onUpload={() => { if (demoLoading)
        return; setPhase('prepare'); inputRef.current?.click(); }} onDemo={() => void demo()} onPrivacy={() => setPrivacy(true)} demoLoading={demoLoading} onFiles={files => void ingest(files)} onError={notify} importing={busy}/>}
      {phase === 'prepare' && <Prepare images={images} onFiles={files => void ingest(files)} onReorder={replaceImages} onRemove={id => { if (busy)
        return; const image = imagesRef.current.find(i => i.id === id); if (image)
        URL.revokeObjectURL(image.url); replaceImages(imagesRef.current.filter(i => i.id !== id)); }} onRun={() => void process()} onResume={result && !busy ? () => setPhase('review') : undefined} preset={preset} setPreset={setPreset} options={options} setOptions={setOptions} onError={notify} busy={busy} isDemo={isDemo}/>}
      {phase === 'processing' && <Processing progress={progress} images={processingImages} result={processingResult} findings={findings} onCancel={cancelProcessing}/>}
      {phase === 'export' && result && <Export result={result} redactions={history.value} onBack={() => setPhase('review')} onNew={() => setResetDialog(true)} onError={notify}/>}
    </motion.div>}
    {result && <Review key={result.url} result={result} images={resultImages} history={history} warnings={warnings} active={phase === 'review'} onBackToScreenshots={() => setPhase('prepare')} onExport={() => setPhase('export')} onRestitch={overlaps => void process(resultImages, overlaps)}/>}
    <footer className="site-footer"><span><span className="footer-mark">[ s ]</span> Screenshots, together.</span><div><button aria-label="Privacy" onClick={() => setPrivacy(true)}><ShieldCheck size={13}/><span>Privacy</span></button><span className="footer-divider"/><button aria-label="Shortcuts" onClick={() => setShortcuts(true)}><Keyboard size={13}/><span>Shortcuts</span></button><span className="footer-divider"/><span>Local processing · Open source</span><span className="status-dot"/></div></footer>
    <PrivacyDialog open={privacy} onOpenChange={setPrivacy}/><Dialog open={resetDialog} onOpenChange={setResetDialog}><DialogContent><span className="eyebrow">A FRESH CANVAS</span><DialogTitle>Start a new story?</DialogTitle><DialogDescription>This clears the images and edits in this tab. Save your clean image first. Your original files are never modified.</DialogDescription><div className="dialog-actions"><Button onClick={() => setResetDialog(false)}>Keep editing</Button><Button variant="primary" onClick={reset}>Start fresh<ArrowUpRight size={15}/></Button></div></DialogContent></Dialog><Dialog open={shortcuts} onOpenChange={setShortcuts}><DialogContent><span className="eyebrow">SMALL MOVES. PRECISE CONTROL.</span><DialogTitle>A few handy shortcuts.</DialogTitle><DialogDescription>Available in the editor, except while typing in a field.</DialogDescription><div className="shortcut-list">{[['Paste screenshots', '⌘ / Ctrl V'], ['Draw a redaction', 'R'], ['Undo', '⌘ / Ctrl Z'], ['Redo', '⌘ / Ctrl Shift Z'], ['Move selected mask', 'Arrow keys'], ['Move by 10 pixels', 'Shift + arrows'], ['Resize focused mask', 'Alt + arrows'], ['Delete selected mask', 'Delete'], ['Exit drawing / deselect', 'Esc']].map(([label, key]) => <div key={label}><span>{label}</span><kbd>{key}</kbd></div>)}</div></DialogContent></Dialog>
    <div className="toast-stack" aria-live="polite"><AnimatePresence>{errors.map((error, index) => <motion.div key={`${index}-${error}`} className="toast" role="alert" initial={{ opacity: 0, y: 15, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 20 }}><span>{error}</span><button aria-label="Dismiss message" onClick={() => setErrors(prev => prev.filter((_, i) => i !== index))}><X size={16}/></button></motion.div>)}</AnimatePresence></div>
  </div></TooltipProvider></MotionConfig>;
}
