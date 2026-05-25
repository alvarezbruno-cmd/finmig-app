"use client";

import { useEffect, useState } from "react";
import { PostCard } from "./PostCard";
import { history, references } from "@/lib/storage";
import type { ReferencePost, Variation } from "@/lib/types";

export function Generator() {
  const [topic, setTopic] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRefs(references.list());
  }, []);

  async function generate() {
    if (!topic.trim()) {
      setError("Informe um tópico.");
      return;
    }
    setError(null);
    setLoading(true);
    setVariations(null);
    try {
      const allRefs = references.list();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          sourceContent,
          references: allRefs.map((r) => r.content),
        }),
      });

      const raw = await res.text();
      let data: { variations?: Variation[]; error?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          "O servidor respondeu em formato inesperado. O deploy pode estar atualizando — aguarde 1 minuto e tente de novo.",
        );
      }

      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar");
      if (!data.variations) throw new Error("Resposta sem variações.");

      setVariations(data.variations);
      history.add({
        topic,
        sourceContent,
        referenceIds: allRefs.map((r) => r.id),
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
            Matéria-prima{" "}
            <span className="text-xs">
              (notas, dados, trechos, histórias — a IA sintetiza num único texto fluido)
            </span>
          </div>
          <textarea
            value={sourceContent}
            onChange={(e) => setSourceContent(e.target.value)}
            placeholder="Cole bullets, dados, histórias suas, trechos de leituras, exemplos...&#10;&#10;A IA escreve em primeira pessoa, sintetizando tudo num único argumento — sem enumerar fontes, mas atribuindo de forma leve quando precisar."
            className="min-h-[180px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-dim)]">
          {refs.length === 0 ? (
            <>
              Nenhuma referência de estilo cadastrada. Adicione posts que você admira em{" "}
              <a href="/library" className="text-[var(--color-accent)] underline">
                Referências
              </a>{" "}
              — a IA usa todas para reproduzir sua voz.
            </>
          ) : (
            <>
              <span className="text-[var(--color-ok)]">{refs.length}</span> referência
              {refs.length === 1 ? "" : "s"} de estilo serão usadas em toda geração.{" "}
              <a href="/library" className="text-[var(--color-accent)] underline">
                Gerenciar
              </a>
            </>
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
