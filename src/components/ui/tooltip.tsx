import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
export const TooltipProvider = TooltipPrimitive.Provider;
export function Tooltip({ children, label }: {
    children: ReactNode;
    label: string;
}) { return <TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={9} className="tooltip-content">{label}<TooltipPrimitive.Arrow className="tooltip-arrow"/></TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root>; }
