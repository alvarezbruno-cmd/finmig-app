"""Wrapper do Stockfish: um único motor cumpre dois papéis.

- ANALISTA: força total, usado para avaliar posições e detectar seus erros.
- ADVERSÁRIO: força limitada por Elo, para jogar como um humano do seu nível
  (substituto da Maia enquanto downloads externos estiverem bloqueados).

Mantemos duas instâncias separadas porque configurar UCI_LimitStrength no motor
de análise contaminaria as avaliações que usamos para julgar seus lances.
"""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass

import chess
import chess.engine

# Locais comuns onde o binário do Stockfish costuma ficar. `/usr/games` é onde o
# pacote Debian/Ubuntu instala, e ele normalmente não está no PATH.
_CANDIDATES = [
    "stockfish",
    "/usr/games/stockfish",
    "/usr/local/bin/stockfish",
    "/usr/bin/stockfish",
    "/opt/homebrew/bin/stockfish",
]


def find_stockfish() -> str:
    """Retorna o caminho do binário do Stockfish ou levanta um erro claro."""
    override = os.environ.get("STOCKFISH_PATH")
    if override and os.path.exists(override):
        return override
    for cand in _CANDIDATES:
        found = shutil.which(cand) if os.path.basename(cand) == cand else cand
        if found and os.path.exists(found):
            return found
    raise FileNotFoundError(
        "Stockfish não encontrado. Instale (apt-get install stockfish) ou "
        "defina STOCKFISH_PATH apontando para o binário."
    )


@dataclass
class Judgement:
    """Resultado de comparar seu lance com o melhor lance do motor.

    cp_loss: quantos centipawns você perdeu vs. o melhor lance (do seu ponto de
             vista). 100 cp ~ um peão.
    label:   classificação pedagógica do erro.
    best_move / best_san: o lance que o motor preferia.
    """

    cp_loss: int
    label: str
    best_move: chess.Move
    best_san: str
    played_san: str


# Limiares em centipawns para classificar um lance. Alinhados, em espírito, com a
# nomenclatura de análise do Lichess.
_THRESHOLDS = [
    (300, "erro grave"),      # blunder
    (150, "erro"),            # mistake
    (60, "imprecisão"),       # inaccuracy
    (0, "ok"),
]


def _label_for(cp_loss: int) -> str:
    for limit, label in _THRESHOLDS:
        if cp_loss >= limit:
            return label
    return "ok"


class Coach:
    """Detém o motor analista de força total."""

    def __init__(self, depth: int = 14):
        self.depth = depth
        self._engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())

    def close(self) -> None:
        try:
            self._engine.quit()
        except Exception:
            pass

    def __enter__(self) -> "Coach":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _score_cp(self, board: chess.Board) -> int:
        """Avaliação da posição em centipawns, do ponto de vista de quem joga."""
        info = self._engine.analyse(board, chess.engine.Limit(depth=self.depth))
        score = info["score"].pov(board.turn)
        # Mate é convertido para um valor grande mas finito para a aritmética.
        return score.score(mate_score=100_000)

    def best_move(self, board: chess.Board) -> chess.Move:
        result = self._engine.play(board, chess.engine.Limit(depth=self.depth))
        return result.move

    def judge(self, board: chess.Board, move: chess.Move) -> Judgement:
        """Julga `move` na posição `board` (antes do lance ser aplicado)."""
        # Avaliação da posição se jogássemos o melhor lance.
        best = self.best_move(board)
        board.push(best)
        best_pov = -self._score_cp(board)  # negamos: agora é a vez do oponente
        board.pop()

        # Avaliação da posição depois do SEU lance.
        played_san = board.san(move)
        best_san = board.san(best)
        board.push(move)
        played_pov = -self._score_cp(board)
        board.pop()

        cp_loss = max(0, best_pov - played_pov)
        return Judgement(
            cp_loss=cp_loss,
            label=_label_for(cp_loss),
            best_move=best,
            best_san=best_san,
            played_san=played_san,
        )


class Opponent:
    """Motor adversário com força limitada por Elo (sparring realista)."""

    def __init__(self, elo: int = 1400, think_time: float = 0.15):
        self.elo = elo
        self.think_time = think_time
        self._engine = chess.engine.SimpleEngine.popen_uci(find_stockfish())
        # Stockfish aceita 1320..3190 em UCI_Elo.
        clamped = max(1320, min(3190, elo))
        self._engine.configure({"UCI_LimitStrength": True, "UCI_Elo": clamped})

    def play(self, board: chess.Board) -> chess.Move:
        result = self._engine.play(
            board, chess.engine.Limit(time=self.think_time)
        )
        return result.move

    def close(self) -> None:
        try:
            self._engine.quit()
        except Exception:
            pass

    def __enter__(self) -> "Opponent":
        return self

    def __exit__(self, *exc) -> None:
        self.close()
