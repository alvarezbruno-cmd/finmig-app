# chess-coach

Máquina local que **joga e ensina xadrez**, em português, do jeito baseado em
evidências que combinamos em [`docs/chess-teaching-machine.md`](../docs/chess-teaching-machine.md).

Este é o MVP (esboço de fim de semana): as peças caras já vêm prontas
(Stockfish para avaliação e adversário), e o que construímos por cima é a
**camada de ensino** — detectar seus erros, explicá-los em uma frase, e
reagendá-los por repetição espaçada.

## O que já faz

- **Joga contra você** com um adversário de força limitada por Elo (substituto
  da Maia enquanto downloads externos estão bloqueados).
- **Detecta seus erros ao vivo**: depois de cada lance seu, o Stockfish em força
  total julga quanto você perdeu e classifica (imprecisão / erro / erro grave).
- **Explica o porquê** em uma frase de português simples. Usa a API do Claude se
  houver chave; senão, cai para um comentário heurístico (funciona sem chave).
- **Repetição espaçada dos seus erros**: cada erro vira um flashcard (algoritmo
  tipo SM-2) que volta para revisão em intervalos crescentes.
- **Maestro adaptativo**: escolhe o foco da próxima sessão a partir da fase em
  que você mais erra — a espinha adaptativa do desenho.

## Instalação

Requer Python 3.11+ e o binário do Stockfish.

```bash
# Stockfish (Debian/Ubuntu):
sudo apt-get install -y stockfish        # instala em /usr/games/stockfish

cd chess-coach
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Se o Stockfish estiver em outro lugar, aponte com `STOCKFISH_PATH=/caminho/stockfish`.

Para a explicação via Claude (opcional — sem isso usa a heurística):

```bash
export ANTHROPIC_API_KEY=sua-chave
```

## Uso

```bash
# jogar uma partida de treino (o maestro escolhe o foco)
.venv/bin/python -m chess_coach play

# forçar um tema e a força do oponente
.venv/bin/python -m chess_coach play --theme tatica --elo 1500

# revisar seus erros que estão 'due' (repetição espaçada)
.venv/bin/python -m chess_coach review

# ver seu perfil de erros e o foco recomendado
.venv/bin/python -m chess_coach status
```

Durante a partida, digite lances em SAN (`Cf3`, `exd5`, `O-O`) ou UCI (`g1f3`).
Comandos: `dica`, `voltar`, `sair`.

Seus dados de progresso ficam em `chess-coach/data/srs.json` (fora do git).

## Arquitetura (mapa dos arquivos)

| Arquivo | Papel |
|---|---|
| `engine.py` | Wrapper do Stockfish: analista (força total) + adversário (Elo limitado) |
| `game.py` | Laço de jogo no terminal + detecção de erros ao vivo |
| `narrate.py` | Explicação pedagógica (Claude com fallback heurístico) |
| `srs.py` | Repetição espaçada (SM-2) sobre os seus erros |
| `curriculum.py` | Sementes de treino por fase do jogo |
| `maestro.py` | Escolhe o foco da sessão a partir do seu histórico |
| `review.py` | Modo flashcard dos erros 'due' |
| `__main__.py` | CLI (`play` / `review` / `status`) |

## Próximos passos (quando liberarmos rede externa)

- **Maia** como adversário de verdade (joga *como humano*, erra como humano), via
  lc0 + pesos — hoje bloqueado por download.
- **Tablebase do Lichess** para verdade perfeita nos finais (hoje 403 no proxy).
- **Base pública de puzzles** do Lichess para alimentar o módulo de táticas.
- **Análise de partidas suas importadas** (PGN) para popular o maestro sem você
  precisar jogar dentro da ferramenta.
- Currículo de finais estruturado a partir do **Silman's Complete Endgame
  Course** (progressão por rating).
