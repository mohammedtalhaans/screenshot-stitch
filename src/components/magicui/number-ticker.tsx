// Adapted from Magic UI's MIT-licensed Number Ticker, restyled for the lab.
import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, useReducedMotion } from 'motion/react';
export function NumberTicker({ value, className = '', suffix = '' }: {
    value: number;
    className?: string;
    suffix?: string;
}) {
    const ref = useRef<HTMLSpanElement>(null), motionValue = useMotionValue(0), spring = useSpring(motionValue, { damping: 32, stiffness: 150 });
    const reduced = useReducedMotion();
    useEffect(() => { motionValue.set(value); }, [value, motionValue]);
    useEffect(() => spring.on('change', v => { if (ref.current && !reduced)
        ref.current.textContent = Math.round(v).toLocaleString() + suffix; }), [spring, reduced, suffix]);
    return <span className={className} ref={ref} aria-label={`${value}${suffix}`}>{value.toLocaleString()}{suffix}</span>;
}
