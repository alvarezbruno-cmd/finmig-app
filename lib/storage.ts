"use client";

import type { HistoryEntry, ReferencePost } from "./types";

const REF_KEY = "finmig:references";
const HIST_KEY = "finmig:history";

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
