"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Ingredient, RecipeDraft } from "@/lib/types";
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS } from "@/lib/types";
import { parseIngredientBlock } from "@/lib/ingredients";
import { formatAmount } from "@/lib/units";
import { nameKey } from "@/lib/categories";
import { getOverrides, setOverride, uploadRecipeImage } from "@/lib/db";
import { resizeImage } from "@/lib/image";
import { ErrorNote, RecipeThumb, Spinner, Stepper } from "./ui";
import { IconCamera, IconPlus, IconX } from "./icons";
import { supabase } from "@/lib/supabase/client";

const SUGGESTED_TAGS = ["quick", "vegetarian", "vegan", "kid-friendly", "pasta", "soup", "salad", "meat", "fish", "baking", "dessert", "batch-cook", "summer", "winter", "swiss"];

function ingredientsToText(list: Ingredient[]): string {
  const lines: string[] = [];
  let group: string | null | undefined = undefined;
  for (const i of list) {
    if ((i.group ?? null) !== (group ?? null)) {
      if (i.group) lines.push(`${i.group}:`);
      group = i.group ?? null;
    }
    lines.push(i.raw || [formatAmount(i.qty, i.unit), i.name, i.note ? `, ${i.note}` : ""].join(" ").replace(/\s+,/, ",").trim());
  }
  return lines.join("\n");
}

export function RecipeEditor({
  initial,
  onSave,
  onCancel,
  saveLabel = "Save recipe",
}: {
  initial: RecipeDraft;
  onSave: (d: RecipeDraft) => Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const [d, setD] = useState<RecipeDraft>(initial);
  const [ingText, setIngText] = useState(() => ingredientsToText(initial.ingredients));
  const [stepsText, setStepsText] = useState(() => initial.steps.join("\n"));
  const [tags, setTags] = useState<string[]>(() => [...new Set(initial.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState<string | null>(null);
  const [catEdits, setCatEdits] = useState<Record<string, Category>>(() =>
    Object.fromEntries(initial.ingredients.map((i) => [nameKey(i.name), i.category])),
  );
  const [overrides, setOverrides] = useState<Record<string, Category>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getOverrides().then(setOverrides).catch(() => {});
    // tags you already use elsewhere, most used first
    supabase()
      .from("recipes")
      .select("tags")
      .then(({ data }) => {
        const count: Record<string, number> = {};
        for (const r of data ?? []) for (const t of (r.tags as string[]) ?? []) count[t] = (count[t] ?? 0) + 1;
        setKnownTags(Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t]) => t));
      });
  }, []);

  const parsed = useMemo(() => {
    const list = parseIngredientBlock(ingText, overrides);
    return list.map((i) => {
      const k = nameKey(i.name);
      return catEdits[k] ? { ...i, category: catEdits[k] } : i;
    });
  }, [ingText, overrides, catEdits]);

  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await resizeImage(f, 1400, 0.8);
      set("image_url", await uploadRecipeImage(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!d.title.trim()) return setError("Give it a title");
    setBusy(true);
    setError(null);
    try {
      const steps = stepsText.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      // remember category changes so the shopping list learns them
      const changed = parsed.filter((i) => catEdits[nameKey(i.name)] && overrides[nameKey(i.name)] !== i.category);
      await Promise.all(changed.map((i) => setOverride(i.name, i.category).catch(() => {})));
      const total = d.total_minutes ?? (d.prep_minutes || d.cook_minutes ? (d.prep_minutes ?? 0) + (d.cook_minutes ?? 0) : null);
      await onSave({ ...d, title: d.title.trim(), ingredients: parsed, steps, tags, total_minutes: total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  }

  const toggleTag = (t: string) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const addTag = () => {
    const t = (newTag ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setNewTag(null);
  };
  const otherTags = [...new Set([...knownTags, ...SUGGESTED_TAGS])].filter((t) => !tags.includes(t));

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative shrink-0 overflow-hidden rounded-2xl">
          <RecipeThumb src={d.image_url} title={d.title || "?"} className="h-24 w-24" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/45 py-1 text-[11px] font-medium text-white">
            {uploading ? <Spinner className="h-3 w-3" /> : <IconCamera size={12} />} Photo
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        <div className="flex-1 space-y-2">
          <input className="field font-display text-lg font-semibold" placeholder="Recipe title" value={d.title} onChange={(e) => set("title", e.target.value)} />
          <input className="field text-sm" placeholder="Image URL (optional)" value={d.image_url ?? ""} onChange={(e) => set("image_url", e.target.value || null)} />
        </div>
      </div>

      <textarea className="field min-h-[60px] text-sm" placeholder="Short description (optional)" value={d.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="space-y-1">
          <span className="text-muted">Serves</span>
          <div>
            <Stepper value={d.servings} onChange={(n) => set("servings", n)} />
          </div>
        </label>
        <label className="space-y-1">
          <span className="text-muted">Total time (min)</span>
          <input className="field" inputMode="numeric" value={d.total_minutes ?? ""} onChange={(e) => set("total_minutes", e.target.value ? Number(e.target.value) : null)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Prep (min)</span>
          <input className="field" inputMode="numeric" value={d.prep_minutes ?? ""} onChange={(e) => set("prep_minutes", e.target.value ? Number(e.target.value) : null)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted">Cook (min)</span>
          <input className="field" inputMode="numeric" value={d.cook_minutes ?? ""} onChange={(e) => set("cook_minutes", e.target.value ? Number(e.target.value) : null)} />
        </label>
      </div>

      <section>
        <h3 className="mb-1 font-display text-lg font-semibold">Ingredients</h3>
        <p className="mb-2 text-xs text-muted">One per line, e.g. “2.5 dl Halbrahm” or “1 onion, chopped”. A line ending with “:” starts a group.</p>
        <textarea className="field min-h-[180px] font-mono text-[14px] leading-relaxed" value={ingText} onChange={(e) => setIngText(e.target.value)} />
        {parsed.length > 0 && (
          <div className="mt-2 divide-y divide-line rounded-2xl border border-line bg-card">
            {parsed.map((i, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-herb">{formatAmount(i.qty, i.unit)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {i.name}
                  {i.note && <span className="text-muted">, {i.note}</span>}
                </span>
                <select
                  className="max-w-[8.5rem] rounded-lg bg-paper px-1.5 py-1 text-xs"
                  value={i.category}
                  onChange={(e) => setCatEdits((p) => ({ ...p, [nameKey(i.name)]: e.target.value as Category }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 font-display text-lg font-semibold">Method</h3>
        <p className="mb-2 text-xs text-muted">One step per line.</p>
        <textarea className="field min-h-[200px] text-[15px] leading-relaxed" value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg font-semibold">Tags</h3>
        <p className="text-xs text-muted">Tap a tag to add or remove it.</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button key={t} type="button" className="chip text-xs" data-on onClick={() => toggleTag(t)} aria-label={`Remove ${t}`}>
              {t} <IconX size={12} />
            </button>
          ))}
          {newTag === null ? (
            <button type="button" className="chip border-dashed text-xs text-herb" onClick={() => setNewTag("")}>
              <IconPlus size={12} /> New tag
            </button>
          ) : (
            <input
              autoFocus
              className="chip w-36 text-xs outline-none"
              placeholder="e.g. asian"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
                if (e.key === "Escape") setNewTag(null);
              }}
              onBlur={addTag}
              enterKeyHint="done"
            />
          )}
        </div>
        {otherTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {otherTags.map((t) => (
              <button key={t} type="button" className="chip text-xs text-muted" onClick={() => toggleTag(t)}>
                <IconPlus size={11} /> {t}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-lg font-semibold">Notes</h3>
        <textarea className="field min-h-[70px] text-sm" placeholder="Our tweaks: less salt, double the garlic…" value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
        <input className="field text-sm" placeholder="Source URL" value={d.source_url ?? ""} onChange={(e) => set("source_url", e.target.value || null)} />
      </section>

      <ErrorNote error={error} />
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-paper/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary flex-1 py-3" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : saveLabel}
        </button>
      </div>
    </div>
  );
}

export const EMPTY_DRAFT = (servings = 4): RecipeDraft => ({
  title: "",
  description: null,
  image_url: null,
  source_url: null,
  servings,
  prep_minutes: null,
  cook_minutes: null,
  total_minutes: null,
  ingredients: [],
  steps: [],
  tags: [],
  notes: null,
  favorite: false,
  rating: null,
});
