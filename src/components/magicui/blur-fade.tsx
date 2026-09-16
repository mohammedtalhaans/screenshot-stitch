// Adapted from Magic UI Blur Fade (MIT), respecting the OS motion preference.
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
export function BlurFade({ children, delay = 0, className = '' }: {
    children: ReactNode;
    delay?: number;
    className?: string;
}) {
    const reduced = useReducedMotion();
    return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 10, filter: 'blur(5px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: .48, delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}
