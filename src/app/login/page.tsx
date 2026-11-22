"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";
import { Spinner } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Email or password is wrong." : error.message);
      setBusy(false);
      return;
    }
    // came from the Safari shortcut? continue the import after login
    const h = window.location.hash;
    window.location.href = h.startsWith("#page=") ? `/recipes/import${h}` : "/plan";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 safe-top">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="mb-6 h-20 w-20 rounded-[1.4rem] shadow-md" />
      <h1 className="font-display text-4xl font-semibold">{APP_NAME}</h1>
      <p className="mt-1 mb-8 text-muted">Recipes, week plan and the shopping list — for the two of us.</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-tomato">{error}</p>}
        <button className="btn btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner /> : "Sign in"}
        </button>
      </form>
      <p className="mt-8 text-xs text-muted">You stay signed in on this phone. Accounts are created in Supabase — there is no public sign-up.</p>
    </main>
  );
}
