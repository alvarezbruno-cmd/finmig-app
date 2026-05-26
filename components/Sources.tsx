"use client";

import { useEffect, useState } from "react";
import { sources } from "@/lib/storage";
import type { SourceText } from "@/lib/types";

const empty = { title: "", author: "", publication: "", date: "", link: "" };

export function Sources() {
  const [items, setItems] = useState<SourceText[]>([]);
  const [form, setForm] = useState(empty);
  const [ideaDrafts, setIdeaDrafts] = useState<Record<string, string>>({});

  function refresh() {
    setItems(sources.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  function addSource() {
    if (!form.title.trim() && !form.author.trim()) return;
    sources.add(form);
    setForm(empty);
    refresh();
  }

  function removeSource(id: string) {
    if (!confirm("Remover este texto e todas as suas ideias?")) return;
    sources.remove(id);
    refresh();
  }

  function addIdea(sourceId: string) {
    const text = ideaDrafts[sourceId] ?? "";
    if (!text.trim()) return;
    sources.addIdea(sourceId, text);
    setIdeaDrafts((d) => ({ ...d, [sourceId]: "" }));
    refresh();
  }

  function removeIdea(sourceId: string, ideaId: string) {
    sources.removeIdea(sourceId, ideaId);
    refresh();
  }

  function exportAll() {
    const blob = new Blob([sources.exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finmig-textos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const added = sources.importMany(String(reader.result));
        refresh();
        alert(`${added} texto(s) importado(s).`);
      } catch {
        alert("Não consegui ler o arquivo. Confira se é um export válido do Finmig.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const field =
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Textos &amp; ideias</h1>
          <p className="mt-1 text-sm text-[var(--color-text-dim)]">
            Sua base de conhecimento. Cadastre textos com autor e fonte, e adicione as
            ideias centrais de cada um. Depois, na aba Gerar, você seleciona ideias (de um
            ou vários textos) para costurar num post.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAll}
            disabled={items.length === 0}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            Exportar backup
          </button>
          <label className="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]">
            Importar
            <input type="file" accept="application/json" onChange={importAll} className="hidden" />
          </label>
        </div>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 text-sm font-medium">Novo texto</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Título do texto"
            className={field}
          />
          <input
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
            placeholder="Autor"
            className={field}
          />
          <input
            value={form.publication}
            onChange={(e) => setForm({ ...form, publication: e.target.value })}
            placeholder="Fonte (publicação, veículo)"
            className={field}
          />
          <input
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            placeholder="Data (ex: 2026, mar/2026)"
            className={field}
          />
          <input
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            placeholder="Link"
            className={`${field} sm:col-span-2`}
          />
        </div>
        <button
          onClick={addSource}
          disabled={!form.title.trim() && !form.author.trim()}
          className="mt-3 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Adicionar texto
        </button>
      </section>

      <section className="space-y-4">
        <div className="text-sm text-[var(--color-text-dim)]">
          {items.length} texto{items.length === 1 ? "" : "s"}
        </div>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-dim)]">
            Nenhum texto ainda. Cadastre o primeiro acima.
          </div>
        ) : (
          items.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{s.title || "(sem título)"}</div>
                  <div className="text-xs text-[var(--color-text-dim)]">
                    {[s.author, s.publication, s.date].filter(Boolean).join(" · ")}
                  </div>
                  {s.link && (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--color-accent)] underline"
                    >
                      {s.link}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => removeSource(s.id)}
                  className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  Remover
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
                  Ideias centrais ({s.ideas.length})
                </div>
                {s.ideas.map((idea) => (
                  <div
                    key={idea.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5"
                  >
                    <div className="text-sm leading-relaxed">{idea.text}</div>
                    <button
                      onClick={() => removeIdea(s.id, idea.id)}
                      className="shrink-0 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-danger)]"
                      title="Remover ideia"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <textarea
                    value={ideaDrafts[s.id] ?? ""}
                    onChange={(e) =>
                      setIdeaDrafts((d) => ({ ...d, [s.id]: e.target.value }))
                    }
                    placeholder="Nova ideia central (trecho ou key message)"
                    rows={2}
                    className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    onClick={() => addIdea(s.id)}
                    disabled={!(ideaDrafts[s.id] ?? "").trim()}
                    className="shrink-0 self-stretch rounded-md bg-[var(--color-accent)] px-4 text-lg font-bold text-black disabled:opacity-40"
                    title="Adicionar ideia"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
