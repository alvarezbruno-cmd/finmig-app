"use client";

import type { HistoryEntry, Idea, ReferencePost, SelectedIdea, SourceText } from "./types";

const REF_KEY = "finmig:references";
const HIST_KEY = "finmig:history";
const SRC_KEY = "finmig:sources";

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
