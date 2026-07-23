"""Modo de revisão: os SEUS erros voltam como flashcards quando estão 'due'.

Mostra a posição em que você errou e pede o lance certo. Acertou → o intervalo
cresce; errou → volta logo. É a metade 'estudo' do ciclo, complementar às
partidas.
"""

from __future__ import annotations

import chess

from .srs import SRS


def run_review(srs: SRS, limit: int = 20) -> None:
    due = srs.due_cards()
    if not due:
        print("Nenhum card para revisar agora. Jogue uma partida para gerar "
              "material, ou volte mais tarde.")
        return

    due = due[:limit]
    print(f"{len(due)} card(s) para revisar. Digite o melhor lance (SAN/UCI), "
          "ou 'pular'.\n")

    correct_count = 0
    for i, card in enumerate(due, 1):
        board = chess.Board(card.fen)
        print(f"[{i}/{len(due)}] tema: {card.theme}")
        print(board.unicode(borders=False, empty_square="."))
        answer = input("Melhor lance: ").strip()

        if answer.lower() in {"pular", "skip", "s"}:
            srs.grade(card, correct=False)
            print(f"  Resposta: {card.best_san}")
            if card.last_note:
                print(f"  Lembrete: {card.last_note}")
            continue

        correct = _matches(board, answer, card.best_san)
        if correct:
            correct_count += 1
            print("  ✓ Correto.")
        else:
            print(f"  ✗ O certo era {card.best_san}.")
            if card.last_note:
                print(f"  Lembrete: {card.last_note}")
        srs.grade(card, correct=correct)

    srs.save()
    print(f"\nRevisão concluída: {correct_count}/{len(due)} corretos.")


def _matches(board: chess.Board, answer: str, best_san: str) -> bool:
    """Confere se `answer` (SAN ou UCI) é o lance `best_san`."""
    try:
        target = board.parse_san(best_san)
    except ValueError:
        return False
    for parser in (board.parse_san, board.parse_uci):
        try:
            mv = parser(answer)
            if mv == target:
                return True
        except (ValueError, chess.InvalidMoveError,
                chess.IllegalMoveError, chess.AmbiguousMoveError):
            continue
    return False
