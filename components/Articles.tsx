"use client";

import { useEffect, useState } from "react";
import {
  articleReferences,
  articles,
  objectives,
  sources,
  territories,
} from "@/lib/storage";
import type {
  Article,
  ArticleReference,
  SourceText,
  Territory,
} from "@/lib/types";

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

export function Articles() {
  const [topic, setTopic] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [refs, setRefs] = useState<ArticleReference[]>([]);
  const [texts, setTexts] = useState<SourceText[]>([]);
  const [terrs, setTerrs] = useState<Territory[]>([]);
  const [territoryId, setTerritoryId] = useState("");
  const [targetChars, setTargetChars] = useState("6000");
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Article | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string }>({ title: "", body: "" });
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<Article[]>([]);

  // References management
  const [newRef, setNewRef] = useState("");
  const [newRefNote, setNewRefNote] = useState("");
  const [showRefs, setShowRefs] = useState(false);

  function refresh() {
    setRefs(articleReferences.list());
    setTexts(sources.list());
    setTerrs(territories.list());
    setHistory(articles.list());
  }
  useEffect(() => {
    refresh();
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
      setError("Selecione ao menos uma ideia ou escreva notas adicionais.");
      return;
    }
    setError(null);
    setLoading(true);
    setCurrent(null);
    try {
      const ideas = sources.getSelectedIdeas(selectedIdeaIds);
      const terr = terrs.find((t) => t.id === territoryId);
      const res = await fetch("/api/article/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          ideas,
          extraNotes,
          references: articleReferences.list().map((r) => r.content),
          territory: terr
            ? `${terr.name}${terr.description ? ` — ${terr.description}` : ""}`
            : undefined,
          objectives: objectivesString() || undefined,
          targetChars: Number(targetChars) || undefined,
        }),
      });
      const raw = await res.text();
      let data: { title?: string; body?: string; error?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Resposta inesperada do servidor. Tente em 1 minuto.");
      }
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar");
      if (!data.body) throw new Error("Artigo vazio.");
      const saved = articles.add({
        topic,
        title: data.title ?? "",
        body: data.body,
      });
      setCurrent(saved);
      setDraft({ title: saved.title, body: saved.body });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function saveEdit() {
    if (!current) return;
    articles.update(current.id, { title: draft.title, body: draft.body });
    setCurrent({ ...current, title: draft.title, body: draft.body });
    setEditing(false);
    refresh();
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  function loadFromHistory(a: Article) {
    setCurrent(a);
    setDraft({ title: a.title, body: a.body });
    setEditing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeArticle(id: string) {
    if (!confirm("Remover este artigo?")) return;
    articles.remove(id);
    if (current?.id === id) setCurrent(null);
    refresh();
  }

  function addReference() {
    if (!newRef.trim()) return;
    articleReferences.add(newRef, newRefNote);
    setNewRef("");
    setNewRefNote("");
    refresh();
  }
  function removeReference(id: string) {
    if (!confirm("Remover esta referência?")) return;
    articleReferences.remove(id);
    refresh();
  }

  const totalIdeas = texts.reduce((n, t) => n + t.ideas.length, 0);
  const field =
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Artigos para imprensa</h1>
        <p className="mt-1 text-sm text-[var(--color-text-dim)]">
          Tópico + ideias + referências de artigo → artigo de opinião pronto para Folha,
          Estadão, Valor. Mesma exigência anti-IA dos posts, com a densidade de um texto
          autoral de jornal.
        </p>
      </header>

      <section className="space-y-4">
        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">Tópico do artigo</div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: o impacto do uso indiscriminado de IA no desenvolvimento do julgamento em adolescentes"
            className={field}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-sm text-[var(--color-text-dim)]">
            Tamanho-alvo (caracteres){" "}
            <span className="text-xs">
              (Folha de opinião: ~4.000 · padrão dominical: ~6.000 · longo: ~8.000)
            </span>
          </div>
          <input
            type="number"
            min={1000}
            max={12000}
            step={500}
            value={targetChars}
            onChange={(e) => setTargetChars(e.target.value)}
            className={`${field} sm:max-w-xs`}
          />
        </label>

        {terrs.length > 0 && (
          <label className="block">
            <div className="mb-1 text-sm text-[var(--color-text-dim)]">
              Território (opcional)
            </div>
            <select
              value={territoryId}
              onChange={(e) => setTerritoryId(e.target.value)}
              className={field}
            >
              <option value="">Sem território específico</option>
              {terrs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div>
          <div className="mb-2 text-sm text-[var(--color-text-dim)]">
            Ideias centrais — {selectedIdeaIds.length} selecionada
            {selectedIdeaIds.length === 1 ? "" : "s"}
          </div>
          {totalIdeas === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-dim)]">
              Sem ideias cadastradas. Adicione textos e ideias em{" "}
              <a href="/sources" className="text-[var(--color-accent)] underline">
                Textos
              </a>
              .
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
            <span className="text-xs">(opcional — ângulo, tese, dados extras)</span>
          </div>
          <textarea
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="Ex: minha tese é que a IA na escola sem mediação atrofia o julgamento. Quero conectar com a discussão sobre formação humanística."
            className={`${field} min-h-[90px] leading-relaxed`}
          />
        </label>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-dim)]">
          {refs.length === 0 ? (
            <>
              Nenhuma referência de artigo cadastrada. Adicione textos abaixo para a IA
              reproduzir o estilo certo.
            </>
          ) : (
            <>
              <span className="text-[var(--color-ok)]">{refs.length}</span> referência
              {refs.length === 1 ? "" : "s"} de artigo serão usadas.
            </>
          )}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="w-full rounded-md bg-[var(--color-accent)] py-3 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Escrevendo artigo…" : "Gerar artigo"}
        </button>

        {error && (
          <div className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
      </section>

      {current && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          {editing ? (
            <>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={`${field} mb-3 text-lg font-semibold`}
              />
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                className={`${field} min-h-[500px] leading-relaxed`}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={saveEdit}
                  className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white"
                >
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setDraft({ title: current.title, body: current.body });
                    setEditing(false);
                  }}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-dim)]"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
                {current.body.length} chars · ~
                {Math.round(current.body.split(/\s+/).length)} palavras
              </div>
              <h2 className="mb-3 text-xl font-semibold">{current.title}</h2>
              <pre className="whitespace-pre-wrap break-words font-serif text-[15px] leading-[1.7]">
                {current.body}
              </pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => copy(`${current.title}\n\n${current.body}`)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
                >
                  Copiar tudo
                </button>
                <button
                  onClick={() => copy(current.body)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
                >
                  Copiar só o corpo
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
                >
                  Editar
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <button
          onClick={() => setShowRefs((s) => !s)}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          <span>Referências de estilo para artigos ({refs.length})</span>
          <span className="text-[var(--color-text-dim)]">{showRefs ? "▾" : "▸"}</span>
        </button>
        {showRefs && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-[var(--color-text-dim)]">
              Cole aqui artigos cuja linguagem você admira (seus ou de outros autores). A
              IA vai estudar a voz, não copiar o conteúdo.
            </p>
            <textarea
              value={newRef}
              onChange={(e) => setNewRef(e.target.value)}
              placeholder="Cole o artigo inteiro aqui…"
              className={`${field} min-h-[160px] leading-relaxed`}
            />
            <input
              value={newRefNote}
              onChange={(e) => setNewRefNote(e.target.value)}
              placeholder="Nota (ex: autor, veículo, o que você gosta)"
              className={field}
            />
            <button
              onClick={addReference}
              disabled={!newRef.trim()}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Adicionar referência
            </button>

            {refs.length > 0 && (
              <ul className="mt-3 space-y-2">
                {refs.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      {r.note && (
                        <div className="mb-1 text-xs font-medium">{r.note}</div>
                      )}
                      <pre className="line-clamp-3 whitespace-pre-wrap break-words font-sans text-xs text-[var(--color-text-dim)]">
                        {r.content}
                      </pre>
                    </div>
                    <button
                      onClick={() => removeReference(r.id)}
                      className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <div className="mb-2 text-sm font-medium">
            Histórico de artigos ({history.length})
          </div>
          <ul className="space-y-2">
            {history.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <button
                  onClick={() => loadFromHistory(a)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate font-medium">{a.title || a.topic}</div>
                  <div className="text-xs text-[var(--color-text-dim)]">
                    {new Date(a.createdAt).toLocaleString("pt-BR")} · {a.body.length} chars
                  </div>
                </button>
                <button
                  onClick={() => removeArticle(a.id)}
                  className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
