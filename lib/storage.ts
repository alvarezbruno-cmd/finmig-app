"use client";

import { supabase } from "./supabase";
import type {
  HistoryEntry,
  Idea,
  Objectives,
  PostFormat,
  PostMetrics,
  PublishedPost,
  ReferencePost,
  SelectedIdea,
  SourceText,
  Territory,
} from "./types";

const EMPTY_OBJECTIVES: Objectives = { audienceGoal: "", regionGoal: "", notes: "" };

// In-memory cache, hydrated once after login. Components read it synchronously;
// mutations update the cache optimistically and persist to Supabase in background.
const cache = {
  refs: [] as ReferencePost[],
  sources: [] as SourceText[],
  history: [] as HistoryEntry[],
  analytics: [] as PublishedPost[],
  territories: [] as Territory[],
  objectives: { ...EMPTY_OBJECTIVES } as Objectives,
};

function persist(p: PromiseLike<{ error: unknown }>): void {
  Promise.resolve(p).then(({ error }) => {
    if (error) console.error("Supabase:", error);
  });
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

interface RefRow {
  id: string;
  content: string;
  note: string | null;
  created_at: string;
}
interface SourceRow {
  id: string;
  title: string;
  author: string;
  publication: string;
  date: string;
  link: string;
  ideas: Idea[];
  created_at: string;
}
interface HistoryRow {
  id: string;
  topic: string;
  variations: HistoryEntry["variations"];
  created_at: string;
}
interface AnalyticsMeta {
  link?: string;
  topRole?: string;
  topLocation?: string;
  topIndustry?: string;
  demographics?: PublishedPost["demographics"];
  territory?: string;
  postedTime?: string;
}
interface AnalyticsRow {
  id: string;
  text: string;
  theme: string;
  format: string;
  posted_at: string;
  metrics: PostMetrics;
  meta: AnalyticsMeta | null;
  created_at: string;
}
interface TerritoryRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export async function hydrate(): Promise<void> {
  const [r, s, h, a, t, st] = await Promise.all([
    supabase.from("style_references").select("*").order("created_at", { ascending: false }),
    supabase.from("sources").select("*").order("created_at", { ascending: false }),
    supabase.from("history").select("*").order("created_at", { ascending: false }),
    supabase.from("analytics").select("*").order("created_at", { ascending: false }),
    supabase.from("territories").select("*").order("created_at", { ascending: true }),
    supabase.from("settings").select("data").maybeSingle(),
  ]);

  const settingsData = (st.data?.data ?? {}) as { objectives?: Objectives };
  cache.objectives = { ...EMPTY_OBJECTIVES, ...(settingsData.objectives ?? {}) };

  cache.territories = ((t.data ?? []) as TerritoryRow[]).map((x) => ({
    id: x.id,
    name: x.name,
    description: x.description ?? "",
    createdAt: new Date(x.created_at).getTime(),
  }));

  cache.refs = ((r.data ?? []) as RefRow[]).map((x) => ({
    id: x.id,
    content: x.content,
    note: x.note ?? undefined,
    createdAt: new Date(x.created_at).getTime(),
  }));
  cache.sources = ((s.data ?? []) as SourceRow[]).map((x) => ({
    id: x.id,
    title: x.title ?? "",
    author: x.author ?? "",
    publication: x.publication ?? "",
    date: x.date ?? "",
    link: x.link ?? "",
    ideas: Array.isArray(x.ideas) ? x.ideas : [],
    createdAt: new Date(x.created_at).getTime(),
  }));
  cache.history = ((h.data ?? []) as HistoryRow[]).map((x) => ({
    id: x.id,
    topic: x.topic,
    variations: Array.isArray(x.variations) ? x.variations : [],
    createdAt: new Date(x.created_at).getTime(),
  }));
  cache.analytics = ((a.data ?? []) as AnalyticsRow[]).map((x) => {
    const meta = x.meta ?? {};
    return {
      id: x.id,
      text: x.text,
      theme: x.theme ?? "",
      format: (x.format ?? "texto") as PostFormat,
      postedAt: x.posted_at ?? "",
      metrics: x.metrics,
      link: meta.link,
      topRole: meta.topRole,
      topLocation: meta.topLocation,
      topIndustry: meta.topIndustry,
      demographics: meta.demographics,
      territory: meta.territory,
      postedTime: meta.postedTime,
      createdAt: new Date(x.created_at).getTime(),
    };
  });
}

export const references = {
  list(): ReferencePost[] {
    return [...cache.refs].sort((a, b) => b.createdAt - a.createdAt);
  },
  add(content: string, note?: string): ReferencePost {
    const item: ReferencePost = {
      id: crypto.randomUUID(),
      content: content.trim(),
      note: note?.trim() || undefined,
      createdAt: Date.now(),
    };
    cache.refs = [item, ...cache.refs];
    persist(
      supabase.from("style_references").insert({
        id: item.id,
        content: item.content,
        note: item.note ?? null,
        created_at: iso(item.createdAt),
      }),
    );
    return item;
  },
  remove(id: string): void {
    cache.refs = cache.refs.filter((r) => r.id !== id);
    persist(supabase.from("style_references").delete().eq("id", id));
  },
  getMany(ids: string[]): ReferencePost[] {
    return ids
      .map((id) => cache.refs.find((r) => r.id === id))
      .filter((r): r is ReferencePost => r != null);
  },
  exportAll(): string {
    return JSON.stringify(references.list(), null, 2);
  },
  importMany(json: string): number {
    const parsed = JSON.parse(json) as ReferencePost[];
    if (!Array.isArray(parsed)) throw new Error("Formato inválido.");
    let added = 0;
    for (const item of parsed) {
      if (!item?.content) continue;
      references.add(item.content, item.note);
      added++;
    }
    return added;
  },
};

export const objectives = {
  get(): Objectives {
    return { ...cache.objectives };
  },
  async save(obj: Objectives): Promise<void> {
    cache.objectives = { ...obj };
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase
      .from("settings")
      .upsert(
        { user_id: userId, data: { objectives: cache.objectives }, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
  },
};

export const territories = {
  list(): Territory[] {
    return [...cache.territories].sort((a, b) => a.createdAt - b.createdAt);
  },
  add(name: string, description = ""): Territory {
    const item: Territory = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      createdAt: Date.now(),
    };
    cache.territories = [...cache.territories, item];
    persist(
      supabase.from("territories").insert({
        id: item.id,
        name: item.name,
        description: item.description,
        created_at: iso(item.createdAt),
      }),
    );
    return item;
  },
  remove(id: string): void {
    cache.territories = cache.territories.filter((t) => t.id !== id);
    persist(supabase.from("territories").delete().eq("id", id));
  },
};

export const history = {
  list(): HistoryEntry[] {
    return [...cache.history].sort((a, b) => b.createdAt - a.createdAt);
  },
  add(entry: Omit<HistoryEntry, "id" | "createdAt">): HistoryEntry {
    const item: HistoryEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
    cache.history = [item, ...cache.history];
    persist(
      supabase.from("history").insert({
        id: item.id,
        topic: item.topic,
        variations: item.variations,
        created_at: iso(item.createdAt),
      }),
    );
    return item;
  },
  remove(id: string): void {
    cache.history = cache.history.filter((e) => e.id !== id);
    persist(supabase.from("history").delete().eq("id", id));
  },
  clear(): void {
    const ids = cache.history.map((e) => e.id);
    cache.history = [];
    if (ids.length) persist(supabase.from("history").delete().in("id", ids));
  },
};

function persistSource(s: SourceText): void {
  persist(
    supabase.from("sources").update({
      title: s.title,
      author: s.author,
      publication: s.publication,
      date: s.date,
      link: s.link,
      ideas: s.ideas,
    }).eq("id", s.id),
  );
}

export const sources = {
  list(): SourceText[] {
    return [...cache.sources].sort((a, b) => b.createdAt - a.createdAt);
  },
  add(meta: Omit<SourceText, "id" | "ideas" | "createdAt">): SourceText {
    const item: SourceText = { ...meta, id: crypto.randomUUID(), ideas: [], createdAt: Date.now() };
    cache.sources = [item, ...cache.sources];
    persist(
      supabase.from("sources").insert({
        id: item.id,
        title: item.title,
        author: item.author,
        publication: item.publication,
        date: item.date,
        link: item.link,
        ideas: [],
        created_at: iso(item.createdAt),
      }),
    );
    return item;
  },
  update(id: string, patch: Partial<Omit<SourceText, "id" | "ideas" | "createdAt">>): void {
    cache.sources = cache.sources.map((s) => (s.id === id ? { ...s, ...patch } : s));
    const s = cache.sources.find((x) => x.id === id);
    if (s) persistSource(s);
  },
  remove(id: string): void {
    cache.sources = cache.sources.filter((s) => s.id !== id);
    persist(supabase.from("sources").delete().eq("id", id));
  },
  addIdea(sourceId: string, text: string): void {
    if (!text.trim()) return;
    const idea: Idea = { id: crypto.randomUUID(), text: text.trim(), createdAt: Date.now() };
    cache.sources = cache.sources.map((s) =>
      s.id === sourceId ? { ...s, ideas: [...s.ideas, idea] } : s,
    );
    const s = cache.sources.find((x) => x.id === sourceId);
    if (s) persistSource(s);
  },
  updateIdea(sourceId: string, ideaId: string, text: string): void {
    cache.sources = cache.sources.map((s) =>
      s.id === sourceId
        ? { ...s, ideas: s.ideas.map((i) => (i.id === ideaId ? { ...i, text: text.trim() } : i)) }
        : s,
    );
    const s = cache.sources.find((x) => x.id === sourceId);
    if (s) persistSource(s);
  },
  removeIdea(sourceId: string, ideaId: string): void {
    cache.sources = cache.sources.map((s) =>
      s.id === sourceId ? { ...s, ideas: s.ideas.filter((i) => i.id !== ideaId) } : s,
    );
    const s = cache.sources.find((x) => x.id === sourceId);
    if (s) persistSource(s);
  },
  getSelectedIdeas(ideaIds: string[]): SelectedIdea[] {
    const idSet = new Set(ideaIds);
    const selected: SelectedIdea[] = [];
    for (const s of cache.sources) {
      for (const idea of s.ideas) {
        if (idSet.has(idea.id)) {
          selected.push({ text: idea.text, sourceTitle: s.title, sourceAuthor: s.author });
        }
      }
    }
    return selected;
  },
  exportAll(): string {
    return JSON.stringify(sources.list(), null, 2);
  },
  importMany(json: string): number {
    const parsed = JSON.parse(json) as SourceText[];
    if (!Array.isArray(parsed)) throw new Error("Formato inválido.");
    let added = 0;
    for (const item of parsed) {
      if (!item?.title && !item?.ideas) continue;
      const created = sources.add({
        title: item.title ?? "",
        author: item.author ?? "",
        publication: item.publication ?? "",
        date: item.date ?? "",
        link: item.link ?? "",
      });
      if (Array.isArray(item.ideas)) {
        cache.sources = cache.sources.map((s) =>
          s.id === created.id ? { ...s, ideas: item.ideas } : s,
        );
        const s = cache.sources.find((x) => x.id === created.id);
        if (s) persistSource(s);
      }
      added++;
    }
    return added;
  },
};

export function engagementRate(p: PublishedPost): number {
  const { impressions, reactions, comments, shares, saves } = p.metrics;
  if (!impressions) return 0;
  return (reactions + comments + shares + saves) / impressions;
}

function analyticsRow(p: PublishedPost) {
  return {
    text: p.text,
    theme: p.theme,
    format: p.format,
    posted_at: p.postedAt,
    metrics: p.metrics,
    meta: {
      link: p.link,
      topRole: p.topRole,
      topLocation: p.topLocation,
      topIndustry: p.topIndustry,
      demographics: p.demographics,
      territory: p.territory,
      postedTime: p.postedTime,
    },
  };
}

export const analytics = {
  list(): PublishedPost[] {
    return [...cache.analytics].sort((a, b) => b.createdAt - a.createdAt);
  },
  add(entry: Omit<PublishedPost, "id" | "createdAt">): PublishedPost {
    const item: PublishedPost = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
    cache.analytics = [item, ...cache.analytics];
    persist(
      supabase
        .from("analytics")
        .insert({ id: item.id, created_at: iso(item.createdAt), ...analyticsRow(item) }),
    );
    return item;
  },
  update(id: string, patch: Partial<Omit<PublishedPost, "id" | "createdAt">>): void {
    cache.analytics = cache.analytics.map((p) => (p.id === id ? { ...p, ...patch } : p));
    const p = cache.analytics.find((x) => x.id === id);
    if (p) persist(supabase.from("analytics").update(analyticsRow(p)).eq("id", id));
  },
  remove(id: string): void {
    cache.analytics = cache.analytics.filter((p) => p.id !== id);
    persist(supabase.from("analytics").delete().eq("id", id));
  },
  performanceProfile(): string {
    const posts = cache.analytics.filter((p) => p.metrics.impressions > 0);
    if (posts.length < 2) return "";

    const ranked = [...posts].sort((a, b) => engagementRate(b) - engagementRate(a));
    const topCount = Math.max(1, Math.round(ranked.length / 3));
    const top = ranked.slice(0, topCount);
    const bottom = ranked.slice(-topCount);

    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
    const avgLen = (arr: PublishedPost[]) =>
      Math.round(arr.reduce((s, p) => s + p.text.length, 0) / arr.length);

    const lines: string[] = [];
    lines.push(`Baseado em ${posts.length} posts publicados e suas métricas reais nesta audiência:`);

    const byTheme = new Map<string, { sum: number; n: number }>();
    for (const p of posts) {
      const key = p.theme.trim() || "(sem tema)";
      const cur = byTheme.get(key) ?? { sum: 0, n: 0 };
      cur.sum += engagementRate(p);
      cur.n += 1;
      byTheme.set(key, cur);
    }
    const themeRank = [...byTheme.entries()]
      .map(([t, v]) => ({ theme: t, avg: v.sum / v.n }))
      .sort((a, b) => b.avg - a.avg);
    if (themeRank.length > 1 && themeRank[0].theme !== "(sem tema)") {
      lines.push(
        `- Temas que mais engajam: ${themeRank.slice(0, 2).map((t) => `${t.theme} (${pct(t.avg)})`).join(", ")}.`,
      );
    }

    const byFormat = new Map<string, { sum: number; n: number }>();
    for (const p of posts) {
      const cur = byFormat.get(p.format) ?? { sum: 0, n: 0 };
      cur.sum += engagementRate(p);
      cur.n += 1;
      byFormat.set(p.format, cur);
    }
    const formatRank = [...byFormat.entries()]
      .map(([f, v]) => ({ format: f, avg: v.sum / v.n }))
      .sort((a, b) => b.avg - a.avg);
    if (formatRank.length > 1) {
      lines.push(
        `- Formato com melhor engajamento: ${formatRank[0].format} (${pct(formatRank[0].avg)}), vs ${formatRank[formatRank.length - 1].format} (${pct(formatRank[formatRank.length - 1].avg)}).`,
      );
    }

    lines.push(
      `- Tamanho dos posts que mais engajam: ~${avgLen(top)} caracteres (os de pior desempenho: ~${avgLen(bottom)}).`,
    );

    lines.push("- Seus posts de MAIOR engajamento (use como bússola do que ressoa aqui):");
    top.slice(0, 2).forEach((p, i) => {
      const excerpt = p.text.length > 600 ? p.text.slice(0, 600) + "…" : p.text;
      lines.push(`  [Exemplo ${i + 1} — engajamento ${pct(engagementRate(p))}]\n${excerpt}`);
    });

    lines.push(
      "Incline o novo post na direção do que funciona acima (tema, tamanho, abordagem dos melhores exemplos), sem copiá-los e sem perder a voz do autor.",
    );

    return lines.join("\n");
  },
};

// ---- Migração do localStorage (uma vez) ----
const MIGRATED_FLAG = "finmig:migrated";

function readLegacy<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function hasLegacyData(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(MIGRATED_FLAG)) return false;
  return (
    readLegacy("finmig:references").length > 0 ||
    readLegacy("finmig:sources").length > 0 ||
    readLegacy("finmig:history").length > 0 ||
    readLegacy("finmig:analytics").length > 0
  );
}

export async function migrateFromLocalStorage(): Promise<void> {
  const refs = readLegacy<ReferencePost>("finmig:references");
  const srcs = readLegacy<SourceText>("finmig:sources");
  const hist = readLegacy<HistoryEntry>("finmig:history");
  const anal = readLegacy<PublishedPost>("finmig:analytics");

  if (refs.length) {
    await supabase.from("style_references").insert(
      refs.map((r) => ({
        content: r.content,
        note: r.note ?? null,
        created_at: r.createdAt ? iso(r.createdAt) : new Date().toISOString(),
      })),
    );
  }
  if (srcs.length) {
    await supabase.from("sources").insert(
      srcs.map((s) => ({
        title: s.title ?? "",
        author: s.author ?? "",
        publication: s.publication ?? "",
        date: s.date ?? "",
        link: s.link ?? "",
        ideas: Array.isArray(s.ideas) ? s.ideas : [],
        created_at: s.createdAt ? iso(s.createdAt) : new Date().toISOString(),
      })),
    );
  }
  if (hist.length) {
    await supabase.from("history").insert(
      hist.map((h) => ({
        topic: h.topic,
        variations: h.variations ?? [],
        created_at: h.createdAt ? iso(h.createdAt) : new Date().toISOString(),
      })),
    );
  }
  if (anal.length) {
    await supabase.from("analytics").insert(
      anal.map((a) => ({
        text: a.text,
        theme: a.theme ?? "",
        format: a.format ?? "texto",
        posted_at: a.postedAt ?? "",
        metrics: a.metrics ?? {},
        created_at: a.createdAt ? iso(a.createdAt) : new Date().toISOString(),
      })),
    );
  }

  window.localStorage.setItem(MIGRATED_FLAG, "1");
}
