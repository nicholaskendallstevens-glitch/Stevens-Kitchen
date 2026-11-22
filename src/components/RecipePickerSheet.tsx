"use client";
import { useMemo, useState } from "react";
import type { Meal, Recipe } from "@/lib/types";
import { daysAgo } from "@/lib/dates";
import { RecipeThumb, Sheet } from "./ui";
import { IconClock, IconHeart, IconSearch } from "./icons";

export function RecipePickerSheet({
  open,
  onClose,
  title,
  recipes,
  lastCooked,
  inWeek,
  defaultMeal = "dinner",
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  recipes: Recipe[];
  lastCooked: Record<string, string>;
  inWeek: Set<string>;
  defaultMeal?: Meal;
  onPick: (p: { recipe?: Recipe; title?: string; meal: Meal }) => void;
}) {
  const [q, setQ] = useState("");
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [free, setFree] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const filtered = recipes.filter(
      (r) =>
        (!onlyFav || r.favorite) &&
        (!n || r.title.toLowerCase().includes(n) || r.tags.some((t) => t.includes(n)) || r.ingredients.some((i) => i.name.toLowerCase().includes(n))),
    );
    if (n) return filtered;
    // suggestions first: favourites not cooked for a while, then the rest
    return [...filtered].sort((a, b) => score(b) - score(a));
    function score(r: Recipe) {
      const d = lastCooked[r.id] ? daysAgo(lastCooked[r.id]) : 120;
      return (r.favorite ? 40 : 0) + Math.min(d, 120) - (inWeek.has(r.id) ? 500 : 0);
    }
  }, [recipes, q, onlyFav, lastCooked, inWeek]);

  return (
    <Sheet open={open} onClose={onClose} title={title} tall>
      <div className="sticky top-0 z-10 -mx-5 space-y-2 bg-paper px-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full bg-line/50 p-1">
            {(["lunch", "dinner"] as Meal[]).map((m) => (
              <button key={m} onClick={() => setMeal(m)} className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${meal === m ? "bg-card shadow-sm" : "text-muted"}`}>
                {m}
              </button>
            ))}
          </div>
          <button className="chip ml-auto" data-on={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>
            <IconHeart size={14} filled={onlyFav} /> Favs
          </button>
        </div>
        <div className="relative">
          <IconSearch size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="field pl-9" placeholder="Search recipes or ingredients" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {["Leftovers", "Eating out", "Takeaway", "Pizza night", "Fridge clear-out"].map((t) => (
            <button key={t} className="chip" onClick={() => onPick({ title: t, meal })}>
              {t}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (free.trim()) onPick({ title: free.trim(), meal });
            setFree("");
          }}
        >
          <input className="field text-sm" placeholder="Something else (no recipe)…" value={free} onChange={(e) => setFree(e.target.value)} />
          <button className="btn btn-soft" disabled={!free.trim()}>
            Add
          </button>
        </form>
      </div>

      {!q && <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Suggested first</p>}
      <div className="space-y-2">
        {list.map((r) => (
          <button key={r.id} onClick={() => onPick({ recipe: r, meal })} className="card flex w-full items-center gap-3 p-2 text-left active:scale-[0.99]">
            <RecipeThumb src={r.image_url} title={r.title} className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.title}</p>
              <p className="flex items-center gap-2 text-xs text-muted">
                {r.favorite && <IconHeart size={12} filled className="text-tomato" />}
                {r.total_minutes ? (
                  <span className="inline-flex items-center gap-0.5">
                    <IconClock size={12} />
                    {r.total_minutes}′
                  </span>
                ) : null}
                <span>{lastCooked[r.id] ? `${daysAgo(lastCooked[r.id])}d ago` : "new"}</span>
                {inWeek.has(r.id) && <span className="text-herb">· this week</span>}
              </p>
            </div>
          </button>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted">No recipes found.</p>}
      </div>
    </Sheet>
  );
}
