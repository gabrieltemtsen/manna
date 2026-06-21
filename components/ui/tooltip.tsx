'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A tiny, dependency-free tooltip. Shows on hover and keyboard focus, so it
 * doubles as accessible inline help for first-time users. No portal — it
 * positions relative to the trigger, which is plenty for short hints.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const pos = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-50 w-max max-w-[16rem] rounded-xl bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-xl',
            'manna-rise',
            pos
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** A small "?" info dot that reveals a tooltip — for labelling controls. */
export function InfoDot({ content }: { content: ReactNode }) {
  return (
    <Tooltip content={content}>
      <span className="inline-flex size-4 cursor-help items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
        ?
      </span>
    </Tooltip>
  );
}
