"""Sementes do currículo do jogo inteiro.

Estas são posições de partida para treino dirigido, uma por fase, ordenadas pelo
peso de impacto do desenho (táticas primeiro, finais ao fim mas fundamentais).
No MVP é uma lista curta e fixa; a intenção é que o maestro escolha DENTRE elas
com base nas suas fraquezas, e que mais tarde ela cresça a partir do Silman e de
bases de puzzles.

Cada semente tem: tema, um FEN de início, o lado que você joga, e uma descrição.
Um FEN None significa "comece da posição inicial padrão" (partida livre).
"""

from __future__ import annotations

from dataclasses import dataclass

import chess


@dataclass
class Seed:
    theme: str
    description: str
    fen: str | None       # None = posição inicial padrão
    you_play: bool        # True = você joga de brancas

    def board(self) -> chess.Board:
        return chess.Board() if self.fen is None else chess.Board(self.fen)


# Peso de impacto (do desenho): tatica > proprias-partidas > meio-jogo >
# abertura > final. As sementes cobrem cada fase com um exemplo canônico.
SEEDS: list[Seed] = [
    Seed(
        theme="tatica",
        description="Garfo de cavalo: encontre o lance que ataca rei e torre.",
        # Brancas jogam Nxc7+ garfando rei em e8 e torre em a8 (validado com o motor).
        fen="r3k2r/ppp2ppp/8/1N6/8/8/PPP2PPP/4K3 w kq - 0 1",
        you_play=True,
    ),
    Seed(
        theme="final",
        description="Rei e peão vs. rei: conduza o peão à promoção (oposição).",
        fen="8/8/8/4k3/8/4P3/4K3/8 w - - 0 1",
        you_play=True,
    ),
    Seed(
        theme="meio-jogo",
        description="Partida livre: foco em não deixar peças penduradas.",
        fen=None,
        you_play=True,
    ),
    Seed(
        theme="abertura",
        description="Desenvolva com princípios: centro, peças menores, roque.",
        fen=None,
        you_play=True,
    ),
]


def seed_for_theme(theme: str) -> Seed:
    for s in SEEDS:
        if s.theme == theme:
            return s
    return SEEDS[0]
