"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RecipeEditor } from "@/components/RecipeEditor";
import { createRecipe } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { blobToBase64, resizeImage } from "@/lib/image";
import type { RecipeDraft } from "@/lib/types";
import { ErrorNote, Header, Page, Spinner } from "@/components/ui";
import { IconCamera, IconChevronLeft, IconLink, IconSparkle, IconText, IconX } from "@/components/icons";

type Mode = "url" | "image" | "text";

const SITES = ["fooby.ch", "swissmilk.ch", "bettybossi.ch", "migusto.migros.ch", "chefkoch.de", "bbcgoodfood.com", "most food blogs"];

function ImportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState(params.get("url") ?? params.get("text")?.match(/https?:\/\/\S+/)?.[0] ?? "");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [translate, setTranslate] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; title: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  useEffect(() => {
    fetch("/api/import")
      .then((r) => r.json())
      .then((j) => setAi(Boolean(j.ai)))
      .catch(() => setAi(false));
  }, []);

  const run = useCallback(
    async (m: Mode, opts?: { url?: string }) => {
      setBusy(true);
      setError(null);
      setDuplicate(null);
      try {
        let body: unknown;
        if (m === "url") {
          const u = (opts?.url ?? url).trim();
          if (!u) throw new Error("Paste a link first");
          const { data: dup } = await supabase().from("recipes").select("id, title").eq("source_url", u).maybeSingle();
          if (dup) setDuplicate(dup);
          body = { mode: "url", url: u, translate };
        } else if (m === "text") {
          if (text.trim().length < 30) throw new Error("Paste the full recipe text");
          body = { mode: "text", text, translate };
        } else {
          if (!files.length) throw new Error("Pick at least one photo");
          const images = await Promise.all(
            files.map(async (f) => ({ media_type: "image/jpeg", data: await blobToBase64(await resizeImage(f)) })),
          );
          body = { mode: "image", images, translate };
        }
        const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok) throw new Error((json.error ?? "Import failed").replace(/^BLOCKED: /, ""));
        setDraft(json.draft);
        setMethod(json.method);
        window.scrollTo({ top: 0 });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setBusy(false);
      }
    },
    [url, text, files, translate],
  );

  // opened from the Safari share-sheet shortcut with the page content: /recipes/import#page=<base64 json>
  useEffect(() => {
    const handle = async () => {
      // payload arrives as ?page=… (preferred) or #page=… (older shortcut script)
      const q = new URLSearchParams(window.location.search).get("page");
      const h = window.location.hash.startsWith("#page=") ? window.location.hash.slice(6) : null;
      const payload = q ?? (h ? decodeURIComponent(h) : null);
      if (!payload) return;
      history.replaceState(null, "", window.location.pathname);
      setBusy(true);
      setError(null);
      setDraft(null);
      try {
        let reqBody: unknown;
        let p: { u?: string } = {};
        if (/^[A-Za-z0-9-]{8,64}$/.test(payload)) {
          // short id: the shortcut already uploaded the data
          reqBody = { mode: "stash", id: payload };
        } else {
          let raw: string;
          try {
            let b64 = payload.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "+");
            while (b64.length % 4) b64 += "=";
            raw = decodeURIComponent(escape(atob(b64)));
          } catch {
            throw new Error("The shortcut sent incomplete data. Update the shortcut script (Settings → Copy shortcut script).");
          }
          const d = JSON.parse(raw) as { u: string; ld?: string[]; t?: string; i?: string | null };
          p = d;
          reqBody = { mode: "page", url: d.u, ld: d.ld ?? [], text: d.t ?? "", image: d.i ?? null };
        }
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(reqBody),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Import failed");
        const src = p.u ?? json.draft?.source_url;
        if (src) setUrl(src);
        if (src) {
          const { data: dup } = await supabase().from("recipes").select("id, title").eq("source_url", src).maybeSingle();
          if (dup) setDuplicate(dup);
        }
        setDraft(json.draft);
        setMethod(json.method);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setBusy(false);
      }
    };
    handle();
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);

  // opened from a link-only shortcut: /recipes/import?url=…
  useEffect(() => {
    const u = params.get("url");
    if (u && !autoRan.current) {
      autoRan.current = true;
      run("url", { url: u });
    }
  }, [params, run]);

  if (draft) {
    return (
      <Page tabbar={false}>
        <Header
          left={
            <button onClick={() => setDraft(null)} className="mb-1 inline-flex items-center text-sm text-herb">
              <IconChevronLeft size={16} /> Back
            </button>
          }
          title="Check & save"
          subtitle={method === "ai" ? "Read by AI — give it a quick look" : "Imported from the recipe's structured data"}
        />
        {duplicate && (
          <p className="mb-4 rounded-xl bg-butter/40 px-3 py-2 text-sm">
            You already have this one:{" "}
            <Link className="font-semibold underline" href={`/recipes/${duplicate.id}`}>
              {duplicate.title}
            </Link>
          </p>
        )}
        <RecipeEditor
          initial={draft}
          onCancel={() => setDraft(null)}
          onSave={async (d) => {
            const r = await createRecipe(d);
            router.replace(`/recipes/${r.id}`);
          }}
        />
      </Page>
    );
  }

  const tabs: { id: Mode; label: string; Icon: typeof IconLink; needsAi: boolean }[] = [
    { id: "url", label: "Link", Icon: IconLink, needsAi: false },
    { id: "image", label: "Photo", Icon: IconCamera, needsAi: true },
    { id: "text", label: "Text", Icon: IconText, needsAi: true },
  ];

  return (
    <Page tabbar={false}>
      <Header
        left={
          <Link href="/recipes" className="mb-1 inline-flex items-center text-sm text-herb">
            <IconChevronLeft size={16} /> Recipes
          </Link>
        }
        title="Add recipe"
      />

      <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-line/50 p-1">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold ${mode === id ? "bg-card shadow-sm" : "text-muted"}`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {mode !== "url" && ai === false && (
        <p className="mb-4 rounded-xl bg-butter/40 px-3 py-2 text-sm">
          Photo and text import use Claude. Add <code>ANTHROPIC_API_KEY</code> in Vercel to switch them on.
        </p>
      )}

      {mode === "url" && (
        <div className="space-y-3">
          <input
            className="field"
            type="url"
            inputMode="url"
            placeholder="https://fooby.ch/de/rezepte/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run("url")}
            autoFocus
          />
          <button
            className="btn btn-soft w-full"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (t) setUrl(t.trim());
              } catch {
                setError("Allow clipboard access, or long-press the field to paste");
              }
            }}
          >
            Paste from clipboard
          </button>
          <p className="text-xs text-muted">Works with {SITES.join(", ")}.</p>
        </div>
      )}

      {mode === "image" && (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 4))}
          />
          <button onClick={() => fileRef.current?.click()} className="card flex w-full flex-col items-center gap-2 border-dashed py-8 text-muted">
            <IconCamera size={32} />
            <span className="text-sm font-medium">Take or choose photos (up to 4 pages)</span>
          </button>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 rounded-xl object-cover" />
                  <button className="absolute -top-1.5 -right-1.5 rounded-full bg-ink p-0.5 text-paper" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">Cookbook pages, Grandma’s handwritten cards, screenshots from Instagram.</p>
        </div>
      )}

      {mode === "text" && (
        <div className="space-y-2">
          <textarea
            className="field min-h-[260px] text-sm"
            placeholder="Paste a recipe from anywhere — WhatsApp, an email, an Instagram caption…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}

      {ai && (
        <label className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          <span>
            <span className="font-semibold">Translate to English</span>
            <span className="block text-xs text-muted">Otherwise the recipe keeps its original language</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--herb)]" checked={translate} onChange={(e) => setTranslate(e.target.checked)} />
        </label>
      )}

      <ErrorNote error={error} />
      {busy && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-herb-soft px-3 py-2 text-sm text-herb">
          <Spinner className="h-4 w-4" /> Reading the recipe…
        </p>
      )}

      <button className="btn btn-primary mt-5 w-full py-3" onClick={() => run(mode)} disabled={busy || (mode !== "url" && ai === false)}>
        {busy ? (
          <>
            <Spinner /> {mode === "url" ? "Reading the page…" : "Reading the recipe…"}
          </>
        ) : (
          <>
            <IconSparkle size={18} /> Import
          </>
        )}
      </button>

      <p className="mt-6 text-center text-sm text-muted">
        or{" "}
        <Link href="/recipes/new" className="font-semibold text-herb">
          write one by hand
        </Link>
      </p>
    </Page>
  );
}

export default function ImportPage() {
  return (
    <Suspense>
      <ImportInner />
    </Suspense>
  );
}
