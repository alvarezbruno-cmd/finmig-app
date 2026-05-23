"use client";

import { useEffect, useState } from "react";
import { PostCard } from "./PostCard";
import { history, references } from "@/lib/storage";
import type { ReferencePost, Variation } from "@/lib/types";

export function Generator() {
  const [topic, setTopic] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefs(references.list());
  }, []);

  function toggleRef(id: string) {
    setSelectedRefIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  }

  function selectAllRefs() {
    setSelectedRefIds(refs.map((r) => r.id));
  }
  function clearRefs() {
    setSelectedRefIds([]);
  }

  async function generate() {
    if (!topic.trim()) {
      setError("Informe um tópico.");
      return;
    }
    setError(null);
    setLoading(true);
    setVariations(null);
    try {
      const selectedContents = references
        .getMany(selectedRefIds)
        .map((r) => r.content);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          sourceContent,
          references: selectedContents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar");
      setVariations(data.variations);
      history.add({
        topic,
        sourceContent,
        referenceIds: selectedRefIds,
        variations: data.variations,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function updateVariation(idx: number, next: Variation) {
    setVariations((curr) => {
      if (!curr) return curr;
      const copy = [...curr];
      copy[idx] = next;
      return copy;
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">Tópico do post</div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: o erro mais comum que vejo em fundadores B2B no primeiro pitch"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">
            Matéria-prima de conteúdo{" "}
            <span className="text-xs">
              (notas, transcrições, dados, exemplos — a IA usa como base)
            </span>
          </div>
          <textarea
            value={sourceContent}
            onChange={(e) => setSourceContent(e.target.value)}
            placeholder="Cole aqui notas, bullets, transcrição de áudio, dados...&#10;&#10;Quanto mais específico, melhor o post."
            className="min-h-[180px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-dim)]">
              Posts de referência (estilo a emular) — {selectedRefIds.length} selecionados
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={selectAllRefs}
                className="text-[var(--color-accent)] hover:underline"
              >
                Selecionar todos
              </button>
              <span className="text-[var(--color-border)]">·</span>
              <button onClick={clearRefs} className="text-[var(--color-text-dim)] hover:underline">
                Limpar
              </button>
            </div>
          </div>
          {refs.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-dim)]">
              Nenhuma referência ainda. Adicione posts que você gosta em{" "}
              <a href="/library" className="text-[var(--color-accent)] underline">
                Referências
              </a>{" "}
              para emular o estilo.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {refs.map((r) => {
                const selected = selectedRefIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRef(r.id)}
                    className={
                      "rounded-md border p-3 text-left text-xs transition " +
                      (selected
                        ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-dim)]")
                    }
                  >
                    {r.note && (
                      <div className="mb-1 font-medium text-[var(--color-text)]">
                        {r.note}
                      </div>
                    )}
                    <div className="line-clamp-3 text-[var(--color-text-dim)]">
                      {r.content}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="w-full rounded-md bg-[var(--color-accent)] py-3 font-medium text-black disabled:opacity-60"
        >
          {loading ? "Gerando 3 variações…" : "Gerar 3 variações"}
        </button>

        {error && (
          <div className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
      </section>

      {variations && (
        <section className="grid gap-4">
          {variations.map((v, i) => (
            <PostCard
              key={i}
              variation={v}
              onChange={(next) => updateVariation(i, next)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
