import { useDropzone } from 'react-dropzone';
import { FileImage, Plus, Upload } from 'lucide-react';
export function FileUpload({ onFiles, compact = false, disabled = false, onError }: {
  onFiles: (files: File[]) => void; compact?: boolean; disabled?: boolean; onError?: (message: string) => void;
}) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDropAccepted: onFiles, onDropRejected: rejections => onError?.(rejections.some(r => r.errors.some(e => e.code === 'file-too-large')) ? 'Each image must be under 20 MB.' : 'Use PNG, JPEG, or WebP screenshots. Animated images and HEIC are not supported.'),
    multiple: true, disabled, noClick: true, noKeyboard: true, maxSize: 20 * 1024 * 1024, accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] }
  });
  return <div {...getRootProps({ className: `file-upload ${compact ? 'is-compact' : ''} ${isDragActive ? 'is-dragging' : ''}` })}>
    <input {...getInputProps({ 'aria-label': 'Choose screenshots' })}/>
    {!compact && <div className="upload-stack" aria-hidden="true"><span className="upload-card back"/><span className="upload-card front"><FileImage size={28} strokeWidth={1.4}/><i/><i/></span></div>}
    <div className="upload-copy"><h3>{isDragActive ? 'Drop to add your screenshots' : compact ? 'Add more screenshots' : 'Drop your screenshots here'}</h3>{!compact && <p>Keep the same width and zoom, with a little shared content.</p>}</div>
    <button className={compact ? 'upload-small-action' : 'button button-primary'} type="button" onClick={open} disabled={disabled}>{compact ? <Plus size={17}/> : <Upload size={17}/>}{compact ? 'Choose files' : 'Choose screenshots'}</button>
    {!compact && <span className="file-formats">PNG, JPG, WebP · up to 12 images · 20 MB each</span>}
  </div>;
}
