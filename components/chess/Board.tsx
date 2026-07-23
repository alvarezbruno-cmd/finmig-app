"use client";

// Tabuleiro tocável e responsivo. Sem dependência de biblioteca de board (evita
// conflitos de peer-deps com React 19): 8x8 em CSS grid, peças em Unicode, toque
// para selecionar a origem e tocar de novo para o destino. chess.js valida.

import { Chess, type Square } from "chess.js";
import { useMemo, useState } from "react";

const PIECE_GLYPH: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  interactive: boolean;
  lastMove?: { from: string; to: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
}

export default function Board({
  fen,
  orientation,
  interactive,
  lastMove,
  onMove,
}: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const game = useMemo(() => new Chess(fen), [fen]);

  // Destinos legais a partir da casa selecionada (para destacar).
  const legalTargets = useMemo(() => {
    if (!selected) return new Set<string>();
    const moves = game.moves({ square: selected as Square, verbose: true });
    return new Set(moves.map((m) => m.to));
  }, [game, selected]);

  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();

  function handleTap(square: string) {
    if (!interactive) return;
    const piece = game.get(square as Square);

    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      // Tentativa de lance para a casa tocada.
      if (legalTargets.has(square)) {
        // Promoção: se um peão chega à última fileira, promove a dama (padrão).
        const moving = game.get(selected as Square);
        const isPromotion =
          moving?.type === "p" &&
          (square[1] === "8" || square[1] === "1");
        onMove(selected, square, isPromotion ? "q" : undefined);
        setSelected(null);
        return;
      }
      // Tocou em outra peça própria: muda a seleção.
      if (piece && piece.color === game.turn()) {
        setSelected(square);
        return;
      }
      setSelected(null);
      return;
    }

    // Nada selecionado: só seleciona peça do lado que está para jogar.
    if (piece && piece.color === game.turn()) {
      setSelected(square);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        aspectRatio: "1 / 1",
        border: "2px solid #334155",
        borderRadius: 8,
        overflow: "hidden",
        touchAction: "manipulation",
        userSelect: "none",
      }}
    >
      {ranks.map((rank, r) =>
        files.map((file, f) => {
          const square = `${file}${rank}`;
          const piece = game.get(square as Square);
          const isDark = (r + f) % 2 === 1;
          const isSelected = selected === square;
          const isTarget = legalTargets.has(square);
          const isLast =
            lastMove && (lastMove.from === square || lastMove.to === square);

          let bg = isDark ? "#7c8aa5" : "#dbe2ea";
          if (isLast) bg = isDark ? "#a3ad6b" : "#cdd884";
          if (isSelected) bg = "#7bb37b";

          return (
            <div
              key={square}
              data-square={square}
              onClick={() => handleTap(square)}
              style={{
                position: "relative",
                background: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "clamp(20px, 8vw, 40px)",
                lineHeight: 1,
                cursor: interactive ? "pointer" : "default",
                color: piece && piece.color === "w" ? "#f8fafc" : "#0f172a",
                textShadow:
                  piece && piece.color === "w"
                    ? "0 0 1px #000, 0 1px 2px rgba(0,0,0,.4)"
                    : "none",
              }}
            >
              {piece ? PIECE_GLYPH[
                piece.color === "w"
                  ? piece.type.toUpperCase()
                  : piece.type
              ] : ""}
              {isTarget && (
                <span
                  style={{
                    position: "absolute",
                    width: piece ? "100%" : "34%",
                    height: piece ? "100%" : "34%",
                    borderRadius: "50%",
                    boxSizing: "border-box",
                    background: piece ? "transparent" : "rgba(15,23,42,.35)",
                    border: piece ? "4px solid rgba(15,23,42,.4)" : "none",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
