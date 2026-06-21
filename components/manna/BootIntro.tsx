'use client';

import { useEffect, useRef, useState } from 'react';

interface Seg {
  tone: 'sys' | 'agent';
  text: string;
}

const SEGMENTS: Seg[] = [
  {
    tone: 'sys',
    text: 'manna agent online. it reads your real Circles trust graph and turns your decaying CRC into gifts.',
  },
  {
    tone: 'sys',
    text: 'tell it what you care about — it decides who + why; you approve every gift.',
  },
  {
    tone: 'agent',
    text: '▸ type your mission in the box below, or tap a suggestion ↓',
  },
];

const TONE: Record<Seg['tone'], string> = {
  sys: 'text-muted-foreground',
  agent: 'text-green',
};
const PREFIX: Record<Seg['tone'], string> = { sys: '·', agent: '◆' };

/**
 * Types the intro out character-by-character, ending on a clear call-to-action
 * that points the user to the prompt. Calls onDone when finished so the parent
 * can focus the input and reveal the hint.
 */
export function BootIntro({ onDone }: { onDone?: () => void }) {
  const [seg, setSeg] = useState(0);
  const [len, setLen] = useState(0);
  const done = seg >= SEGMENTS.length;
  const calledDone = useRef(false);

  useEffect(() => {
    if (done) {
      if (!calledDone.current) {
        calledDone.current = true;
        onDone?.();
      }
      return;
    }
    const full = SEGMENTS[seg].text;
    if (len < full.length) {
      // Type a few chars per tick so it feels brisk, not sluggish.
      const t = setTimeout(() => setLen((l) => Math.min(full.length, l + 2)), 18);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setSeg((s) => s + 1);
      setLen(0);
    }, 260);
    return () => clearTimeout(t);
  }, [seg, len, done, onDone]);

  return (
    <div className="space-y-1">
      {SEGMENTS.map((s, i) => {
        if (i > seg) return null;
        const text = i < seg ? s.text : s.text.slice(0, len);
        const typing = i === seg && !done;
        return (
          <p key={i} className={`mono text-xs leading-relaxed ${TONE[s.tone]}`}>
            <span className="mr-1.5 opacity-70">{PREFIX[s.tone]}</span>
            {text}
            {typing && <span className="caret">▋</span>}
          </p>
        );
      })}
    </div>
  );
}
