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
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
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

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) alert(error.message);
    else setSent(true);
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
        <div className="text-lg font-semibold">Entrar no Finmig</div>
        {sent ? (
          <p className="mt-3 text-sm text-[var(--color-text-dim)]">
            Enviei um link de acesso para <strong>{email}</strong>. Abra seu email e clique no
            link para entrar. Pode fechar esta aba.
          </p>
        ) : (
          <form onSubmit={sendLink} className="mt-4 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full rounded-md bg-[var(--color-accent)] py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar link de acesso"}
            </button>
            <p className="text-xs text-[var(--color-text-dim)]">
              Você recebe um link mágico por email. Sem senha.
            </p>
          </form>
        )}
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
