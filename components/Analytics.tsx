"use client";

import { useEffect, useMemo, useState } from "react";
import { analytics, engagementRate, history } from "@/lib/storage";
import type { HistoryEntry, PostFormat, PublishedPost } from "@/lib/types";

const FORMATS: PostFormat[] = ["texto", "link", "imagem", "carrossel"];
const formatLabel: Record<PostFormat, string> = {
  texto: "Texto puro",
  link: "Com link",
  imagem: "Com imagem",
  carrossel: "Carrossel",
};

const emptyMetrics = {
  impressions: "",
  reached: "",
  reactions: "",
  comments: "",
  shares: "",
  saves: "",
  profileViews: "",
  followers: "",
};

const metricFields: { key: keyof typeof emptyMetrics; label: string }[] = [
  { key: "impressions", label: "Impressões" },
  { key: "reached", label: "Usuários alcançados" },
  { key: "reactions", label: "Reações" },
  { key: "comments", label: "Comentários" },
  { key: "shares", label: "Compartilhamentos" },
  { key: "saves", label: "Salvamentos" },
  { key: "profileViews", label: "Visualizações de perfil" },
  { key: "followers", label: "Seguidores obtidos" },
];

export function Analytics() {
  const [items, setItems] = useState<PublishedPost[]>([]);
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  const [text, setText] = useState("");
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState<PostFormat>("texto");
  const [postedAt, setPostedAt] = useState("");
  const [metrics, setMetrics] = useState({ ...emptyMetrics });

  function refresh() {
    setItems(analytics.list());
    setHist(history.list());
  }
  useEffect(() => {
    refresh();
  }, []);

  function save() {
    if (!text.trim() || !metrics.impressions.trim()) return;
    analytics.add({
      text: text.trim(),
      theme: theme.trim(),
      format,
      postedAt: postedAt || new Date().toISOString().slice(0, 10),
      metrics: {
        impressions: Number(metrics.impressions) || 0,
        reached: Number(metrics.reached) || 0,
        reactions: Number(metrics.reactions) || 0,
        comments: Number(metrics.comments) || 0,
        shares: Number(metrics.shares) || 0,
        saves: Number(metrics.saves) || 0,
        profileViews: Number(metrics.profileViews) || 0,
        followers: Number(metrics.followers) || 0,
      },
    });
    setText("");
    setTheme("");
    setFormat("texto");
    setPostedAt("");
    setMetrics({ ...emptyMetrics });
    refresh();
  }

  function remove(id: string) {
    if (!confirm("Remover este registro?")) return;
    analytics.remove(id);
    refresh();
  }

  const stats = useMemo(() => {
    const valid = items.filter((p) => p.metrics.impressions > 0);
    if (valid.length === 0) return null;
    const avgEng = valid.reduce((s, p) => s + engagementRate(p), 0) / valid.length;

    const byFormat = new Map<string, { sum: number; n: number }>();
    const byTheme = new Map<string, { sum: number; n: number }>();
    for (const p of valid) {
      const f = byFormat.get(p.format) ?? { sum: 0, n: 0 };
      f.sum += engagementRate(p);
      f.n++;
      byFormat.set(p.format, f);
      const tkey = p.theme.trim() || "(sem tema)";
      const t = byTheme.get(tkey) ?? { sum: 0, n: 0 };
      t.sum += engagementRate(p);
      t.n++;
      byTheme.set(tkey, t);
    }
    const fmt = [...byFormat.entries()]
      .map(([k, v]) => ({ k, avg: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
    const thm = [...byTheme.entries()]
      .map(([k, v]) => ({ k, avg: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
    const topPosts = [...valid].sort((a, b) => engagementRate(b) - engagementRate(a));
    return { valid, avgEng, fmt, thm, topPosts };
  }, [items]);

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const field =
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--color-text-dim)]">
          Registre seus posts publicados com as métricas do LinkedIn. O painel mostra o que
          funciona — e a aba Gerar passa a priorizar esses padrões ao criar novos posts.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 text-sm font-medium">Registrar post publicado</div>

        {hist.length > 0 && (
          <label className="mb-3 block">
            <div className="mb-1 text-xs text-[var(--color-text-dim)]">
              Puxar texto do Histórico (opcional)
            </div>
            <select
              onChange={(e) => {
                const entry = hist.find((h) => h.id === e.target.value);
                if (entry) {
                  setText(entry.variations[0]?.post ?? "");
                  setTheme(entry.topic);
                }
              }}
              defaultValue=""
              className={field}
            >
              <option value="" disabled>
                Selecione uma geração anterior…
              </option>
              {hist.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.topic.slice(0, 60)} — {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </label>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole o texto do post publicado…"
          className={`${field} min-h-[120px] leading-relaxed`}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Tema (ex: educação, IA)"
            className={field}
          />
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as PostFormat)}
            className={field}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {formatLabel[f]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={postedAt}
            onChange={(e) => setPostedAt(e.target.value)}
            className={field}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metricFields.map((m) => (
            <label key={m.key} className="block">
              <div className="mb-1 text-xs text-[var(--color-text-dim)]">{m.label}</div>
              <input
                type="number"
                inputMode="numeric"
                value={metrics[m.key]}
                onChange={(e) => setMetrics({ ...metrics, [m.key]: e.target.value })}
                placeholder="0"
                className={field}
              />
            </label>
          ))}
        </div>

        <button
          onClick={save}
          disabled={!text.trim() || !metrics.impressions.trim()}
          className="mt-3 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Salvar métricas
        </button>
      </section>

      {stats && (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
              Engajamento médio
            </div>
            <div className="mt-1 text-2xl font-semibold text-[var(--color-accent)]">
              {pct(stats.avgEng)}
            </div>
            <div className="text-xs text-[var(--color-text-dim)]">
              {stats.valid.length} posts
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
              Melhor formato
            </div>
            <div className="mt-1 text-lg font-medium">
              {formatLabel[stats.fmt[0].k as PostFormat] ?? stats.fmt[0].k}
            </div>
            <div className="text-xs text-[var(--color-text-dim)]">
              {pct(stats.fmt[0].avg)} de engajamento
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
              Melhor tema
            </div>
            <div className="mt-1 text-lg font-medium">{stats.thm[0].k}</div>
            <div className="text-xs text-[var(--color-text-dim)]">
              {pct(stats.thm[0].avg)} de engajamento
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 text-sm text-[var(--color-text-dim)]">
          {items.length} post{items.length === 1 ? "" : "s"} registrado
          {items.length === 1 ? "" : "s"}
          {stats && " · ordenados por engajamento"}
        </div>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-dim)]">
            Nenhum post registrado. Adicione o primeiro acima — depois de 2, a aba Gerar
            começa a aprender com eles.
          </div>
        ) : (
          <ul className="space-y-3">
            {(stats?.topPosts ?? items).map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-dim)]">
                      <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5">
                        {formatLabel[p.format]}
                      </span>
                      {p.theme && <span>{p.theme}</span>}
                      {p.postedAt && <span>· {p.postedAt}</span>}
                      <span className="text-[var(--color-ok)]">
                        engajamento {pct(engagementRate(p))}
                      </span>
                    </div>
                    <pre className="line-clamp-3 whitespace-pre-wrap break-words font-sans text-sm text-[var(--color-text-dim)]">
                      {p.text}
                    </pre>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-dim)]">
                      <span>{p.metrics.impressions} impr.</span>
                      <span>{p.metrics.reactions} reações</span>
                      <span>{p.metrics.comments} coment.</span>
                      <span>{p.metrics.shares} compart.</span>
                      <span>{p.metrics.saves} saves</span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(p.id)}
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
