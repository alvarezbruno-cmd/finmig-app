"use client";

import { useEffect, useState } from "react";
import { PostCard } from "./PostCard";
import { analytics, history, objectives, references, sources, territories } from "@/lib/storage";
import type { ReferencePost, SourceText, Territory, Variation } from "@/lib/types";

function objectivesString(): string {
  const o = objectives.get();
  return [
    o.audienceGoal && `Público-alvo: ${o.audienceGoal}`,
    o.regionGoal && `Geografia: ${o.regionGoal}`,
    o.notes && `Outros objetivos: ${o.notes}`,
  ]
    .filter(Boolean)
    .join(". ");
}

export function Generator() {
  const [topic, setTopic] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [refs, setRefs] = useState<ReferencePost[]>([]);
  const [texts, setTexts] = useState<SourceText[]>([]);
  const [terrs, setTerrs] = useState<Territory[]>([]);
  const [territoryId, setTerritoryId] = useState("");
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [learnedFrom, setLearnedFrom] = useState(0);

  useEffect(() => {
    setRefs(references.list());
    setTexts(sources.list());
    setTerrs(territories.list());
    setLearnedFrom(analytics.list().filter((p) => p.metrics.impressions > 0).length);
  }, []);

  function toggleIdea(id: string) {
    setSelectedIdeaIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  }

  async function generate() {
    if (!topic.trim()) {
      setError("Informe um tópico.");
      return;
    }
    if (selectedIdeaIds.length === 0 && !extraNotes.trim()) {
      setError("Selecione ao menos uma ideia central (ou escreva notas adicionais).");
      return;
    }
    setError(null);
    setLoading(true);
    setVariations(null);
    try {
      const ideas = sources.getSelectedIdeas(selectedIdeaIds);
      const terr = terrs.find((t) => t.id === territoryId);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          ideas,
          extraNotes,
          references: references.list().map((r) => r.content),
          performance: analytics.performanceProfile(),
          territory: terr
            ? `${terr.name}${terr.description ? ` — ${terr.description}` : ""}`
            : undefined,
          objectives: objectivesString() || undefined,
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
      history.add({ topic, variations: data.variations });
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

  const totalIdeas = texts.reduce((n, t) => n + t.ideas.length, 0);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">Tópico do post</div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: o impacto da IA no desenvolvimento do julgamento em adolescentes"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">
            Território{" "}
            <span className="text-xs">
              (mantém o post coeso com um dos seus temas centrais)
            </span>
          </div>
          {terrs.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-dim)]">
              Defina seus territórios temáticos em{" "}
              <a href="/analytics" className="text-[var(--color-accent)] underline">
                Analytics
              </a>{" "}
              para ancorar a geração.
            </div>
          ) : (
            <select
              value={territoryId}
              onChange={(e) => setTerritoryId(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Sem território específico</option>
              {terrs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-dim)]">
              Ideias centrais — {selectedIdeaIds.length} selecionada
              {selectedIdeaIds.length === 1 ? "" : "s"}
            </div>
            {selectedIdeaIds.length > 0 && (
              <button
                onClick={() => setSelectedIdeaIds([])}
                className="text-xs text-[var(--color-text-dim)] hover:underline"
              >
                Limpar seleção
              </button>
            )}
          </div>

          {totalIdeas === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-dim)]">
              Nenhuma ideia cadastrada. Vá em{" "}
              <a href="/sources" className="text-[var(--color-accent)] underline">
                Textos
              </a>{" "}
              e adicione textos com suas ideias centrais.
            </div>
          ) : (
            <div className="space-y-3">
              {texts
                .filter((t) => t.ideas.length > 0)
                .map((t) => (
                  <div
                    key={t.id}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="mb-2 text-xs text-[var(--color-text-dim)]">
                      <span className="font-medium text-[var(--color-text)]">
                        {t.title || "(sem título)"}
                      </span>
                      {t.author && ` · ${t.author}`}
                    </div>
                    <div className="space-y-1.5">
                      {t.ideas.map((idea) => {
                        const selected = selectedIdeaIds.includes(idea.id);
                        return (
                          <button
                            key={idea.id}
                            onClick={() => toggleIdea(idea.id)}
                            className={
                              "flex w-full items-start gap-2 rounded-md border p-2.5 text-left text-sm transition " +
                              (selected
                                ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
                                : "border-[var(--color-border)] hover:border-[var(--color-text-dim)]")
                            }
                          >
                            <span
                              className={
                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] " +
                                (selected
                                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                                  : "border-[var(--color-border)]")
                              }
                            >
                              {selected ? "✓" : ""}
                            </span>
                            <span className="leading-relaxed">{idea.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">
            Notas adicionais{" "}
            <span className="text-xs">(opcional — sua opinião, ângulo, contexto)</span>
          </div>
          <textarea
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="Ex: quero defender que retenção importa mais que aquisição, e contrariar o discurso de 'growth at all costs'."
            className="min-h-[90px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-dim)]">
          {refs.length === 0 ? (
            <>
              Nenhuma referência de estilo. Adicione posts que você admira em{" "}
              <a href="/library" className="text-[var(--color-accent)] underline">
                Referências
              </a>{" "}
              para a IA reproduzir sua voz.
            </>
          ) : (
            <>
              <span className="text-[var(--color-ok)]">{refs.length}</span> referência
              {refs.length === 1 ? "" : "s"} de estilo serão usadas para reproduzir sua voz.
            </>
          )}
        </div>

        {learnedFrom >= 2 && (
          <div className="rounded-md border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 px-3 py-2 text-sm text-[var(--color-ok)]">
            Aprendendo com {learnedFrom} posts publicados — a geração vai priorizar o que
            mais engajou.
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading}
          className="w-full rounded-md bg-[var(--color-accent)] py-3 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Costurando 3 variações…" : "Gerar 3 variações"}
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
