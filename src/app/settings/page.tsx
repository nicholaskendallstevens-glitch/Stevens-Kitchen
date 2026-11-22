"use client";
import { useEffect, useState } from "react";
import { addStaple, getSettings, listRecipes, listStaples, removeStaple, saveSettings } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_STORE_ORDERS, STORES, storeOrder } from "@/lib/stores";
import { APP_NAME } from "@/lib/config";
import { CATEGORY_EMOJI, CATEGORY_LABELS, type Category, type Settings, type StoreId } from "@/lib/types";
import { ErrorNote, Header, Loading, Page, Stepper, Toast } from "@/components/ui";
import { IconChevronDown, IconChevronUp, IconX } from "@/components/icons";

function shortcutScript(origin: string) {
  return `function f(o){if(!o||typeof o!=='object')return null;if(Array.isArray(o)){for(var i=0;i<o.length;i++){var r=f(o[i]);if(r)return r;}return null;}var t=o['@type'];if(t==='Recipe'||(Array.isArray(t)&&t.indexOf('Recipe')>-1))return o;return f(o['@graph'])||f(o.mainEntity);}
var rec=null;document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){if(!rec){try{rec=f(JSON.parse(s.textContent));}catch(e){}}});
if(rec){['review','aggregateRating','video','author','nutrition','publisher','comment'].forEach(function(k){delete rec[k];});}
var m=document.querySelector('meta[property="og:image"]');
var d={u:location.href.split('#')[0],ld:rec?[JSON.stringify(rec)]:[],t:rec?'':document.body.innerText.slice(0,8000),i:m?m.content:null};
completion('${origin}/i/'+btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''));`;
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [staples, setStaples] = useState<{ id: string; name: string }[]>([]);
  const [newStaple, setNewStaple] = useState("");
  const [orderStore, setOrderStore] = useState<StoreId>("migros");
  const [email, setEmail] = useState<string | null>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((x) => {
      setS(x);
      setOrderStore(x.default_store);
    }).catch((e) => setError(e.message));
    listStaples().then(setStaples).catch(() => {});
    supabase().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    fetch("/api/import").then((r) => r.json()).then((j) => setAi(Boolean(j.ai))).catch(() => setAi(false));
  }, []);

  if (!s) return <Page><Header title="Settings" /><ErrorNote error={error} /><Loading /></Page>;

  const order = storeOrder(orderStore, s.store_orders);

  async function patch(p: Partial<Settings>) {
    const next = { ...s!, ...p };
    setS(next);
    await saveSettings(p).catch((e) => setError(e.message));
  }

  function move(idx: number, dir: -1 | 1) {
    const list = [...order];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    patch({ store_orders: { ...s!.store_orders, [orderStore]: list as Category[] } });
  }

  async function backup() {
    const recipes = await listRecipes();
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), recipes }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `recipes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  return (
    <Page>
      <Header title="Settings" subtitle={email ?? undefined} />
      <ErrorNote error={error} />

      <section className="card mb-4 divide-y divide-line">
        <div className="flex items-center justify-between px-4 py-3">
          <span>Usual number of people</span>
          <Stepper value={s.default_servings} onChange={(n) => patch({ default_servings: n })} />
        </div>
        <div className="px-4 py-3">
          <p className="mb-2">Usual store</p>
          <div className="flex flex-wrap gap-2">
            {STORES.map((st) => (
              <button key={st.id} className="chip" data-on={s.default_store === st.id} onClick={() => patch({ default_store: st.id })}>
                {st.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <h2 className="mb-1 px-1 font-display text-xl font-semibold">Aisle order</h2>
      <p className="mb-2 px-1 text-sm text-muted">Sort the list the way you walk through your branch.</p>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {STORES.map((st) => (
          <button key={st.id} className="chip" data-on={orderStore === st.id} onClick={() => setOrderStore(st.id)}>
            {st.name}
          </button>
        ))}
      </div>
      <section className="card mb-2 divide-y divide-line">
        {order.map((c, i) => (
          <div key={c} className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-6 text-center text-xs text-muted tabular-nums">{i + 1}</span>
            <span className="flex-1 text-[15px]">
              {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
            </span>
            <button className="p-1.5 text-muted disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Up">
              <IconChevronUp size={18} />
            </button>
            <button className="p-1.5 text-muted disabled:opacity-20" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Down">
              <IconChevronDown size={18} />
            </button>
          </div>
        ))}
      </section>
      <button
        className="mb-6 px-1 text-sm text-herb"
        onClick={() => {
          const next = { ...s.store_orders };
          delete next[orderStore];
          patch({ store_orders: next });
          setToast(`Reset to default ${STORES.find((x) => x.id === orderStore)?.name} order`);
        }}
        hidden={!s.store_orders[orderStore] || JSON.stringify(s.store_orders[orderStore]) === JSON.stringify(DEFAULT_STORE_ORDERS[orderStore])}
      >
        Reset to default
      </button>

      <h2 className="mb-1 px-1 font-display text-xl font-semibold">Always at home</h2>
      <p className="mb-2 px-1 text-sm text-muted">These go into a collapsed “probably at home” section instead of the main list.</p>
      <section className="card mb-6 p-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {staples.map((st) => (
            <span key={st.id} className="chip">
              {st.name}
              <button
                onClick={async () => {
                  setStaples((p) => p.filter((x) => x.id !== st.id));
                  await removeStaple(st.id).catch(() => {});
                }}
                aria-label={`Remove ${st.name}`}
                className="text-muted"
              >
                <IconX size={14} />
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newStaple.trim()) return;
            await addStaple(newStaple).catch((err) => setError(err.message));
            setNewStaple("");
            setStaples(await listStaples());
          }}
        >
          <input className="field text-sm" placeholder="e.g. Bouillon, Mehl, Reis" value={newStaple} onChange={(e) => setNewStaple(e.target.value)} />
          <button className="btn btn-soft">Add</button>
        </form>
      </section>

      <h2 className="mb-2 px-1 font-display text-xl font-semibold">On your iPhone</h2>
      <section className="card mb-6 space-y-2 p-4 text-sm">
        <p>
          <b>Home screen:</b> open this site in Safari → Share → <i>Add to Home Screen</i>. It opens full-screen like an app.
        </p>
        <p>
          <b>Save from Safari (works on every site):</b> a Shortcut that sends the page you have open to the app. Copy the script below and
          follow the README (“Kurzbefehl”).
        </p>
        <button
          className="btn btn-soft w-full text-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(shortcutScript(window.location.origin));
            setToast("Shortcut script copied");
          }}
        >
          Copy shortcut script
        </button>
        <p>
          <b>AI import (photo, text, translation):</b>{" "}
          {ai === null ? "…" : ai ? <span className="font-semibold text-herb">on</span> : <span className="font-semibold text-tomato">off — add ANTHROPIC_API_KEY in Vercel</span>}
        </p>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-2">
        <button className="btn btn-ghost" onClick={backup}>
          Backup recipes
        </button>
        <button
          className="btn btn-danger"
          onClick={async () => {
            await supabase().auth.signOut();
            window.location.href = "/login";
          }}
        >
          Sign out
        </button>
      </section>
      <p className="pb-4 text-center text-xs text-muted">{APP_NAME}</p>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
