// Sementes do currículo do jogo inteiro, ordenadas por peso de impacto (táticas
// primeiro). Porta de chess-coach/chess_coach/curriculum.py.

import type { Theme } from "./srs";

export interface Seed {
  theme: Theme;
  description: string;
  fen: string; // posição inicial do treino
  youWhite: boolean;
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const SEEDS: Seed[] = [
  {
    theme: "tatica",
    description: "Peça pendurada: a dama preta está sem defesa — capture-a.",
    // Brancas jogam Nxd7 capturando a dama de graça (margem enorme, validado).
    fen: "6k1/1p1q1p1p/8/4N3/8/8/PP3PPP/6K1 w - - 0 1",
    youWhite: true,
  },
  {
    theme: "final",
    description: "Rei e peão vs. rei: conduza o peão à promoção (oposição).",
    fen: "8/8/8/4k3/8/4P3/4K3/8 w - - 0 1",
    youWhite: true,
  },
  {
    theme: "meio-jogo",
    description: "Partida livre: foco em não deixar peças penduradas.",
    fen: START,
    youWhite: true,
  },
  {
    theme: "abertura",
    description: "Desenvolva com princípios: centro, peças menores, roque.",
    fen: START,
    youWhite: true,
  },
];

export function seedForTheme(theme: Theme): Seed {
  return SEEDS.find((s) => s.theme === theme) ?? SEEDS[0];
}

export function allThemes(): Theme[] {
  return SEEDS.map((s) => s.theme);
}
