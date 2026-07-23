"""Camada pedagógica: traduz um erro em uma frase de português simples.

Segue o princípio do desenho: *feedback narrativo > número cru*. Uma perda de
120 centipawns não ensina nada; "você deixou o cavalo sem defesa" ensina.

Usa a API do Claude quando há chave (ANTHROPIC_API_KEY); caso contrário, degrada
graciosamente para um comentário baseado em heurística, para que a ferramenta
continue 100% utilizável offline / sem chave.
"""

from __future__ import annotations

import json
import os
import urllib.request

import chess

from .engine import Judgement

_MODEL = "claude-sonnet-5"
_API_URL = "https://api.anthropic.com/v1/messages"


def _heuristic_comment(board: chess.Board, j: Judgement) -> str:
    """Comentário de reserva, sem LLM. Modesto, mas sempre disponível.

    `board` é a posição ANTES do seu lance.
    """
    parts = []
    if j.label == "erro grave":
        parts.append("Erro grave.")
    elif j.label == "erro":
        parts.append("Erro.")
    elif j.label == "imprecisão":
        parts.append("Pequena imprecisão.")

    # Heurística simples: o melhor lance era uma captura? dava xeque? era mate?
    tmp = board.copy()
    tmp.push(j.best_move)
    if tmp.is_checkmate():
        parts.append(f"Havia mate com {j.best_san}.")
    elif board.is_capture(j.best_move):
        parts.append(f"Você tinha a captura {j.best_san}, que ganhava material.")
    elif tmp.is_check():
        parts.append(f"O xeque {j.best_san} era mais forte.")
    else:
        parts.append(f"O motor preferia {j.best_san}.")

    parts.append(f"(perda ~{j.cp_loss} centipawns)")
    return " ".join(parts)


def _claude_comment(board: chess.Board, j: Judgement) -> str | None:
    """Pede ao Claude uma explicação de UMA frase. Retorna None se indisponível."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    prompt = (
        "Você é um treinador de xadrez paciente. O aluno acabou de jogar um lance "
        "sub-ótimo. Explique em UMA única frase, em português simples e sem jargão "
        "excessivo, QUAL CONCEITO ele violou e por que o lance recomendado é "
        "melhor. Não repita a avaliação numérica. Seja concreto.\n\n"
        f"Posição (FEN, antes do lance dele): {board.fen()}\n"
        f"Lance que ele jogou: {j.played_san}\n"
        f"Melhor lance: {j.best_san}\n"
        f"Classificação do erro: {j.label}\n"
    )
    body = json.dumps(
        {
            "model": _MODEL,
            "max_tokens": 150,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode()

    req = urllib.request.Request(
        _API_URL,
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return data["content"][0]["text"].strip()
    except Exception:
        # Rede, chave inválida, rate limit: nunca derrube a sessão de treino.
        return None


def explain(board: chess.Board, j: Judgement) -> str:
    """Explicação pedagógica do erro `j` na posição `board` (antes do lance).

    Tenta o Claude; cai para a heurística. Sempre retorna algo útil.
    """
    if j.label == "ok":
        return ""
    return _claude_comment(board, j) or _heuristic_comment(board, j)
