// Aceternity Compare adaptation with a real keyboard-accessible range control.
import { ChevronsLeftRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
export function Compare({ before, after, className = '' }: {
    before: ReactNode;
    after: ReactNode;
    className?: string;
}) {
    const [position, setPosition] = useState(25);
    return <div className={`compare ${className}`}>
    <div className="compare-layer">{after}</div>
    <div className="compare-layer compare-before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>{before}</div>
    <span className="compare-label before">ORIGINAL</span><span className="compare-label after">PROTECTED</span>
    <div className="compare-divider" style={{ left: `${position}%` }}><span><ChevronsLeftRight size={19}/></span></div>
    <input type="range" className="compare-range" min={0} max={100} value={position} onChange={e => setPosition(Number(e.target.value))} aria-label="Before and after comparison"/>
  </div>;
}
