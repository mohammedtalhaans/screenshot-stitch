import { ScanLine } from 'lucide-react';
export function Brand({ onClick }: {
    onClick?: () => void;
}) { return <button className="brand" onClick={onClick} aria-label="Screenshot Stitch home"><span className="brand-mark"><ScanLine size={25} strokeWidth={1.8}/></span><span>screenshot<span className="brand-light">stitch<span className="brand-dot">.</span></span></span></button>; }
