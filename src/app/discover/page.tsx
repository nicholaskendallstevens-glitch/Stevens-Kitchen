"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Suggestion } from "@/lib/types";
import { addDays, fmtWeekRange, isoWeekNumber, today, weekStart } from "@/lib/dates";
import { Empty, ErrorNote, Header, Loading, Page, RecipeThumb, Spinner, Toast } from "@/components/ui";
import { IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconExternal, IconPlus, IconSparkle, IconX } from "@/components/icons";

export default function DiscoverPage() {
  const thisWeek = weekStart(today());
  const [week, setWeek] = useState(thisWeek);
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const autoTried = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase()
      .from("suggestions")
      .select("*")
      .eq("week_start", week)
      .neq("status", "dismissed")
      .order("created_at");
    if (error) {
      setError(error.message);
      setItems([]);
      return [];
    }
    setItems(data as Suggestion[]);
    return data as Suggestion[];
  }, [week]);

  const find = useCallback(
    async (more: boolean) => {
      setFinding(true);
      setError(null);
      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ week, more }),
        });
        const json = await res.json().catch(() => ({ error: "The search took too long — try again." }));
        if (!res.ok) throw new Error(json.error ?? "Failed");
        await load();
        if (more && json.added) setToast(`${json.added} more ideas`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setFinding(false);
      }
    },
    [week, load],
  );

  useEffect(() => {
    setItems(null);
    load().then((list) => {
      // first visit of the current week: fetch this week's ideas automatically
      if (list.length === 0 && week === thisWeek && autoTried.current !== week) {
        autoTried.current = week;
        find(false);
      }
    });
  }, [week, load, find, thisWeek]);

  async function dismiss(s: Suggestion) {
    setItems((p) => p?.filter((x) => x.id !== s.id) ?? null);
    await supabase().from("suggestions").update({ status: "dismissed" }).eq("id", s.id);
  }

  const open = (items ?? []).filter((s) => s.status === "new");
  const saved = (items ?? []).filter((s) => s.status === "saved");

  return (
    <Page>
      <Header
        title="Discover"
        subtitle={`Week ${isoWeekNumber(week)} · ${fmtWeekRange(week)}`}
        right={
          <>
            <button className="rounded-full border border-line bg-card p-2" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">
              <IconChevronLeft size={18} />
            </button>
            <button
              className="rounded-full border border-line bg-card p-2 disabled:opacity-30"
              disabled={week >= thisWeek}
              onClick={() => setWeek(addDays(week, 7))}
              aria-label="Next week"
            >
              <IconChevronRight size={18} />
            </button>
          </>
        }
      />
      <p className="-mt-2 mb-4 text-sm text-muted">Fresh, trending and easy dinner ideas from the web — new every week.</p>

      <ErrorNote error={error} />

      {finding && (
        <div className="card mb-4 flex items-center gap-3 p-4 text-sm">
          <Spinner className="text-herb" />
          <span>
            Searching the web for this week’s ideas…
            <span className="block text-xs text-muted">Takes about 30–60 seconds.</span>
          </span>
        </div>
      )}

      {items === null && !finding && <Loading />}
      {items && items.length === 0 && !finding && (
        <Empty emoji="🧭" title={week === thisWeek ? "No ideas yet" : "No ideas saved for that week"}>
          {week === thisWeek && (
            <button className="btn btn-primary mt-3" onClick={() => find(false)}>
              <IconSparkle size={18} /> Find ideas
            </button>
          )}
        </Empty>
      )}

      <div className="space-y-3">
        {open.map((s) => (
          <article key={s.id} className="card overflow-hidden">
            <a href={s.url} target="_blank" rel="noreferrer" className="block">
              <RecipeThumb src={s.image_url} title={s.title} className="aspect-[16/9] w-full" />
            </a>
            <div className="p-4">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">{s.source}</p>
              <h2 className="mt-0.5 font-display text-xl leading-snug font-semibold">{s.title}</h2>
              {s.why && <p className="mt-1 text-[14.5px] text-muted">{s.why}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.minutes ? (
                  <span className="chip text-xs">
                    <IconClock size={12} /> {s.minutes} min
                  </span>
                ) : null}
                {s.tags.map((t) => (
                  <span key={t} className="chip text-xs">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/recipes/import?url=${encodeURIComponent(s.url)}&sug=${s.id}`} className="btn btn-primary flex-1">
                  <IconPlus size={18} /> Save recipe
                </Link>
                <a href={s.url} target="_blank" rel="noreferrer" className="btn btn-ghost px-3" aria-label="Open website">
                  <IconExternal size={18} />
                </a>
                <button className="btn btn-ghost px-3" onClick={() => dismiss(s)} aria-label="Not for us">
                  <IconX size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {saved.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted uppercase">Saved from this week</h3>
          <div className="card divide-y divide-line">
            {saved.map((s) => (
              <Link key={s.id} href={s.recipe_id ? `/recipes/${s.recipe_id}` : s.url} className="flex items-center gap-3 px-4 py-3">
                <IconCheck size={18} className="text-herb" />
                <span className="flex-1 truncate">{s.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {items && items.length > 0 && week === thisWeek && (
        <button className="btn btn-soft mt-6 w-full" onClick={() => find(true)} disabled={finding}>
          {finding ? <Spinner className="h-4 w-4" /> : <IconSparkle size={18} />} Find more ideas
        </button>
      )}
      <p className="mt-4 px-1 text-xs text-muted">
        Tip: if “Save recipe” says a site blocks apps, open it with ↗ and use Share → To Stevens Kitchen.
      </p>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
