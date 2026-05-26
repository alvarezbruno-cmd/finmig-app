"use client";

import { useEffect, useState } from "react";
import { history } from "@/lib/storage";
import type { HistoryEntry } from "@/lib/types";
import { PostCard } from "./PostCard";

export function History() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  function refresh() {
    setItems(history.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  function remove(id: string) {
    if (!confirm("Remover este registro?")) return;
    history.remove(id);
    refresh();
  }

  function clearAll() {
    if (!confirm("Apagar todo o histórico?")) return;
    history.clear();
    refresh();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Histórico</h1>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">
            Posts gerados anteriormente — salvos no seu navegador.
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-danger)]"
          >
            Limpar tudo
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-dim)]">
          Nenhuma geração registrada ainda.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => {
            const open = openId === e.id;
            return (
              <li
                key={e.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <button
                  onClick={() => setOpenId(open ? null : e.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.topic}</div>
                    <div className="text-xs text-[var(--color-text-dim)]">
                      {new Date(e.createdAt).toLocaleString("pt-BR")} ·{" "}
                      {e.variations.length} variações
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      onClick={(ev) => {
                        ev.stopPropagation();
                        remove(e.id);
                      }}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      Remover
                    </span>
                    <span className="text-[var(--color-text-dim)]">{open ? "▾" : "▸"}</span>
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-[var(--color-border)] p-4">
                    {e.variations.map((v, i) => (
                      <PostCard key={i} variation={v} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
