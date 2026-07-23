"""O maestro: decide o foco da próxima sessão a partir do SEU histórico.

Esta é a peça que transforma componentes soltos numa 'máquina que ensina'. Em vez
de um currículo fixo, ele olha onde você mais erra (via contagem de temas no SRS)
e aponta a fase que precisa de trabalho. É a materialização da espinha adaptativa
do desenho: a máquina descobre sua fraqueza em vez de adivinhá-la.

MVP: heurística de contagem. Evolui depois para pesos por gravidade e recência.
"""

from __future__ import annotations

from dataclasses import dataclass

from .curriculum import SEEDS, Seed, seed_for_theme
from .srs import SRS

# Ordem de prioridade quando ainda não há histórico suficiente (do desenho:
# táticas dão o maior retorno, sobretudo no início).
_DEFAULT_PRIORITY = ["tatica", "meio-jogo", "abertura", "final"]


@dataclass
class Focus:
    theme: str
    reason: str
    seed: Seed


def choose_focus(srs: SRS) -> Focus:
    counts = srs.theme_counts()

    if not counts:
        theme = _DEFAULT_PRIORITY[0]
        return Focus(
            theme=theme,
            reason="Sem histórico ainda — começamos por táticas, onde está o "
            "maior retorno de aprendizado.",
            seed=seed_for_theme(theme),
        )

    # Fase onde você acumulou mais erros = onde treinar.
    theme = max(counts, key=lambda t: counts[t])
    n = counts[theme]
    return Focus(
        theme=theme,
        reason=f"Você acumulou {n} erro(s) em '{theme}' — é onde vamos focar.",
        seed=seed_for_theme(theme),
    )


def all_themes() -> list[str]:
    return [s.theme for s in SEEDS]
