"use client";

// Coach de xadrez para o celular: você joga contra o Stockfish (Elo limitado),
// e a cada lance seu o motor em força total detecta erros, explica em português
// e arquiva o erro para revisão espaçada. Tudo roda no navegador.

import { Chess } from "chess.js";
import { useCallback, useEffect, useRef, useState } from "react";
import Board from "@/components/chess/Board";
import { ChessEngine } from "@/lib/chess/engine";
import { heuristicComment, judgeMove, type Judgement } from "@/lib/chess/coach";
import { chooseFocus } from "@/lib/chess/maestro";
import {
  addMistake,
  dueCards,
  grade,
  hydrateChess,
  themeCounts,
  totalCards,
  type Card,
  type Theme,
} from "@/lib/chess/srs";

const OPPONENT_ELO = 1400;
const DEPTH = 12;

type Msg = { kind: "info" | "warn" | "good"; text: string };
type Mode = "idle" | "play" | "review";

// Pede a explicação ao Claude (rota /api/chess/narrate); cai para a heurística
// local se não houver chave ou a rede falhar.
async function explain(fen: string, j: Judgement): Promise<string> {
  try {
    const res = await fetch("/api/chess/narrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fen,
        playedSan: j.playedSan,
        bestSan: j.bestSan,
        label: j.label,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { text?: string };
      if (data.text) return data.text;
    }
  } catch {
    /* usa heurística abaixo */
  }
  return heuristicComment(fen, j);
}

export default function ChessCoachPage() {
  const engineRef = useRef<ChessEngine | null>(null);
  const gameRef = useRef<Chess>(new Chess());
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [fen, setFen] = useState(gameRef.current.fen());
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [theme, setTheme] = useState<Theme>("tatica");
  const [description, setDescription] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [reviewCard, setReviewCard] = useState<Card | null>(null);
  const [stats, setStats] = useState({ total: 0, due: 0, counts: {} as Record<string, number> });

  const refreshStats = useCallback(() => {
    setStats({ total: totalCards(), due: dueCards().length, counts: themeCounts() });
  }, []);

  const pushMsg = useCallback((m: Msg) => {
    setMessages((prev) => [m, ...prev].slice(0, 12));
  }, []);

  // Inicializa o motor WASM e carrega o progresso do usuário (Supabase) uma vez.
  useEffect(() => {
    const engine = new ChessEngine();
    engineRef.current = engine;
    Promise.all([engine.init(), hydrateChess()]).then(() => {
      setReady(true);
      refreshStats();
    });
    return () => engine.dispose();
  }, [refreshStats]);

  const startGame = useCallback(() => {
    const focus = chooseFocus();
    const game = new Chess(focus.seed.fen);
    gameRef.current = game;
    setMode("play");
    setTheme(focus.theme);
    setDescription(focus.seed.description);
    setOrientation(focus.seed.youWhite ? "white" : "black");
    setFen(game.fen());
    setLastMove(null);
    setReviewCard(null);
    setGameOver(false);
    setMessages([{ kind: "info", text: focus.reason }]);
  }, []);

  const opponentMove = useCallback(async () => {
    const engine = engineRef.current;
    const game = gameRef.current;
    if (!engine || game.isGameOver()) return;
    setThinking(true);
    const uci = await engine.playAtElo(game.fen(), OPPONENT_ELO, 200);
    if (uci) {
      const mv = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (mv) {
        setFen(game.fen());
        setLastMove({ from: mv.from, to: mv.to });
        pushMsg({ kind: "info", text: `Oponente: ${mv.san}` });
      }
    }
    setThinking(false);
  }, [pushMsg]);

  const handlePlayMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      const engine = engineRef.current;
      const game = gameRef.current;
      if (!engine) return;

      const fenBefore = game.fen();
      const uci = from + to + (promotion ?? "");

      setThinking(true);
      const j = await judgeMove(engine, fenBefore, uci, DEPTH);

      const mv = game.move({ from, to, promotion });
      if (!mv) {
        setThinking(false);
        return;
      }
      setFen(game.fen());
      setLastMove({ from: mv.from, to: mv.to });

      if (j.label !== "ok") {
        const note = await explain(fenBefore, j);
        pushMsg({ kind: "warn", text: `⚠ ${mv.san}: ${note}` });
        addMistake(fenBefore, j.bestSan, theme, note);
        refreshStats();
      } else {
        pushMsg({ kind: "good", text: `Você: ${mv.san} — bom lance.` });
      }
      setThinking(false);

      if (game.isGameOver()) {
        setGameOver(true);
        pushMsg({ kind: "info", text: `Fim: ${resultText(game)}` });
        return;
      }
      await opponentMove();
      if (gameRef.current.isGameOver()) {
        setGameOver(true);
        pushMsg({ kind: "info", text: `Fim: ${resultText(gameRef.current)}` });
      }
    },
    [theme, pushMsg, refreshStats, opponentMove],
  );

  const loadReviewCard = useCallback((card: Card) => {
    gameRef.current = new Chess(card.fen);
    setReviewCard(card);
    setFen(card.fen);
    setLastMove(null);
    setOrientation(gameRef.current.turn() === "w" ? "white" : "black");
  }, []);

  const startReview = useCallback(() => {
    const due = dueCards();
    if (due.length === 0) {
      pushMsg({ kind: "info", text: "Nenhum card para revisar agora. Jogue para gerar material." });
      return;
    }
    setMode("review");
    setGameOver(false);
    setDescription("Revisão espaçada — reencontre o melhor lance.");
    loadReviewCard(due[0]);
    setMessages([{ kind: "info", text: `Revisão (${due[0].theme}): qual o melhor lance?` }]);
  }, [pushMsg, loadReviewCard]);

  const handleReviewMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const card = reviewCard;
      if (!card) return;
      const probe = new Chess(card.fen);
      const mv = probe.move({ from, to, promotion });
      const correct = !!mv && mv.san === card.bestSan;
      grade(card.fen, correct);
      if (correct) {
        pushMsg({ kind: "good", text: "✓ Correto." });
      } else {
        pushMsg({ kind: "warn", text: `✗ O certo era ${card.bestSan}.` });
        if (card.lastNote) pushMsg({ kind: "info", text: card.lastNote });
      }
      refreshStats();
      const next = dueCards().find((c) => c.fen !== card.fen) ?? null;
      if (next) {
        loadReviewCard(next);
        pushMsg({ kind: "info", text: `Próximo (${next.theme}): qual o melhor lance?` });
      } else {
        setReviewCard(null);
        setMode("idle");
        pushMsg({ kind: "info", text: "Revisão concluída." });
      }
    },
    [reviewCard, pushMsg, refreshStats, loadReviewCard],
  );

  const interactive =
    ready &&
    !thinking &&
    ((mode === "play" && !gameOver) || (mode === "review" && reviewCard !== null));

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Coach de Xadrez</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
        {ready ? "Motor pronto." : "Carregando motor (Stockfish)…"}
      </p>

      {description && (
        <div style={{ fontSize: 13, background: "#f1f5f9", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
          {mode === "play" && <strong>{theme} — </strong>}
          {description}
        </div>
      )}

      <Board
        fen={fen}
        orientation={orientation}
        interactive={interactive}
        lastMove={lastMove}
        onMove={mode === "review" ? handleReviewMove : handlePlayMove}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={startGame} disabled={!ready} style={btn}>Nova partida</button>
        <button onClick={startReview} disabled={!ready} style={btnAlt}>Revisar ({stats.due})</button>
        <button onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))} style={btnAlt}>Girar</button>
      </div>

      {thinking && <p style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>Pensando…</p>}

      <div style={{ marginTop: 14 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              fontSize: 13,
              padding: "6px 10px",
              marginBottom: 6,
              borderRadius: 6,
              background: m.kind === "warn" ? "#fef3c7" : m.kind === "good" ? "#dcfce7" : "#f1f5f9",
              color: "#0f172a",
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      <footer style={{ fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
        Cards: {stats.total} · para revisar: {stats.due}
      </footer>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#0f172a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const btnAlt: React.CSSProperties = { ...btn, background: "#e2e8f0", color: "#0f172a" };

function resultText(game: Chess): string {
  if (game.isCheckmate()) return "xeque-mate";
  if (game.isStalemate()) return "afogamento (empate)";
  if (game.isInsufficientMaterial()) return "material insuficiente (empate)";
  if (game.isDraw()) return "empate";
  return game.isGameOver() ? "fim" : "em andamento";
}
