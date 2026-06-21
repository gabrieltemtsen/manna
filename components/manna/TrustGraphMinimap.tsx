'use client';

import { useMemo } from 'react';
import type { Candidate } from '@/lib/types';

/**
 * Live minimap of the avatar's real Circles trust graph — "you" at the center,
 * reachable people around, coloured by relation. Recipients in the current
 * round light up and connect, so generosity is visible spreading across the
 * real graph.
 */
export function TrustGraphMinimap({
  candidates,
  highlighted,
}: {
  candidates: Candidate[];
  highlighted?: Set<string>;
}) {
  const W = 320;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;

  const nodes = useMemo(() => {
    const list = candidates.slice(0, 14);
    const R = 80;
    return list.map((c, i) => {
      const angle = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
      const r = c.relation === 'mutuallyTrusts' ? R - 12 : R;
      return {
        ...c,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r * 0.74,
      };
    });
  }, [candidates]);

  const colorFor = (rel: Candidate['relation']) =>
    rel === 'mutuallyTrusts'
      ? 'var(--green)'
      : rel === 'trustedBy'
        ? 'var(--amber)'
        : 'var(--blue)';

  if (candidates.length === 0) {
    return (
      <p className="mono py-8 text-center text-xs text-muted-foreground">
        no trust relations found
      </p>
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Live trust graph">
        {nodes.map((n) => {
          const lit = highlighted?.has(n.address.toLowerCase());
          return (
            <line
              key={`e-${n.address}`}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke={lit ? 'var(--green)' : 'var(--border)'}
              strokeWidth={lit ? 1.8 : 1}
              className={lit ? 'dash' : ''}
              opacity={lit ? 1 : 0.6}
            />
          );
        })}
        {nodes.map((n) => {
          const lit = highlighted?.has(n.address.toLowerCase());
          const initial = (n.name?.trim()?.[0] || n.address.slice(2, 3)).toUpperCase();
          return (
            <g key={`n-${n.address}`}>
              <circle
                cx={n.x}
                cy={n.y}
                r={lit ? 12 : 9}
                fill={lit ? colorFor(n.relation) : 'var(--card)'}
                stroke={colorFor(n.relation)}
                strokeWidth={lit ? 0 : 1.4}
              />
              <text
                x={n.x}
                y={n.y + 3}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="600"
                fill={lit ? 'var(--background)' : 'var(--muted-foreground)'}
              >
                {initial}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="16" fill="var(--green)" />
        <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--background)">
          you
        </text>
      </svg>
      <div className="mono mt-1 flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground">
        <Legend color="var(--green)" label="mutual" />
        <Legend color="var(--amber)" label="trusts you" />
        <Legend color="var(--blue)" label="you trust" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
