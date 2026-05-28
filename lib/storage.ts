"use client";

import type {
  HistoryEntry,
  Idea,
  PublishedPost,
  ReferencePost,
  SelectedIdea,
  SourceText,
} from "./types";

const REF_KEY = "finmig:references";
const HIST_KEY = "finmig:history";
const SRC_KEY = "finmig:sources";
const ANALYTICS_KEY = "finmig:analytics";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const references = {
  list(): ReferencePost[] {
    return read<ReferencePost>(REF_KEY).sort((a, b) => b.createdAt - a.createdAt);
  },
  add(content: string, note?: string): ReferencePost {
    const item: ReferencePost = {
      id: crypto.randomUUID(),
      content: content.trim(),
      note: note?.trim() || undefined,
      createdAt: Date.now(),
    };
    write(REF_KEY, [item, ...read<ReferencePost>(REF_KEY)]);
    return item;
  },
  remove(id: string): void {
    write(
      REF_KEY,
      read<ReferencePost>(REF_KEY).filter((r) => r.id !== id),
    );
  },
  update(id: string, patch: Partial<Pick<ReferencePost, "content" | "note">>): void {
    write(
      REF_KEY,
      read<ReferencePost>(REF_KEY).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  },
  getMany(ids: string[]): ReferencePost[] {
    const all = read<ReferencePost>(REF_KEY);
    return ids
      .map((id) => all.find((r) => r.id === id))
      .filter((r): r is ReferencePost => r != null);
  },
  exportAll(): string {
    return JSON.stringify(read<ReferencePost>(REF_KEY), null, 2);
  },
  importMany(json: string): number {
    const parsed = JSON.parse(json) as ReferencePost[];
    if (!Array.isArray(parsed)) throw new Error("Formato inválido.");
    const existing = read<ReferencePost>(REF_KEY);
    const byId = new Map(existing.map((r) => [r.id, r]));
    let added = 0;
    for (const item of parsed) {
      if (!item?.content) continue;
      const id = item.id ?? crypto.randomUUID();
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          content: String(item.content),
          note: item.note,
          createdAt: item.createdAt ?? Date.now(),
        });
        added++;
      }
    }
    write(REF_KEY, [...byId.values()]);
    return added;
  },
};

export const history = {
  list(): HistoryEntry[] {
    return read<HistoryEntry>(HIST_KEY).sort((a, b) => b.createdAt - a.createdAt);
  },
  add(entry: Omit<HistoryEntry, "id" | "createdAt">): HistoryEntry {
    const item: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    write(HIST_KEY, [item, ...read<HistoryEntry>(HIST_KEY)].slice(0, 200));
    return item;
  },
  remove(id: string): void {
    write(
      HIST_KEY,
      read<HistoryEntry>(HIST_KEY).filter((e) => e.id !== id),
    );
  },
  clear(): void {
    write(HIST_KEY, []);
  },
};

function writeSources(items: SourceText[]): void {
  write(SRC_KEY, items);
}
function readSources(): SourceText[] {
  return read<SourceText>(SRC_KEY);
}

export const sources = {
  list(): SourceText[] {
    return readSources().sort((a, b) => b.createdAt - a.createdAt);
  },
  add(meta: Omit<SourceText, "id" | "ideas" | "createdAt">): SourceText {
    const item: SourceText = {
      ...meta,
      id: crypto.randomUUID(),
      ideas: [],
      createdAt: Date.now(),
    };
    writeSources([item, ...readSources()]);
    return item;
  },
  update(id: string, patch: Partial<Omit<SourceText, "id" | "ideas" | "createdAt">>): void {
    writeSources(readSources().map((s) => (s.id === id ? { ...s, ...patch } : s)));
  },
  remove(id: string): void {
    writeSources(readSources().filter((s) => s.id !== id));
  },
  addIdea(sourceId: string, text: string): void {
    if (!text.trim()) return;
    const idea: Idea = { id: crypto.randomUUID(), text: text.trim(), createdAt: Date.now() };
    writeSources(
      readSources().map((s) =>
        s.id === sourceId ? { ...s, ideas: [...s.ideas, idea] } : s,
      ),
    );
  },
  updateIdea(sourceId: string, ideaId: string, text: string): void {
    writeSources(
      readSources().map((s) =>
        s.id === sourceId
          ? {
              ...s,
              ideas: s.ideas.map((i) => (i.id === ideaId ? { ...i, text: text.trim() } : i)),
            }
          : s,
      ),
    );
  },
  removeIdea(sourceId: string, ideaId: string): void {
    writeSources(
      readSources().map((s) =>
        s.id === sourceId ? { ...s, ideas: s.ideas.filter((i) => i.id !== ideaId) } : s,
      ),
    );
  },
  getSelectedIdeas(ideaIds: string[]): SelectedIdea[] {
    const idSet = new Set(ideaIds);
    const selected: SelectedIdea[] = [];
    for (const s of readSources()) {
      for (const idea of s.ideas) {
        if (idSet.has(idea.id)) {
          selected.push({
            text: idea.text,
            sourceTitle: s.title,
            sourceAuthor: s.author,
          });
        }
      }
    }
    return selected;
  },
  exportAll(): string {
    return JSON.stringify(readSources(), null, 2);
  },
  importMany(json: string): number {
    const parsed = JSON.parse(json) as SourceText[];
    if (!Array.isArray(parsed)) throw new Error("Formato inválido.");
    const existing = readSources();
    const byId = new Map(existing.map((s) => [s.id, s]));
    let added = 0;
    for (const item of parsed) {
      if (!item?.title && !item?.ideas) continue;
      const id = item.id ?? crypto.randomUUID();
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          title: item.title ?? "",
          author: item.author ?? "",
          publication: item.publication ?? "",
          date: item.date ?? "",
          link: item.link ?? "",
          ideas: Array.isArray(item.ideas) ? item.ideas : [],
          createdAt: item.createdAt ?? Date.now(),
        });
        added++;
      }
    }
    writeSources([...byId.values()]);
    return added;
  },
};

export function engagementRate(p: PublishedPost): number {
  const { impressions, reactions, comments, shares, saves } = p.metrics;
  if (!impressions) return 0;
  return (reactions + comments + shares + saves) / impressions;
}

export const analytics = {
  list(): PublishedPost[] {
    return read<PublishedPost>(ANALYTICS_KEY).sort((a, b) => b.createdAt - a.createdAt);
  },
  add(entry: Omit<PublishedPost, "id" | "createdAt">): PublishedPost {
    const item: PublishedPost = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    write(ANALYTICS_KEY, [item, ...read<PublishedPost>(ANALYTICS_KEY)]);
    return item;
  },
  remove(id: string): void {
    write(
      ANALYTICS_KEY,
      read<PublishedPost>(ANALYTICS_KEY).filter((p) => p.id !== id),
    );
  },
  // Compact, statistical summary of what works — injected into generation.
  performanceProfile(): string {
    const posts = read<PublishedPost>(ANALYTICS_KEY).filter((p) => p.metrics.impressions > 0);
    if (posts.length < 2) return "";

    const ranked = [...posts].sort((a, b) => engagementRate(b) - engagementRate(a));
    const topCount = Math.max(1, Math.round(ranked.length / 3));
    const top = ranked.slice(0, topCount);
    const bottom = ranked.slice(-topCount);

    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
    const avgLen = (arr: PublishedPost[]) =>
      Math.round(arr.reduce((s, p) => s + p.text.length, 0) / arr.length);

    const lines: string[] = [];
    lines.push(
      `Baseado em ${posts.length} posts publicados e suas métricas reais nesta audiência:`,
    );

    // Best themes
    const byTheme = new Map<string, { sum: number; n: number }>();
    for (const p of posts) {
      const key = p.theme.trim() || "(sem tema)";
      const cur = byTheme.get(key) ?? { sum: 0, n: 0 };
      cur.sum += engagementRate(p);
      cur.n += 1;
      byTheme.set(key, cur);
    }
    const themeRank = [...byTheme.entries()]
      .map(([t, v]) => ({ theme: t, avg: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
    if (themeRank.length > 1 && themeRank[0].theme !== "(sem tema)") {
      lines.push(
        `- Temas que mais engajam: ${themeRank
          .slice(0, 2)
          .map((t) => `${t.theme} (${pct(t.avg)})`)
          .join(", ")}.`,
      );
    }

    // Best format
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

    // Length
    lines.push(
      `- Tamanho dos posts que mais engajam: ~${avgLen(top)} caracteres (os de pior desempenho: ~${avgLen(bottom)}).`,
    );

    // Top exemplars
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
