"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteRecipe, getRecipe, updateRecipe, uploadRecipeImage } from "@/lib/db";
import { resizeImage } from "@/lib/image";
import { supabase } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/types";
import { formatAmount, scaleQty } from "@/lib/units";
import { fmtDM, daysAgo, today } from "@/lib/dates";
import { Empty, Loading, Page, RecipeThumb, Spinner, Stepper, Toast } from "@/components/ui";
import { AddToPlanSheet } from "@/components/AddToPlanSheet";
import { IconCamera, IconCalendar, IconChevronLeft, IconClock, IconEdit, IconExternal, IconHeart, IconPlay, IconTrash, IconUsers } from "@/components/icons";

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [r, setR] = useState<Recipe | null | undefined>(undefined);
  const [servings, setServings] = useState(4);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [planOpen, setPlanOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getRecipe(id).then((x) => {
      setR(x);
      if (x) setServings(x.servings);
    });
    supabase()
      .from("meal_plan")
      .select("date")
      .eq("recipe_id", id)
      .lte("date", today())
      .order("date", { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory((data ?? []).map((d) => d.date)));
  }, [id]);

  if (r === undefined) return <Page><Loading /></Page>;
  if (r === null)
    return (
      <Page>
        <div className="pt-10"><Empty emoji="🤷" title="Recipe not found" /></div>
      </Page>
    );

  const toggleFav = async () => {
    const next = !r.favorite;
    setR({ ...r, favorite: next });
    await updateRecipe(r.id, { favorite: next }).catch(() => setR({ ...r, favorite: !next }));
  };

  async function onPhoto(f: File | undefined) {
    if (!f || !r) return;
    setUploading(true);
    try {
      const url = await uploadRecipeImage(await resizeImage(f, 1400, 0.8));
      await updateRecipe(r.id, { image_url: url });
      setR({ ...r, image_url: url });
      setToast("Photo saved");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  const groups: { name: string | null; items: Recipe["ingredients"] }[] = [];
  for (const i of r.ingredients) {
    const g = i.group ?? null;
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] });
    groups[groups.length - 1].items.push(i);
  }

  return (
    <Page>
      <div className="relative -mx-4 -mt-3">
        <RecipeThumb src={r.image_url} title={r.title} className="aspect-[4/3] max-h-[46vh] w-full" />
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        {r.image_url ? (
          <button
            onClick={() => photoRef.current?.click()}
            className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-sm font-semibold shadow backdrop-blur"
          >
            {uploading ? <Spinner className="h-4 w-4" /> : <IconCamera size={16} />} Change photo
          </button>
        ) : (
          <button
            onClick={() => photoRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/15 text-white"
          >
            <span className="rounded-full bg-black/35 p-4 backdrop-blur">{uploading ? <Spinner className="h-7 w-7" /> : <IconCamera size={30} />}</span>
            <span className="text-sm font-semibold drop-shadow">Take a photo of your dish</span>
          </button>
        )}
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 safe-top">
          <button onClick={() => router.back()} className="rounded-full bg-card/90 p-2 shadow backdrop-blur" aria-label="Back">
            <IconChevronLeft />
          </button>
          <button onClick={toggleFav} className={`rounded-full bg-card/90 p-2 shadow backdrop-blur ${r.favorite ? "text-tomato" : ""}`} aria-label="Favourite">
            <IconHeart filled={r.favorite} />
          </button>
        </div>
      </div>

      <div className="pt-4">
        <h1 className="font-display text-[1.9rem] leading-tight font-semibold">{r.title}</h1>
        {r.description && <p className="mt-1 text-[15px] text-muted">{r.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {r.total_minutes ? (
            <span className="chip"><IconClock size={14} /> {r.total_minutes} min</span>
          ) : null}
          {r.prep_minutes ? <span className="chip">Prep {r.prep_minutes}′</span> : null}
          {r.tags.map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {history.length
            ? `Cooked ${history.length}× · last ${fmtDM(history[0])} (${daysAgo(history[0])} days ago)`
            : "Not cooked yet"}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button className="btn btn-primary py-3" onClick={() => setPlanOpen(true)}>
          <IconCalendar size={18} /> Add to plan
        </button>
        <Link className="btn btn-soft py-3" href={`/recipes/${r.id}/cook?servings=${servings}`}>
          <IconPlay size={18} /> Cook mode
        </Link>
      </div>

      <section className="mt-7">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Ingredients</h2>
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <IconUsers size={16} />
            <Stepper value={servings} onChange={setServings} />
          </span>
        </div>
        <div className="card divide-y divide-line overflow-hidden">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.name && <p className="bg-paper/60 px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{g.name}</p>}
              {g.items.map((i) => {
                const on = checked.has(i.id);
                return (
                  <button
                    key={i.id}
                    onClick={() => setChecked((s) => { const n = new Set(s); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })}
                    className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left"
                  >
                    <span className={`w-20 shrink-0 text-right font-semibold tabular-nums ${on ? "text-muted" : "text-herb"}`}>
                      {formatAmount(scaleQty(i.qty, r.servings, servings), i.unit)}
                    </span>
                    <span className={on ? "check-strike" : ""}>
                      {i.name}
                      {i.note && <span className="text-muted">, {i.note}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {r.ingredients.length === 0 && <p className="px-4 py-3 text-sm text-muted">No ingredients.</p>}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-2 font-display text-xl font-semibold">Method</h2>
        <ol className="space-y-3">
          {r.steps.map((s, i) =>
            /^—.*—$/.test(s) ? (
              <li key={i} className="pt-2 text-xs font-semibold tracking-wide text-muted uppercase">{s.replace(/—/g, "").trim()}</li>
            ) : (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-herb-soft text-sm font-semibold text-herb">
                  {r.steps.slice(0, i + 1).filter((x) => !/^—.*—$/.test(x)).length}
                </span>
                <p className="pt-0.5 text-[15.5px] leading-relaxed">{s}</p>
              </li>
            ),
          )}
        </ol>
      </section>

      {r.notes && (
        <section className="mt-7 rounded-2xl bg-butter/30 p-4">
          <h2 className="mb-1 text-sm font-semibold">Our notes</h2>
          <p className="text-[15px] whitespace-pre-wrap">{r.notes}</p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={`/recipes/${r.id}/edit`} className="btn btn-ghost">
          <IconEdit size={16} /> Edit
        </Link>
        {r.source_url && (
          <a href={r.source_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
            <IconExternal size={16} /> Original
          </a>
        )}
        <button
          className="btn btn-danger ml-auto"
          onClick={async () => {
            if (!confirm(`Delete “${r.title}”? It will also be removed from any plan.`)) return;
            await deleteRecipe(r.id);
            router.replace("/recipes");
          }}
        >
          <IconTrash size={16} /> Delete
        </button>
      </div>

      <AddToPlanSheet open={planOpen} onClose={() => setPlanOpen(false)} recipe={r} onAdded={(d) => setToast(`Added to ${fmtDM(d)}`)} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
