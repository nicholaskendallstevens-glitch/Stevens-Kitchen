"use client";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getRecipe } from "@/lib/db";
import type { Recipe } from "@/lib/types";
import { formatAmount, scaleQty } from "@/lib/units";
import { Loading, Sheet } from "@/components/ui";
import { IconChevronLeft, IconChevronRight, IconClock, IconX } from "@/components/icons";

function findMinutes(step: string): number | null {
  const m = step.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:min|minutes?|minuten|mins?\.?)\b/i);
  if (m) return Number(m[2] ?? m[1]);
  const h = step.match(/(\d+(?:[.,]\d)?)\s*(?:h|std\.?|stunden?|hours?)\b/i);
  if (h) return Math.round(Number(h[1].replace(",", ".")) * 60);
  return null;
}

function CookInner({ id }: { id: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [r, setR] = useState<Recipe | null>(null);
  const [i, setI] = useState(0);
  const [showIng, setShowIng] = useState(false);
  const [timer, setTimer] = useState<{ end: number; label: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ringing, setRinging] = useState(false);
  const lockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    getRecipe(id).then(setR);
  }, [id]);

  // keep the screen on while cooking
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const req = () => nav.wakeLock?.request("screen").then((l) => (lockRef.current = l)).catch(() => {});
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lockRef.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= timer.end) {
        setRinging(true);
        setTimer(null);
        try {
          navigator.vibrate?.([300, 150, 300, 150, 300]);
          const ctx = new AudioContext();
          [0, 0.4, 0.8].forEach((d) => {
            const o = ctx.createOscillator();
            o.frequency.value = 880;
            o.connect(ctx.destination);
            o.start(ctx.currentTime + d);
            o.stop(ctx.currentTime + d + 0.25);
          });
        } catch {}
      }
    }, 500);
    return () => clearInterval(t);
  }, [timer]);

  if (!r) return <Loading />;
  const steps = r.steps.filter((s) => !/^—.*—$/.test(s));
  const servings = Number(sp.get("servings")) || r.servings;
  const step = steps[i] ?? "";
  const mins = findMinutes(step);
  const left = timer ? Math.max(0, Math.round((timer.end - now) / 1000)) : 0;

  return (
    <main className="flex min-h-dvh flex-col bg-paper px-5 safe-top safe-bottom">
      <div className="flex items-center justify-between py-2">
        <button onClick={() => router.back()} className="rounded-full p-2 text-muted" aria-label="Exit">
          <IconX />
        </button>
        <p className="truncate px-2 text-sm font-semibold">{r.title}</p>
        <button onClick={() => setShowIng(true)} className="btn btn-soft px-3 py-1.5 text-sm">
          Ingredients
        </button>
      </div>

      <div className="mt-2 flex gap-1">
        {steps.map((_, k) => (
          <div key={k} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-herb" : "bg-line"}`} />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center py-6">
        <p className="mb-3 text-sm font-semibold text-muted">
          Step {i + 1} of {steps.length}
        </p>
        <p className="font-display text-[1.7rem] leading-snug">{step || "No steps for this recipe."}</p>
        {mins && !timer && (
          <button className="btn btn-soft mt-6 self-start" onClick={() => setTimer({ end: Date.now() + mins * 60000, label: `Step ${i + 1}` })}>
            <IconClock size={18} /> Start {mins} min timer
          </button>
        )}
      </div>

      {timer && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-herb px-4 py-3 text-paper">
          <span className="text-sm">{timer.label}</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
          <button onClick={() => setTimer(null)} className="text-sm underline">Stop</button>
        </div>
      )}
      {ringing && (
        <button onClick={() => setRinging(false)} className="mb-3 animate-pulse rounded-2xl bg-tomato px-4 py-4 text-center text-lg font-semibold text-white">
          ⏰ Time’s up — tap to dismiss
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 pb-2">
        <button className="btn btn-ghost py-4" disabled={i === 0} onClick={() => setI(i - 1)}>
          <IconChevronLeft /> Back
        </button>
        {i < steps.length - 1 ? (
          <button className="btn btn-primary py-4" onClick={() => setI(i + 1)}>
            Next <IconChevronRight />
          </button>
        ) : (
          <button className="btn btn-primary py-4" onClick={() => router.back()}>
            Done 🎉
          </button>
        )}
      </div>

      <Sheet open={showIng} onClose={() => setShowIng(false)} title={`Ingredients · ${servings} ppl`}>
        <ul className="divide-y divide-line">
          {r.ingredients.map((x) => (
            <li key={x.id} className="flex gap-3 py-2.5 text-[17px]">
              <span className="w-24 shrink-0 text-right font-semibold text-herb tabular-nums">{formatAmount(scaleQty(x.qty, r.servings, servings), x.unit)}</span>
              <span>
                {x.name}
                {x.note && <span className="text-muted">, {x.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </main>
  );
}

export default function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <CookInner id={id} />
    </Suspense>
  );
}
