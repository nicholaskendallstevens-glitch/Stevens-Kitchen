"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listRecipes, lastCookedMap } from "@/lib/db";
import type { Recipe } from "@/lib/types";
import { daysAgo } from "@/lib/dates";
import { Empty, ErrorNote, Header, Loading, Page, RecipeThumb } from "@/components/ui";
import { IconClock, IconHeart, IconPlus, IconSearch } from "@/components/icons";

type Sort = "az" | "new" | "stale";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [last, setLast] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [quick, setQuick] = useState(false);
  const [sort, setSort] = useState<Sort>("az");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRecipes(), lastCookedMap()])
      .then(([r, l]) => {
        setRecipes(r);
        setLast(l);
      })
      .catch((e) => setError(e.message));
  }, []);

  const tags = useMemo(() => {
    const count: Record<string, number> = {};
    for (const r of recipes ?? []) for (const t of r.tags) count[t] = (count[t] ?? 0) + 1;
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  }, [recipes]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = (recipes ?? []).filter((r) => {
      if (fav && !r.favorite) return false;
      if (quick && !(r.total_minutes && r.total_minutes <= 30)) return false;
      if (tag && !r.tags.includes(tag)) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        r.tags.some((t) => t.includes(needle)) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(needle))
      );
    });
    if (sort === "new") list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "stale") list = [...list].sort((a, b) => (last[a.id] ?? "0000").localeCompare(last[b.id] ?? "0000"));
    return list;
  }, [recipes, q, tag, fav, quick, sort, last]);

  return (
    <Page>
      <Header
        title="Recipes"
        subtitle={recipes ? `${recipes.length} saved` : " "}
        right={
          <>
            <Link href="/recipes/new" className="btn btn-ghost px-3" aria-label="Write recipe">
              Write
            </Link>
            <Link href="/recipes/import" className="btn btn-primary">
              <IconPlus size={18} /> Add
            </Link>
          </>
        }
      />

      <div className="relative mb-3">
        <IconSearch size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input className="field pl-9" placeholder="Search title, ingredient, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <button className="chip" data-on={fav} onClick={() => setFav(!fav)}>
          <IconHeart size={14} filled={fav} /> Favourites
        </button>
        <button className="chip" data-on={quick} onClick={() => setQuick(!quick)}>
          <IconClock size={14} /> ≤ 30 min
        </button>
        <select className="chip appearance-none pr-3" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="az">A–Z</option>
          <option value="new">Newest</option>
          <option value="stale">Not cooked lately</option>
        </select>
        {tags.map((t) => (
          <button key={t} className="chip" data-on={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {t}
          </button>
        ))}
      </div>

      <ErrorNote error={error} />
      {!recipes && !error && <Loading />}
      {recipes && recipes.length === 0 && (
        <Empty emoji="📖" title="No recipes yet">
          Tap <b>Add</b> to paste a link from Fooby, Swissmilk, Betty Bossi or any blog — or snap a cookbook page.
        </Empty>
      )}
      {recipes && recipes.length > 0 && shown.length === 0 && <Empty emoji="🔍" title="Nothing matches" />}

      <div className="grid grid-cols-2 gap-3">
        {shown.map((r) => (
          <Link key={r.id} href={`/recipes/${r.id}`} className="card overflow-hidden active:scale-[0.98] transition-transform">
            <div className="relative">
              <RecipeThumb src={r.image_url} title={r.title} className="aspect-[4/3] w-full" />
              {!r.image_url && (
                <span className="absolute bottom-2 left-2 rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-white">📷 add photo</span>
              )}
              {r.favorite && (
                <span className="absolute top-2 right-2 rounded-full bg-card/90 p-1 text-tomato">
                  <IconHeart size={14} filled />
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-[15px] leading-snug font-semibold">{r.title}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                {r.total_minutes ? (
                  <span className="inline-flex items-center gap-1">
                    <IconClock size={12} />
                    {r.total_minutes}′
                  </span>
                ) : null}
                {last[r.id] ? <span>{relative(last[r.id])}</span> : <span>never cooked</span>}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}

function relative(date: string) {
  const d = daysAgo(date);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} wk ago`;
  return `${Math.round(d / 30)} mo ago`;
}
