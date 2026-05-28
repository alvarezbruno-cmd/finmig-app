"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isConfigured, supabase } from "@/lib/supabase";
import { hasLegacyData, hydrate, migrateFromLocalStorage } from "@/lib/storage";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHydrated(false);
      return;
    }
    hydrate()
      .then(() => {
        setLegacy(hasLegacyData());
        setHydrated(true);
      })
      .catch((err) => {
        console.error(err);
        setHydrated(true);
      });
  }, [session]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setAuthMsg(null);
    const creds = { email: email.trim(), password };
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp(creds)
        : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) {
      setAuthMsg(error.message);
      return;
    }
    if (mode === "signup" && !data.session) {
      setAuthMsg(
        "Conta criada, mas o Supabase está exigindo confirmação de email. Desative 'Confirm email' no Supabase (Authentication → Providers → Email) ou confirme pelo email enviado.",
      );
    }
  }

  async function doMigrate() {
    setMigrating(true);
    try {
      await migrateFromLocalStorage();
      await hydrate();
      setLegacy(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha na migração.");
    } finally {
      setMigrating(false);
    }
  }

  const centerBox =
    "mx-auto mt-24 max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center";

  if (!isConfigured) {
    return (
      <div className={centerBox}>
        <div className="text-lg font-semibold">Configuração pendente</div>
        <p className="mt-2 text-sm text-[var(--color-text-dim)]">
          As variáveis do Supabase ainda não foram definidas na Vercel.
        </p>
      </div>
    );
  }

  if (!authReady) {
    return <div className="mt-24 text-center text-sm text-[var(--color-text-dim)]">Carregando…</div>;
  }

  if (!session) {
    return (
      <div className={centerBox}>
        <div className="text-lg font-semibold">
          {mode === "signup" ? "Criar conta no Finmig" : "Entrar no Finmig"}
        </div>
        <form onSubmit={submitAuth} className="mt-4 space-y-3 text-left">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha (mín. 6 caracteres)"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={busy || !email.trim() || password.length < 6}
            className="w-full rounded-md bg-[var(--color-accent)] py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {busy ? "Aguarde…" : mode === "signup" ? "Criar conta" : "Entrar"}
          </button>
          {authMsg && (
            <p className="text-xs text-[var(--color-danger)]">{authMsg}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setAuthMsg(null);
            }}
            className="w-full text-center text-xs text-[var(--color-accent)] hover:underline"
          >
            {mode === "signup"
              ? "Já tenho conta — entrar"
              : "Não tenho conta — criar uma"}
          </button>
        </form>
      </div>
    );
  }

  if (!hydrated) {
    return <div className="mt-24 text-center text-sm text-[var(--color-text-dim)]">Carregando seus dados…</div>;
  }

  return (
    <>
      {legacy && (
        <div className="border-b border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-4 py-2">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-warn)]">
            <span>
              Encontrei dados salvos neste navegador. Quer migrá-los para a nuvem agora?
            </span>
            <button
              onClick={doMigrate}
              disabled={migrating}
              className="rounded-md border border-[var(--color-warn)]/60 px-3 py-1 text-xs font-medium disabled:opacity-50"
            >
              {migrating ? "Migrando…" : "Migrar para a nuvem"}
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
