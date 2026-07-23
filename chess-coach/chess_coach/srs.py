"""Repetição espaçada (algoritmo tipo SM-2) sobre os SEUS erros.

Cada erro que você comete numa partida vira um "card": a posição (FEN) e o lance
certo. O card volta para revisão em intervalos crescentes se você acerta, e é
reagendado para logo se você erra de novo. É a aplicação da curva de Ebbinghaus
ao conhecimento discreto (padrões táticos e de finais), onde a evidência mostra
que a técnica funciona bem.

Armazenamento: um único JSON em data/srs.json. Simples de inspecionar e versionar
mentalmente; sem banco de dados no MVP.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

_DAY = 86_400.0


@dataclass
class Card:
    fen: str                 # posição antes do lance certo
    best_san: str            # o lance a lembrar
    theme: str               # categoria (tatica, final, abertura, meio-jogo)
    ease: float = 2.5        # fator de facilidade do SM-2
    interval_days: float = 0.0
    reps: int = 0
    due: float = field(default_factory=time.time)
    created: float = field(default_factory=time.time)
    last_note: str = ""      # explicação pedagógica associada

    def key(self) -> str:
        return self.fen


class SRS:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.cards: dict[str, Card] = {}
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            raw = json.loads(self.path.read_text())
            self.cards = {k: Card(**v) for k, v in raw.items()}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {k: asdict(v) for k, v in self.cards.items()}
        self.path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    def add_mistake(self, fen: str, best_san: str, theme: str, note: str = "") -> None:
        """Registra (ou reforça) um erro. Repetir o mesmo erro o torna 'due' já."""
        card = self.cards.get(fen)
        if card is None:
            card = Card(fen=fen, best_san=best_san, theme=theme, last_note=note)
            self.cards[fen] = card
        else:
            # Errou de novo antes de dominar: reinicia o ciclo.
            card.reps = 0
            card.interval_days = 0.0
            card.ease = max(1.3, card.ease - 0.2)
            card.due = time.time()
            if note:
                card.last_note = note

    def due_cards(self, now: float | None = None) -> list[Card]:
        now = now if now is not None else time.time()
        return sorted(
            (c for c in self.cards.values() if c.due <= now),
            key=lambda c: c.due,
        )

    def grade(self, card: Card, correct: bool, now: float | None = None) -> None:
        """Atualiza um card após revisão. SM-2 simplificado (acertou/errou)."""
        now = now if now is not None else time.time()
        if not correct:
            card.reps = 0
            card.interval_days = 0.0
            card.ease = max(1.3, card.ease - 0.2)
            card.due = now + 600  # revê em ~10 min, ainda nesta sessão
            return
        card.reps += 1
        if card.reps == 1:
            card.interval_days = 1.0
        elif card.reps == 2:
            card.interval_days = 3.0
        else:
            card.interval_days = round(card.interval_days * card.ease, 2)
        card.ease = min(3.0, card.ease + 0.05)
        card.due = now + card.interval_days * _DAY

    # --- estatísticas para o maestro / status ---

    def theme_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for c in self.cards.values():
            counts[c.theme] = counts.get(c.theme, 0) + 1
        return counts

    def __len__(self) -> int:
        return len(self.cards)
