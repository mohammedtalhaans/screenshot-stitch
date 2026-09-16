// Aceternity Glowing Effect adaptation: one pointer-responsive mint edge.
import { useEffect, useRef } from 'react';
export function GlowingEffect() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = ref.current, parent = element?.parentElement;
        if (!parent || !element)
            return;
        const onMove = (event: PointerEvent) => { const rect = parent.getBoundingClientRect(); element.style.setProperty('--glow-x', `${event.clientX - rect.left}px`); element.style.setProperty('--glow-y', `${event.clientY - rect.top}px`); element.style.opacity = '1'; };
        const onLeave = () => { element.style.opacity = '0'; };
        parent.addEventListener('pointermove', onMove, { passive: true });
        parent.addEventListener('pointerleave', onLeave);
        return () => { parent.removeEventListener('pointermove', onMove); parent.removeEventListener('pointerleave', onLeave); };
    }, []);
    return <div ref={ref} className="glowing-effect" aria-hidden="true"/>;
}
