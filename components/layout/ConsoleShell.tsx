'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Wheat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBar } from '@/components/layout/StatusBar';

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nav = [
    { href: '/', label: 'console' },
    { href: '/garden', label: 'garden' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden className="grid-bg pointer-events-none fixed inset-0 -z-10" />

      {/* Title bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-3 md:px-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-green-soft text-green">
                <Wheat className="size-3.5" />
              </span>
              <span className="mono text-sm font-medium tracking-tight">
                manna<span className="text-muted-foreground">://</span>
                <span className="text-green">agent</span>
              </span>
            </Link>
            <nav className="ml-1 flex items-center gap-0.5">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    'mono rounded px-2 py-1 text-xs transition-colors',
                    pathname === n.href
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <StatusBar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 md:px-5 md:py-6">
        {children}
      </main>
    </div>
  );
}
