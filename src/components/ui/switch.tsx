import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';
import type { ComponentPropsWithoutRef } from 'react';
export function Switch({ className, ...props }: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) { return <SwitchPrimitive.Root className={cn('switch-root', className)} {...props}><SwitchPrimitive.Thumb className="switch-thumb"/></SwitchPrimitive.Root>; }
