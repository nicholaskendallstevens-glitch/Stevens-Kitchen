"use client";
import { useEffect, useState } from "react";
import { addPlanEntry, getSettings } from "@/lib/db";
import { addDays, fmtDay, fmtDM, today, weekStart, weekDays } from "@/lib/dates";
import type { Meal } from "@/lib/types";
import { ErrorNote, Sheet, Spinner, Stepper } from "./ui";

export function AddToPlanSheet({
  open,
  onClose,
  recipe,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  recipe: { id: string; title: string; servings: number };
  onAdded: (date: string) => void;
}) {
  const [meal, setMeal] = useState<Meal>("dinner");
  const [servings, setServings] = useState(4);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) getSettings().then((s) => setServings(s.default_servings)).catch(() => setServings(recipe.servings));
  }, [open, recipe.servings]);

  const t = today();
  const days = [...weekDays(weekStart(t)), ...weekDays(addDays(weekStart(t), 7))].filter((d) => d >= t);

  async function add(date: string) {
    setBusy(date);
    setError(null);
    try {
      await addPlanEntry({ date, meal, recipe_id: recipe.id, servings });
      onAdded(date);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add to plan">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full bg-line/50 p-1">
          {(["lunch", "dinner"] as Meal[]).map((m) => (
            <button key={m} onClick={() => setMeal(m)} className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${meal === m ? "bg-card shadow-sm" : "text-muted"}`}>
              {m}
            </button>
          ))}
        </div>
        <Stepper value={servings} onChange={setServings} label="ppl" />
      </div>
      <ErrorNote error={error} />
      <div className="grid grid-cols-2 gap-2">
        {days.map((d) => (
          <button key={d} onClick={() => add(d)} disabled={!!busy} className="card flex items-center justify-between px-4 py-3 text-left active:scale-[0.98]">
            <span>
              <span className="block font-semibold">{d === t ? "Today" : fmtDay(d)}</span>
              <span className="text-xs text-muted">{fmtDM(d)}</span>
            </span>
            {busy === d && <Spinner />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
