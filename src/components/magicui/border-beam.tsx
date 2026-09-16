// Adapted from Magic UI Border Beam (MIT); intentionally subtle, not a demo frame.
import { motion, useReducedMotion } from 'motion/react';
export function BorderBeam({ duration = 8 }: {
    duration?: number;
}) {
    const reduced = useReducedMotion();
    return <div className="border-beam-clip" aria-hidden="true"><motion.div className="border-beam" initial={{ offsetDistance: '0%' }} animate={{ offsetDistance: reduced ? '25%' : '100%' }} transition={{ duration, repeat: reduced ? 0 : Infinity, ease: 'linear' }}/></div>;
}
