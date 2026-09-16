import * as SliderPrimitive from '@radix-ui/react-slider';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';
export function Slider({ className, ...props }: ComponentPropsWithoutRef<typeof SliderPrimitive.Root>) { return <SliderPrimitive.Root className={cn('slider-root', className)} {...props}><SliderPrimitive.Track className="slider-track"><SliderPrimitive.Range className="slider-range"/></SliderPrimitive.Track><SliderPrimitive.Thumb className="slider-thumb" aria-label={props['aria-label']}/></SliderPrimitive.Root>; }
