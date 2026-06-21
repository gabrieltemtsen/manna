'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  CircleSlash,
  Loader2,
  X,
} from 'lucide-react';
import { useSession } from '@/components/session/SessionProvider';
import { ProfileChip } from '@/components/profile/ProfileChip';
import { TrustPath } from '@/components/manna/TrustPath';
import { BootIntro } from '@/components/manna/BootIntro';
import { Tooltip } from '@/components/ui/tooltip';
import { formatCrc } from '@/lib/format';
import type { Allocation, Candidate, Hex, RoundPlan } from '@/lib/types';

type Tone = 'sys' | 'user' | 'agent' | 'ok' | 'warn' | 'err';
interface Line {
  id: number;
  tone: Tone;
  text: string;
}
type RowState = 'idle' | 'sending' | 'ok' | 'skip' | 'fail';
interface Row extends Allocation {
  include: boolean;
  name?: string;
  state: RowState;
}

const PRESETS = [
  'support local food + people who feed others',
  'back first-time builders in my circle',
  'reward the quiet maintainers nobody thanks',
];

const TONE_CLS: Record<Tone, string> = {
  sys: 'text-muted-foreground',
  user: 'text-foreground',
  agent: 'text-green',
  ok: 'text-green',
  warn: 'text-amber',
  err: 'text-red',
};
const TONE_PREFIX: Record<Tone, string> = {
  sys: '·',
  user: '>',
  agent: '◆',
  ok: '✓',
  warn: '!',
  err: '✗',
};

let _id = 0;
const nid = () => ++_id;

export function AgentConsole({
  onHighlight,
}: {
  onHighlight: (s: Set<string>) => void;
}) {
  const { address, candidates, canSend, source, snapshot, refresh } =
    useSession();

  const [lines, setLines] = useState<Line[]>([]);
  const [phase, setPhase] = useState<'idle' | 'planning' | 'review' | 'executing' | 'done'>('idle');
  const [mission, setMission] = useState('');
  const [budget, setBudget] = useState(12);
  const [plan, setPlan] = useState<RoundPlan | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [bootDone, setBootDone] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines, rows, phase]);

  // After the intro types out, draw the user to the input.
  const hintActive =
    bootDone && phase === 'idle' && !mission && lines.length === 0 && !plan;

  function push(tone: Tone, text: string) {
    setLines((prev) => [...prev, { id: nid(), tone, text }]);
  }
  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    const m = mission.trim();
    if (phase === 'planning' || phase === 'executing') return;
    if (!address) {
      push('err', 'no avatar loaded — connect a wallet or load an address above.');
      return;
    }
    if (candidates.length === 0) {
      push('err', 'this avatar has no usable trust relations to give through.');
      return;
    }
    setMission('');
    setPlan(null);
    setRows([]);
    onHighlight(new Set());
    push('user', m || 'put my decaying CRC to good use');
    setPhase('planning');
    push('agent', 'reading trust graph + weighing your mission…');

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission: m, budget, buffer: 0, candidates }),
      });
      const data = (await res.json()) as { plan?: RoundPlan; error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error || `agent error ${res.status}`);

      const byAddr = new Map<string, Candidate>(
        candidates.map((c) => [c.address.toLowerCase(), c])
      );
      const newRows: Row[] = data.plan.allocations.map((a) => ({
        ...a,
        include: true,
        name: byAddr.get(a.to.toLowerCase())?.name,
        state: 'idle' as RowState,
      }));
      setPlan(data.plan);
      setRows(newRows);
      onHighlight(new Set(newRows.map((r) => r.to.toLowerCase())));
      push(
        data.plan.engine === 'gemini' ? 'agent' : 'sys',
        `${data.plan.engine === 'gemini' ? 'gemini' : 'heuristic'} proposed ${newRows.length} gifts · ${formatCrc(data.plan.total)} CRC`
      );
      setPhase('review');
    } catch (err) {
      push('err', err instanceof Error ? err.message : 'planning failed');
      setPhase('idle');
    }
  }

  function discard() {
    push('sys', 'round discarded.');
    setPlan(null);
    setRows([]);
    onHighlight(new Set());
    setPhase('idle');
  }

  async function approve() {
    setPhase('executing');
    const included = rows.map((r, i) => ({ r, i })).filter((x) => x.r.include);
    if (included.length === 0) {
      push('warn', 'nothing selected.');
      setPhase('review');
      return;
    }

    if (!canSend) {
      push('sys', 'read-only mode — tracing live routes (open in the Circles app to actually send):');
    }
    const settled: Allocation[] = [];

    for (const { r, i } of included) {
      setRow(i, { state: 'sending' });
      const who = r.name || `${r.to.slice(0, 8)}…`;
      try {
        if (canSend && address) {
          const { buildPathTransferTxs } = await import('@/lib/circles');
          const txs = await buildPathTransferTxs({ from: address, to: r.to, amount: r.amount });
          const { sendTransactions } = await import('@aboutcircles/miniapp-sdk');
          const hashes = await sendTransactions(txs);
          const txHash = hashes[hashes.length - 1] as Hex;
          if (!txHash) throw new Error('no tx hash');
          settled.push({ ...r, txHash });
          setRow(i, { state: 'ok', txHash });
          push('ok', `sent ${formatCrc(r.amount)} CRC → ${who}`);
        } else if (address) {
          const { findTrustPath } = await import('@/lib/circles');
          const p = await findTrustPath({ from: address, to: r.to, amount: r.amount });
          if (p.resolved) {
            setRow(i, { state: 'ok' });
            push('ok', `route ok → ${who} · ${p.direct ? 'direct' : p.length + ' hops'}${typeof p.maxFlow === 'number' ? ` · max ${formatCrc(p.maxFlow)} CRC` : ''}`);
          } else {
            setRow(i, { state: 'fail' });
            push('warn', `no live route to ${who} right now`);
          }
        }
      } catch (err) {
        setRow(i, { state: 'fail' });
        push('err', `${who}: ${err instanceof Error ? err.message.slice(0, 80) : 'failed'}`);
      }
    }
    rows.forEach((r, i) => {
      if (!r.include) setRow(i, { state: 'skip' });
    });

    if (canSend && address && settled.length > 0) {
      try {
        const signedMessage = [
          'Manna generosity round',
          `From: ${address}`,
          `Mission: ${plan?.summary ? mission || '(none)' : '(none)'}`,
          ...settled.map((s) => `Tx: ${s.txHash}`),
          `At: ${new Date().toISOString()}`,
        ].join('\n');
        const { signMessage } = await import('@aboutcircles/miniapp-sdk');
        const { signature } = await signMessage(signedMessage);
        const res = await fetch('/api/rounds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: address,
            mission,
            summary: plan?.summary ?? '',
            allocations: settled,
            engine: plan?.engine ?? 'heuristic',
            signature,
            signedMessage,
          }),
        });
        if (res.ok) push('ok', 'round recorded to the garden.');
      } catch {
        push('sys', 'gifts sent; garden logging skipped.');
      }
      refresh();
    }

    push('agent', canSend ? 'round complete. your manna is at work.' : 'dry-run complete — every route checked against the live graph.');
    setPhase('done');
  }

  const total =
    Math.round(rows.filter((r) => r.include).reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100;
  const busy = phase === 'planning' || phase === 'executing';
  const maxBudget = Math.max(1, Math.floor(snapshot?.totalCrc ?? 100));

  return (
    <div className="panel flex h-[clamp(420px,60vh,640px)] flex-col">
      {/* terminal header */}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-soft" />
        <span className="size-2.5 rounded-full bg-amber-soft" />
        <span className="size-2.5 rounded-full bg-green-soft" />
        <span className="mono ml-2 text-[11px] text-muted-foreground">
          manna — agent console {source === 'lookup' && '· read-only'}
        </span>
      </div>

      {/* log */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <BootIntro
          onDone={() => {
            setBootDone(true);
            inputRef.current?.focus();
          }}
        />
        <div className="mt-1 space-y-1">
          {lines.map((l) => (
            <p key={l.id} className={`log-in mono text-xs leading-relaxed ${TONE_CLS[l.tone]}`}>
              <span className="mr-1.5 opacity-70">{TONE_PREFIX[l.tone]}</span>
              {l.text}
            </p>
          ))}
        </div>

        {/* plan card */}
        {plan && rows.length > 0 && phase !== 'idle' && (
          <div className="log-in mt-3 rounded-md border border-border bg-background/50 p-3">
            <p className="mono mb-2 text-xs text-foreground/90">{plan.summary}</p>
            <ul className="divide-y divide-border">
              {rows.map((r, i) => (
                <li key={r.to} className="py-2.5">
                  <div className="flex items-center gap-2">
                    {phase === 'review' ? (
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => {
                          setRow(i, { include: e.target.checked });
                          onHighlight(
                            new Set(
                              rows
                                .map((x, j) => (j === i ? { ...x, include: e.target.checked } : x))
                                .filter((x) => x.include)
                                .map((x) => x.to.toLowerCase())
                            )
                          );
                        }}
                        className="size-3.5 accent-[var(--green)]"
                        aria-label="include"
                      />
                    ) : (
                      <span className="flex size-4 items-center justify-center">
                        {r.state === 'ok' && <Check className="size-3.5 text-green" />}
                        {r.state === 'sending' && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                        {r.state === 'fail' && <X className="size-3.5 text-red" />}
                        {r.state === 'skip' && <CircleSlash className="size-3.5 text-muted-foreground/50" />}
                        {r.state === 'idle' && <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <ProfileChip address={r.to} variant="sm" />
                    </div>
                    {phase === 'review' ? (
                      <input
                        type="number"
                        value={r.amount}
                        min={0}
                        step={0.5}
                        onChange={(e) => setRow(i, { amount: e.target.value })}
                        disabled={!r.include}
                        className="mono w-16 rounded border border-input bg-background px-1.5 py-1 text-right text-xs tabular-nums disabled:opacity-40"
                      />
                    ) : (
                      <span className="mono text-xs tabular-nums">{formatCrc(r.amount)}</span>
                    )}
                    <span className="mono text-[10px] text-muted-foreground">CRC</span>
                  </div>
                  <p className={`mono mt-1 pl-6 text-[11px] text-muted-foreground ${!r.include && phase === 'review' ? 'opacity-40' : ''}`}>
                    {r.reason}
                  </p>
                  {r.include && (
                    <div className="pl-6">
                      <TrustPath from={address} to={r.to} toName={r.name} amount={r.amount} />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {phase === 'review' && (
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                <span className="mono text-xs text-muted-foreground">
                  total <span className="text-foreground">{formatCrc(total)} CRC</span>
                </span>
                <div className="flex gap-2">
                  <button onClick={discard} className="mono rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                    discard
                  </button>
                  <button
                    onClick={approve}
                    disabled={total <= 0}
                    className="mono rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    {canSend ? 'approve & send' : 'trace routes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* prompt */}
      <div className="border-t border-border p-2.5">
        {hintActive && (
          <div className="mb-1.5 flex items-center gap-1.5 text-green">
            <ChevronDown className="size-3.5 animate-bounce" />
            <span className="mono text-[11px]">
              {address ? 'start here — type below or tap a suggestion' : 'load an avatar above, then type here'}
            </span>
          </div>
        )}
        {phase === 'idle' && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setMission(p);
                  inputRef.current?.focus();
                }}
                className="mono rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <div
          className={`flex items-center gap-2 rounded-md px-1 transition-shadow ${
            hintActive ? 'glow-green' : ''
          }`}
        >
          <span className="mono text-green">$</span>
          <input
            ref={inputRef}
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            disabled={busy}
            placeholder={address ? 'what do you care about?' : 'load an avatar above to begin'}
            spellCheck={false}
            className="mono h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          <Tooltip content="Budget: the most CRC this round may spend.">
            <span className="mono flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground">
              <input
                type="number"
                value={budget}
                min={1}
                max={maxBudget}
                onChange={(e) => setBudget(Math.max(1, Number(e.target.value) || 1))}
                className="mono w-12 bg-transparent text-right tabular-nums text-foreground outline-none"
              />
              CRC
            </span>
          </Tooltip>
          <button
            onClick={submit}
            disabled={busy || !address}
            className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="run"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
