"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addShoppingItem, deleteCheckedItems, deleteShoppingItem, generateShoppingList, getOverrides, getSettings, listShopping,
  saveSettings, setOverride, updateShoppingItem,
} from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { parseIngredient } from "@/lib/ingredients";
import { formatAmount } from "@/lib/units";
import { storeOrder, STORES } from "@/lib/stores";
import { shareText } from "@/lib/shopping";
import { addDays, defaultPlanningWeek, fmtWeekRange, isoWeekNumber, today } from "@/lib/dates";
import { APP_NAME } from "@/lib/config";
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS, type Category, type Settings, type ShoppingItem, type StoreId } from "@/lib/types";
import { Empty, ErrorNote, Header, Loading, Page, Sheet, Spinner, Toast } from "@/components/ui";
import { IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconPlus, IconRefresh, IconShare, IconTrash } from "@/components/icons";

const cacheKey = (w: string) => `sk-list-${w}`;

function ListInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const week = sp.get("week") ?? defaultPlanningWeek();

  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [store, setStore] = useState<StoreId>("migros");
  const [overrides, setOverridesState] = useState<Record<string, Category>>({});
  const [newItem, setNewItem] = useState("");
  const [edit, setEdit] = useState<ShoppingItem | null>(null);
  const [showBasket, setShowBasket] = useState(false);
  const [showStaples, setShowStaples] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listShopping(week)
      .then((list) => {
        setItems(list);
        try {
          localStorage.setItem(cacheKey(week), JSON.stringify(list));
        } catch {}
      })
      .catch((e) => setError(navigator.onLine ? e.message : "Offline — showing the last saved list"));
  }, [week]);

  useEffect(() => {
    // show cached list instantly (handy in the supermarket basement)
    try {
      const c = localStorage.getItem(cacheKey(week));
      setItems(c ? JSON.parse(c) : null);
    } catch {
      setItems(null);
    }
    load();
  }, [week, load]);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setStore(s.default_store);
    }).catch(() => {});
    getOverrides().then(setOverridesState).catch(() => {});
  }, []);

  // live sync: you tick it off, she sees it instantly
  useEffect(() => {
    const ch = supabase()
      .channel(`list-${week}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `week_start=eq.${week}` }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase().removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [week, load]);

  const order = useMemo(() => storeOrder(store, settings?.store_orders), [store, settings]);

  const { groups, basket, staples, total, done } = useMemo(() => {
    const list = items ?? [];
    const open = list.filter((i) => !i.checked && !i.staple);
    const staples = list.filter((i) => !i.checked && i.staple);
    const basket = list.filter((i) => i.checked);
    const g = order
      .map((c) => ({ cat: c, items: open.filter((i) => (i.category ?? "other") === c).sort((a, b) => a.name.localeCompare(b.name, "de")) }))
      .filter((x) => x.items.length);
    return { groups: g, basket, staples, total: list.length - staples.length, done: basket.filter((i) => !i.staple).length };
  }, [items, order]);

  async function toggle(i: ShoppingItem) {
    const checked = !i.checked;
    setItems((prev) => prev?.map((x) => (x.id === i.id ? { ...x, checked } : x)) ?? null);
    try {
      navigator.vibrate?.(8);
    } catch {}
    await updateShoppingItem(i.id, { checked }).catch((e) => {
      setError(e.message);
      setItems((prev) => prev?.map((x) => (x.id === i.id ? { ...x, checked: !checked } : x)) ?? null);
    });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    const p = parseIngredient(text, overrides);
    const amount = p.qty != null || p.unit ? formatAmount(p.qty, p.unit) : null;
    try {
      const created = await addShoppingItem({ week_start: week, name: p.name, amount_text: amount, category: p.category, manual: true });
      setItems((prev) => [...(prev ?? []), created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    }
  }

  async function regenerate() {
    setBusy("regen");
    try {
      const t = today();
      const { count, recipes } = await generateShoppingList(week, week < t && addDays(week, 6) >= t ? t : undefined);
      setToast(`${count} items from ${recipes} meals`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const text = shareText(
      `🛒 ${APP_NAME} · ${fmtWeekRange(week)}`,
      groups.map((g) => ({ label: CATEGORY_LABELS[g.cat], items: g.items })),
    );
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setToast("Copied to clipboard");
      }
    } catch {}
  }

  async function chooseStore(s: StoreId) {
    setStore(s);
    saveSettings({ default_store: s }).catch(() => {});
  }

  async function saveEdit(it: ShoppingItem, patch: Partial<ShoppingItem>) {
    setItems((prev) => prev?.map((x) => (x.id === it.id ? { ...x, ...patch } : x)) ?? null);
    if (patch.category && patch.category !== it.category) {
      setOverride(it.name, patch.category).catch(() => {});
    }
    await updateShoppingItem(it.id, patch).catch((e) => setError(e.message));
  }

  const go = (w: string) => router.replace(`/list?week=${w}`);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <Page>
      <Header
        title="Shopping"
        subtitle={`Week ${isoWeekNumber(week)} · ${fmtWeekRange(week)}`}
        right={
          <>
            <button className="rounded-full border border-line bg-card p-2" onClick={() => go(addDays(week, -7))} aria-label="Previous week">
              <IconChevronLeft size={18} />
            </button>
            <button className="rounded-full border border-line bg-card p-2" onClick={() => go(addDays(week, 7))} aria-label="Next week">
              <IconChevronRight size={18} />
            </button>
          </>
        }
      />

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {STORES.map((s) => (
          <button
            key={s.id}
            className="chip font-semibold"
            data-on={store === s.id}
            style={store === s.id ? { background: s.color, borderColor: s.color, color: "white" } : undefined}
            onClick={() => chooseStore(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {total > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              {done} of {total} in the basket
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-herb transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <form onSubmit={add} className="mb-4 flex gap-2">
        <input className="field" placeholder="Add item, e.g. 2 l Milch" value={newItem} onChange={(e) => setNewItem(e.target.value)} enterKeyHint="done" />
        <button className="btn btn-primary px-3" aria-label="Add">
          <IconPlus />
        </button>
      </form>

      <div className="mb-4 flex gap-2">
        <button className="btn btn-ghost flex-1 text-sm" onClick={regenerate} disabled={!!busy}>
          {busy === "regen" ? <Spinner className="h-4 w-4" /> : <IconRefresh size={16} />} Update from plan
        </button>
        <button className="btn btn-ghost flex-1 text-sm" onClick={share} disabled={!groups.length}>
          <IconShare size={16} /> Share
        </button>
      </div>

      <ErrorNote error={error} />
      {items === null && <Loading />}
      {items && items.length === 0 && (
        <Empty emoji="🧺" title="List is empty">
          Plan the week, then tap <b>Make shopping list</b> —{" "}
          <Link href={`/plan?week=${week}`} className="font-semibold text-herb">
            go to plan
          </Link>
        </Empty>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.cat}>
            <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">
              <span className="text-base">{CATEGORY_EMOJI[g.cat]}</span> {CATEGORY_LABELS[g.cat]}
            </h3>
            <div className="card divide-y divide-line overflow-hidden">
              {g.items.map((i) => (
                <Row key={i.id} item={i} onToggle={() => toggle(i)} onEdit={() => setEdit(i)} />
              ))}
            </div>
          </section>
        ))}

        {staples.length > 0 && (
          <section>
            <button className="flex w-full items-center justify-between px-1 py-1 text-xs font-semibold tracking-wide text-muted uppercase" onClick={() => setShowStaples(!showStaples)}>
              <span>🏠 Probably at home ({staples.length})</span>
              <IconChevronDown size={16} className={showStaples ? "rotate-180" : ""} />
            </button>
            {showStaples && (
              <div className="card mt-1.5 divide-y divide-line overflow-hidden">
                {staples.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="flex-1">
                      {i.amount_text && <span className="mr-1.5 font-semibold text-herb">{i.amount_text}</span>}
                      {i.name}
                    </span>
                    <button className="chip text-xs" onClick={() => saveEdit(i, { staple: false })}>
                      Need it
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {basket.length > 0 && (
          <section>
            <div className="flex items-center justify-between px-1">
              <button className="flex items-center gap-1 py-1 text-xs font-semibold tracking-wide text-muted uppercase" onClick={() => setShowBasket(!showBasket)}>
                ✅ In the basket ({basket.length}) <IconChevronDown size={16} className={showBasket ? "rotate-180" : ""} />
              </button>
              <button
                className="text-xs font-semibold text-tomato"
                onClick={async () => {
                  setItems((prev) => prev?.filter((x) => !x.checked) ?? null);
                  await deleteCheckedItems(week).catch((e) => setError(e.message));
                }}
              >
                Clear
              </button>
            </div>
            {showBasket && (
              <div className="card mt-1.5 divide-y divide-line overflow-hidden">
                {basket.map((i) => (
                  <Row key={i.id} item={i} onToggle={() => toggle(i)} onEdit={() => setEdit(i)} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <EditSheet
        item={edit}
        onClose={() => setEdit(null)}
        onSave={(patch) => {
          if (edit) saveEdit(edit, patch);
          setEdit(null);
        }}
        onDelete={async () => {
          if (!edit) return;
          const id = edit.id;
          setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
          setEdit(null);
          await deleteShoppingItem(id).catch((e) => setError(e.message));
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

function Row({ item: i, onToggle, onEdit }: { item: ShoppingItem; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className="flex items-center">
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            i.checked ? "border-herb bg-herb text-paper" : "border-line"
          }`}
        >
          {i.checked && <IconCheck size={14} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[16px] ${i.checked ? "check-strike" : ""}`}>
            {i.amount_text && <span className={`mr-1.5 font-semibold tabular-nums ${i.checked ? "" : "text-herb"}`}>{i.amount_text}</span>}
            {i.name}
          </span>
          {(i.sources ?? []).length > 0 && !i.checked && <span className="block truncate text-xs text-muted">{i.sources.join(" · ")}</span>}
        </span>
      </button>
      <button onClick={onEdit} className="px-3 py-3 text-muted" aria-label="Edit">
        ⋯
      </button>
    </div>
  );
}

function EditSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (p: Partial<ShoppingItem>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<Category>("other");
  useEffect(() => {
    if (item) {
      setName(item.name);
      setAmount(item.amount_text ?? "");
      setCat(item.category);
    }
  }, [item]);
  return (
    <Sheet open={!!item} onClose={onClose} title="Edit item">
      {item && (
        <div className="space-y-3">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <input className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount, e.g. 500 g" />
          <div>
            <p className="mb-1.5 text-sm text-muted">Aisle (remembered for next time)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} className="chip justify-start text-xs" data-on={cat === c} onClick={() => setCat(c)}>
                  {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          {(item.sources ?? []).length > 0 && <p className="text-xs text-muted">For: {item.sources.join(", ")}</p>}
          {!item.manual && <p className="text-xs text-muted">Note: “Update from plan” recalculates amounts of recipe items.</p>}
          <div className="flex gap-2 pt-1">
            <button className="btn btn-danger" onClick={onDelete}>
              <IconTrash size={16} />
            </button>
            {!item.staple && (
              <button className="btn btn-ghost text-sm" onClick={() => onSave({ staple: true })}>
                🏠 Have it
              </button>
            )}
            <button className="btn btn-primary flex-1" onClick={() => onSave({ name: name.trim() || item.name, amount_text: amount.trim() || null, category: cat })}>
              Save
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<Page><Loading /></Page>}>
      <ListInner />
    </Suspense>
  );
}
