"""CLI do chess-coach.

Comandos:
  play    Joga uma partida de treino; o maestro escolhe o foco (ou use --theme).
  review  Revisa seus erros que estão 'due' (repetição espaçada).
  status  Mostra seu perfil de erros e o foco recomendado.

Rode com:  python -m chess_coach <comando>
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .curriculum import seed_for_theme
from .game import play_game
from .maestro import all_themes, choose_focus
from .review import run_review
from .srs import SRS

_DATA = Path(__file__).resolve().parent.parent / "data" / "srs.json"


def _srs() -> SRS:
    return SRS(_DATA)


def cmd_play(args: argparse.Namespace) -> None:
    srs = _srs()
    if args.theme:
        theme = args.theme
        seed = seed_for_theme(theme)
        print(f"Foco escolhido por você: {theme}")
    else:
        focus = choose_focus(srs)
        theme, seed = focus.theme, focus.seed
        print(f"Maestro: {focus.reason}")
    print(f"Cenário: {seed.description}")
    board = seed.board()
    play_game(
        srs=srs,
        theme=theme,
        board=board,
        you_white=seed.you_play,
        opponent_elo=args.elo,
        depth=args.depth,
    )


def cmd_review(args: argparse.Namespace) -> None:
    run_review(_srs(), limit=args.limit)


def cmd_status(args: argparse.Namespace) -> None:
    srs = _srs()
    counts = srs.theme_counts()
    due = srs.due_cards()
    print(f"Cards no total: {len(srs)}")
    print(f"Para revisar agora: {len(due)}")
    if counts:
        print("\nErros por tema:")
        for theme, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            print(f"  {theme:12} {n}")
    focus = choose_focus(srs)
    print(f"\nFoco recomendado: {focus.theme}")
    print(f"  {focus.reason}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="chess_coach",
        description="Máquina local que joga e ensina xadrez (Stockfish + Claude).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_play = sub.add_parser("play", help="jogar uma partida de treino")
    p_play.add_argument("--theme", choices=all_themes(), default=None,
                        help="força um tema; sem isso, o maestro escolhe")
    p_play.add_argument("--elo", type=int, default=1400,
                        help="força do oponente em Elo (1320-3190)")
    p_play.add_argument("--depth", type=int, default=14,
                        help="profundidade de análise do Stockfish")
    p_play.set_defaults(func=cmd_play)

    p_review = sub.add_parser("review", help="revisar seus erros (SRS)")
    p_review.add_argument("--limit", type=int, default=20)
    p_review.set_defaults(func=cmd_review)

    p_status = sub.add_parser("status", help="ver seu perfil de erros e foco")
    p_status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
