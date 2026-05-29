"use client";

import { useEffect, useMemo, useState } from "react";
import { analytics, engagementRate, history, territories } from "@/lib/storage";
import { parseLinkedInXlsx } from "@/lib/linkedinImport";
import type {
  Demographics,
  HistoryEntry,
  PostFormat,
  PublishedPost,
  Territory,
} from "@/lib/types";

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
  const [postedTime, setPostedTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ ...emptyMetrics });
  const [audience, setAudience] = useState({ ...emptyAudience });
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [territory, setTerritory] = useState("");
  const [terrs, setTerrs] = useState<Territory[]>([]);
  const [newTerrName, setNewTerrName] = useState("");
  const [newTerrDesc, setNewTerrDesc] = useState("");

  function refresh() {
    setItems(analytics.list());
    setHist(history.list());
    setTerrs(territories.list());
  }

  function addTerritory() {
    if (!newTerrName.trim()) return;
    territories.add(newTerrName, newTerrDesc);
    setNewTerrName("");
    setNewTerrDesc("");
    refresh();
  }

  function removeTerritory(id: string) {
    if (!confirm("Remover este território?")) return;
    territories.remove(id);
    refresh();
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
      if (parsed.postedTime) setPostedTime(parsed.postedTime);
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

  function resetForm() {
    setText("");
    setTheme("");
    setFormat("texto");
    setPostedAt("");
    setPostedTime("");
    setMetrics({ ...emptyMetrics });
    setAudience({ ...emptyAudience });
    setDemographics(null);
    setTerritory("");
    setImportMsg(null);
    setEditingId(null);
  }

  function save() {
    if (!text.trim() || !metrics.impressions.trim()) return;
    const payload = {
      text: text.trim(),
      theme: theme.trim(),
      format,
      postedAt: postedAt || new Date().toISOString().slice(0, 10),
      postedTime: postedTime || undefined,
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
      territory: territory || undefined,
    };
    if (editingId) analytics.update(editingId, payload);
    else analytics.add(payload);
    resetForm();
    refresh();
  }

  function startEdit(p: PublishedPost) {
    setEditingId(p.id);
    setText(p.text);
    setTheme(p.theme);
    setFormat(p.format);
    setPostedAt(p.postedAt);
    setPostedTime(p.postedTime ?? "");
    setMetrics({
      impressions: String(p.metrics.impressions ?? ""),
      reached: String(p.metrics.reached ?? ""),
      reactions: String(p.metrics.reactions ?? ""),
      comments: String(p.metrics.comments ?? ""),
      shares: String(p.metrics.shares ?? ""),
      saves: String(p.metrics.saves ?? ""),
      profileViews: String(p.metrics.profileViews ?? ""),
      followers: String(p.metrics.followers ?? ""),
      sends: String(p.metrics.sends ?? ""),
    });
    setAudience({
      link: p.link ?? "",
      topRole: p.topRole ?? "",
      topLocation: p.topLocation ?? "",
      topIndustry: p.topIndustry ?? "",
    });
    setDemographics(p.demographics ?? null);
    setTerritory(p.territory ?? "");
    setImportMsg(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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

  const territoryStats = useMemo(() => {
    const valid = items.filter((p) => p.metrics.impressions > 0);
    if (valid.length === 0) return [];
    const m = new Map<string, { sum: number; n: number }>();
    for (const p of valid) {
      const key = p.territory?.trim() || "(sem território)";
      const cur = m.get(key) ?? { sum: 0, n: 0 };
      cur.sum += engagementRate(p);
      cur.n += 1;
      m.set(key, cur);
    }
    const total = valid.length;
    return [...m.entries()]
      .map(([name, v]) => ({ name, avg: v.sum / v.n, n: v.n, share: v.n / total }))
      .sort((a, b) => b.n - a.n);
  }, [items]);

  const WEEKDAYS = [
    "domingo",
    "segunda",
    "terça",
    "quarta",
    "quinta",
    "sexta",
    "sábado",
  ];

  const postingAdvice = useMemo(() => {
    const valid = items.filter((p) => p.postedAt && p.metrics.impressions > 0);
    if (valid.length === 0) return null;

    const dates = valid
      .map((p) => new Date(p.postedAt + "T12:00:00"))
      .sort((a, b) => a.getTime() - b.getTime());
    const last = dates[dates.length - 1];
    const daysSince = Math.floor((Date.now() - last.getTime()) / 86400000);

    let avgGap: number | null = null;
    if (dates.length >= 2) {
      let sum = 0;
      for (let i = 1; i < dates.length; i++) {
        sum += (dates[i].getTime() - dates[i - 1].getTime()) / 86400000;
      }
      avgGap = sum / (dates.length - 1);
    }

    const wd = new Map<number, { sum: number; n: number }>();
    for (const p of valid) {
      const d = new Date(p.postedAt + "T12:00:00").getDay();
      const c = wd.get(d) ?? { sum: 0, n: 0 };
      c.sum += engagementRate(p);
      c.n += 1;
      wd.set(d, c);
    }
    const bestWeekday = [...wd.entries()]
      .map(([d, v]) => ({ d, avg: v.sum / v.n }))
      .sort((a, b) => b.avg - a.avg)[0];

    const hr = new Map<number, { sum: number; n: number }>();
    for (const p of valid) {
      if (!p.postedTime) continue;
      const h = parseInt(p.postedTime.split(":")[0], 10);
      if (Number.isNaN(h)) continue;
      const c = hr.get(h) ?? { sum: 0, n: 0 };
      c.sum += engagementRate(p);
      c.n += 1;
      hr.set(h, c);
    }
    const bestHour =
      [...hr.entries()].map(([h, v]) => ({ h, avg: v.sum / v.n })).sort((a, b) => b.avg - a.avg)[0] ??
      null;

    // próxima ocorrência do melhor dia da semana
    const today = new Date().getDay();
    const diff = ((bestWeekday.d - today + 7) % 7) || 7;
    const next = new Date();
    next.setDate(next.getDate() + diff);

    return {
      count: valid.length,
      daysSince,
      avgGap,
      bestWeekday,
      bestHour,
      nextDate: next,
    };
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

      {postingAdvice && (
        <section className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-surface-2)] p-4">
          <div className="mb-1 text-sm font-medium">Quando postar a seguir</div>
          <div className="text-sm text-[var(--color-text)]">
            Última publicação há{" "}
            <strong>
              {postingAdvice.daysSince} dia{postingAdvice.daysSince === 1 ? "" : "s"}
            </strong>
            {postingAdvice.avgGap != null && (
              <> · sua cadência média é a cada {postingAdvice.avgGap.toFixed(0)} dias</>
            )}
            .
          </div>
          <div className="mt-1 text-sm text-[var(--color-text)]">
            Melhor dia pelos seus dados:{" "}
            <strong className="capitalize">{WEEKDAYS[postingAdvice.bestWeekday.d]}</strong> (
            {pct(postingAdvice.bestWeekday.avg)} de engajamento)
            {postingAdvice.bestHour && (
              <>
                {" "}
                · melhor horário: <strong>~{postingAdvice.bestHour.h}h</strong>
              </>
            )}
            .
          </div>
          <div className="mt-2 rounded-md bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]">
            Sugestão: poste na próxima{" "}
            <strong className="capitalize">{WEEKDAYS[postingAdvice.bestWeekday.d]}</strong> (
            {postingAdvice.nextDate.toLocaleDateString("pt-BR")})
            {postingAdvice.bestHour ? ` por volta de ${postingAdvice.bestHour.h}h` : ""}.
          </div>
          {postingAdvice.count < 4 && (
            <div className="mt-2 text-xs text-[var(--color-text-dim)]">
              Baseado em poucos posts ({postingAdvice.count}) — a recomendação fica mais
              confiável conforme você registra mais. Mire em 3–5 posts/semana.
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-1 text-sm font-medium">Territórios temáticos</div>
        <p className="mb-3 text-xs text-[var(--color-text-dim)]">
          Defina 2–3 temas centrais. O algoritmo recompensa coerência: posts ancorados num
          território constroem autoridade. Use-os na aba Gerar e acompanhe a concentração
          abaixo.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newTerrName}
            onChange={(e) => setNewTerrName(e.target.value)}
            placeholder="Nome (ex: IA na educação)"
            className={`${field} sm:max-w-xs`}
          />
          <input
            value={newTerrDesc}
            onChange={(e) => setNewTerrDesc(e.target.value)}
            placeholder="Descrição curta (opcional)"
            className={`${field} flex-1`}
          />
          <button
            onClick={addTerritory}
            disabled={!newTerrName.trim()}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
        {terrs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {terrs.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs"
                title={t.description}
              >
                {t.name}
                <button
                  onClick={() => removeTerritory(t.id)}
                  className="text-[var(--color-text-dim)] hover:text-[var(--color-danger)]"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {territoryStats.length > 0 && (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 text-sm font-medium">Desempenho por território</div>
          <div className="space-y-3">
            {territoryStats.map((t) => {
              const maxAvg = territoryStats[0]
                ? Math.max(...territoryStats.map((x) => x.avg))
                : 1;
              return (
                <div key={t.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-[var(--color-text-dim)]">
                      {t.n} post{t.n === 1 ? "" : "s"} ({(t.share * 100).toFixed(0)}%) ·
                      engajamento {pct(t.avg)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded bg-[var(--color-surface-2)]">
                    <div
                      className="h-3 rounded bg-[var(--color-accent)]"
                      style={{ width: `${Math.max(2, (maxAvg > 0 ? t.avg / maxAvg : 0) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-dim)]">
            Concentre seus posts em poucos territórios. Dispersão derruba o alcance no
            algoritmo atual.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">
            {editingId ? "Editar post registrado" : "Registrar post publicado"}
          </div>
          <label className="cursor-pointer rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            {editingId ? "Atualizar com novo .xlsx" : "Importar arquivo do LinkedIn (.xlsx)"}
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
          <div className="flex gap-2">
            <input
              type="date"
              value={postedAt}
              onChange={(e) => setPostedAt(e.target.value)}
              className={field}
            />
            <input
              type="time"
              value={postedTime}
              onChange={(e) => setPostedTime(e.target.value)}
              title="Hora da publicação"
              className={`${field} max-w-[7rem]`}
            />
          </div>
        </div>

        {terrs.length > 0 && (
          <select
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
            className={`${field} mt-3`}
          >
            <option value="">Território (opcional)</option>
            {terrs.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}

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

        <div className="mt-3 flex gap-2">
          <button
            onClick={save}
            disabled={!text.trim() || !metrics.impressions.trim()}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {editingId ? "Salvar alterações" : "Salvar métricas"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-dim)]"
            >
              Cancelar edição
            </button>
          )}
        </div>
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
                      {p.territory && (
                        <span className="rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[var(--color-accent)]">
                          {p.territory}
                        </span>
                      )}
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
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-surface-2)]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
