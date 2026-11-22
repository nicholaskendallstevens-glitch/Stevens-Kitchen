"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addPlanEntry, copyWeek, deletePlanEntry, generateShoppingList, getSettings, lastCookedMap, listPlan, listRecipes, updatePlanEntry,
} from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import type { Meal, MealPlanEntry, Recipe } from "@/lib/types";
import { addDays, daysAgo, defaultPlanningWeek, fmtDay, fmtDM, fmtWeekRange, isoWeekNumber, today, weekDays, weekStart } from "@/lib/dates";
import { ErrorNote, Header, Loading, Page, RecipeThumb, Sheet, Spinner, Stepper, Toast } from "@/components/ui";
import { RecipePickerSheet } from "@/components/RecipePickerSheet";
import { IconCart, IconCheck, IconChevronLeft, IconChevronRight, IconCopy, IconDice, IconMore, IconPlus } from "@/components/icons";

const MEAL_ORDER: Record<Meal, number> = { breakfast: 0, lunch: 1, dinner: 2 };

function PlanInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const week = sp.get("week") ?? defaultPlanningWeek();
  const days = weekDays(week);
  const t = today();

  const [entries, setEntries] = useState<MealPlanEntry[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [last, setLast] = useState<Record<string, string>>({});
  const [servingsDefault, setServingsDefault] = useState(4);
  const [pickDay, setPickDay] = useState<string | null>(null);
  const [menu, setMenu] = useState<MealPlanEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listPlan(week, addDays(week, 6)).then(setEntries).catch((e) => setError(e.message));
  }, [week]);

  useEffect(() => {
    setEntries(null);
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([listRecipes(), lastCookedMap(), getSettings()])
      .then(([r, l, s]) => {
        setRecipes(r);
        setLast(l);
        setServingsDefault(s.default_servings);
      })
      .catch((e) => setError(e.message));
  }, []);

  // live sync with the other phone
  useEffect(() => {
    const ch = supabase()
      .channel(`plan-${week}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_plan" }, () => load())
      .subscribe();
    return () => {
      supabase().removeChannel(ch);
    };
  }, [week, load]);

  const byDay = useMemo(() => {
    const m: Record<string, MealPlanEntry[]> = {};
    for (const d of days) m[d] = [];
    for (const e of entries ?? []) (m[e.date] ??= []).push(e);
    for (const d of Object.keys(m)) m[d].sort((a, b) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal] || a.position - b.position);
    return m;
  }, [entries, days]);

  const inWeek = useMemo(() => new Set((entries ?? []).map((e) => e.recipe_id).filter(Boolean) as string[]), [entries]);
  const plannedCount = (entries ?? []).filter((e) => e.recipe_id).length;

  const go = (w: string) => router.replace(`/plan?week=${w}`);

  async function pick(p: { recipe?: Recipe; title?: string; meal: Meal }) {
    if (!pickDay) return;
    const date = pickDay;
    setPickDay(null);
    try {
      const e = await addPlanEntry({ date, meal: p.meal, recipe_id: p.recipe?.id ?? null, title: p.title ?? null, servings: servingsDefault });
      setEntries((prev) => [...(prev ?? []), e]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    }
  }

  async function suggest() {
    setBusy("suggest");
    try {
      const emptyDays = days.filter((d) => d >= t && !byDay[d].some((e) => e.meal === "dinner"));
      if (!emptyDays.length) return setToast("Every dinner is already planned");
      const pool = recipes
        .filter((r) => !inWeek.has(r.id))
        .map((r) => {
          const d = last[r.id] ? daysAgo(last[r.id]) : 60;
          if (d < 10) return { r, s: -1 };
          return { r, s: (r.favorite ? 30 : 0) + Math.min(d, 90) + Math.random() * 40 };
        })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s);
      if (!pool.length) return setToast("Add a few more recipes first");
      const picks = emptyDays.slice(0, pool.length);
      const added = await Promise.all(
        picks.map((d, i) => addPlanEntry({ date: d, meal: "dinner", recipe_id: pool[i].r.id, servings: servingsDefault })),
      );
      setEntries((prev) => [...(prev ?? []), ...added]);
      setToast(`Suggested ${added.length} dinners — swap what you don’t fancy`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function copyLast() {
    setBusy("copy");
    try {
      const n = await copyWeek(addDays(week, -7), week);
      setToast(n ? `Copied ${n} meals from last week` : "Last week was empty");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function makeList() {
    setBusy("list");
    try {
      await generateShoppingList(week, week < t && addDays(week, 6) >= t ? t : undefined);
      router.push(`/list?week=${week}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(null);
    }
  }

  async function patch(e: MealPlanEntry, p: Partial<MealPlanEntry>) {
    setEntries((prev) => prev?.map((x) => (x.id === e.id ? { ...x, ...p } : x)) ?? null);
    await updatePlanEntry(e.id, p).catch((err) => setError(err.message));
  }

  async function remove(e: MealPlanEntry) {
    setEntries((prev) => prev?.filter((x) => x.id !== e.id) ?? null);
    setMenu(null);
    await deletePlanEntry(e.id).catch((err) => setError(err.message));
  }

  return (
    <Page>
      <Header
        title={week === weekStart(t) ? "This week" : week === addDays(weekStart(t), 7) ? "Next week" : `Week ${isoWeekNumber(week)}`}
        subtitle={`${fmtWeekRange(week)} · ${plannedCount} meals planned`}
        right={
          <div className="flex items-center rounded-full border border-line bg-card">
            <button className="p-2" onClick={() => go(addDays(week, -7))} aria-label="Previous week">
              <IconChevronLeft size={20} />
            </button>
            <button className="px-1 text-xs font-semibold text-muted" onClick={() => go(defaultPlanningWeek())}>
              W{isoWeekNumber(week)}
            </button>
            <button className="p-2" onClick={() => go(addDays(week, 7))} aria-label="Next week">
              <IconChevronRight size={20} />
            </button>
          </div>
        }
      />

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <button className="btn btn-soft" onClick={suggest} disabled={!!busy}>
          {busy === "suggest" ? <Spinner className="h-4 w-4" /> : <IconDice size={18} />} Suggest dinners
        </button>
        <button className="btn btn-ghost" onClick={copyLast} disabled={!!busy}>
          {busy === "copy" ? <Spinner className="h-4 w-4" /> : <IconCopy size={18} />} Copy last week
        </button>
      </div>

      <ErrorNote error={error} />
      {!entries ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          {days.map((d) => {
            const isToday = d === t;
            const past = d < t;
            return (
              <section key={d} className={`card p-3 ${isToday ? "ring-2 ring-herb/40" : ""} ${past ? "opacity-70" : ""}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">
                    {fmtDay(d)} <span className="font-normal text-muted">{fmtDM(d)}</span>
                    {isToday && <span className="ml-2 rounded-full bg-herb px-2 py-0.5 text-[11px] font-semibold text-paper">Today</span>}
                  </p>
                  <button className="rounded-full p-1.5 text-herb hover:bg-herb-soft" onClick={() => setPickDay(d)} aria-label={`Add meal ${fmtDay(d)}`}>
                    <IconPlus size={20} />
                  </button>
                </div>
                {byDay[d].length === 0 && (
                  <button onClick={() => setPickDay(d)} className="w-full rounded-xl border border-dashed border-line py-3 text-sm text-muted">
                    What’s for dinner?
                  </button>
                )}
                <div className="space-y-2">
                  {byDay[d].map((e) => (
                    <div key={e.id} className="flex items-center gap-3">
                      {e.recipe ? (
                        <Link href={`/recipes/${e.recipe.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <RecipeThumb src={e.recipe.image_url} title={e.recipe.title} className="h-12 w-12 shrink-0 rounded-xl" />
                          <span className="min-w-0">
                            <span className={`block truncate font-medium ${e.cooked ? "check-strike" : ""}`}>{e.recipe.title}</span>
                            <span className="text-xs text-muted">
                              <span className="capitalize">{e.meal}</span>
                              {e.recipe.total_minutes ? ` · ${e.recipe.total_minutes} min` : ""}
                            </span>
                          </span>
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-butter/40 text-xl">🍽️</div>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{e.title}</span>
                            <span className="text-xs text-muted capitalize">{e.meal}</span>
                          </span>
                        </div>
                      )}
                      {e.recipe && <span className="text-xs text-muted tabular-nums">{e.servings}p</span>}
                      <button className="rounded-full p-1.5 text-muted" onClick={() => setMenu(e)} aria-label="Options">
                        <IconMore />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <div className="h-20" />

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
        <button className="btn btn-primary w-full max-w-md py-3.5 shadow-lg" onClick={makeList} disabled={!!busy || !plannedCount}>
          {busy === "list" ? <Spinner /> : <IconCart size={20} />} Make shopping list
        </button>
      </div>

      <RecipePickerSheet
        open={!!pickDay}
        onClose={() => setPickDay(null)}
        title={pickDay ? `${fmtDay(pickDay)} ${fmtDM(pickDay)}` : ""}
        recipes={recipes}
        lastCooked={last}
        inWeek={inWeek}
        onPick={pick}
      />

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.recipe?.title ?? menu?.title ?? ""}>
        {menu && (
          <div className="space-y-4">
            {menu.recipe && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Servings</span>
                <Stepper
                  value={menu.servings}
                  onChange={(n) => {
                    patch(menu, { servings: n });
                    setMenu({ ...menu, servings: n });
                  }}
                />
              </div>
            )}
            <div>
              <p className="mb-2 text-sm text-muted">Move to</p>
              <div className="grid grid-cols-4 gap-2">
                {days.map((d) => (
                  <button
                    key={d}
                    className="chip justify-center"
                    data-on={d === menu.date}
                    onClick={() => {
                      patch(menu, { date: d });
                      setMenu(null);
                    }}
                  >
                    {fmtDay(d)}
                  </button>
                ))}
                <button
                  className="chip justify-center"
                  onClick={() => {
                    patch(menu, { date: addDays(menu.date, 7) });
                    setEntries((prev) => prev?.filter((x) => x.id !== menu.id) ?? null);
                    setMenu(null);
                    setToast("Moved to next week");
                  }}
                >
                  Next wk
                </button>
              </div>
            </div>
            <div className="flex gap-1 rounded-full bg-line/50 p-1">
              {(["lunch", "dinner"] as Meal[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    patch(menu, { meal: m });
                    setMenu({ ...menu, meal: m });
                  }}
                  className={`flex-1 rounded-full py-1.5 text-sm font-semibold capitalize ${menu.meal === m ? "bg-card shadow-sm" : "text-muted"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn btn-soft"
                onClick={() => {
                  patch(menu, { cooked: !menu.cooked });
                  setMenu(null);
                }}
              >
                <IconCheck size={18} /> {menu.cooked ? "Not cooked" : "Mark cooked"}
              </button>
              <button className="btn btn-danger" onClick={() => remove(menu)}>
                Remove
              </button>
            </div>
          </div>
        )}
      </Sheet>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<Page><Loading /></Page>}>
      <PlanInner />
    </Suspense>
  );
}
