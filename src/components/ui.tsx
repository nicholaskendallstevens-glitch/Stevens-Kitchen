"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBook, IconCalendar, IconCart, IconGear, IconMinus, IconPlus, IconX } from "./icons";

/* ---------------------------------- shell --------------------------------- */

const TABS = [
  { href: "/plan", label: "Plan", Icon: IconCalendar },
  { href: "/recipes", label: "Recipes", Icon: IconBook },
  { href: "/list", label: "List", Icon: IconCart },
  { href: "/settings", label: "Settings", Icon: IconGear },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/90 backdrop-blur-xl safe-bottom">
      <div className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, Icon }) => {
          const on = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium ${on ? "text-herb" : "text-muted"}`}
            >
              <Icon size={24} strokeWidth={on ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Page({ children, tabbar = true }: { children: ReactNode; tabbar?: boolean }) {
  return (
    <>
      <main className={`mx-auto max-w-xl px-4 safe-top ${tabbar ? "pb-tabbar" : "pb-10"}`}>{children}</main>
      {tabbar && <TabBar />}
    </>
  );
}

export function Header({ title, subtitle, right, left }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; left?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pt-2 pb-4">
      <div className="min-w-0">
        {left}
        <h1 className="font-display text-[2rem] leading-tight font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}

/* ---------------------------------- sheet --------------------------------- */

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        className={`animate-sheet relative flex w-full max-w-xl flex-col rounded-t-3xl bg-paper shadow-2xl safe-bottom ${tall ? "h-[92dvh]" : "max-h-[88dvh]"}`}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between px-5 pt-2 pb-2">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-line/50" aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- bits ----------------------------------- */

export function Stepper({ value, onChange, min = 1, max = 30, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-card">
      <button className="p-2 text-muted disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Less">
        <IconMinus size={16} />
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">
        {value}
        {label ? <span className="ml-1 font-normal text-muted">{label}</span> : null}
      </span>
      <button className="p-2 text-muted disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="More">
        <IconPlus size={16} />
      </button>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-muted">
      <Spinner />
    </div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-2 text-4xl">{emoji}</div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="my-3 rounded-xl bg-tomato-soft px-3 py-2 text-sm text-tomato">{error}</p>;
}

export function RecipeThumb({ src, title, className = "" }: { src: string | null | undefined; title: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    const hue = [...title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return (
      <div
        className={`flex items-center justify-center font-display text-lg font-semibold text-white/90 ${className}`}
        style={{ background: `linear-gradient(135deg, hsl(${hue} 35% 45%), hsl(${(hue + 40) % 360} 40% 35%))` }}
      >
        {title.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`object-cover ${className}`} onError={() => setBroken(true)} loading="lazy" referrerPolicy="no-referrer" />;
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4">
      <div className="animate-fade rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-lg">{message}</div>
    </div>
  );
}
