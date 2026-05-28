"use client";

import { useEffect, useMemo, useState } from "react";
import { analytics, engagementRate, history } from "@/lib/storage";
import { parseLinkedInXlsx } from "@/lib/linkedinImport";
import type { Demographics, HistoryEntry, PostFormat, PublishedPost } from "@/lib/types";

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
  sends: "",
};

const emptyAudience = { link: "", topRole: "", topLocation: "", topIndustry: "" };

const metricFields: { key: keyof typeof emptyMetrics; label: string }[] = [
  { key: "impressions", label: "Impressões" },
  { key: "reached", label: "Usuários alcançados" },
  { key: "reactions", label: "Reações" },
  { key: "comments", label: "Comentários" },
  { key: "shares", label: "Compartilhamentos" },
  { key: "saves", label: "Salvamentos" },
  { key: "profileViews", label: "Visualizações de perfil" },
  { key: "followers", label: "Seguidores obtidos" },
  { key: "sends", label: "Envios no LinkedIn" },
];

function Bar({
  label,
  display,
  ratio,
}: {
  label: string;
  display: string;
  ratio: number;
}) {
  const w = Math.max(2, Math.min(100, ratio * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-36 shrink-0 truncate text-[var(--color-text-dim)]" title={label}>
        {label}
      </div>
      <div className="h-3 flex-1 overflow-hidden rounded bg-[var(--color-surface-2)]">
        <div className="h-3 rounded bg-[var(--color-accent)]" style={{ width: `${w}%` }} />
      </div>
      <div className="w-14 shrink-0 text-right tabular-nums text-[var(--color-text)]">
        {display}
      </div>
    </div>
  );
}

export function Analytics() {
  const [items, setItems] = useState<PublishedPost[]>([]);
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  const [text, setText] = useState("");
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState<PostFormat>("texto");
  const [postedAt, setPostedAt] = useState("");
  const [metrics, setMetrics] = useState({ ...emptyMetrics });
  const [audience, setAudience] = useState({ ...emptyAudience });
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  function refresh() {
    setItems(analytics.list());
    setHist(history.list());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function importLinkedIn(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportMsg(null);
    try {
      const parsed = await parseLinkedInXlsx(await file.arrayBuffer());
      setMetrics({
        ...emptyMetrics,
        ...Object.fromEntries(
          Object.entries(parsed.metrics).map(([k, v]) => [k, String(v)]),
        ),
      });
      if (parsed.postedAt) setPostedAt(parsed.postedAt);
      setAudience({
        link: parsed.link ?? "",
        topRole: parsed.topRole ?? "",
        topLocation: parsed.topLocation ?? "",
        topIndustry: parsed.topIndustry ?? "",
      });
      setDemographics(parsed.demographics ?? null);
      const aud = [parsed.topRole, parsed.topLocation, parsed.topIndustry]
        .filter(Boolean)
        .join(" · ");
      setImportMsg(
        `Métricas importadas${parsed.postedAt ? ` (${parsed.postedAt})` : ""}${aud ? ` — público: ${aud}` : ""}. Agora cole o texto do post e salve.`,
      );
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Falha ao ler o arquivo.");
    }
  }

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
        sends: Number(metrics.sends) || 0,
      },
      link: audience.link || undefined,
      topRole: audience.topRole || undefined,
      topLocation: audience.topLocation || undefined,
      topIndustry: audience.topIndustry || undefined,
      demographics: demographics ?? undefined,
    });
    setText("");
    setTheme("");
    setFormat("texto");
    setPostedAt("");
    setMetrics({ ...emptyMetrics });
    setAudience({ ...emptyAudience });
    setDemographics(null);
    setImportMsg(null);
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

  const audienceAgg = useMemo(() => {
    const dims = new Map<string, Map<string, { sum: number; n: number }>>();
    for (const p of items) {
      if (!p.demographics) continue;
      for (const [dim, entries] of Object.entries(p.demographics)) {
        const m = dims.get(dim) ?? new Map<string, { sum: number; n: number }>();
        for (const e of entries) {
          const cur = m.get(e.label) ?? { sum: 0, n: 0 };
          cur.sum += e.pct;
          cur.n += 1;
          m.set(e.label, cur);
        }
        dims.set(dim, m);
      }
    }
    const order = [
      "Localidade",
      "Nível de experiência",
      "Setor",
      "Cargo",
      "Tamanho da empresa",
      "Empresa",
    ];
    return [...dims.entries()]
      .map(([dimension, m]) => ({
        dimension,
        entries: [...m.entries()]
          .map(([label, v]) => ({ label, pct: v.sum / v.n }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 6),
      }))
      .sort((a, b) => {
        const ia = order.indexOf(a.dimension);
        const ib = order.indexOf(b.dimension);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">Registrar post publicado</div>
          <label className="cursor-pointer rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            Importar arquivo do LinkedIn (.xlsx)
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={importLinkedIn}
              className="hidden"
            />
          </label>
        </div>

        {importMsg && (
          <div className="mb-3 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text)]">
            {importMsg}
          </div>
        )}

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
          className="mt-3 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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

      {stats && stats.topPosts.length > 0 && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 text-sm font-medium">Engajamento por post</div>
          <div className="space-y-1.5">
            {stats.topPosts.slice(0, 12).map((p) => {
              const er = engagementRate(p);
              const max = engagementRate(stats.topPosts[0]) || 1;
              const title = (p.theme || p.text).slice(0, 40);
              return (
                <Bar key={p.id} label={title} display={pct(er)} ratio={er / max} />
              );
            })}
          </div>
        </section>
      )}

      {audienceAgg.length > 0 && (
        <section className="space-y-4">
          <div className="text-sm font-medium">Público (média dos posts importados)</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {audienceAgg.map((dim) => {
              const max = dim.entries[0]?.pct || 1;
              return (
                <div
                  key={dim.dimension}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
                    {dim.dimension}
                  </div>
                  <div className="space-y-1.5">
                    {dim.entries.map((e) => (
                      <Bar
                        key={e.label}
                        label={e.label}
                        display={`${e.pct.toFixed(0)}%`}
                        ratio={e.pct / max}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
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
                      <span>{p.metrics.reached} alcanç.</span>
                      <span>{p.metrics.reactions} reações</span>
                      <span>{p.metrics.comments} coment.</span>
                      <span>{p.metrics.shares} compart.</span>
                      <span>{p.metrics.saves} saves</span>
                      {p.metrics.sends > 0 && <span>{p.metrics.sends} envios</span>}
                    </div>
                    {(p.topRole || p.topLocation || p.topIndustry) && (
                      <div className="mt-1 text-xs text-[var(--color-text-dim)]">
                        Público: {[p.topRole, p.topLocation, p.topIndustry].filter(Boolean).join(" · ")}
                      </div>
                    )}
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
