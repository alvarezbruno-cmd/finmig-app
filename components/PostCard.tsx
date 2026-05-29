"use client";

import { useMemo, useState } from "react";
import { scorePost, validatePost } from "@/lib/validators";
import type { Variation } from "@/lib/types";

interface Props {
  variation: Variation;
  onChange?: (next: Variation) => void;
  onSchedule?: (post: string) => void;
}

export function PostCard({ variation, onChange, onSchedule }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(variation.post);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [copied, setCopied] = useState(false);

  const post = editing ? draft : variation.post;
  const issues = useMemo(() => validatePost(post), [post]);
  const score = useMemo(() => scorePost(post), [post]);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;

  async function copy() {
    await navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyAndOpen(url: string) {
    await navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function saveEdit() {
    onChange?.({ ...variation, post: draft });
    setEditing(false);
  }

  function captureSelection(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    if (ta.selectionStart !== ta.selectionEnd) {
      setSelection({ start: ta.selectionStart, end: ta.selectionEnd });
    } else {
      setSelection(null);
    }
  }

  async function rewriteSnippet() {
    if (!selection || !instruction.trim()) return;
    const snippet = draft.slice(selection.start, selection.end);
    setRewriting(true);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullPost: draft, snippet, instruction }),
      });
      const raw = await res.text();
      let data: { rewritten?: string; error?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Resposta inesperada do servidor. Tente de novo em 1 minuto.");
      }
      if (!res.ok || !data.rewritten) throw new Error(data.error ?? "Erro ao reescrever");
      const next =
        draft.slice(0, selection.start) + data.rewritten + draft.slice(selection.end);
      setDraft(next);
      setSelection(null);
      setInstruction("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao reescrever");
    } finally {
      setRewriting(false);
    }
  }

  const scoreColor =
    score >= 85
      ? "text-[var(--color-ok)]"
      : score >= 60
        ? "text-[var(--color-warn)]"
        : "text-[var(--color-danger)]";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
            Ângulo
          </div>
          <div className="mt-0.5 font-medium">{variation.angle}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={scoreColor}>{score}/100</span>
          <span className="text-[var(--color-text-dim)]">
            {post.length} chars
          </span>
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onSelect={captureSelection}
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
            className="min-h-[280px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
          />
          {selection && (
            <div className="mt-2 rounded-md border border-[var(--color-accent)] bg-[var(--color-surface-2)] p-3">
              <div className="mb-2 text-xs text-[var(--color-text-dim)]">
                Reescrever trecho selecionado ({selection.end - selection.start} chars):
              </div>
              <div className="flex gap-2">
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex: deixar mais direto, adicionar número, virar pergunta..."
                  className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  onClick={rewriteSnippet}
                  disabled={rewriting || !instruction.trim()}
                  className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {rewriting ? "..." : "Reescrever"}
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveEdit}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white"
            >
              Salvar
            </button>
            <button
              onClick={() => {
                setDraft(variation.post);
                setEditing(false);
                setSelection(null);
              }}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-dim)]"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
          {post}
        </pre>
      )}

      {(errorCount > 0 || warnCount > 0) && (
        <div className="mt-4 space-y-1.5">
          {issues.map((issue, i) => (
            <div
              key={i}
              className={
                "rounded-md border px-3 py-1.5 text-xs " +
                (issue.severity === "error"
                  ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                  : "border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 text-[var(--color-warn)]")
              }
            >
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={copy}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
          >
            {copied ? "Copiado ✓" : "Copiar"}
          </button>
          <button
            onClick={() =>
              copyAndOpen("https://www.linkedin.com/feed/?shareActive=true")
            }
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            title="Copia o post e abre o compositor do LinkedIn — cole com Ctrl/Cmd+V"
          >
            Copiar + abrir LinkedIn
          </button>
          {onSchedule && (
            <button
              onClick={() => onSchedule(post)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
              title="Adiciona à Agenda para você definir data e hora"
            >
              Agendar
            </button>
          )}
          <button
            onClick={() => {
              setDraft(variation.post);
              setEditing(true);
            }}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
          >
            Editar / reescrever trecho
          </button>
        </div>
      )}
    </div>
  );
}
