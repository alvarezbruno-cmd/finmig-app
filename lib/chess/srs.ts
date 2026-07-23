"use client";

// Repetição espaçada (SM-2 simplificado) sobre os SEUS erros, agora persistida no
// Supabase por usuário — para o progresso sincronizar entre dispositivos (celular
// e computador) e nunca se perder. Mesmo padrão do lib/storage.ts do app: um cache
// em memória hidratado após o login, leituras síncronas, e escritas otimistas que
// persistem em segundo plano.

import { supabase } from "@/lib/supabase";

export type Theme = "tatica" | "final" | "meio-jogo" | "abertura";

export interface Card {
  fen: string; // posição antes do lance certo (chave, por usuário)
  bestSan: string; // o lance a lembrar
  theme: Theme;
  ease: number;
  intervalDays: number;
  reps: number;
  due: number; // epoch ms
  created: number;
  lastNote: string;
}

const DAY_MS = 86_400_000;

interface Row {
  fen: string;
  best_san: string;
  theme: string;
  ease: number;
  interval_days: number;
  reps: number;
  due: string;
  created: string;
  last_note: string | null;
}

// Cache em memória, hidratado uma vez após o login.
let cache: Record<string, Card> = {};
let userId: string | null = null;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

// Carrega os cards do usuário logado. Chamado quando a página de xadrez monta.
export async function hydrateChess(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  userId = userData.user?.id ?? null;

  const { data, error } = await supabase.from("chess_cards").select("*");
  if (error) {
    console.error("chess hydrate:", error);
    return;
  }
  cache = {};
  for (const r of (data ?? []) as Row[]) {
    cache[r.fen] = {
      fen: r.fen,
      bestSan: r.best_san,
      theme: r.theme as Theme,
      ease: r.ease,
      intervalDays: r.interval_days,
      reps: r.reps,
      due: new Date(r.due).getTime(),
      created: new Date(r.created).getTime(),
      lastNote: r.last_note ?? "",
    };
  }
}

function persist(card: Card): void {
  if (!userId) return;
  Promise.resolve(
    supabase.from("chess_cards").upsert(
      {
        user_id: userId,
        fen: card.fen,
        best_san: card.bestSan,
        theme: card.theme,
        ease: card.ease,
        interval_days: card.intervalDays,
        reps: card.reps,
        due: iso(card.due),
        created: iso(card.created),
        last_note: card.lastNote,
      },
      { onConflict: "user_id,fen" },
    ),
  ).then(({ error }) => {
    if (error) console.error("chess persist:", error);
  });
}

export function addMistake(
  fen: string,
  bestSan: string,
  theme: Theme,
  note = "",
): void {
  const existing = cache[fen];
  if (!existing) {
    cache[fen] = {
      fen,
      bestSan,
      theme,
      ease: 2.5,
      intervalDays: 0,
      reps: 0,
      due: Date.now(),
      created: Date.now(),
      lastNote: note,
    };
  } else {
    // Errou de novo antes de dominar: reinicia o ciclo.
    existing.reps = 0;
    existing.intervalDays = 0;
    existing.ease = Math.max(1.3, existing.ease - 0.2);
    existing.due = Date.now();
    if (note) existing.lastNote = note;
  }
  persist(cache[fen]);
}

export function dueCards(now = Date.now()): Card[] {
  return Object.values(cache)
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due);
}

export function grade(fen: string, correct: boolean, now = Date.now()): void {
  const card = cache[fen];
  if (!card) return;
  if (!correct) {
    card.reps = 0;
    card.intervalDays = 0;
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.due = now + 600_000; // revê em ~10 min, ainda nesta sessão
  } else {
    card.reps += 1;
    if (card.reps === 1) card.intervalDays = 1;
    else if (card.reps === 2) card.intervalDays = 3;
    else card.intervalDays = Math.round(card.intervalDays * card.ease * 100) / 100;
    card.ease = Math.min(3.0, card.ease + 0.05);
    card.due = now + card.intervalDays * DAY_MS;
  }
  persist(card);
}

export function themeCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of Object.values(cache)) {
    counts[c.theme] = (counts[c.theme] ?? 0) + 1;
  }
  return counts;
}

export function totalCards(): number {
  return Object.keys(cache).length;
}
