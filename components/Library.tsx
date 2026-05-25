"use client";

import { useEffect, useState } from "react";
import { references } from "@/lib/storage";
import type { ReferencePost } from "@/lib/types";

export function Library() {
  const [items, setItems] = useState<ReferencePost[]>([]);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");

  function refresh() {
    setItems(references.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  function add() {
    if (!content.trim()) return;
    references.add(content, note);
    setContent("");
    setNote("");
    refresh();
  }

  function remove(id: string) {
    if (!confirm("Remover esta referência?")) return;
    references.remove(id);
    refresh();
  }

  function exportRefs() {
    const blob = new Blob([references.exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finmig-referencias-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importRefs(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const added = references.importMany(String(reader.result));
        refresh();
        alert(`${added} referência(s) importada(s).`);
      } catch {
        alert("Não consegui ler o arquivo. Confira se é um export válido do Finmig.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Biblioteca de referências</h1>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">
            Cole aqui posts do LinkedIn que você admira. A IA estuda o estilo (tom, ritmo,
            estrutura) e emula ao gerar — sem copiar o conteúdo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportRefs}
            disabled={items.length === 0}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            Exportar backup
          </button>
          <label className="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]">
            Importar
            <input
              type="file"
              accept="application/json"
              onChange={importRefs}
              className="hidden"
            />
          </label>
        </div>
      </header>

      <div className="rounded-md border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-3 py-2 text-xs text-[var(--color-warn)]">
        Suas referências ficam salvas neste navegador (localStorage). Para não perdê-las,
        use sempre a mesma URL do app e faça um <strong>Exportar backup</strong> de vez em
        quando. Em breve vamos migrar para armazenamento na nuvem.
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">
            Conteúdo do post de referência
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole o post inteiro aqui..."
            className="min-h-[160px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="mt-3 block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">
            Nota (opcional) — o que você gosta neste post
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: hook contraintuitivo, ritmo de frases curtas..."
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <button
          onClick={add}
          disabled={!content.trim()}
          className="mt-3 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Adicionar à biblioteca
        </button>
      </section>

      <section>
        <div className="mb-2 text-sm text-[var(--color-text-dim)]">
          {items.length} referência{items.length === 1 ? "" : "s"}
        </div>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-dim)]">
            Nada por aqui ainda. Adicione seus posts favoritos acima.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {r.note && <div className="mb-1 text-sm font-medium">{r.note}</div>}
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--color-text-dim)]">
                      {r.content}
                    </pre>
                  </div>
                  <button
                    onClick={() => remove(r.id)}
                    className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
