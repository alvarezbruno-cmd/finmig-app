# Máquina de ensinar (e jogar) xadrez — desenho

Documento de ideias e registro do desenho. Objetivo do usuário: uma máquina que
jogue *e* ensine a jogar melhor, **grátis**, **baseada em evidências**, cobrindo
**o jogo inteiro** (não só finais).

> **Estado atual:** existem duas implementações do mesmo desenho.
> - **`chess-coach/`** — protótipo/CLI em Python (referência).
> - **`app/chess/`** — **versão web para o celular** (Next.js). Stockfish roda no
>   navegador via WASM (`public/stockfish/`, variante *lite-single* que dispensa
>   isolamento cross-origin no Safari), a lógica de coaching está em `lib/chess/`,
>   e a narração usa o Claude via `app/api/chess/narrate`. Motor + coaching
>   validados de ponta a ponta em viewport de celular.
>
> **Salvamento entre dispositivos:** o progresso (erros + repetição espaçada) é
> gravado no **Supabase por usuário** (tabela `chess_cards`, RLS), então o
> `/chess` exige login (o mesmo do app) e sincroniza celular↔computador. Para ter
> a URL pública e o login funcionando é preciso um deploy único na Vercel +
> configurar o Supabase — passo a passo em [`chess-deploy.md`](chess-deploy.md)
> e SQL em [`../supabase/chess_cards.sql`](../supabase/chess_cards.sql).

## Princípio central

Quase nada de xadrez open source é um serviço na nuvem para "puxar por API": os
motores (Stockfish, Leela, Maia) são binários/WASM que você **embute e roda**
(custo por uso ≈ zero). A única API paga de verdade é o **LLM** que narra o
"porquê". Logo: **puxar as peças caras prontas, construir só a camada de ensino
por cima.** Reconstruir um motor seria desperdício — Stockfish/Leela já são
estado da arte e gratuitos.

## As camadas (o que puxar vs. o que construir)

| Camada | O que faz | Puxar ou construir |
|---|---|---|
| Motor de avaliação | "esse lance é bom/ruim?" | Puxar: Stockfish (binário ou WASM) |
| Verdade dos finais | avaliação *perfeita* até 7 peças | Puxar: tablebase do Lichess (API grátis) |
| Adversário realista | erra como humano do seu nível | Puxar: Maia (via lc0); no MVP, Stockfish enfraquecido |
| Regras / lances / PGN | mecânica do jogo | Puxar: `python-chess` (ou `chess.js`) |
| Currículo | ordem de aprendizado por nível | **Construir** |
| Narração pedagógica | traduzir o "porquê" em PT simples | **Construir** (API do Claude) |
| Repetição espaçada | reagendar *seus* erros recorrentes | **Construir** (algoritmo tipo SM-2) |

Só as três últimas linhas são trabalho real de construção — e são as que não
existem prontas. É aí que está o valor.

## A espinha: análise das próprias partidas

Como o alvo é "aprender tudo", a máquina não pode partir de um currículo fixo —
ela precisa **descobrir** onde o usuário erra. A evidência (estudo de 2014,
*Psychology of Sport and Exercise*) aponta que a combinação mais eficaz é
**praticar + treinar + analisar os próprios jogos**. Então o fluxo é adaptativo:
o usuário joga → Stockfish marca os erros → um "maestro" detecta o padrão dos
erros (tática? estrutura? abertura?) → decide o que ensinar em seguida.

## Currículo do jogo inteiro (por peso de impacto)

Ordem baseada em pesquisa de reconhecimento de padrões (de Groot; Chase & Simon:
mestres *reconhecem* padrões, não calculam mais).

| Fase | Peso | Como a máquina cobre |
|---|---|---|
| Táticas / padrões | maior retorno, sobretudo no início | Drills + repetição espaçada; base pública de puzzles do Lichess |
| Próprias partidas | espinha adaptativa | Stockfish marca erros; Claude explica o porquê |
| Meio-jogo / estratégia | alto | Estruturas de peões e planos, tirados dos erros recorrentes |
| Aberturas | médio (sem decorar) | Explorer do Lichess por estatística real |
| Finais | fundamental, focado | Módulo Silman + tablebase (verdade perfeita) |

## Base científica

- **Prática deliberada** (Ericsson): foco nas fraquezas específicas, feedback
  imediato e específico — não jogar mais partidas aleatórias.
- **Repetição espaçada** (curva de Ebbinghaus): ótima para táticas e padrões
  (conhecimento discreto); fraca para estratégia abstrata — aplicar só onde cabe.
- **Reconhecimento de padrões / chunking** (de Groot; Chase & Simon): treinar
  por padrões táticos e estruturas recorrentes, não por memorização de linhas.
- **Feedback narrativo > número cru**: avaliação em centipawns sem explicação
  ensina pouco; o valor está em traduzir o "porquê" em linguagem.

## Sobre o livro

Há duas obras chamadas "Endgame". A que Kasparov resenhou é a **biografia de
Bobby Fischer (Frank Brady)** — inspiração/contexto, não manual técnico. Para
estudo de finais do zero, o ponto de partida escolhido é **Silman's Complete
Endgame Course** (organizado por faixa de rating, não exige base prévia);
*Fundamental Chess Endings* (Müller/Lamprecht) fica como referência técnica
posterior. Finais são **um módulo**, não a espinha.

## O que já existe (não reinventar)

- **Lichess** (grátis, open source): Stockfish embutido, táticas adaptativas,
  explorer de aberturas, studies, análise pós-jogo.
- **Maia** (Microsoft Research / CMU): IA que joga *como humano* de um nível
  (1100–1900 Elo); prevê o lance humano até ~53% das vezes. Melhor sparring que
  um motor sobre-humano.
- **ChessTempo / Chessable**: repetição espaçada real (tipo SM-2).
- **Decodechess**: narra o porquê de um lance em palavras.
- **Stappenmethode (Chess Steps)**: currículo estruturado com base pedagógica.

Nenhum junta tudo (motor + sparring humano-símile + narrativa + repetição
espaçada + currículo adaptativo) para *um* aluno. É o nicho a construir.

## MVP (menor primeira versão que já ensina)

1. Posição/partida do currículo; Maia (ou Stockfish fraco) responde como humano.
2. A cada lance, Stockfish (ou tablebase, nos finais) diz se manteve o resultado.
3. Ao errar, Claude explica em uma frase qual conceito foi violado.
4. O erro entra numa fila de repetição espaçada e volta em dias.
5. O "maestro" olha o histórico e escolhe o foco da próxima sessão.

Esboço inicial = ~um fim de semana, porque as peças caras já vêm prontas.

## Decisão em aberto: web vs. local

- **Web** (tudo no navegador, Stockfish em WASM): usa em qualquer lugar, não
  instala nada; rodar a Maia no browser é mais chato.
- **Local (Python + `python-chess` + lc0/Maia)**: mais simples de programar, Maia
  roda trivialmente; é ferramenta de desktop/terminal.

**Recomendação:** começar **local em Python** (caminho mais curto até algo que
funciona; Maia sem dor). Migrar para web depois, se valer a pena.
