import { ArrowRight, ArrowUpRight, ChevronsLeftRight, FileImage, Layers, LockKeyhole, Play, Plus, Check, Download } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Compare } from './aceternity/compare';
import { Button } from './ui/button';

function Conversation({ clean = false }: { clean?: boolean }) {
  return <div className={`sample-chat ${clean ? 'clean' : ''}`} aria-hidden="true">
    <div className="sample-app-bar"><span className="sample-avatar">A</span><div><strong className={clean ? 'sample-name-mask' : ''}>Alex Morgan</strong><small>Messages · today</small></div><span className="sample-menu">•••</span></div>
    <div className="sample-date">Today, 10:24 AM</div>
    <div className="sample-message"><p>Hey! Here are the details.</p><p className={clean ? 'sample-line-mask' : ''}>alex.morgan@example.com</p><p className={clean ? 'sample-line-mask narrow' : ''}>+1 (415) 555-0132</p></div>
    <div className="sample-message own"><p>Perfect, thanks!</p><p>Where should I send it?</p></div>
    <div className="sample-join"><span>Overlap removed</span></div>
    <div className="sample-message"><p>You can send it here:</p><p className={clean ? 'sample-line-mask address' : ''}>42 Willow Street, Portland</p><p>Leave it at the front door.</p></div>
    <div className="sample-message own"><p>On its way. Enjoy!</p><small>Delivered <Check size={12}/></small></div>
  </div>;
}

export function Landing({ onUpload, onDemo, onPrivacy, demoLoading, onFiles, onError, importing }: {
  onUpload: () => void; onDemo: () => void; onPrivacy: () => void; demoLoading: boolean;
  onFiles: (files: File[]) => void; onError: (message: string) => void; importing: boolean;
}) {
  const disabled = demoLoading || importing;
  const { getRootProps, isDragActive } = useDropzone({ noClick: true, noKeyboard: true, disabled, multiple: true,
    maxSize: 20 * 1024 * 1024, accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] },
    onDropAccepted: onFiles,
    onDropRejected: rejected => onError(rejected.some(file => file.errors.some(error => error.code === 'file-too-large'))
      ? 'Each image must be under 20 MB.' : 'Use PNG, JPEG, or still WebP screenshots. HEIC and animated images are not supported.'),
  });
  return <main {...getRootProps({ className: 'landing', id: 'main-content', tabIndex: -1, role: undefined })} aria-busy={importing}>
    {isDragActive && <div className="landing-drop-overlay" role="status"><Layers size={38}/><strong>Drop the pieces here.</strong><span>Your screenshots stay on this device.</span></div>}
    <section className="hero-layout" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="product-note"><span className="mini-stitch" aria-hidden="true"/> A small tool for the whole picture</div>
        <h1 id="hero-title">The whole story.<br/><span className="headline-mask">Just less personal.</span></h1>
        <p className="hero-description">Join overlapping screenshots. Cover the private details.<br className="desktop-break"/> Save one image that’s ready to share.</p>
        <div className="hero-upload">
          <div className="hero-upload-label"><FileImage size={21}/><div><strong>Bring your screenshots together</strong><span>Drop PNG, JPG or WebP images here.</span></div></div>
          <div className="hero-actions"><Button size="lg" variant="primary" onClick={onUpload} disabled={disabled}><Plus size={18}/>{importing ? 'Reading screenshots…' : 'Upload screenshots'}</Button><Button size="lg" variant="ghost" onClick={onDemo} disabled={disabled}><Play size={15}/>{demoLoading ? 'Preparing demo…' : 'Try the demo'}</Button></div>
          <p className="hero-import-hint">Up to 12 images · or paste with <kbd>Ctrl / ⌘ V</kbd></p>
        </div>
        <p className="hero-fineprint"><LockKeyhole size={14}/> On your device. No account. No image uploads.</p>
      </div>
      <div className="sample-workbench" aria-label="Illustrative screenshot stitching and privacy comparison">
        <div className="sample-workbench-header"><span><Layers size={16}/> A conversation, in one piece</span><span className="example-badge">Interactive example</span></div>
        <div className="sample-workbench-body">
          <div className="sample-inputs" aria-hidden="true"><span className="sample-input-label">3 screenshots</span>{[0,1,2].map(i => <div className={`sample-input sample-input-${i}`} key={i}><span className="input-index">0{i+1}</span><div className="mini-conversation"><i/><b/><i/><b/><i/></div><span className="input-overlap"/></div>)}<ArrowRight className="input-flow-arrow" size={19}/></div>
          <div className="sample-result"><div className="sample-result-label"><span><FileImage size={13}/> One shareable image</span><span>PNG</span></div><Compare before={<Conversation/>} after={<Conversation clean/>}/></div>
        </div>
        <div className="sample-workbench-footer"><ChevronsLeftRight size={17}/><span>Drag to compare before and after.</span><span className="sample-fiction">Fictional details</span></div>
      </div>
    </section>
    <section className="how-it-works" id="how-it-works" aria-label="How Screenshot Stitch works">
      <div className="how-intro"><span className="eyebrow">From pieces to picture</span><h2>Three steps. One clean handoff.</h2></div>
      <ol className="workflow-explainer">
        <li><span className="step-icon"><Layers size={20}/></span><div><h3><span>1.</span> Join the screenshots</h3><p>Add them in scrolling order. Shared pixels help us find the joins.</p></div></li>
        <li><span className="step-icon"><span className="redaction-glyph"/></span><div><h3><span>2.</span> Make it yours</h3><p>Review suggested masks, adjust the seams, and cover anything else.</p></div></li>
        <li><span className="step-icon"><Download size={20}/></span><div><h3><span>3.</span> Save the whole image</h3><p>Check the final result and download a PNG with your edits baked in.</p></div></li>
      </ol>
    </section>
    <section className="privacy-strip"><LockKeyhole size={19}/><p><strong>Your screenshots stay with you.</strong> Stitching and scanning happen in your browser.</p><button onClick={onPrivacy}>Our privacy promise <ArrowUpRight size={15}/></button></section>
  </main>;
}
