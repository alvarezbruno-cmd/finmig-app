"use client";

import { useEffect, useMemo, useState } from "react";
import { schedule, territories } from "@/lib/storage";
import type { ScheduledPost, Territory } from "@/lib/types";

function toLocalInput(ms: number): string {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d.getTime());
}

export function Agenda() {
  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [terrs, setTerrs] = useState<Territory[]>([]);
  const [text, setText] = useState("");
  const [when, setWhen] = useState(defaultSlot());
  const [territory, setTerritory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  function refresh() {
    setItems(schedule.list());
    setTerrs(territories.list());
  }
  useEffect(() => {
    refresh();
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  function resetForm() {
    setText("");
    setWhen(defaultSlot());
    setTerritory("");
    setEditingId(null);
  }

  function save() {
    if (!text.trim() || !when) return;
    const scheduledAt = new Date(when).getTime();
    if (editingId) {
      schedule.update(editingId, { text: text.trim(), scheduledAt, territory: territory || undefined });
    } else {
      schedule.add({ text: text.trim(), scheduledAt, territory: territory || undefined });
    }
    resetForm();
    refresh();
  }

  function startEdit(p: ScheduledPost) {
    setEditingId(p.id);
    setText(p.text);
    setWhen(toLocalInput(p.scheduledAt));
    setTerritory(p.territory ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(id: string) {
    if (!confirm("Remover este post da agenda?")) return;
    schedule.remove(id);
    refresh();
  }

  async function copyAndOpen(p: ScheduledPost) {
    await navigator.clipboard.writeText(p.text);
    window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank", "noopener,noreferrer");
  }

  const { due, upcoming, posted } = useMemo(() => {
    const pending = items.filter((p) => p.status === "pending");
    return {
      due: pending.filter((p) => p.scheduledAt <= now),
      upcoming: pending.filter((p) => p.scheduledAt > now),
      posted: items.filter((p) => p.status === "posted"),
    };
  }, [items, now]);

  const field =
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

  function Card({ p, highlight }: { p: ScheduledPost; highlight?: boolean }) {
    return (
      <li
        className={
          "rounded-xl border p-4 " +
          (highlight
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
            : "border-[var(--color-border)] bg-[var(--color-surface)]")
        }
      >
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-dim)]">
          <span className={highlight ? "font-medium text-[var(--color-accent)]" : ""}>
            {new Date(p.scheduledAt).toLocaleString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {p.territory && (
            <span className="rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[var(--color-accent)]">
              {p.territory}
            </span>
          )}
          <span>{p.text.length} chars</span>
        </div>
        <pre className="line-clamp-4 whitespace-pre-wrap break-words font-sans text-sm">
          {p.text}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.status === "pending" && (
            <>
              <button
                onClick={() => copyAndOpen(p)}
                className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white"
              >
                Copiar + abrir LinkedIn
              </button>
              <button
                onClick={() => {
                  schedule.update(p.id, { status: "posted" });
                  refresh();
                }}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
              >
                Marcar como publicado
              </button>
              <button
                onClick={() => startEdit(p)}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
              >
                Editar
              </button>
            </>
          )}
          {p.status === "posted" && (
            <button
              onClick={() => {
                schedule.update(p.id, { status: "pending" });
                refresh();
              }}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-dim)]"
            >
              Reverter para pendente
            </button>
          )}
          <button
            onClick={() => remove(p.id)}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
          >
            Remover
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="mt-1 text-sm text-[var(--color-text-dim)]">
          Programe seus posts com data e hora. O app organiza a fila e destaca os que estão
          na hora de publicar — é só copiar e colar no LinkedIn.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 text-sm font-medium">
          {editingId ? "Editar agendamento" : "Agendar post"}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole ou escreva o post…"
          className={`${field} min-h-[120px] leading-relaxed`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className={`${field} sm:max-w-xs`}
          />
          {terrs.length > 0 && (
            <select
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              className={`${field} sm:max-w-xs`}
            >
              <option value="">Território (opcional)</option>
              {terrs.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={save}
            disabled={!text.trim() || !when}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {editingId ? "Salvar alterações" : "Agendar"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-dim)]"
            >
              Cancelar
            </button>
          )}
        </div>
      </section>

      {due.length > 0 && (
        <section className="space-y-3">
          <div className="text-sm font-medium text-[var(--color-accent)]">
            Na hora de publicar ({due.length})
          </div>
          <ul className="space-y-3">
            {due.map((p) => (
              <Card key={p.id} p={p} highlight />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="text-sm font-medium">Próximos ({upcoming.length})</div>
        {upcoming.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-dim)]">
            Nada agendado. Adicione posts acima — ou gere na aba Gerar e clique em Agendar.
          </div>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      {posted.length > 0 && (
        <section className="space-y-3">
          <div className="text-sm font-medium text-[var(--color-text-dim)]">
            Publicados ({posted.length})
          </div>
          <ul className="space-y-3 opacity-70">
            {posted.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
