// Julgamento pedagógico de um lance: quanto você perdeu vs. o melhor lance, e
// como classificar o erro. Porta direta de chess-coach/chess_coach/engine.py.

import { Chess } from "chess.js";
import type { ChessEngine } from "./engine";

export type MistakeLabel =
  | "ok"
  | "imprecisão"
  | "erro"
  | "erro grave";

export interface Judgement {
  cpLoss: number;
  label: MistakeLabel;
  bestMoveUci: string;
  bestSan: string;
  playedSan: string;
}

// Limiares em centipawns, alinhados em espírito com a análise do Lichess.
export function labelFor(cpLoss: number): MistakeLabel {
  if (cpLoss >= 300) return "erro grave";
  if (cpLoss >= 150) return "erro";
  if (cpLoss >= 60) return "imprecisão";
  return "ok";
}

// Converte um lance UCI em SAN a partir de um FEN (para exibição amigável).
function toSan(fen: string, uci: string): string {
  const game = new Chess(fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  const move = game.move({ from, to, promotion });
  return move ? move.san : uci;
}

// Julga `moveUci` na posição `fen` (antes do lance ser aplicado).
export async function judgeMove(
  engine: ChessEngine,
  fen: string,
  moveUci: string,
  depth = 12,
): Promise<Judgement> {
  // Avaliação se jogássemos o melhor lance.
  const base = await engine.analyse(fen, depth);
  const afterBest = new Chess(fen);
  afterBest.move({
    from: base.bestMove.slice(0, 2),
    to: base.bestMove.slice(2, 4),
    promotion: base.bestMove.length > 4 ? base.bestMove[4] : undefined,
  });
  const bestPov = -(await engine.analyse(afterBest.fen(), depth)).scoreCp;

  // Avaliação depois do SEU lance.
  const playedSan = toSan(fen, moveUci);
  const afterPlayed = new Chess(fen);
  afterPlayed.move({
    from: moveUci.slice(0, 2),
    to: moveUci.slice(2, 4),
    promotion: moveUci.length > 4 ? moveUci[4] : undefined,
  });
  const playedPov = -(await engine.analyse(afterPlayed.fen(), depth)).scoreCp;

  const cpLoss = Math.max(0, bestPov - playedPov);
  return {
    cpLoss,
    label: labelFor(cpLoss),
    bestMoveUci: base.bestMove,
    bestSan: toSan(fen, base.bestMove),
    playedSan,
  };
}

// Comentário de reserva, sem LLM. Modesto, mas sempre disponível — espelha o
// _heuristic_comment do Python.
export function heuristicComment(fen: string, j: Judgement): string {
  const parts: string[] = [];
  if (j.label === "erro grave") parts.push("Erro grave.");
  else if (j.label === "erro") parts.push("Erro.");
  else if (j.label === "imprecisão") parts.push("Pequena imprecisão.");

  const game = new Chess(fen);
  const tmp = new Chess(fen);
  const bestMoveObj = tmp.move({
    from: j.bestMoveUci.slice(0, 2),
    to: j.bestMoveUci.slice(2, 4),
    promotion: j.bestMoveUci.length > 4 ? j.bestMoveUci[4] : undefined,
  });

  if (tmp.isCheckmate()) {
    parts.push(`Havia mate com ${j.bestSan}.`);
  } else if (bestMoveObj && bestMoveObj.captured) {
    parts.push(`Você tinha a captura ${j.bestSan}, que ganhava material.`);
  } else if (tmp.isCheck()) {
    parts.push(`O xeque ${j.bestSan} era mais forte.`);
  } else {
    parts.push(`O motor preferia ${j.bestSan}.`);
  }

  parts.push(`(perda ~${j.cpLoss} centipawns)`);
  // `game` mantido para simetria com a versão Python; não altera a saída.
  void game;
  return parts.join(" ");
}
