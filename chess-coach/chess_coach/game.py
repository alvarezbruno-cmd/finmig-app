"""O laço de jogo no terminal + detecção de erros ao vivo.

Você joga contra o adversário de Elo limitado. Depois de CADA lance seu, o
analista de força total julga o lance; se foi um erro, você recebe uma explicação
em português e o erro entra na fila de repetição espaçada. É o ciclo central do
desenho: praticar + detectar + explicar + reagendar.

Entrada de lances: aceita SAN (Cf3, exd5, O-O) ou UCI (g1f3). Comandos especiais:
  dica   -> mostra o melhor lance segundo o motor
  voltar -> desfaz seu último lance e o do oponente
  sair   -> encerra a partida
"""

from __future__ import annotations

import chess

from .engine import Coach, Opponent
from .narrate import explain
from .srs import SRS


def _read_move(board: chess.Board, prompt: str) -> chess.Move | str:
    """Lê um lance do usuário. Retorna um chess.Move ou um comando (str)."""
    while True:
        raw = input(prompt).strip()
        if not raw:
            continue
        low = raw.lower()
        if low in {"sair", "quit", "q", "voltar", "undo", "dica", "hint"}:
            return low
        # Tenta SAN primeiro, depois UCI.
        for parser in (board.parse_san, board.parse_uci):
            try:
                mv = parser(raw)
                if mv in board.legal_moves:
                    return mv
            except (ValueError, chess.InvalidMoveError,
                    chess.IllegalMoveError, chess.AmbiguousMoveError):
                continue
        print("  Lance inválido. Use SAN (Cf3, exd5, O-O) ou UCI (g1f3).")


def play_game(
    srs: SRS,
    theme: str,
    board: chess.Board,
    you_white: bool,
    opponent_elo: int = 1400,
    depth: int = 14,
) -> None:
    print(f"\nTreino: {theme} | você joga de "
          f"{'brancas' if you_white else 'pretas'} | oponente ~{opponent_elo} Elo")
    print("Comandos: 'dica', 'voltar', 'sair'.\n")
    print(board.unicode(borders=False, empty_square="."))

    with Coach(depth=depth) as coach, Opponent(elo=opponent_elo) as opp:
        # Se o oponente move primeiro (você de pretas na posição inicial).
        if board.turn != (chess.WHITE if you_white else chess.BLACK):
            mv = opp.play(board)
            print(f"\nOponente: {board.san(mv)}")
            board.push(mv)
            print(board.unicode(borders=False, empty_square="."))

        while not board.is_game_over():
            action = _read_move(board, "\nSeu lance: ")

            if action == "sair" or action == "quit" or action == "q":
                print("Partida encerrada.")
                break
            if action in {"dica", "hint"}:
                best = coach.best_move(board)
                print(f"  Dica: {board.san(best)}")
                continue
            if action in {"voltar", "undo"}:
                if len(board.move_stack) >= 2:
                    board.pop()
                    board.pop()
                    print(board.unicode(borders=False, empty_square="."))
                else:
                    print("  Nada para desfazer.")
                continue

            # É um lance legal seu: julgamos ANTES de aplicar.
            move = action
            fen_before = board.fen()
            j = coach.judge(board, move)
            if j.label != "ok":
                note = explain(board, j)
                print(f"  ⚠ {note}")
                # Registra o erro para revisão espaçada.
                srs.add_mistake(
                    fen=fen_before,
                    best_san=j.best_san,
                    theme=theme,
                    note=note,
                )
                srs.save()

            board.push(move)
            print(f"\nVocê: {j.played_san}")
            print(board.unicode(borders=False, empty_square="."))

            if board.is_game_over():
                break

            # Resposta do oponente.
            mv = opp.play(board)
            print(f"\nOponente: {board.san(mv)}")
            board.push(mv)
            print(board.unicode(borders=False, empty_square="."))

    print(f"\nResultado: {board.result()}  ({_outcome_text(board)})")


def _outcome_text(board: chess.Board) -> str:
    if board.is_checkmate():
        return "xeque-mate"
    if board.is_stalemate():
        return "afogamento (empate)"
    if board.is_insufficient_material():
        return "material insuficiente (empate)"
    if board.can_claim_draw():
        return "empate reclamável"
    if not board.is_game_over():
        return "interrompida"
    return "fim"
